import { useEffect, useRef, useState } from 'react'

import { supabase } from '../lib/supabaseClient'
import { shrinkImage } from '../lib/storeUpload'

// Public picture-upload page, reached at yently.com/<form name>.
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
//   moves between the buttons (menu / close / arrows / play or pause
//   / Want this for your business?), OK presses the highlighted
//   button, Esc closes the open menu first, then the gallery.
//   Buttons and fields also show a thick gold outline when focused,
//   so the remote's position is visible on a TV.
// - The controls hide on their own after a few seconds so the
//   picture is clean. They come back on a tap or a key press — never
//   on an automatic picture change. The menu button (top left) and
//   the X to close (top right) hide with the controls, so the
//   fullscreen is a clean picture until the visitor taps it.
const MAX_PICS = 7

// Demo TV gallery: the slug 'demo-tv-gallery' opens the same
// fullscreen gallery with NO login (demo/demo), view-only, and the
// gallery opens by itself as soon as the pictures load. Two display
// types on the same link: Slideshow plays the pictures one after the
// other (every 10 seconds); One picture holds a single picture on
// the TV — the visitor picks it with Prev/Next and the TV remembers
// it, so seven TVs on the same link can each hold a different
// picture. ?pic=N opens One picture on that picture. The demo
// gallery also carries the Business Systems ☰ submenu (top left),
// like the other Business Systems pages — in the fullscreen it
// hides with the controls, and the page behind the gallery has it
// too, so the visitor can always get back to the Business Systems
// pages. The demo form row (f =
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
  // Two display types, one link. 'slideshow' plays the pictures one
  // after the other; 'single' holds one picture on this TV. Each TV
  // remembers its own mode and picture in this browser, so seven TVs
  // opened on the same link can each hold a different picture.
  // ?pic=N opens single mode on that picture. The customer pays $2
  // for both types together, not per type.
  const modeKey = 'tv-gallery-mode-' + slug
  const picKey = 'tv-gallery-pic-' + slug
  const storedMode = (() => { try { return localStorage.getItem(modeKey) } catch { return null } })()
  const [galleryMode, setGalleryMode] = useState(urlPic ? 'single' : (storedMode === 'single' || storedMode === 'slideshow' ? storedMode : 'slideshow'))
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuAddonsOpen, setMenuAddonsOpen] = useState(false)
  const menuRef = useRef(null)
  const pageMenuRef = useRef(null)
  const menuOpenRef = useRef(false)
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
    // While the submenu is open the controls stay up — hiding them
    // would hide the menu the visitor is reading.
    hideTimer.current = setTimeout(() => { if (!menuOpenRef.current) setControlsVisible(false) }, 3000)
  }
  const toggleControls = () => {
    if (controlsVisible) { setControlsVisible(false); if (hideTimer.current) clearTimeout(hideTimer.current) } else pokeControls()
  }
  useEffect(() => {
    if (viewIndex === null) return
    // Give the gallery itself the focus, so a TV remote's keys land
    // here instead of on whichever button was last touched — but
    // only when the remote is NOT already sitting on a control
    // button. An auto-advance (or a manual picture change) must not
    // steal the remote's place and send it back to the first button.
    const ae = document.activeElement
    if (!(ae && ae.tagName === 'BUTTON' && galleryRef.current?.contains(ae))) {
      galleryRef.current?.focus()
    }
    // In single mode this TV holds its picture: remember it, so the
    // TV comes back to the same picture after a reload or a power cut.
    if (galleryMode === 'single') { try { localStorage.setItem(picKey, String(viewIndex)) } catch {} }
    // NOTE: the controls are deliberately NOT shown here. They
    // appear when the gallery opens and on any tap or key press —
    // an automatic picture change must never bring them back, or
    // they flash on the screen every 10 seconds.
  }, [viewIndex, galleryMode, picKey])
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
      if (e.key === 'Escape') { if (menuOpen) { setMenuOpen(false); pokeControls(); return } closeGallery() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewIndex, pics.length, controlsVisible, menuOpen])

  // Closing the gallery also closes the submenu: the menu is the same
  // one on the page behind the gallery, so leaving it open would leave
  // it hanging over the header after the fullscreen goes away.
  const closeGallery = () => {
    setViewIndex(null)
    setMenuOpen(false)
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
    // Same as closing: the menu must not hang over the picture.
    setMenuOpen(false)
    // The controls show when the gallery opens, then hide on their
    // own after a few seconds.
    pokeControls()
    // Fullscreen from the same tap (a user gesture), so the browser
    // allows it; if it refuses, the overlay below is fullscreen anyway.
    setTimeout(() => { galleryRef.current?.requestFullscreen?.().catch(() => {}) }, 0)
  }

  // The picture the gallery opens on: ?pic=N wins, then (in single
  // mode) the picture this TV held last time, otherwise the first one.
  const openingPic = () => {
    if (urlPic && urlPic <= pics.length) return urlPic - 1
    if (galleryMode !== 'single') return 0
    try { const n = Number(localStorage.getItem(picKey)); if (Number.isInteger(n) && n >= 0 && n < pics.length) return n } catch {}
    return 0
  }

  // Switch display type. The choice is remembered in this browser,
  // so a TV set to one picture stays on one picture.
  const setMode = (m) => {
    setGalleryMode(m)
    try { localStorage.setItem(modeKey, m) } catch {}
    if (m === 'single') { try { localStorage.setItem(picKey, String(viewIndex ?? 0)) } catch {} }
    pokeControls()
  }

  // The Business Systems ☰ submenu, used twice on the demo page: in
  // the fullscreen (top left, hides with the controls) and on the
  // page behind the gallery (top left, always there). Same links as
  // the other Business Systems pages.
  const menuBox = (ref) => (
    <div ref={ref} className="car-submenu-wrap" style={{ marginBottom: 0 }}>
      <button type="button" className="car-submenu-btn" aria-label="Business Systems menu" onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); pokeControls() }}>
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      {menuOpen && (
        <div className="car-submenu">
          <button type="button" onClick={e => { e.stopPropagation(); setMenuOpen(false); if (go) go('business-cart') }}>My Cart</button>
          <button type="button" onClick={e => { e.stopPropagation(); setMenuOpen(false); if (go) go('restaurants') }}>Restaurant</button>
          <button type="button" onClick={e => { e.stopPropagation(); setMenuOpen(false); if (go) go('pos') }}>POS</button>
          <button type="button" onClick={e => { e.stopPropagation(); setMenuOpen(false); if (go) go('barbers') }}>Barber</button>
          <button type="button" onClick={e => { e.stopPropagation(); setMenuOpen(false); if (go) go('dealer') }}>Dealer</button>
          <button type="button" onClick={e => { e.stopPropagation(); setMenuOpen(false); if (go) go('employee') }}>Employee</button>
          <button type="button" onClick={e => { e.stopPropagation(); setMenuOpen(false); if (go) go('bodyshop') }}>Bodyshop</button>
          <button type="button" onClick={e => { e.stopPropagation(); setMenuOpen(false); if (go) go('simple-barbershop') }}>Sample Website</button>
          <button type="button" onClick={e => { e.stopPropagation(); setMenuAddonsOpen(o => !o) }}>Add-ons {menuAddonsOpen ? '▾' : '▸'}</button>
          {menuAddonsOpen && (
            <a href="/demo-tv-gallery" style={{ display: 'block', width: '100%', background: 'white', color: '#111827', textAlign: 'left', padding: '12px 16px 12px 32px', fontSize: '14.5px', textDecoration: 'none', borderTop: '1px solid #f1f2f5' }}>TV Gallery</a>
          )}
          {menuAddonsOpen && (
            <a href="/demo-live-chat" style={{ display: 'block', width: '100%', background: 'white', color: '#111827', textAlign: 'left', padding: '12px 16px 12px 32px', fontSize: '14.5px', textDecoration: 'none', borderTop: '1px solid #f1f2f5' }}>Live Chat</a>
          )}
        </div>
      )}
    </div>
  )

  // The gallery submenu closes when the visitor taps anywhere else.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      const inMenu = [menuRef.current, pageMenuRef.current].some(r => r && r.contains(e.target))
      if (!inMenu) { setMenuOpen(false); pokeControls() }
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [menuOpen])
  // The hide timer reads this, so it knows not to hide the controls
  // while the submenu is open.
  useEffect(() => { menuOpenRef.current = menuOpen }, [menuOpen])

  // Demo mode: open the gallery by itself as soon as the pictures
  // load — ?pic=N picks that picture, otherwise the first one, or
  // (in single mode) the picture this TV held last time.
  // Only once per visit: closing the gallery stays closed until the
  // visitor taps "View the gallery" again.
  useEffect(() => {
    if (!demoMode || pics.length === 0 || viewIndex !== null || demoOpened.current) return
    demoOpened.current = true
    openGallery(openingPic())
  }, [demoMode, pics.length, viewIndex, urlPic, galleryMode])

  // Demo mode, slideshow only: advance one picture every 10 seconds.
  // Single mode holds its picture and never advances. The advance
  // never shows the controls — they stay hidden until the visitor
  // taps or presses a key, so the picture stays clean.
  useEffect(() => {
    if (!demoMode || galleryMode !== 'slideshow' || viewIndex === null || pics.length < 2) return
    const t = setInterval(() => {
      setViewIndex(v => (v === null ? v : (v + 1) % pics.length))
    }, 10000)
    return () => clearInterval(t)
  }, [demoMode, galleryMode, viewIndex, pics.length])

  return (
    <div className="upload-form-page">
      <style>{`.upload-form-page button:focus-visible, .upload-form-page input:focus-visible { outline: 3px solid #f5a623; outline-offset: 2px; }`}</style>
      {demoMode && viewIndex === null && (
        <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 10 }} onClick={e => e.stopPropagation()}>
          {menuBox(pageMenuRef)}
        </div>
      )}
      <div className="hero-card">
        {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}
        <h2>📷 Picture upload</h2>
        {demoMode
          ? <p>This is the demo TV gallery — pictures play fullscreen, one after the other, or hold one picture per TV. Same link, both ways.</p>
          : folder
            ? <p>Upload pictures to your folder, or view them fullscreen.</p>
            : <p>Log in with the username and password Yently gave you for this form.</p>}
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
              <button type="button" onClick={() => openGallery(openingPic())} disabled={pics.length === 0}>View the gallery</button>
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={() => go && go('tv-gallery')}>Want this for your business?</button>
              </div>
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
          {demoMode && (
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 5, opacity: controlsVisible ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: controlsVisible ? 'auto' : 'none' }} onClick={e => e.stopPropagation()}>
              {menuBox(menuRef)}
            </div>
          )}
          <button type="button" className="car-submenu-btn" aria-label="Close gallery" onClick={e => { e.stopPropagation(); closeGallery() }} style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, fontSize: 22, color: '#374151', opacity: controlsVisible ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: controlsVisible ? 'auto' : 'none' }}>✕</button>
          {message.trim() && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#dc2626', color: '#fff', overflow: 'hidden', padding: '10px 0', zIndex: 2 }}>
              <span className="pos-ticker" style={{ display: 'inline-block', whiteSpace: 'nowrap', fontWeight: 800, fontSize: 22 }}>{message} &nbsp;•&nbsp; {message}</span>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: message.trim() ? 64 : 16, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#fff', opacity: controlsVisible ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: controlsVisible ? 'auto' : 'none' }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Tap the picture to hide these buttons</span>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <button type="button" aria-label="Previous picture" onClick={e => { e.stopPropagation(); setViewIndex((viewIndex - 1 + pics.length) % pics.length); pokeControls() }} style={{ padding: '6px 12px', fontSize: 18 }}>‹</button>
              <span>{viewIndex + 1}/{pics.length}</span>
              <button type="button" aria-label="Next picture" onClick={e => { e.stopPropagation(); setViewIndex((viewIndex + 1) % pics.length); pokeControls() }} style={{ padding: '6px 12px', fontSize: 18 }}>›</button>
              <button type="button" aria-label={galleryMode === 'slideshow' ? 'Hold one picture' : 'Play the slideshow'} onClick={e => { e.stopPropagation(); setMode(galleryMode === 'slideshow' ? 'single' : 'slideshow') }} style={{ padding: '6px 12px', fontSize: 18 }}>{galleryMode === 'slideshow' ? '❚❚' : '▶'}</button>
              {demoMode && <button type="button" onClick={e => { e.stopPropagation(); if (go) go('tv-gallery') }}>Want this for your business?</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
