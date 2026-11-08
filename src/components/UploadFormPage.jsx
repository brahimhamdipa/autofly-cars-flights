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
//
// Limits and extras:
// - At most 7 pictures per form. The count is the pictures actually
//   shown — deleting one frees its place.
// - A picture can be deleted or replaced without touching the rest.
//   The delete only HIDES the file from this gallery (it is added to
//   the form's removed list): only the signed-in admin can truly
//   delete files from storage, and the customer is anonymous here.
//   Deleting the whole form still removes the folder + pictures
//   for real. A replaced picture is uploaded first, then the old one
//   is hidden, so a failed upload never loses the old picture.
// - A message the customer writes rolls across the bottom of the
//   fullscreen like the urgent messages on TV (big, red, impossible
//   to miss). Empty message: nothing shows, just the pictures.
// - TV remote: in the fullscreen, Left/Right flip pictures, Up/Down
//   moves between the buttons (Prev / Next / Close / Want this for
//   your business?), OK presses the highlighted button, Esc closes.
//   Buttons and fields also show a thick gold outline when focused,
//   so the remote's position is visible on a TV.
const MAX_PICS = 7

// Demo TV gallery: the slug 'demo-tv-gallery' opens the same
// fullscreen gallery with NO login (demo/demo), view-only, and the
// gallery opens by itself as soon as the pictures load. ?pic=N shows
// that one picture and holds it (no auto-advance); otherwise the
// pictures advance every 10 seconds. The demo form row (f =
// 'demo-tv-gallery', u/p 'demo') is seeded in the database — this
// page only opens it, it never creates it.
export default function UploadFormPage({ slug, goBack, go }) {
  const demoMode = slug === 'demo-tv-gallery'
  // ?pic=N from the address bar (1-based), read once. A TV shows one
  // picture: the owner opens the same link on each TV with a
  // different ?pic= number.
  const urlPic = (() => {
    try {
      const n = Number(new URLSearchParams(window.location.search).get('pic'))
      return Number.isInteger(n) && n >= 1 ? n : null
    } catch { return null }
  })()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [folder, setFolder] = useState(null)
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [message, setMessage] = useState('')
  const [savingMessage, setSavingMessage] = useState(false)
  const [removedPics, setRemovedPics] = useState([])
  const [pendingReplace, setPendingReplace] = useState(null)

  const [pics, setPics] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState('')
  const [status, setStatus] = useState('')
  const [viewIndex, setViewIndex] = useState(null)
  const [controlsVisible, setControlsVisible] = useState(true)
  const fileRef = useRef(null)
  const replaceRef = useRef(null)
  const galleryRef = useRef(null)
  const hideTimer = useRef(null)
  const demoOpened = useRef(false)

  // Demo mode logs itself in with the demo credentials — no login
  // form, no password typed. If the demo form row is missing the
  // page says so instead of showing a login.
  useEffect(() => {
    if (!demoMode) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('upload_form_open', { p_f: slug, p_u: 'demo', p_p: 'demo' })
      if (cancelled) return
      if (error || !data) { setStatus('The demo gallery is not ready yet — please check back soon.'); return }
      setFolder(data.folder)
      setMessage(data.message || '')
      setRemovedPics(data.removed || [])
    })()
    return () => { cancelled = true }
  }, [demoMode, slug])

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
    // here instead of on whichever button was last touched — but
    // only when the remote is NOT already sitting on a control
    // button. An auto-advance (or a manual picture change) must not
    // steal the remote's place and send it back to the first button.
    const ae = document.activeElement
    if (!(ae && ae.tagName === 'BUTTON' && galleryRef.current?.contains(ae))) {
      galleryRef.current?.focus()
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [viewIndex])
  useEffect(() => {
    if (viewIndex === null) return
    const onKey = (e) => {
      // TV remotes (and keyboards) drive the gallery with keys.
      // Left/Right flip pictures. Up/Down moves the focus between
      // the control buttons (Prev / Next / Close / Want this for your
      // business?) so the remote can press one — OK (Enter) presses
      // the focused button, or shows/hides the controls when none is
      // focused. Volume keys never reach a website at all — the TV
      // keeps those.
      if (e.key === 'ArrowLeft') { e.preventDefault(); setViewIndex((viewIndex - 1 + pics.length) % pics.length); pokeControls() }
      if (e.key === 'ArrowRight') { e.preventDefault(); setViewIndex((viewIndex + 1) % pics.length); pokeControls() }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        pokeControls()
        const btns = Array.from(galleryRef.current?.querySelectorAll('button') || [])
        if (!btns.length) return
        const cur = btns.indexOf(document.activeElement)
        const next = e.key === 'ArrowDown' ? (cur + 1) % btns.length : (cur - 1 + btns.length) % btns.length
        btns[next].focus()
      }
      if (e.key === 'Enter') {
        // A focused control button gets the normal press (the TV's OK
        // button clicks it). Otherwise OK shows/hides the controls.
        if (document.activeElement?.tagName === 'BUTTON' && galleryRef.current?.contains(document.activeElement)) return
        e.preventDefault(); toggleControls()
      }
      if (e.key === 'Escape') closeGallery()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewIndex, pics.length, controlsVisible])

  const closeGallery = () => {
    setViewIndex(null)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  const loadPics = async (fld, removed = removedPics) => {
    setLoading(true)
    const { data, error } = await supabase.storage.from('product-images').list('store/' + fld, { limit: 100, sortBy: { column: 'name', order: 'desc' } })
    setLoading(false)
    if (error) { setStatus('Could not list pictures: ' + error.message); return }
    const files = (data || []).filter(f => f.name !== '.keep' && !removed.includes(f.name))
    setPics(files.map(f => {
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl('store/' + fld + '/' + f.name)
      return { name: f.name, url: pub.publicUrl }
    }))
  }

  useEffect(() => { if (folder) loadPics(folder) }, [folder])

  const login = async (e) => {
    e.preventDefault()
    setLoggingIn(true); setLoginError('')
    const { data, error } = await supabase.rpc('upload_form_open', { p_f: slug, p_u: username, p_p: password })
    setLoggingIn(false)
    if (error || !data) { setLoginError('Wrong username or password for this form.'); return }
    setFolder(data.folder)
    setMessage(data.message || '')
    setRemovedPics(data.removed || [])
  }

  const uploadFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length || !folder) return
    if (pics.length + files.length > MAX_PICS) {
      setStatus(`You can have up to ${MAX_PICS} pictures — you have ${pics.length}, and you picked ${files.length}. Delete some first, or pick fewer.`)
      return
    }
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

  // Delete hides the picture from this gallery (and frees its place)
  // — the file itself stays in storage until the form is deleted.
  const deletePic = async (name) => {
    if (!window.confirm('Delete this picture? It will disappear from the gallery and free its place.')) return
    const { data, error } = await supabase.rpc('remove_upload_picture', { p_f: slug, p_u: username, p_p: password, p_name: name })
    if (error || !data) { setStatus('Could not delete: ' + (error?.message || 'try again')); return }
    const next = [...removedPics, name]
    setRemovedPics(next)
    setPics(pics.filter(p => p.name !== name))
    if (viewIndex !== null && pics[viewIndex]?.name === name) closeGallery()
    setStatus('✓ Picture deleted — its place is free now.')
  }

  // Replace uploads the new picture first, then hides the old one, so
  // a failed upload never loses the picture being replaced.
  const replacePic = async (e) => {
    const file = (e.target.files || [])[0]
    e.target.value = ''
    if (!file || !pendingReplace || !folder) return
    const oldName = pendingReplace
    setPendingReplace(null)
    setUploading('Replacing...')
    try {
      const up = await shrinkImage(file)
      const safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `store/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
      const { error } = await supabase.storage.from('product-images').upload(path, up)
      if (error) throw error
      const { data, error: rmErr } = await supabase.rpc('remove_upload_picture', { p_f: slug, p_u: username, p_p: password, p_name: oldName })
      if (rmErr || !data) throw new Error(rmErr?.message || 'could not hide the old picture')
      const next = [...removedPics, oldName]
      setRemovedPics(next)
      setStatus('✓ Picture replaced.')
      loadPics(folder, next)
    } catch (err) {
      setStatus('Could not replace: ' + err.message)
    }
    setUploading('')
  }

  const saveMessage = async (value) => {
    setSavingMessage(true)
    const { data, error } = await supabase.rpc('save_upload_form_message', { p_f: slug, p_u: username, p_p: password, p_message: value })
    setSavingMessage(false)
    if (error || !data) { setStatus('Could not save the message: ' + (error?.message || 'try again')); return }
    setMessage(value)
    setStatus(value ? '✓ Message saved — it rolls across the bottom of the fullscreen.' : '✓ Message cleared — the fullscreen shows just the pictures.')
  }

  const openGallery = (i) => {
    setViewIndex(i)
    // Fullscreen from the same tap (a user gesture), so the browser
    // allows it; if it refuses, the overlay below is fullscreen anyway.
    setTimeout(() => { galleryRef.current?.requestFullscreen?.().catch(() => {}) }, 0)
  }

  // Demo mode: open the gallery by itself as soon as the pictures
  // load — ?pic=N picks that picture, otherwise the first one.
  // Only once per visit: closing the gallery stays closed until the
  // visitor taps "View the gallery" again.
  useEffect(() => {
    if (!demoMode || pics.length === 0 || viewIndex !== null || demoOpened.current) return
    demoOpened.current = true
    openGallery(urlPic && urlPic <= pics.length ? urlPic - 1 : 0)
  }, [demoMode, pics.length, viewIndex, urlPic])

  // Demo mode: advance one picture every 10 seconds, unless ?pic=N
  // pinned one picture (then it holds). The 10-second clock restarts
  // on every picture change, manual or automatic.
  useEffect(() => {
    if (!demoMode || urlPic || viewIndex === null || pics.length < 2) return
    const t = setInterval(() => {
      setViewIndex(v => (v === null ? v : (v + 1) % pics.length))
      pokeControls()
    }, 10000)
    return () => clearInterval(t)
  }, [demoMode, urlPic, viewIndex, pics.length])

  return (
    <div className="upload-form-page">
      <style>{`.upload-form-page button:focus-visible, .upload-form-page input:focus-visible { outline: 3px solid #f5a623; outline-offset: 2px; }`}</style>
      <div className="hero-card">
        {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}
        <h2>📷 Picture upload</h2>
        {demoMode
          ? <p>This is the demo TV gallery — pictures play fullscreen, one after the other.</p>
          : folder
            ? <p>Upload pictures to your folder, or view them fullscreen.</p>
            : <p>Log in with the username and password AutoFly gave you for this form.</p>}
      </div>

      {!folder && !demoMode && (
        <form onSubmit={login} className="form-card">
          <input required placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <input required placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" disabled={loggingIn}>{loggingIn ? 'Opening...' : 'Open form'}</button>
          {loginError && <p className="status">{loginError}</p>}
        </form>
      )}

      {folder && !demoMode && (
        <div className="form-card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!uploading || pics.length >= MAX_PICS}>{uploading || 'Upload'}</button>
            <button type="button" className="btn-soft" onClick={() => openGallery(0)} disabled={pics.length === 0}>View</button>
            <button type="button" className="btn-soft" onClick={() => loadPics(folder)}>Refresh</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={uploadFiles} />
          <input ref={replaceRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={replacePic} />
          {status && <p className="status">{status}</p>}
          {loading && <p className="hint">Loading pictures...</p>}
          {!loading && pics.length === 0 && <p className="hint">No pictures in this folder yet — tap Upload to add some (up to {MAX_PICS}).</p>}
          {pics.length > 0 && <p className="hint">{pics.length} of {MAX_PICS} pictures in this folder.{pics.length >= MAX_PICS ? ' Delete a picture to make room for a new one.' : ''}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {pics.map((p, i) => (
              <div key={p.name} style={{ position: 'relative' }}>
                <img src={p.url} alt={p.name} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, cursor: 'pointer' }} onClick={() => openGallery(i)} />
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button type="button" className="btn-soft" style={{ flex: 1, padding: '6px 4px', fontSize: 13 }} onClick={() => { setPendingReplace(p.name); replaceRef.current?.click() }}>Replace</button>
                  <button type="button" className="btn-soft" style={{ flex: 1, padding: '6px 4px', fontSize: 13 }} onClick={() => deletePic(p.name)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <label>Message on the fullscreen (optional)</label>
            <input placeholder="e.g. SALE — 20% off everything today!" value={message} onChange={e => setMessage(e.target.value)} maxLength={200} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn-soft" onClick={() => saveMessage(message)} disabled={savingMessage}>{savingMessage ? 'Saving...' : 'Save message'}</button>
              {message.trim() && <button type="button" className="btn-soft" onClick={() => saveMessage('')}>Clear message</button>}
            </div>
            <p className="hint">This rolls across the bottom of the fullscreen, like the urgent messages on TV. Leave it empty and nothing shows — just the pictures.</p>
          </div>
        </div>
      )}

      {demoMode && viewIndex === null && (
        <div className="form-card" style={{ textAlign: 'center' }}>
          {folder ? (
            <>
              <p>The demo gallery is playing fullscreen — close it any time with Esc, or tap below to open it again.</p>
              <button type="button" onClick={() => openGallery(urlPic && urlPic <= pics.length ? urlPic - 1 : 0)} disabled={pics.length === 0}>View the gallery</button>
              {pics.length === 0 && !loading && <p className="hint">No pictures in the demo gallery yet.</p>}
            </>
          ) : (
            <p className="hint">Opening the demo gallery...</p>
          )}
          {status && <p className="status">{status}</p>}
        </div>
      )}

      {viewIndex !== null && pics.length > 0 && (
        <div ref={galleryRef} tabIndex={-1} className="gallery-remote" style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }} onClick={closeGallery}>
          <style>{`@keyframes pos-ticker-scroll { from { transform: translateX(100%); } to { transform: translateX(-100%); } } .pos-ticker { animation: pos-ticker-scroll 36s linear infinite; } .gallery-remote button:focus { outline: 3px solid #f5a623; outline-offset: 3px; }`}</style>
          <img src={pics[viewIndex].url} alt={pics[viewIndex].name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onClick={e => { e.stopPropagation(); toggleControls() }} />
          {message.trim() && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#dc2626', color: '#fff', overflow: 'hidden', padding: '10px 0', zIndex: 2 }}>
              <span className="pos-ticker" style={{ display: 'inline-block', whiteSpace: 'nowrap', fontWeight: 800, fontSize: 22 }}>{message} &nbsp;•&nbsp; {message}</span>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: message.trim() ? 64 : 16, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#fff', opacity: controlsVisible ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: controlsVisible ? 'auto' : 'none' }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Tap the picture to hide these buttons</span>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              <button type="button" onClick={e => { e.stopPropagation(); setViewIndex((viewIndex - 1 + pics.length) % pics.length); pokeControls() }}>‹ Prev</button>
              <span>{viewIndex + 1} of {pics.length}</span>
              <button type="button" onClick={e => { e.stopPropagation(); setViewIndex((viewIndex + 1) % pics.length); pokeControls() }}>Next ›</button>
              <button type="button" onClick={closeGallery}>Close</button>
              {demoMode && <button type="button" onClick={e => { e.stopPropagation(); if (go) go('tv-gallery') }}>Want this for your business?</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
