import { useState } from 'react'
import { placeStoreHold, emailReceipt, buildReceiptPdf, money } from '../lib/storeData'

// Stock line, exactly like the Online Store page: green when in stock,
// red when out of stock, nothing at all when stock is not tracked
// (null — e.g. services).
export function StockLine({ stock }) {
  if (stock === null || stock === undefined) return null
  if (stock <= 0) return <p className="stock out">Out of stock</p>
  if (stock <= 10) return <p className="stock low">Only {stock} left in stock</p>
  return <p className="stock ok">{stock} available in stock</p>
}

// "Hold the item" dialog, shared by the store order page and the item
// detail page: the store holds the item until the customer contacts them
// to arrange pickup or delivery. No payment is taken online.
export function HoldModal({ item, providerName, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [status, setStatus] = useState('')
  const [receipt, setReceipt] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setStatus('Holding...')
    try {
      const res = await placeStoreHold({ itemId: item.id, ...form })
      const pdf = buildReceiptPdf({
        kind: 'hold', refId: res.hold_id, storeName: providerName,
        customer: form, lines: [{ name: res.item, price: res.price, qty: 1 }], total: res.price,
      })
      const record = {
        hold_id: res.hold_id, store: providerName, item: res.item, price: res.price,
        customer: form.name, customer_email: form.email, customer_phone: form.phone,
      }
      try {
        await emailReceipt({ subject: `New hold #${res.hold_id} — ${res.item} (${providerName})`, record, pdfBase64: pdf.base64, filename: `receipt-hold-${res.hold_id}.pdf` })
      } catch { /* hold is saved */ }
      setReceipt({ ...res, pdf, record })
      setStatus('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  const resend = async () => {
    await emailReceipt({
      subject: `Receipt hold #${receipt.hold_id} — ${receipt.item}`,
      record: receipt.record, pdfBase64: receipt.pdf.base64,
      filename: `receipt-hold-${receipt.hold_id}.pdf`,
    })
    alert('Receipt emailed to the store owner.')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        {!receipt && (
          <form onSubmit={submit} className="modal-form">
            <h3>Hold — {item.name} ({money(item.price)})</h3>
            <p className="hint">The store will hold this item for you until you contact them to arrange pickup or delivery. No payment is taken online.</p>
            <input required placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Phone" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <button type="submit">Hold this item</button>
            {status && <p className="hint">{status}</p>}
          </form>
        )}
        {receipt && (
          <div className="confirm">
            <h3>✓ Held! Hold #{receipt.hold_id} — {receipt.item}</h3>
            <p>The store is holding this item for you until you contact them to arrange pickup or delivery. No payment was taken online — you pay the store when you make your arrangement.</p>
            <div className="store-actions">
              <button type="button" onClick={() => receipt.pdf.download(`receipt-hold-${receipt.hold_id}.pdf`)}>⬇️ Download receipt</button>
              <button type="button" className="btn-soft" onClick={resend}>✉️ Email receipt</button>
              <button type="button" className="btn-soft" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
