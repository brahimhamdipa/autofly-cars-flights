import { useEffect, useMemo, useState } from 'react'
import { fetchAll } from '../../lib/admin'
import { money } from '../../lib/storeData'
import { supabase } from '../../lib/supabaseClient'
import { ean13CheckDigit, isValidEan13, generateEan13, inferBarcodeFormat, barcodeSvg } from '../../lib/barcode'

// Barcode Generator: make scannable barcodes for shop items and stick
// them on the items that are missing one.
//
// Generated barcodes live ONLY on this page until they are assigned —
// nothing is written to the database by generating. Assigning writes
// one field, "barCode", on one store_items row (the column name is
// mixed case, so it is always written as { barCode: value }).
//
// Format: the shop's existing barcodes decide the format. If they are
// EAN-13, new ones are EAN-13 too. If they are something else — or
// there are no barcodes yet — new ones are still EAN-13: the shop's
// barcode search matches the value either way, and the phone scanner
// reads EAN-13. Every generated code is checked with isValidEan13
// (and its check digit cross-checked with ean13CheckDigit) before it
// is shown, and is unique against every barcode already on an item
// and every other code in the batch.
//
// One bad fetch can never blank the page: zero items, zero barcodes
// or a failed load all show their empty/error state and the generate
// buttons keep working on the EAN-13 default.

const MAX_BATCH = 50

export default function AdminBarcodeGenerator() {
  const [items, setItems] = useState(null)
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('')

  // Generated-but-unassigned barcodes, newest first. Never stored.
  const [generated, setGenerated] = useState([])
  const [batchCount, setBatchCount] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [copiedCode, setCopiedCode] = useState('')

  // Assign state: which generated code is being pointed at which item.
  const [assignTarget, setAssignTarget] = useState({})
  const [assigning, setAssigning] = useState(false)
  // In-page overwrite confirmation (never window.confirm): the
  // { code, item } pair waiting for a yes.
  const [confirmOverwrite, setConfirmOverwrite] = useState(null)
  const [assignError, setAssignError] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    // Store names are a nicety, not a requirement: a failed providers
    // fetch just leaves the Store column blank.
    try {
      setProviders(await fetchAll('store_providers', 1000))
    } catch (e) {
      setProviders([])
    }
    try {
      setItems(await fetchAll('store_items', 1000))
    } catch (err) {
      // fetchAll orders by created_at; if that ever stops working for
      // this table, fall back to a plain id-ordered read before
      // giving up — the generator must keep working either way.
      try {
        const { data, error } = await supabase.from('store_items').select('*').order('id', { ascending: false }).limit(1000)
        if (error) throw error
        setItems(data || [])
      } catch (fallbackErr) {
        setItems([])
        setLoadError('Could not load the items (' + (fallbackErr.message || err.message) + ') — the generator below still works, and assigning will be offered again after a refresh.')
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const providerName = useMemo(() => {
    const map = {}
    for (const p of providers || []) map[p.id] = p.name || ''
    return map
  }, [providers])

  const itemList = items || []

  // The format the shop already uses, from its existing barcodes.
  const formatInfo = useMemo(() => {
    const codes = itemList.map(r => (r.barCode || '').trim()).filter(Boolean)
    if (codes.length === 0) return { kind: 'none', codes: [] }
    try {
      const info = inferBarcodeFormat(codes) || {}
      return { kind: info.kind || 'unknown', label: info.label || info.kind || 'unknown', codes }
    } catch (e) {
      return { kind: 'unknown', label: 'unknown', codes }
    }
  }, [itemList])

  const withBarcodes = useMemo(
    () => itemList.filter(r => (r.barCode || '').trim() !== ''),
    [itemList]
  )
  const missingBarcodes = useMemo(
    () => itemList.filter(r => (r.barCode || '').trim() === ''),
    [itemList]
  )

  // Every barcode already in use: on items, plus the ones already
  // generated on this page (a code is spent the moment it is shown).
  const takenCodes = useMemo(() => {
    const set = new Set()
    for (const r of itemList) {
      const c = (r.barCode || '').trim()
      if (c) set.add(c)
    }
    for (const g of generated) set.add(g.code)
    return set
  }, [itemList, generated])

  // One fresh, valid, never-seen code — or null if the generator
  // keeps colliding (effectively impossible for EAN-13, but the loop
  // is capped so a broken generator can never hang the page).
  const makeOneCode = (taken) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = ''
      try { code = String(generateEan13() || '').trim() } catch (e) { code = '' }
      if (!code || taken.has(code)) continue
      if (!isValidEan13(code)) continue
      // Cross-check the check digit: the last digit must be the one
      // ean13CheckDigit computes from the first twelve.
      try {
        if (String(ean13CheckDigit(code.slice(0, 12))) !== code.slice(12)) continue
      } catch (e) { /* isValidEan13 already passed; keep the code */ }
      return code
    }
    return null
  }

  const generateCodes = (count) => {
    const n = Math.max(1, Math.min(MAX_BATCH, Number(count) || 1))
    setGenerating(true)
    setStatus('')
    const taken = new Set(takenCodes)
    const fresh = []
    for (let i = 0; i < n; i++) {
      const code = makeOneCode(taken)
      if (!code) break
      taken.add(code)
      fresh.push({ code, at: Date.now() + i })
    }
    if (fresh.length === 0) {
      setStatus('Could not generate a barcode — please try again.')
    } else {
      // Newest first.
      setGenerated(prev => [...fresh.reverse(), ...prev])
      setStatus(`✓ Generated ${fresh.length} barcode${fresh.length === 1 ? '' : 's'}${fresh.length < n ? ` — ${n - fresh.length} could not be made, try again for the rest` : ''}. Nothing is saved yet: assign one to an item, or copy / download it.`)
    }
    setGenerating(false)
  }

  const copyCode = async (code) => {
    const done = () => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(current => (current === code ? '' : current)), 2000)
    }
    try {
      await navigator.clipboard.writeText(code)
      done()
    } catch (e) {
      // Clipboard API unavailable (older browser / no permission):
      // fall back to a selected textarea.
      try {
        const ta = document.createElement('textarea')
        ta.value = code
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        done()
      } catch (fallbackErr) {
        setStatus('Could not copy — select the number under the barcode and copy it by hand.')
      }
    }
  }

  const downloadSvg = (code) => {
    try {
      const svg = barcodeSvg(code)
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'barcode-' + code + '.svg'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setStatus('Could not download the barcode: ' + e.message)
    }
  }

  const printSheet = () => {
    if (generated.length === 0) return
    let win = null
    try {
      win = window.open('', '_blank')
    } catch (e) { win = null }
    if (!win) {
      setStatus('The print sheet was blocked — allow pop-ups for this page and try again.')
      return
    }
    const cards = generated.map(g => {
      let svg = ''
      try { svg = barcodeSvg(g.code) } catch (e) { svg = '' }
      return '<div style="border:1px solid #999;padding:24px;margin:0 0 24px;text-align:center;page-break-inside:avoid;">' + svg + '<div style="font-size:28px;letter-spacing:4px;margin-top:12px;">' + g.code + '</div></div>'
    }).join('')
    win.document.write('<!doctype html><html><head><title>Barcodes</title><style>body{font-family:sans-serif;padding:24px} svg{max-width:100%;height:auto}</style></head><body><h1>Barcodes</h1>' + cards + '</body></html>')
    win.document.close()
    win.focus()
    win.print()
  }

  // Write one barcode onto one item. The item already having a
  // barcode goes through the in-page confirmation first (see
  // requestAssign); this function only runs once that is settled.
  const doAssign = async (code, item) => {
    setAssigning(true)
    setAssignError('')
    setStatus('')
    try {
      const { error } = await supabase.from('store_items').update({ barCode: code }).eq('id', item.id)
      if (error) { setAssignError('Cannot assign: ' + error.message); return }
      setItems(prev => (prev || []).map(r => (r.id === item.id ? { ...r, barCode: code } : r)))
      setGenerated(prev => prev.filter(g => g.code !== code))
      setAssignTarget(prev => {
        const next = { ...prev }
        delete next[code]
        return next
      })
      setConfirmOverwrite(null)
      setStatus(`✓ Assigned to ${item.name || ('item #' + item.id)} — it now shows in “Items with barcodes” below.`)
    } catch (err) {
      setAssignError('Cannot assign: ' + err.message)
    } finally {
      setAssigning(false)
    }
  }

  const requestAssign = (code) => {
    const itemId = assignTarget[code]
    if (!itemId) { setAssignError('Pick an item first.'); return }
    const item = itemList.find(r => String(r.id) === String(itemId))
    if (!item) { setAssignError('That item is no longer in the list — refresh and try again.'); return }
    setAssignError('')
    const old = (item.barCode || '').trim()
    if (old) {
      // Overwriting an existing barcode: ask in-page, never
      // window.confirm. The old barcode is shown so the choice is
      // an informed one.
      setConfirmOverwrite({ code, item })
      return
    }
    doAssign(code, item)
  }

  // One-step: make a fresh barcode and put it straight on an item
  // that has none. Used by the "missing a barcode" table.
  const generateAndAssign = async (item) => {
    if ((item.barCode || '').trim() !== '') return
    setAssigning(true)
    setAssignError('')
    setStatus('')
    const code = makeOneCode(takenCodes)
    if (!code) {
      setAssignError('Could not generate a barcode — please try again.')
      setAssigning(false)
      return
    }
    await doAssign(code, item)
  }

  if (loading) return <div className="hero-card"><p>Loading items…</p></div>

  const formatNote = formatInfo.kind === 'ean13'
    ? 'Your items use EAN-13 barcodes — new ones will match.'
    : formatInfo.kind === 'none'
      ? 'No barcodes on your items yet — new ones will be EAN-13.'
      : `Your items use ${formatInfo.label} barcodes — new ones will still be EAN-13. The shop's barcode search matches the value either way, and the phone scanner reads EAN-13.`

  return (
    <div>
      <div className="hero-card">
        <h2>🏷️ Barcode Generator</h2>
        <p>Make scannable barcodes for shop items and put them on the items that are missing one. {formatNote}</p>
        <p className="hint">{itemList.length === 0 ? 'No items loaded yet.' : `${withBarcodes.length} item${withBarcodes.length === 1 ? '' : 's'} with a barcode · ${missingBarcodes.length} still missing one.`} Generated barcodes are not saved anywhere until you assign one to an item.</p>
      </div>

      {status && <p className="status">{status}</p>}
      {loadError && <p className="status">{loadError}</p>}

      {confirmOverwrite && (
        <div className="form-card">
          <h3>Replace this item's barcode?</h3>
          <p>“{confirmOverwrite.item.name || ('Item #' + confirmOverwrite.item.id)}” already has barcode {confirmOverwrite.item.barCode}. Assigning {confirmOverwrite.code} will replace it — the old barcode will stop matching in barcode search.</p>
          <div className="store-actions">
            <button type="button" className="btn-primary" onClick={() => doAssign(confirmOverwrite.code, confirmOverwrite.item)} disabled={assigning}>Replace barcode</button>
            <button type="button" className="btn-soft" onClick={() => setConfirmOverwrite(null)}>Cancel</button>
          </div>
          {assignError && <p className="hint">{assignError}</p>}
        </div>
      )}

      <div className="form-card">
        <h3>Generate barcodes</h3>
        <p className="hint">Every code is checked before it is shown, and is unique against all barcodes already on items and all barcodes already generated on this page.</p>
        <div className="store-actions">
          <button type="button" className="btn-primary" onClick={() => generateCodes(1)} disabled={generating}>Generate one barcode</button>
          <button type="button" className="btn-soft" onClick={load} disabled={loading}>↻ Refresh items</button>
        </div>
        <div className="row">
          <input type="number" min="1" max={MAX_BATCH} step="1" value={batchCount} onChange={e => setBatchCount(e.target.value)} aria-label="How many barcodes to generate" />
          <button type="button" className="btn-primary" onClick={() => generateCodes(batchCount)} disabled={generating}>Generate {Math.max(1, Math.min(MAX_BATCH, Number(batchCount) || 1))} barcodes</button>
        </div>
        <p className="hint">Batch size is 1–50 at a time.</p>
      </div>

      {generated.length > 0 && (
        <div>
          <div className="store-actions">
            <h3>Generated barcodes ({generated.length})</h3>
            <button type="button" className="btn-soft" onClick={printSheet}>🖨️ Print sheet</button>
            <button type="button" className="btn-soft" onClick={() => { setGenerated([]); setAssignTarget({}); setConfirmOverwrite(null); setStatus('') }}>Clear list</button>
          </div>
          <p className="hint">Newest first. These are not saved — assign one to an item, or copy / download it, before clearing the list.</p>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Barcode</th><th>Value</th><th>Assign to an item</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {generated.map(g => (
                  <tr key={g.code}>
                    <td>
                      <div dangerouslySetInnerHTML={{ __html: barcodeSvg(g.code) }} />
                    </td>
                    <td><b>{g.code}</b></td>
                    <td>
                      <select value={assignTarget[g.code] || ''} onChange={e => setAssignTarget(prev => ({ ...prev, [g.code]: e.target.value }))} aria-label={'Assign barcode ' + g.code + ' to an item'}>
                        <option value="">Pick an item…</option>
                        <optgroup label="Items without a barcode">
                          {missingBarcodes.map(r => <option key={r.id} value={r.id}>{r.name || ('Item #' + r.id)}</option>)}
                        </optgroup>
                        {withBarcodes.length > 0 && (
                          <optgroup label="Items that already have one">
                            {withBarcodes.map(r => <option key={r.id} value={r.id}>{r.name || ('Item #' + r.id)} — has {r.barCode}</option>)}
                          </optgroup>
                        )}
                      </select>{' '}
                      <button type="button" className="btn-mini" onClick={() => requestAssign(g.code)} disabled={assigning || !assignTarget[g.code]}>Assign</button>
                    </td>
                    <td>
                      <button type="button" className="btn-mini" onClick={() => copyCode(g.code)}>{copiedCode === g.code ? '✓ Copied' : 'Copy value'}</button>{' '}
                      <button type="button" className="btn-mini" onClick={() => downloadSvg(g.code)}>Download SVG</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {assignError && <p className="hint">{assignError}</p>}
        </div>
      )}

      <h3>Items with barcodes ({withBarcodes.length})</h3>
      {itemList.length === 0 && <p className="hint">No items yet — add items in the Shop first, then come back here to give them barcodes.</p>}
      {itemList.length > 0 && withBarcodes.length === 0 && <p className="hint">No item has a barcode yet — generate one above and assign it.</p>}
      {withBarcodes.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Item</th><th>Store</th><th>Price</th><th>Barcode</th></tr>
            </thead>
            <tbody>
              {withBarcodes.map(r => (
                <tr key={r.id}>
                  <td>{r.name || ('Item #' + r.id)}</td>
                  <td>{providerName[r.provider_id] || '—'}</td>
                  <td>{r.price !== undefined && r.price !== null && r.price !== '' ? money(Number(r.price) || 0) : '—'}</td>
                  <td>{r.barCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Items still missing a barcode ({missingBarcodes.length})</h3>
      {itemList.length === 0 && <p className="hint">No items yet.</p>}
      {itemList.length > 0 && missingBarcodes.length === 0 && <p className="hint">Every item has a barcode ✓</p>}
      {missingBarcodes.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Item</th><th>Store</th><th>Price</th><th></th></tr>
            </thead>
            <tbody>
              {missingBarcodes.map(r => (
                <tr key={r.id}>
                  <td>{r.name || ('Item #' + r.id)}</td>
                  <td>{providerName[r.provider_id] || '—'}</td>
                  <td>{r.price !== undefined && r.price !== null && r.price !== '' ? money(Number(r.price) || 0) : '—'}</td>
                  <td>
                    <button type="button" className="btn-mini" onClick={() => generateAndAssign(r)} disabled={assigning}>Generate &amp; assign</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
