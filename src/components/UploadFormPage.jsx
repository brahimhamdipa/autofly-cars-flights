import { useEffect, useRef, useState } from 'react'

import { supabase } from '../lib/supabaseClient'
import { shrinkImage } from '../lib/storeUpload'

// Public picture-upload page, reached at autofly.us.com/<form name>.
// The customer logs in with the username and password the admin gave
// them (checked server-side — the form's row is never readable by
// visitors), then uploads pictures into their folder and views them
// fullscreen. Pictures live in the product-images bucket under
// store/<folder>/, the same storage the shop pictures already use, so
// uploads work with the same rules. The folder is created by the admin
// when the form is saved.
export default function UploadFormPage({ slug, goBack }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [folder, setFolder] = useState(null)
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const [pics, setPics] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState('')
  const [status, setStatus] = useState('')
  const [viewIndex, setViewIndex] = useState(null)
  const [controlsVisible, setControlsVisible] = useState(true)
  const fileRef = useRef(null)
  const galleryRef = useRef(null)
  const hideTimer = useRef(null)

  // The gallery controls hide on their own after a few seconds so the
  // picture is clean; any tap on the picture brings them back.
  const pokeControls = () => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000)
  }
  const toggleControls = () => {
    if (controlsVisible) { setControlsVisible(false); if (hideTimer.current) clearTimeout(hideTimer.current) } else pokeControls()
  }
  useEffect(() => {
    if (viewIndex === null) return
    pokeControls()
    // Give the gallery itself the focus, so a TV remote's keys land
    // here instead of on whichever button was last touched.
    galleryRef.current?.focus()
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [viewIndex])
  useEffect(() => {
    if (viewIndex === null) return
    const onKey = (e) => {
      // TV remotes (and keyboards) drive the gallery with keys. Keep
      // the arrows on the pictures only: without preventDefault the TV
      // would also move its focus between the buttons on every press.
      // Volume keys never reach a website at all — the TV keeps those.
      if (e.key === 'ArrowLeft') { e.preventDefault(); setViewIndex((viewIndex - 1 + pics.length) % pics.length); pokeControls() }
      if (e.key === 'ArrowRight') { e.preventDefault(); setViewIndex((viewIndex + 1) % pics.length); pokeControls() }
      if (e.key === 'Enter') { e.preventDefault(); toggleControls() }
      if (e.key === 'Escape') closeGallery()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewIndex, pics.length, controlsVisible])

  const closeGallery = () => {
    setViewIndex(null)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  const loadPics = async (fld) => {
    setLoading(true)
    const { data, error } = await supabase.storage.from('product-images').list('store/' + fld, { limit: 100, sortBy: { column: 'name', order: 'desc' } })
    setLoading(false)
    if (error) { setStatus('Could not list pictures: ' + error.message); return }
    const files = (data || []).filter(f => f.name !== '.keep')
    setPics(files.map(f => {
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl('store/' + fld + '/' + f.name)
      return { name: f.name, url: pub.publicUrl }
    }))
  }

  useEffect(() => { if (folder) loadPics(folder) }, [folder])

  const login = async (e) => {
    e.preventDefault()
    setLoggingIn(true); setLoginError('')
    const { data, error } = await supabase.rpc('upload_form_login', { p_f: slug, p_u: username, p_p: password })
    setLoggingIn(false)
    if (error || !data) { setLoginError('Wrong username or password for this form.'); return }
    setFolder(data)
  }

  const uploadFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !folder) return
    setUploading(`Uploading 0 of ${files.length}...`)
    let done = 0
    for (const file of files) {
      try {
        const up = await shrinkImage(file)
        const safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `store/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
        const { error } = await supabase.storage.from('product-images').upload(path, up)
        if (error) throw error
        done += 1
        setUploading(`Uploading ${done} of ${files.length}...`)
      } catch (err) {
        setStatus(`Upload stopped at ${done} of ${files.length}: ${err.message}`)
        setUploading('')
        loadPics(folder)
        return
      }
    }
    setUploading('')
    setStatus(`✓ Uploaded ${done} picture${done === 1 ? '' : 's'}.`)
    loadPics(folder)
  }

  const openGallery = (i) => {
    setViewIndex(i)
    // Fullscreen from the same tap (a user gesture), so the browser
    // allows it; if it refuses, the overlay below is fullscreen anyway.
    setTimeout(() => { galleryRef.current?.requestFullscreen?.().catch(() => {}) }, 0)
  }

  return (
    <div>
      <div className="hero-card">
        {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}
        <h2>📷 Picture upload</h2>
        {folder
          ? <p>Upload pictures to your folder, or view them fullscreen.</p>
          : <p>Log in with the username and password AutoFly gave you for this form.</p>}
      </div>

      {!folder && (
        <form onSubmit={login} className="form-card">
          <input required placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <input required placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" disabled={loggingIn}>{loggingIn ? 'Opening...' : 'Open form'}</button>
          {loginError && <p className="status">{loginError}</p>}
        </form>
      )}

      {folder && (
        <div className="form-card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!uploading}>{uploading || 'Upload'}</button>
            <button type="button" className="btn-soft" onClick={() => openGallery(0)} disabled={pics.length === 0}>View</button>
            <button type="button" className="btn-soft" onClick={() => loadPics(folder)}>Refresh</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={uploadFiles} />
          {status && <p className="status">{status}</p>}
          {loading && <p className="hint">Loading pictures...</p>}
          {!loading && pics.length === 0 && <p className="hint">No pictures in this folder yet — tap Upload to add some.</p>}
          {pics.length > 0 && <p className="hint">{pics.length} picture{pics.length === 1 ? '' : 's'} in this folder.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {pics.map((p, i) => (
              <img key={p.name} src={p.url} alt={p.name} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, cursor: 'pointer' }} onClick={() => openGallery(i)} />
            ))}
          </div>
        </div>
      )}

      {viewIndex !== null && pics.length > 0 && (
        <div ref={galleryRef} tabIndex={-1} style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }} onClick={closeGallery}>
          <img src={pics[viewIndex].url} alt={pics[viewIndex].name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onClick={e => { e.stopPropagation(); toggleControls() }} />
          <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#fff', opacity: controlsVisible ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: controlsVisible ? 'auto' : 'none' }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Tap the picture to hide these buttons</span>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              <button type="button" onClick={e => { e.stopPropagation(); setViewIndex((viewIndex - 1 + pics.length) % pics.length); pokeControls() }}>‹ Prev</button>
              <span>{viewIndex + 1} of {pics.length}</span>
              <button type="button" onClick={e => { e.stopPropagation(); setViewIndex((viewIndex + 1) % pics.length); pokeControls() }}>Next ›</button>
              <button type="button" onClick={closeGallery}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
