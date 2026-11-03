import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Admin "Folder Passes" section: one username + password per template
// folder (dine, houses, barbershop, doctor, employee, and every copy).
// The folder's Setup tab asks for that pass; while a folder has no pass,
// its Setup opens freely, as it does today. Passwords are stored readable
// here, the same as the employee passes — so keep them unique per folder
// and never reuse the admin password. A pass belongs to the folder's
// name: rename a folder and its pass must be set again under the new name.
//
// The Folder field is a search box and a list in one: type to filter the
// list of all folders, or pick one from it. The filter button narrows the
// list by TYPE — the original folder a page was copied from (dine,
// houses, barbershop, doctor, employee). A copy's type is worked out from
// its own content (its data.json shape), so copies automatically carry
// their original's type. The list comes from the repo's public file
// listing, so no special access is needed; if it cannot load, the five
// original folders are offered instead, and any name can still be typed.

const NAME_RULE = /^[a-z0-9][a-z0-9-]*$/

const ORIGINALS = ['dine', 'houses', 'barbershop', 'doctor', 'employee', 'holiday', 'pos', 'retailer', 'dealer', 'carRental', 'carRentalSystem', 'rentCarAdmin']

const REPO_PUBLIC_URL = 'https://api.github.com/repos/brahimhamdipa/autofly-cars-flights/contents/public'
const RAW_BASE = 'https://raw.githubusercontent.com/brahimhamdipa/autofly-cars-flights/main/public/'

function detectType(d) {
  if (!d || typeof d !== 'object') return 'other'
  if (Array.isArray(d.doctors)) return 'doctor'
  if (Array.isArray(d.services)) return 'barbershop'
  if (Array.isArray(d.listings)) return 'houses'
  if (Array.isArray(d.employees)) return 'employee'
  if (Array.isArray(d.properties)) return 'holiday'
  if (Array.isArray(d.items)) return 'pos'
  if (Array.isArray(d.goods)) return 'retailer'
  if (Array.isArray(d.vehicles)) return 'dealer'
  if (Array.isArray(d.cars)) return 'carRental'
  if (Array.isArray(d.fleet)) return 'carRentalSystem'
  if (Array.isArray(d.rides)) return 'rentCarAdmin'
  if (Array.isArray(d.menu)) return 'dine'
  return 'other'
}

function displayName(d) {
  if (!d) return ''
  if (d.business && d.business.name) return d.business.name
  if (typeof d.name === 'string') return d.name
  return ''
}

export default function AdminFolderPasses() {
  const [passes, setPasses] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [folder, setFolder] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(null) // row id, or null for a new pass
  const [folders, setFolders] = useState(null) // null = loading, else [{ folder, type, name }]
  const [typeFilter, setTypeFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showList, setShowList] = useState(false)

  const load = async () => {
    const { data, error } = await supabase.from('folder_passes').select('*').order('folder')
    if (error) {
      setMsg('Error loading passes: ' + error.message)
      setPasses([])
      return
    }
    setPasses(data || [])
  }

  const loadFolders = async () => {
    try {
      const res = await fetch(REPO_PUBLIC_URL)
      if (!res.ok) throw new Error('list failed')
      const items = await res.json()
      const dirs = (Array.isArray(items) ? items : []).filter((i) => i.type === 'dir')
      const found = []
      for (const dir of dirs) {
        let type = 'other'
        let name = ''
        try {
          const r = await fetch(RAW_BASE + dir.name + '/data.json')
          if (r.ok) {
            const d = await r.json()
            type = detectType(d)
            name = displayName(d)
          }
        } catch (e) { /* keep as other */ }
        found.push({ folder: dir.name, type, name })
      }
      found.sort((a, b) => a.folder.localeCompare(b.folder))
      setFolders(found)
    } catch (e) {
      setFolders(ORIGINALS.map((s) => ({ folder: s, type: s, name: '' })))
    }
  }

  useEffect(() => { load(); loadFolders() }, [])

  const resetForm = () => {
    setFolder('')
    setUsername('')
    setPassword('')
    setNote('')
    setEditing(null)
  }

  const startEdit = (row) => {
    setFolder(row.folder)
    setUsername(row.username)
    setPassword(row.password)
    setNote(row.note || '')
    setEditing(row.id)
    setMsg('')
  }

  const save = async () => {
    const clean = folder.trim().toLowerCase()
    if (!NAME_RULE.test(clean) || clean === 'admin') {
      setMsg('Folder names can only use small letters, numbers and dashes, and cannot be "admin".')
      return
    }
    if (!username.trim() || !password) {
      setMsg('Username and password are both required.')
      return
    }
    setMsg('')
    setBusy(true)
    try {
      const { error } = await supabase.from('folder_passes').upsert(
        { folder: clean, username: username.trim(), password, note: note.trim() },
        { onConflict: 'folder' },
      )
      if (error) throw error
      setMsg('Pass saved for "' + clean + '". Its Setup tab now asks for it.')
      resetForm()
      await load()
    } catch (err) {
      setMsg('Error saving pass: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (!window.confirm('Remove the pass for "' + row.folder + '"? Its Setup tab will open freely again.')) return
    setMsg('')
    setBusy(true)
    try {
      const { error } = await supabase.from('folder_passes').delete().eq('id', row.id)
      if (error) throw error
      setMsg('Pass removed for "' + row.folder + '".')
      if (editing === row.id) resetForm()
      await load()
    } catch (err) {
      setMsg('Error removing pass: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const q = folder.trim().toLowerCase()
  const visible = (folders || []).filter((f) =>
    (typeFilter === 'all' || f.type === typeFilter) &&
    (q === '' || f.folder.toLowerCase().indexOf(q) !== -1 ||
      (f.name && f.name.toLowerCase().indexOf(q) !== -1)),
  )
  const typesPresent = ['all'].concat(ORIGINALS.filter((s) => (folders || []).some((f) => f.type === s)))
  if ((folders || []).some((f) => f.type === 'other') && typesPresent.indexOf('other') === -1) typesPresent.push('other')

  return (
    <div>
      <div className="hero-card">
        <h2>🔐 Folder Passes</h2>
        <p>Set a username and password on a template folder (dine, houses, barbershop, doctor, employee, or any copy). That folder's Setup tab will ask for it; until a pass is set, Setup opens freely.</p>
        <p className="hint">Passwords are shown here readable, like the employee passes. Keep each one unique to its folder and never reuse your admin password. A pass belongs to the folder's name — rename a folder and set its pass again under the new name.</p>
      </div>

      {msg && <p className="status">{msg}</p>}
      {passes === null && !msg && <p className="status">Loading passes…</p>}

      <div className="form-card wide">
        <h3 style={{ margin: '0 0 10px' }}>{editing ? 'Edit pass' : 'New pass'}</h3>
        <label>Folder</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Type to search, or pick from the list"
            value={folder}
            onChange={(e) => { setFolder(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setShowList(true) }}
            onFocus={() => setShowList(true)}
            onBlur={() => setTimeout(() => setShowList(false), 150)}
            autoComplete="off"
          />
          <button type="button" className="btn-soft" title="Filter by folder type" onClick={() => setShowFilters(!showFilters)}>⧩ Filter</button>
        </div>
        {showFilters && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {typesPresent.map((t) => (
              <button
                key={t}
                type="button"
                className={typeFilter === t ? '' : 'btn-soft'}
                onClick={() => { setTypeFilter(t); setShowList(true) }}
              >
                {t === 'all' ? 'All types' : t}
              </button>
            ))}
          </div>
        )}
        {folders === null && <p className="status">Loading folders…</p>}
        {showList && folders !== null && (
          <div style={{ border: '1px solid #ccc', borderRadius: 8, marginTop: 6, maxHeight: 220, overflowY: 'auto' }}>
            {visible.length === 0 && <p className="status" style={{ margin: 8 }}>No folders match.</p>}
            {visible.map((f) => (
              <button
                key={f.folder}
                type="button"
                className="btn-soft"
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderRadius: 0 }}
                onMouseDown={(e) => { e.preventDefault(); setFolder(f.folder); setShowList(false) }}
              >
                {f.folder}{f.name && f.name !== f.folder ? ' — ' + f.name : ''} <span style={{ opacity: 0.6 }}>({f.type})</span>
              </button>
            ))}
          </div>
        )}
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional — who this pass is for" />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" disabled={busy} onClick={save}>{editing ? 'Save changes' : 'Save pass'}</button>
          {editing && (<button type="button" className="btn-soft" disabled={busy} onClick={resetForm}>Cancel</button>)}
        </div>
      </div>

      {passes && passes.length === 0 && (
        <p className="status">No folder passes yet. Every folder's Setup tab opens freely until you set one.</p>
      )}

      {passes && passes.map((row) => (
        <div key={row.id} className="form-card wide">
          <h3 style={{ margin: '0 0 4px' }}>{row.folder}</h3>
          <p style={{ margin: '0 0 10px' }}>
            <a href={`https://autofly.us.com/${row.folder}`} target="_blank" rel="noreferrer">autofly.us.com/{row.folder}</a>
          </p>
          <p style={{ margin: '0 0 4px' }}>Username: <b>{row.username}</b></p>
          <p style={{ margin: '0 0 4px' }}>Password: <b>{row.password}</b></p>
          {row.note && <p style={{ margin: '0 0 10px' }}>Note: {row.note}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy} onClick={() => startEdit(row)}>✏️ Edit</button>
            <button type="button" className="btn-soft" disabled={busy} onClick={() => remove(row)}>🗑️ Remove</button>
          </div>
        </div>
      ))}
    </div>
  )
}
