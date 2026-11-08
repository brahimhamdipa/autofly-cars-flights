import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Admin "Restaurant Pages" section: copy, rename and delete the
// self-contained restaurant folders under public/ (each folder is one
// page, live at yently.com/<folder>). Only folders that contain a
// restaurant page (data.json) are listed, so nothing else in public/
// can be touched from here.
//
// The work runs as a server job: start the job, then poll it every
// couple of seconds until it finishes. Each poll advances the job one
// step (the server can only do one GitHub request per call), so a copy
// of a 5-file page takes roughly half a minute of polling.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const PHASE_LABELS = {
  checking: 'Checking…',
  'checking-target': 'Checking the new name…',
  'reading-source': 'Reading the original page…',
  'reading-files': 'Reading files…',
  publishing: 'Publishing the new page…',
  reading: 'Reading pages…',
  deleting: 'Deleting…',
}

const NAME_RULE = /^[a-z0-9][a-z0-9-]*$/

function validName(name) {
  return NAME_RULE.test(name) && name !== 'admin'
}

async function runJob(op, source, target, onProgress) {
  const { data: started, error: startErr } = await supabase.rpc('rpc_folder_job_start', {
    p_op: op,
    p_source: source || null,
    p_target: target || null,
  })
  if (startErr) throw startErr
  const jobId = started.job_id
  for (let i = 0; i < 90; i++) {
    await sleep(2000)
    const { data: poll, error: pollErr } = await supabase.rpc('rpc_folder_job_poll', { p_job_id: jobId })
    if (pollErr) throw pollErr
    if (poll.status === 'running') {
      if (onProgress) onProgress(poll)
      continue
    }
    if (poll.status === 'done') return poll.result
    throw new Error((poll.error && poll.error.message) || 'Job failed')
  }
  throw new Error('This is taking too long — the job is still running. Come back and refresh the list in a minute.')
}

function progressText(poll) {
  const label = PHASE_LABELS[poll.phase] || 'Working…'
  if (poll.total > 0) return `${label} (${poll.current} of ${poll.total})`
  return label
}

export default function AdminRestaurantPages() {
  const [folders, setFolders] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(null) // { action, folder, text }
  const [copyFor, setCopyFor] = useState(null) // { folder, value }
  const [renameFor, setRenameFor] = useState(null) // { folder, value }

  const load = async () => {
    setMsg('')
    try {
      const result = await runJob('list', null, null, (poll) => setBusy({ action: 'list', folder: '', text: progressText(poll) }))
      setFolders(result.folders || [])
    } catch (err) {
      setMsg('Error loading pages: ' + err.message)
      setFolders([])
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => { load() }, [])

  const doCopy = async (folder, newName) => {
    if (!validName(newName)) {
      setMsg('Page names can only use small letters, numbers and dashes, and cannot be "admin".')
      return
    }
    setMsg('')
    setBusy({ action: 'copy', folder, text: 'Starting…' })
    try {
      await runJob('copy', folder, newName, (poll) => setBusy({ action: 'copy', folder, text: progressText(poll) }))
      setCopyFor(null)
      setMsg(`✓ Copied — yently.com/${newName} will be live in a few minutes (the site rebuilds automatically). One thing to change after copying: the name shown on the page comes from inside the folder, so open the new page's Setup tab to change it.`)
      load()
    } catch (err) {
      setMsg('Copy failed: ' + err.message)
    } finally {
      setBusy(null)
    }
  }

  const doRename = async (folder, newName) => {
    if (!validName(newName)) {
      setMsg('Page names can only use small letters, numbers and dashes, and cannot be "admin".')
      return
    }
    setMsg('')
    setBusy({ action: 'rename', folder, text: 'Starting…' })
    try {
      await runJob('copy', folder, newName, (poll) => setBusy({ action: 'rename', folder, text: 'Copying to the new name… ' + progressText(poll) }))
      await runJob('delete', folder, null, (poll) => setBusy({ action: 'rename', folder, text: 'Removing the old name… ' + progressText(poll) }))
      setRenameFor(null)
      setMsg(`✓ Renamed — yently.com/${newName} will be live in a few minutes, and yently.com/${folder} will stop opening the page after the rebuild.`)
      load()
    } catch (err) {
      setMsg('Rename failed: ' + err.message + ' (If the copy finished but the old name is still there, delete the old name by hand from this list.)')
    } finally {
      setBusy(null)
    }
  }

  const doDelete = async (folder) => {
    if (!window.confirm(`Delete the page "${folder}" (yently.com/${folder}) for good? This cannot be undone.`)) return
    setMsg('')
    setBusy({ action: 'delete', folder, text: 'Starting…' })
    try {
      await runJob('delete', folder, null, (poll) => setBusy({ action: 'delete', folder, text: progressText(poll) }))
      setMsg(`✓ Deleted — yently.com/${folder} will stop opening the page after the next rebuild (a few minutes).`)
      load()
    } catch (err) {
      setMsg('Delete failed: ' + err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="hero-card">
        <h2>🍽️ Restaurant Pages</h2>
        <p>Each restaurant page is a folder, live at yently.com/<b>folder-name</b>. Copy one to make a new restaurant, rename one to change its address, or delete one you no longer need. Only folders that hold a restaurant page are listed here.</p>
        <p className="hint">After a copy or rename, give the site a few minutes to rebuild before opening the new address. And remember: the restaurant name shown on a copied page comes from inside its folder — open the new page's Setup tab to change it.</p>
      </div>

      {msg && <p className="status">{msg}</p>}
      {busy && <p className="status">⏳ {busy.text}</p>}

      {folders === null && !msg && <p className="status">Loading pages…</p>}

      {folders !== null && folders.length === 0 && (
        <p className="status">No restaurant pages found. The "dine" demo page should be here — if it is missing, it may have been deleted.</p>
      )}

      {folders && folders.map((f) => (
        <div key={f.folder} className="form-card wide">
          <h3 style={{ margin: '0 0 4px' }}>{f.name}</h3>
          <p style={{ margin: '0 0 10px' }}>
            <a href={`https://yently.com/${f.folder}`} target="_blank" rel="noreferrer">yently.com/{f.folder}</a>
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={!!busy} onClick={() => { setCopyFor({ folder: f.folder, value: '' }); setRenameFor(null) }}>📋 Copy</button>
            <button type="button" disabled={!!busy} onClick={() => { setRenameFor({ folder: f.folder, value: '' }); setCopyFor(null) }}>✏️ Rename</button>
            <button type="button" className="btn-soft" disabled={!!busy} onClick={() => doDelete(f.folder)}>🗑️ Delete</button>
          </div>

          {copyFor && copyFor.folder === f.folder && (
            <div style={{ marginTop: 10 }}>
              <input
                placeholder="New page name (small letters, numbers, dashes)"
                value={copyFor.value}
                onChange={(e) => setCopyFor({ ...copyFor, value: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button type="button" disabled={!!busy || !copyFor.value} onClick={() => doCopy(f.folder, copyFor.value)}>Copy to this name</button>
                <button type="button" className="btn-soft" disabled={!!busy} onClick={() => setCopyFor(null)}>Cancel</button>
              </div>
            </div>
          )}

          {renameFor && renameFor.folder === f.folder && (
            <div style={{ marginTop: 10 }}>
              <input
                placeholder="New page name (small letters, numbers, dashes)"
                value={renameFor.value}
                onChange={(e) => setRenameFor({ ...renameFor, value: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button type="button" disabled={!!busy || !renameFor.value} onClick={() => doRename(f.folder, renameFor.value)}>Rename to this name</button>
                <button type="button" className="btn-soft" disabled={!!busy} onClick={() => setRenameFor(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}

      <button type="button" className="btn-soft no-print" disabled={!!busy} onClick={load} style={{ marginTop: 12 }}>↻ Refresh list</button>
    </div>
  )
}
