import { useEffect, useMemo, useRef, useState } from 'react'

import { Lightbox } from './CarSection'

// Stock line, exactly like the Online Store page: green when in stock,
// red when out of stock, nothing at all when stock is not tracked
// (null — e.g. services).
export function StockLine({ stock }) {
  if (stock === null || stock === undefined) return null
  if (stock <= 0) return <p className="stock out">Out of stock</p>
  if (stock <= 10) return <p className="stock low">Only {stock} left in stock</p>
  return <p className="stock ok">{stock} available in stock</p>
}

// Card picture slideshow, exactly like the Physical Stores cards:
// arrows + counter in the card, tap the picture for the fullscreen
// Lightbox (X top-right to close). Used by the Online Store and
// category cards (General Products, Lunches/Snacks, Meats, Clothes).
export function CardSlideshow({ images, name }) {
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const pics = images || []
  const n = pics.length
  return (
    <>
      <div className="slideshow">
        {n > 0 ? (
          <img src={pics[idx]} alt={name} onClick={() => setZoom(true)} title="Click to enlarge" />
        ) : (
          <div className="no-photo">No photos yet</div>
        )}
        {n > 1 && (
          <>
            <button className="slide-btn prev" onClick={() => setIdx(i => (i - 1 + n) % n)} aria-label="Previous photo">‹</button>
            <button className="slide-btn next" onClick={() => setIdx(i => (i + 1 + n) % n)} aria-label="Next photo">›</button>
            <span className="slide-count">{idx + 1} / {n}</span>
          </>
        )}
      </div>
      {zoom && n > 0 && <Lightbox images={pics} start={idx} onClose={() => setZoom(false)} />}
    </>
  )
}

// Variant dimensions, in the order they appear in the matrix. One
// subCategory row has one value per dimension; a dimension is shown
// only when at least one row has a value for it.
const VARIANT_DIMS = [
  { key: 'flavor', label: 'Flavor' },
  { key: 'color', label: 'Color' },
  { key: 'size', label: 'Size' },
  { key: 'packof', label: 'Pack' },
  { key: 'weight', label: 'Weight' },
]

// The value of one dimension in one subCategory row, as a string, or
// null when the row has none (a cap has no size, a juice no flavor).
// Pack is a number in the DB; weight pairs with its unit.
function dimValue(row, key) {
  if (key === 'packof') {
    if (row.packof === null || row.packof === undefined || row.packof === '') return null
    return String(row.packof)
  }
  if (key === 'weight') {
    if (row.weight === null || row.weight === undefined || row.weight === '') return null
    return String(row.weight) + (row.unit ? ' ' + row.unit : '')
  }
  const v = row[key]
  return v === null || v === undefined || v === '' ? null : String(v)
}

// Variant matrix: the customer picks ONE value per dimension (flavor,
// color, pack, ...) with check boxes, BEFORE adding to cart — the
// exact combination is the variant that goes in the cart. A value is
// DISABLED (greyed out, not clickable) when no row can combine it
// with the values already picked in the other dimensions, so the
// customer can never pick a combination that does not exist. Tapping
// a picked box again clears it. A dimension with only one possible
// value is picked for the customer (there is nothing to choose).
// onChange receives the matching subCategory row once every dimension
// has a pick, or null while the choice is incomplete.
export function VariantMatrix({ rows, onChange }) {
  const list = rows || []
  const rowsKey = list.map(r => r.id).join(',')
  const dims = useMemo(() => {
    return VARIANT_DIMS.map(d => {
      const values = [...new Set(list.map(r => dimValue(r, d.key)).filter(v => v !== null))]
      return { key: d.key, label: d.label, values }
    }).filter(d => d.values.length > 0)
    // The rows are identified by rowsKey; the values only change when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey])
  const [picks, setPicks] = useState({})
  // Start over when the rows change: dimensions with a single possible
  // value are picked automatically (nothing to choose).
  useEffect(() => {
    const start = {}
    for (const d of dims) if (d.values.length === 1) start[d.key] = d.values[0]
    setPicks(start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey])
  // A value is available when some row has it AND matches every pick
  // already made in the other dimensions.
  const isAvailable = (dimKey, value) => {
    return list.some(r => {
      if (dimValue(r, dimKey) !== value) return false
      return dims.every(d => {
        if (d.key === dimKey) return true
        const p = picks[d.key]
        return p === undefined || p === null || dimValue(r, d.key) === p
      })
    })
  }
  // The row matching every pick, once all dimensions have one.
  const complete = dims.length > 0 && dims.every(d => picks[d.key] !== undefined && picks[d.key] !== null)
  const matched = complete ? list.find(r => dims.every(d => dimValue(r, d.key) === picks[d.key])) || null : null
  useEffect(() => {
    if (onChange) onChange(matched)
    // onChange is the parent's setter; it does the same thing every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched])
  const toggle = (dimKey, value) => {
    setPicks(prev => {
      const next = { ...prev }
      if (next[dimKey] === value) delete next[dimKey]
      else next[dimKey] = value
      return next
    })
  }
  const missing = dims.filter(d => picks[d.key] === undefined || picks[d.key] === null).map(d => d.label.toLowerCase())
  if (list.length < 2) return null
  return (
    <div className="variant-matrix">
      {dims.map(d => (
        <div key={d.key} className="variant-dim">
          <span className="variant-dim-label">{d.label}</span>
          <div className="variant-options">
            {d.values.map(v => {
              const picked = picks[d.key] === v
              const disabled = !picked && !isAvailable(d.key, v)
              return (
                <label key={v} className={'variant-opt' + (picked ? ' picked' : '') + (disabled ? ' disabled' : '')}>
                  <input type="checkbox" checked={picked} disabled={disabled} onChange={() => toggle(d.key, v)} />
                  <span>{v}</span>
                </label>
              )
            })}
          </div>
        </div>
      ))}
      {missing.length > 0 && (
        <p className="hint">{'Pick a ' + missing.join(' and ') + ' above to add this to your cart.'}</p>
      )}
    </div>
  )
}

// Loads the vendored html5-qrcode library (the same file the POS
// register uses, served at /pos/html5-qrcode.min.js) once, then
// resolves with the Html5Qrcode constructor.
let scanLibPromise = null
function loadScanLib() {
  if (window.Html5Qrcode) return Promise.resolve(window.Html5Qrcode)
  if (scanLibPromise) return scanLibPromise
  scanLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = '/pos/html5-qrcode.min.js'
    s.onload = () => (window.Html5Qrcode ? resolve(window.Html5Qrcode) : reject(new Error('Scanner library did not load.')))
    s.onerror = () => reject(new Error('Could not load the barcode scanner.'))
    document.body.appendChild(s)
  })
  return scanLibPromise
}

// Barcode scanner: a "Scan barcode" button that opens the phone
// camera in a fullscreen overlay. Point it at a product barcode and
// onScan receives the code (the digits). Closing adds nothing. Uses
// the same html5-qrcode library as the POS register (rear camera).
export function BarcodeScanner({ onScan }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const scannerRef = useRef(null)
  const onScanRef = useRef(onScan)
  const idRef = useRef(null)
  if (!idRef.current) idRef.current = 'shop-scanner-' + Math.random().toString(36).slice(2, 8)

  useEffect(() => { onScanRef.current = onScan })

  const stop = () => {
    const s = scannerRef.current
    scannerRef.current = null
    if (s) {
      try { s.stop().then(() => { try { s.clear() } catch (e) {} }).catch(() => {}) } catch (e) {}
    }
  }
  const close = () => { stop(); setOpen(false); setStatus('') }

  useEffect(() => {
    if (!open) return undefined
    setStatus('Point your camera at a barcode…')
    let cancelled = false
    ;(async () => {
      try {
        const Html5Qrcode = await loadScanLib()
        if (cancelled) return
        const el = document.getElementById(idRef.current)
        if (!el) return
        const scanner = new Html5Qrcode(idRef.current)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (code) => {
            const c = String(code).trim()
            if (!c) return
            stop()
            setOpen(false)
            setStatus('')
            if (onScanRef.current) onScanRef.current(c)
          },
          () => { /* no code in the frame — normal, ignore */ }
        )
        if (cancelled) stop()
      } catch (e) {
        if (!cancelled) setStatus('Could not open the camera: ' + (e && e.message ? e.message : e) + ' — allow camera access and try again.')
      }
    })()
    return () => { cancelled = true; stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <button type="button" className="btn-soft" onClick={() => setOpen(true)}>📷 Scan barcode</button>
      {open && (
        <div className="scan-overlay" onClick={close}>
          <div className="scan-box" onClick={e => e.stopPropagation()}>
            <div id={idRef.current} className="scan-view" />
            <p className="hint">{status}</p>
            <button type="button" onClick={close}>Close scanner</button>
          </div>
        </div>
      )}
    </>
  )
}
