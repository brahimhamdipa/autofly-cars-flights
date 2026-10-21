import { useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import FlightsMenu from './FlightsMenu'
import AirportInput from './AirportInput'
import { supabase, NOTIFY_EMAIL } from '../lib/supabaseClient'

const fmtDob = (iso) => {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function buildPdf(travelers, trip, message) {
  const doc = new jsPDF()
  const left = 20
  let y = 22

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('AutoFly — Traveler Information', left, y)
  y += 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Prepared: ${new Date().toLocaleString('en-US')}`, left, y)
  y += 5
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.6)
  doc.line(left, y, 190, y)
  y += 12

  if (trip) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`Trip — ${trip.type}`, left, y)
    y += 7
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    if (trip.from) { doc.text(`From:  ${trip.from}`, left + 4, y); y += 6.5 }
    if (trip.to) { doc.text(`To:  ${trip.to}`, left + 4, y); y += 6.5 }
    if (trip.depart) { doc.text(`Depart:  ${fmtDob(trip.depart)}`, left + 4, y); y += 6.5 }
    if (trip.type === 'Round Trip' && trip.return) { doc.text(`Return:  ${fmtDob(trip.return)}`, left + 4, y); y += 6.5 }
    y += 7
  }

  travelers.forEach((t, i) => {
    if (y > 255) { doc.addPage(); y = 22 }
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`Traveler ${i + 1}`, left, y)
    y += 7
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`First Name:  ${t.first}`, left + 4, y); y += 6.5
    doc.text(`Last Name:  ${t.last}`, left + 4, y); y += 6.5
    doc.text(`Date of Birth:  ${fmtDob(t.dob)}`, left + 4, y); y += 13
  })

  if (message && message.trim()) {
    if (y > 255) { doc.addPage(); y = 22 }
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Message', left, y)
    y += 7
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    for (const line of doc.splitTextToSize(message.trim(), 166)) {
      if (y > 275) { doc.addPage(); y = 22 }
      doc.text(line, left + 4, y)
      y += 6.5
    }
  }

  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text('Submitted via autofly.us.com', left, 285)
  return doc
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const blank = () => ({ first: '', last: '', dob: '' })

export default function FlightReservationPage({ go }) {
  const [tripType, setTripType] = useState('Round Trip')
  const [trip, setTrip] = useState({ from: '', to: '', depart: '', return: '' })
  const [travelers, setTravelers] = useState([blank()])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const formRef = useRef(null)

  const setTripField = (k, v) => setTrip(prev => ({ ...prev, [k]: v }))
  const tripData = () => ({
    type: tripType,
    from: trip.from,
    to: trip.to,
    depart: trip.depart,
    return: tripType === 'Round Trip' ? trip.return : undefined,
  })

  const setT = (i, k, v) => setTravelers(prev => prev.map((t, idx) => (idx === i ? { ...t, [k]: v } : t)))
  const add = () => setTravelers(prev => (prev.length >= 20 ? prev : [...prev, blank()]))
  const remove = (i) => setTravelers(prev => prev.filter((_, idx) => idx !== i))

  const valid = () => formRef.current && formRef.current.reportValidity()

  const handleDownload = () => {
    if (!valid()) return
    buildPdf(travelers, tripData(), message).save('AutoFly-Traveler-Information.pdf')
    setStatus('✓ PDF downloaded.')
  }

  const handleSubmit = async () => {
    if (!valid()) return
    setBusy(true)
    setStatus('Sending PDF...')
    try {
      const doc = buildPdf(travelers, tripData(), message)
      const base64 = await blobToBase64(doc.output('blob'))
      const { error } = await supabase.functions.invoke('send-notification', {
        body: {
          to: NOTIFY_EMAIL,
          subject: `Traveler information (PDF) — ${travelers.length} traveler${travelers.length > 1 ? 's' : ''}`,
          table: 'traveler_pdf',
          record: {
            trip: tripData(),
            travelers: travelers.map(t => ({ first_name: t.first, last_name: t.last, date_of_birth: t.dob })),
            ...(message.trim() ? { message: message.trim() } : {}),
          },
          attachment: { filename: 'AutoFly-Traveler-Information.pdf', content: base64 },
        },
      })
      if (error) throw error
      setStatus('✓ Submitted! The PDF was emailed to our team.')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <FlightsMenu go={go} />
      <div className="hero-card">
        <h2>Flight Reservation</h2>
        <p>Tell us your trip below, then add every traveler — airlines need each traveler's full name and date of birth, exactly as they appear on their ID or passport. When you're done, send us the PDF — or download it for your records.</p>
      </div>
      <div className="form-card wide">
        <form ref={formRef} className="traveler-form" onSubmit={e => e.preventDefault()}>
          <div className="trip-tabs">
            {['One Way', 'Round Trip', 'Multi City'].map(t => (
              <button key={t} type="button" className={tripType === t ? 'active' : ''} onClick={() => setTripType(t)}>{t}</button>
            ))}
          </div>
          <div className="row">
            <AirportInput label="From" placeholder="Type city or airport" value={trip.from} onChange={v => setTripField('from', v)} />
            <AirportInput label="To" placeholder="Type city or airport" value={trip.to} onChange={v => setTripField('to', v)} />
          </div>
          <div className="row">
            <label>Depart<input required type="date" value={trip.depart} onChange={e => setTripField('depart', e.target.value)} /></label>
            {tripType === 'Round Trip' && (
              <label>Return<input type="date" value={trip.return} onChange={e => setTripField('return', e.target.value)} /></label>
            )}
          </div>
          {travelers.map((t, i) => (
            <fieldset key={i} className="traveler-card">
              <legend>Traveler {i + 1}</legend>
              {travelers.length > 1 && (
                <button type="button" className="traveler-remove" onClick={() => remove(i)}>Remove</button>
              )}
              <div className="row">
                <label>First Name<input required value={t.first} onChange={e => setT(i, 'first', e.target.value)} /></label>
                <label>Last Name<input required value={t.last} onChange={e => setT(i, 'last', e.target.value)} /></label>
              </div>
              <label>Date of Birth<input required type="date" value={t.dob} onChange={e => setT(i, 'dob', e.target.value)} /></label>
            </fieldset>
          ))}
          <button type="button" className="add-traveler" onClick={add}>+ Add another traveler</button>
          <textarea placeholder="Message — anything else we should know?" value={message} onChange={e => setMessage(e.target.value)} />
          <div className="traveler-actions">
            <button type="button" className="pdf-submit" disabled={busy} onClick={handleSubmit}>Submit as PDF</button>
            <button type="button" className="pdf-download" disabled={busy} onClick={handleDownload}>Download PDF</button>
          </div>
          <p className="hint">"Submit as PDF" emails the PDF to our team. "Download PDF" just saves it to your device.</p>
          {status && <p className="status">{status}</p>}
        </form>
      </div>
    </div>
  )
}
