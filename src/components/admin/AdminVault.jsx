import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fmtDate } from '../../lib/admin'

// Admin → menu 6 (My Vault).
//
// The owner's private page for running the Yently LLC: important
// documents, dates and reminders (things to pay) and his list of
// providers. It never appears on the public site, and nothing here
// is reachable without the Admin owner login — the tables and the
// storage bucket all have owner-only policies (authenticated +
// brahimhamdipa@gmail.com, no anon access).
//
// RULE: no passwords, secrets or credentials are ever stored here —
// documents, dates and provider contacts only. Passwords belong in
// a password manager, not in the Vault.
//
// DOCUMENTS — files live in the PRIVATE Supabase Storage bucket
// 'vault-documents' (public = false). Downloads go through a
// 1-hour signed URL created with the owner's session, never a
// public URL.
// REMINDERS & BILLS — vault_reminders: title, due date, amount,
// kind (bill / reminder / date), notes, done. Undone first, sorted
// by due date; overdue rows are red, due within 7 days are gold.
// PROVIDERS — vault_providers: name, service, contact, email,
// phone, website, notes.

const BUCKET = 'vault-documents'

const KIND_OPTIONS = [
  { value: 'bill', label: 'Bill to pay' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'date', label: 'Important date' },
]

const EMPTY_REMINDER = { title: '', kind: 'bill', due_date: '', amount: '', notes: '' }
const EMPTY_PROVIDER = { name: '', service: '', contact_name: '', email: '', phone: '', website: '', notes: '' }

function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function fmtSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtAmount(v) {
  if (v == null || v === '') return ''
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Stored file names are "<timestamp>_<n>_<original>"; show the original.
function displayName(stored) {
  const parts = String(stored).split('_')
  return parts.length > 2 ? parts.slice(2).join('_') : stored
}

function sanitizeName(name) {
  return String(name).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+/, '') || 'file'
}

function sortReminders(rows) {
  const withDue = (r) => r.due_date || '9999-12-31'
  return [...rows].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1
    return withDue(a).localeCompare(withDue(b))
  })
}

export default function AdminVault() {
  const [view, setView] = useState('documents')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // Documents
  const [docs, setDocs] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [confirmDoc, setConfirmDoc] = useState(null)
  const [busyDoc, setBusyDoc] = useState(null)

  // Reminders
  const [reminders, setReminders] = useState(null)
  const [remForm, setRemForm] = useState(EMPTY_REMINDER)
  const [editingRem, setEditingRem] = useState(null)
  const [confirmRemDel, setConfirmRemDel] = useState(null)

  // Providers
  const [providers, setProviders] = useState(null)
  const [provForm, setProvForm] = useState(EMPTY_PROVIDER)
  const [editingProv, setEditingProv] = useState(null)
  const [confirmProvDel, setConfirmProvDel] = useState(null)

  const loadDocs = async () => {
    try {
      const { data, error: err } = await supabase.storage.from(BUCKET)
        .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
      if (err) throw err
      setDocs(data || [])
    } catch (e) { setError(e.message); setDocs([]) }
  }
  const loadReminders = async () => {
    try {
      const { data, error: err } = await supabase.from('vault_reminders').select('*')
      if (err) throw err
      setReminders(sortReminders(data || []))
    } catch (e) { setError(e.message); setReminders([]) }
  }
  const loadProviders = async () => {
    try {
      const { data, error: err } = await supabase.from('vault_providers').select('*').order('name', { ascending: true })
      if (err) throw err
      setProviders(data || [])
    } catch (e) { setError(e.message); setProviders([]) }
  }
  useEffect(() => { loadDocs(); loadReminders(); loadProviders() }, [])

  // ----- Documents -----

  const uploadDocs = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setError('')
    setUploading(true)
    setStatus(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`)
    const stamp = Date.now()
    let ok = 0
    let firstErr = ''
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const path = `${stamp}_${i}_${sanitizeName(f.name)}`
      const { error: err } = await supabase.storage.from(BUCKET).upload(path, f, { upsert: false })
      if (err) { if (!firstErr) firstErr = err.message; continue }
      ok++
    }
    e.target.value = ''
    setUploading(false)
    if (ok === files.length) setStatus(`✓ ${ok} file${ok > 1 ? 's' : ''} uploaded to the Vault.`)
    else {
      setStatus(ok > 0 ? `✓ ${ok} of ${files.length} files uploaded.` : '')
      setError(`Upload error: ${firstErr}`)
    }
    loadDocs()
  }

  const downloadDoc = async (doc) => {
    setError('')
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(doc.name, 3600)
    if (err) { setError(err.message); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const deleteDoc = async (doc) => {
    if (confirmDoc !== doc.name) { setConfirmDoc(doc.name); return }
    setConfirmDoc(null)
    setBusyDoc(doc.name)
    setError('')
    const { error: err } = await supabase.storage.from(BUCKET).remove([doc.name])
    setBusyDoc(null)
    if (err) { setError(err.message); return }
    setStatus(`✓ Deleted ${displayName(doc.name)} from the Vault.`)
    loadDocs()
  }

  // ----- Reminders -----

  const saveReminder = async (e) => {
    e.preventDefault()
    setError('')
    const row = {
      title: remForm.title.trim(),
      kind: remForm.kind,
      due_date: remForm.due_date || null,
      amount: remForm.amount === '' ? null : Number(remForm.amount),
      notes: remForm.notes.trim(),
    }
    let err = null
    if (editingRem) {
      ;({ error: err } = await supabase.from('vault_reminders').update(row).eq('id', editingRem))
    } else {
      ;({ error: err } = await supabase.from('vault_reminders').insert(row))
    }
    if (err) { setError(err.message); return }
    setStatus(editingRem ? '✓ Reminder updated.' : '✓ Reminder added.')
    setRemForm(EMPTY_REMINDER)
    setEditingRem(null)
    loadReminders()
  }

  const editReminder = (r) => {
    setEditingRem(r.id)
    setRemForm({
      title: r.title || '',
      kind: r.kind || 'reminder',
      due_date: r.due_date || '',
      amount: r.amount == null ? '' : String(r.amount),
      notes: r.notes || '',
    })
    setConfirmRemDel(null)
  }

  const deleteReminder = async (r) => {
    if (confirmRemDel !== r.id) { setConfirmRemDel(r.id); return }
    setConfirmRemDel(null)
    setError('')
    const { error: err } = await supabase.from('vault_reminders').delete().eq('id', r.id)
    if (err) { setError(err.message); return }
    if (editingRem === r.id) { setEditingRem(null); setRemForm(EMPTY_REMINDER) }
    setStatus(`✓ Deleted “${r.title}”.`)
    loadReminders()
  }

  const toggleDone = async (r) => {
    setError('')
    const { error: err } = await supabase.from('vault_reminders').update({ done: !r.done }).eq('id', r.id)
    if (err) { setError(err.message); return }
    setStatus(r.done ? `✓ “${r.title}” reopened.` : `✓ “${r.title}” marked done.`)
    loadReminders()
  }

  // ----- Providers -----

  const saveProvider = async (e) => {
    e.preventDefault()
    setError('')
    const row = {
      name: provForm.name.trim(),
      service: provForm.service.trim(),
      contact_name: provForm.contact_name.trim(),
      email: provForm.email.trim(),
      phone: provForm.phone.trim(),
      website: provForm.website.trim(),
      notes: provForm.notes.trim(),
    }
    let err = null
    if (editingProv) {
      ;({ error: err } = await supabase.from('vault_providers').update(row).eq('id', editingProv))
    } else {
      ;({ error: err } = await supabase.from('vault_providers').insert(row))
    }
    if (err) { setError(err.message); return }
    setStatus(editingProv ? '✓ Provider updated.' : '✓ Provider added.')
    setProvForm(EMPTY_PROVIDER)
    setEditingProv(null)
    loadProviders()
  }

  const editProvider = (p) => {
    setEditingProv(p.id)
    setProvForm({
      name: p.name || '',
      service: p.service || '',
      contact_name: p.contact_name || '',
      email: p.email || '',
      phone: p.phone || '',
      website: p.website || '',
      notes: p.notes || '',
    })
    setConfirmProvDel(null)
  }

  const deleteProvider = async (p) => {
    if (confirmProvDel !== p.id) { setConfirmProvDel(p.id); return }
    setConfirmProvDel(null)
    setError('')
    const { error: err } = await supabase.from('vault_providers').delete().eq('id', p.id)
    if (err) { setError(err.message); return }
    if (editingProv === p.id) { setEditingProv(null); setProvForm(EMPTY_PROVIDER) }
    setStatus(`✓ Deleted provider ${p.name}.`)
    loadProviders()
  }

  const today = todayStr()
  const dueSoonCutoff = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })()
  const openReminders = (reminders || []).filter(r => !r.done)
  const overdueCount = openReminders.filter(r => r.due_date && r.due_date < today).length
  const dueSoonCount = openReminders.filter(r => r.due_date && r.due_date >= today && r.due_date <= dueSoonCutoff).length

  const dueTag = (r) => {
    if (r.done || !r.due_date) return null
    if (r.due_date < today) return { text: 'Overdue', color: '#dc2626' }
    if (r.due_date <= dueSoonCutoff) return { text: 'Due soon', color: '#b45309' }
    return null
  }

  return (
    <div>
      <div className="hero-card">
        <h2>🔐 My Vault</h2>
        <p>Your private place for running Yently — important documents, dates and reminders (things to pay), and your providers. Only you can open this page: it is behind your Admin login, and the database only lets your account read or change anything here.</p>
        <p className="hint">Never store passwords or secret codes here — documents, dates and provider contacts only. Passwords belong in a password manager.</p>
      </div>

      <div className="trip-tabs" style={{ marginBottom: 16 }}>
        <button type="button" className={view === 'documents' ? 'active' : ''} onClick={() => setView('documents')}>Documents</button>
        <button type="button" className={view === 'reminders' ? 'active' : ''} onClick={() => setView('reminders')}>
          Reminders &amp; bills {overdueCount > 0 ? `(${overdueCount} overdue)` : dueSoonCount > 0 ? `(${dueSoonCount} due soon)` : ''}
        </button>
        <button type="button" className={view === 'providers' ? 'active' : ''} onClick={() => setView('providers')}>Providers</button>
      </div>

      {status && <p className="status">{status}</p>}
      {error && <p className="status">Error: {error}</p>}

      {view === 'documents' && (
        <div>
          <p className="hint">Files are stored in a private bucket — they are never on a public link. Downloads open through a signed link that works for one hour.</p>
          <div className="form-card wide">
            <h3>Upload documents</h3>
            <input type="file" multiple disabled={uploading} onChange={uploadDocs} />
            <p className="hint">You can pick several files at once. A file with the same name as one already here is kept as a separate copy.</p>
          </div>
          {docs === null && <div className="hero-card"><p>Loading documents...</p></div>}
          {docs !== null && docs.length === 0 && <p className="hint">No documents in the Vault yet — upload your first one above.</p>}
          {docs !== null && docs.length > 0 && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>File</th><th>Size</th><th>Uploaded</th><th className="no-print"></th></tr>
                </thead>
                <tbody>
                  {docs.map(d => (
                    <tr key={d.id || d.name}>
                      <td>{displayName(d.name)}</td>
                      <td>{fmtSize(d.metadata && d.metadata.size)}</td>
                      <td>{fmtDate(d.created_at)}</td>
                      <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn-mini" onClick={() => downloadDoc(d)}>Download</button>{' '}
                        <button
                          type="button"
                          className="btn-mini btn-danger"
                          disabled={busyDoc === d.name}
                          onClick={() => deleteDoc(d)}
                        >{confirmDoc === d.name ? 'Tap again to confirm' : 'Delete'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'reminders' && (
        <div>
          <form className="form-card wide" onSubmit={saveReminder}>
            <h3>{editingRem ? 'Edit reminder' : 'Add a reminder or bill'}</h3>
            <div className="row">
              <input required placeholder="Title — e.g. LLC annual fee" value={remForm.title} onChange={e => setRemForm({ ...remForm, title: e.target.value })} />
              <select value={remForm.kind} onChange={e => setRemForm({ ...remForm, kind: e.target.value })}>
                {KIND_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div className="row">
              <label style={{ flex: 1 }}>Due date
                <input type="date" value={remForm.due_date} onChange={e => setRemForm({ ...remForm, due_date: e.target.value })} />
              </label>
              <label style={{ flex: 1 }}>Amount ($)
                <input type="number" step="0.01" min="0" placeholder="0.00" value={remForm.amount} onChange={e => setRemForm({ ...remForm, amount: e.target.value })} />
              </label>
            </div>
            <textarea placeholder="Notes (optional)" rows={2} value={remForm.notes} onChange={e => setRemForm({ ...remForm, notes: e.target.value })} />
            <div className="row">
              <button type="submit">{editingRem ? 'Save changes' : 'Add reminder'}</button>
              {editingRem && (
                <button type="button" className="secondary" onClick={() => { setEditingRem(null); setRemForm(EMPTY_REMINDER) }}>Cancel edit</button>
              )}
            </div>
          </form>

          {reminders === null && <div className="hero-card"><p>Loading reminders...</p></div>}
          {reminders !== null && reminders.length === 0 && <p className="hint">Nothing on your list yet — add your first reminder or bill above.</p>}
          {reminders !== null && reminders.length > 0 && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th></th><th>Title</th><th>Kind</th><th>Due</th><th>Amount</th><th>Notes</th><th className="no-print"></th></tr>
                </thead>
                <tbody>
                  {reminders.map(r => {
                    const tag = dueTag(r)
                    return (
                      <tr key={r.id} style={tag ? { background: tag.text === 'Overdue' ? '#fef2f2' : '#fffbeb' } : undefined}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!r.done}
                            onChange={() => toggleDone(r)}
                            aria-label={r.done ? 'Mark as not done' : 'Mark as done'}
                          />
                        </td>
                        <td style={r.done ? { textDecoration: 'line-through', color: '#6b7280' } : undefined}>
                          {r.title}
                          {tag && <span style={{ color: tag.color, fontWeight: 700 }}> — {tag.text}</span>}
                        </td>
                        <td>{(KIND_OPTIONS.find(k => k.value === r.kind) || {}).label || r.kind}</td>
                        <td>{r.due_date || ''}</td>
                        <td>{fmtAmount(r.amount)}</td>
                        <td>{r.notes || ''}</td>
                        <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                          <button type="button" className="btn-mini" onClick={() => editReminder(r)}>Edit</button>{' '}
                          <button type="button" className="btn-mini btn-danger" onClick={() => deleteReminder(r)}>
                            {confirmRemDel === r.id ? 'Tap again to confirm' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'providers' && (
        <div>
          <form className="form-card wide" onSubmit={saveProvider}>
            <h3>{editingProv ? 'Edit provider' : 'Add a provider'}</h3>
            <div className="row">
              <input required placeholder="Provider name — e.g. Fora Travel" value={provForm.name} onChange={e => setProvForm({ ...provForm, name: e.target.value })} />
              <input placeholder="Service — e.g. Travel host / IATA" value={provForm.service} onChange={e => setProvForm({ ...provForm, service: e.target.value })} />
            </div>
            <div className="row">
              <input placeholder="Contact person" value={provForm.contact_name} onChange={e => setProvForm({ ...provForm, contact_name: e.target.value })} />
              <input type="email" placeholder="Email" value={provForm.email} onChange={e => setProvForm({ ...provForm, email: e.target.value })} />
            </div>
            <div className="row">
              <input type="tel" placeholder="Phone" value={provForm.phone} onChange={e => setProvForm({ ...provForm, phone: e.target.value })} />
              <input type="url" placeholder="Website" value={provForm.website} onChange={e => setProvForm({ ...provForm, website: e.target.value })} />
            </div>
            <textarea placeholder="Notes (optional)" rows={2} value={provForm.notes} onChange={e => setProvForm({ ...provForm, notes: e.target.value })} />
            <div className="row">
              <button type="submit">{editingProv ? 'Save changes' : 'Add provider'}</button>
              {editingProv && (
                <button type="button" className="secondary" onClick={() => { setEditingProv(null); setProvForm(EMPTY_PROVIDER) }}>Cancel edit</button>
              )}
            </div>
          </form>

          {providers === null && <div className="hero-card"><p>Loading providers...</p></div>}
          {providers !== null && providers.length === 0 && <p className="hint">No providers listed yet — add your first one above.</p>}
          {providers !== null && providers.length > 0 && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Provider</th><th>Service</th><th>Contact</th><th>Email</th><th>Phone</th><th>Website</th><th>Notes</th><th className="no-print"></th></tr>
                </thead>
                <tbody>
                  {providers.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.service || ''}</td>
                      <td>{p.contact_name || ''}</td>
                      <td>{p.email || ''}</td>
                      <td>{p.phone || ''}</td>
                      <td>{p.website ? <a href={p.website} target="_blank" rel="noreferrer">{p.website}</a> : ''}</td>
                      <td>{p.notes || ''}</td>
                      <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn-mini" onClick={() => editProvider(p)}>Edit</button>{' '}
                        <button type="button" className="btn-mini btn-danger" onClick={() => deleteProvider(p)}>
                          {confirmProvDel === p.id ? 'Tap again to confirm' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
