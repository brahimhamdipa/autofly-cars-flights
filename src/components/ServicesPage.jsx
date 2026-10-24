import { useEffect, useRef, useState } from 'react'
import ServicesMenu from './ServicesMenu'
import { submitAndNotify } from '../lib/notify'

// Voice message recorder (optional): records with the device microphone
// and attaches the audio to the emailed request. Picks the first audio
// format the browser supports (Safari uses mp4, Chrome/Firefox webm).
function VoiceRecorder({ value, onChange }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const recRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const startRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => () => {
    clearInterval(timerRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (value?.url) URL.revokeObjectURL(value.url)
  }, [])

  const pickMime = () => {
    if (typeof MediaRecorder === 'undefined') return ''
    for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
      if (MediaRecorder.isTypeSupported(m)) return m
    }
    return ''
  }

  const start = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mime = pickMime()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recRef.current = rec
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const type = mime.split(';')[0] || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const secs = Math.max(1, Math.round((Date.now() - startRef.current) / 1000))
        if (blob.size > 10 * 1024 * 1024) {
          setError('That recording is too long — please keep it under a couple of minutes.')
          return
        }
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        onChange({ blob, ext, seconds: secs, url: URL.createObjectURL(blob) })
      }
      startRef.current = Date.now()
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(Math.round((Date.now() - startRef.current) / 1000)), 500)
      rec.start()
      setRecording(true)
    } catch (e) {
      setError('Microphone access was not allowed. You can still send your message as text.')
    }
  }

  const stop = () => {
    clearInterval(timerRef.current)
    setRecording(false)
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="voice-box">
      <label>Voice message <span className="hint">(optional)</span></label>
      {!value && !recording && (
        <>
          <button type="button" className="voice-btn" onClick={start}>🎤 Record a voice message</button>
          <p className="hint">Tap, allow microphone access, speak — your recording is sent with this form.</p>
        </>
      )}
      {recording && (
        <div className="voice-recording">
          <span className="rec-dot" /> Recording… {fmt(seconds)}
          <button type="button" className="voice-btn stop" onClick={stop}>⏹ Stop</button>
        </div>
      )}
      {value && !recording && (
        <div className="voice-done">
          <audio controls src={value.url} />
          <p className="hint">✓ Voice message recorded ({fmt(value.seconds)}). It will be sent with your request.</p>
          <button type="button" className="voice-btn plain" onClick={() => onChange(null)}>Remove voice message</button>
        </div>
      )}
      {error && <p className="hint">{error}</p>}
    </div>
  )
}

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1])
  r.onerror = reject
  r.readAsDataURL(blob)
})

export default function ServicesPage({ go }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', companyUrl: '', language: '', message: '' })
  const [voice, setVoice] = useState(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setStatus('Sending your request...')
    try {
      let attachment = null
      if (voice) {
        const content = await blobToBase64(voice.blob)
        attachment = { filename: `voice-message.${voice.ext}`, content }
      }
      const emailExtras = {}
      if (form.company.trim()) emailExtras.company_name = form.company.trim()
      if (form.companyUrl.trim()) emailExtras.company_url = form.companyUrl.trim()
      if (form.language.trim()) emailExtras.preferred_language = form.language.trim()
      if (voice) emailExtras.voice_message = `Yes — voice message attached (${voice.seconds}s)`
      await submitAndNotify({
        table: 'car_inquiries',
        data: { car_id: null, car_name: 'Services Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Services request — ${form.name}`,
        emailExtras,
        attachment,
      })
      setStatus('✓ Sent! Thanks — our Services team will get back to you shortly.')
      setForm({ name: '', email: '', phone: '', company: '', companyUrl: '', language: '', message: '' })
      setVoice(null)
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <ServicesMenu go={go} />
      <div className="hero-card">
        <h2>Websites &amp; Systems</h2>
        <p><b>You talk, we listen.</b> Tell us the plan in your head — from a simple, personal website to a complicated system for a big business. From just a part of a code, in any language, to the whole system: we're here to help you achieve it.</p>
      </div>

      <div className="form-card wide">
        <h3>🌍 Don't let the language be a barrier</h3>
        <p>Tell us what you need using your own tongue language — we have translators, and we'll take care of the rest. Just tell us what you need and we will help.</p>
      </div>

      <div className="form-card wide">
        <h3>How it works <span className="hint">(websites as an example)</span></h3>
        <ol className="steps">
          <li><b>We gather information</b> — how you want your logo and everything else. This step usually happens by email.</li>
          <li><b>You pay a deposit</b> — very small, and it depends on what you need. You'll like our price.</li>
          <li><b>We keep you updated</b> — you'll see your website as it grows, and we'll change anything you want changed.</li>
          <li><b>You like it, you get the bill</b> — cheap, guaranteed. The bill covers hosting, security, domain, bank linking, and the effort of building it — plus a very small monthly cost for maintenance if it's a dynamic website.</li>
        </ol>
        <p className="hint">All of this is just to give you an idea of how it works. Don't hesitate — just tell us your needs and we'll talk.</p>
      </div>

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Tell us what you need</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
        </div>
        <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        <div className="row">
          <input placeholder="Company name (optional)" value={form.company} onChange={set('company')} />
          <input placeholder="Company URL (optional)" value={form.companyUrl} onChange={set('companyUrl')} />
        </div>
        <input placeholder="Preferred language (optional) — the language you'd like us to reply in" value={form.language} onChange={set('language')} />
        <VoiceRecorder value={voice} onChange={setVoice} />
        <textarea required className="big-message" placeholder="Your message — a few lines or a few pages, tell us everything" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>
    </div>
  )
}
