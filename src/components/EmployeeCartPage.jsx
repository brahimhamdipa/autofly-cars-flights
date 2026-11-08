import { useState } from 'react'
import { useEmployeeCart, EMPLOYEE_PLAN_KEY, EMPLOYEE_PLAN_NAME, EMPLOYEE_PLAN_PRICE } from '../lib/EmployeeCartContext'
import { insertEmployeeOrder } from '../lib/employeeData'
import { EmployeeTopBar } from './EmployeeMenu'

// My Cart for employee time pages — mirrors DealerCartPage's
// shape (top bar, hero intro, empty state, cart lines, checkout block
// at the bottom) but for the single $20/month employee-time-page plan.
// Placing the order inserts an employee_order row and emails the
// owner, then clears the cart; the confirmation survives via
// lastOrder, same as the dealer cart. No payment is taken here — the
// owner follows up to set the team up. Connecting carts to the
// bank comes later.
export default function EmployeeCartPage({ go }) {
  const { cart, count, setQty, clearCart, lastOrder, setLastOrder } = useEmployeeCart()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')

  const inCart = (cart[EMPLOYEE_PLAN_KEY] || 0) > 0

  const placeOrder = async (e) => {
    e.preventDefault()
    setSubmitting(true); setStatus('')
    try {
      await insertEmployeeOrder({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        plan: EMPLOYEE_PLAN_NAME,
        price: EMPLOYEE_PLAN_PRICE,
        note,
      }, { plan: EMPLOYEE_PLAN_NAME, price: EMPLOYEE_PLAN_PRICE })
      setLastOrder([{ plan: EMPLOYEE_PLAN_NAME, price: EMPLOYEE_PLAN_PRICE, customer_name: name }])
      clearCart()
      setName(''); setEmail(''); setPhone(''); setNote('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setSubmitting(false)
  }

  return (
    <div>
      <EmployeeTopBar go={go} />
      <div className="hero-card">
        <h2>🛒 My Cart</h2>
        <p>Your employee time page order. Place it below and AutoFly will be in touch to set up your team with your own link, login, employees and time logs.</p>
      </div>

      {count === 0 && (!lastOrder || lastOrder.length === 0) && (
        <div className="hero-card">
          <p>Your cart is empty.</p>
          <button onClick={() => go && go('employee')}>See the employee time page</button>
        </div>
      )}

      {lastOrder && lastOrder.length > 0 && (
        <div className="hero-card">
          <h3>✓ Order placed — thank you, {lastOrder[0].customer_name}!</h3>
          <p>{lastOrder[0].plan} — ${Number(lastOrder[0].price).toFixed(2)}/month. AutoFly will be in touch to set up your team.</p>
          <button onClick={() => go && go('employee')}>Back to Employee</button>
        </div>
      )}

      {inCart && (
        <div>
          <div className="hero-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <b>{EMPLOYEE_PLAN_NAME}</b>
                <div className="hint">Your own employee page + time logging, receipts and shared records, for your team.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b>${EMPLOYEE_PLAN_PRICE.toFixed(2)}/month</b>
                <div><button type="button" className="btn-mini" onClick={() => setQty(EMPLOYEE_PLAN_KEY, 0)}>Remove</button></div>
              </div>
            </div>
          </div>

          <form onSubmit={placeOrder} className="form-card">
            <h3>Checkout</h3>
            <label>Your name
              <input required placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label>Email
              <input required placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <label>Phone
              <input required placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
            </label>
            <label>Note (optional)
              <textarea placeholder="Your team name, city, anything that helps us set up your page" value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <p><b>Total: ${EMPLOYEE_PLAN_PRICE.toFixed(2)}/month</b></p>
            <button type="submit" disabled={submitting}>{submitting ? 'Placing…' : 'Place order'}</button>
            {status && <p className="status">{status}</p>}
          </form>
        </div>
      )}
    </div>
  )
}
