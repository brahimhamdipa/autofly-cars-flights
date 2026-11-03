import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Admin "Folder Passes" section: one username + password per template
// folder (dine, houses, barbershop, and every copy). The folder's Setup
// tab asks for that pass; while a folder has no pass, its Setup opens
// freely, as it does today. Passwords are stored readable here, the same
// as the employee passes — so keep them unique per folder and never
// reuse the admin password. A pass belongs to the folder's name: rename
// a folder and its pass must be set again under the new name.

const NAME_RULE = /^[a-z0-9][a-z0-9-]*$/

const SUGGESTIONS = ['dine', 'houses', 'barbershop', 'doctor', 'employee']

export default function AdminFolderPasses() {
  const [passes, setPasses] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [folder, setFolder] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(null) // row id, or null for a new pass

  const load = async () => {
    const { data, error } = await supabase.from('folder_passes').select('*').order('folder')
    if (error) {
      setMsg('Error loading passes: ' + error.message)
      setPasses([])
      return
    }
    setPasses(data || [])
  }

  useEffect(() => { load() }, [])

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

  return (
    <div>
      <div className="hero-card">
        <h2>🔐 Folder Passes</h2>
        <p>Set a username and password on a template folder (dine, houses, barbershop, or any copy). That folder's Setup tab will ask for it; until a pass is set, Setup opens freely.</p>
        <p className="hint">Passwords are shown here readable, like the employee passes. Keep each one unique to its folder and never reuse your admin password. A pass belongs to the folder's name — rename a folder and set its pass again under the new name.</p>
      </div>

      {msg && <p className="status">{msg}</p>}
      {passes === null && !msg && <p className="status">Loading passes…</p>}

      <div className="form-card wide">
        <h3 style={{ margin: '0 0 10px' }}>{editing ? 'Edit pass' : 'New pass'}</h3>
        <label>
          Folder
          <input
            list="folder-pass-suggestions"
            placeholder="dine, houses, barbershop, or a copy's name"
            value={folder}
            onChange={(e) => setFolder(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          />
          <datalist id="folder-pass-suggestions">
            {SUGGESTIONS.map((s) => (<option key={s} value={s} />))}
          </datalist>
        </label>
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
