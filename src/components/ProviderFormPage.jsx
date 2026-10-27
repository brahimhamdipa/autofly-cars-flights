import { useEffect, useState } from 'react'
import { supabase, NOTIFY_EMAIL } from '../lib/supabaseClient'
import { loadCategories } from '../lib/storeData'
import { PicField } from './admin/StoreFormBits'

// Public provider form page, reached at autofly.us.com/<form name>.
// The store owner logs in with the username and password the admin
// gave them (checked server-side — the form's row is never readable
// by visitors), then submits items one at a time: each submit inserts
// ONE row into store_items for that form's store, live immediately,
// and emails the owner. The form is temporary: when the admin deletes
// it, logins and submits stop working, but items already submitted
// stay. The store name is already filled in at the top (from the
// provider the admin picked when creating the form) — the owner never
// types it.
const blankItem = () => ({
  category_id: '', name: '', price: '', description: '',
  delivery_address: '', pickup_address: '',
  delivery: true, pickup: true, online: false, stock: '', pics: [],
})

export default function ProviderFormPage({ slug, goBack }) {
  const [categories, setCategories] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(null)
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [item, setItem] = useState(blankItem)
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadCategories().then(setCategories).catch(() => {})
  }, [])

  const login = async (e) => {
    e.preventDefault()
    setLoggingIn(true); setLoginError('')
    const { data, error } = await supabase.rpc('check_provider_form', {
      p_slug: slug, p_username: username, p_password: password,
    })
    setLoggingIn(false)
    if (error) { setLoginError('Could not open this form: ' + error.message); return }
    if (!data || !data.ok) { setLoginError('Wrong username or password for this form.'); return }
    setAuthed({ providerId: data.provider_id, providerName: data.provider_name })
  }

  const submitItem = async (e) => {
    e.preventDefault()
    setSubmitting(true); setStatus('')
    const { data, error } = await supabase.rpc('submit_provider_item', {
      p_slug: slug, p_username: username, p_password: password,
      p_category_id: Number(item.category_id),
      p_name: item.name,
      p_price: Number(item.price),
      p_description: item.description,
      p_delivery_address: item.delivery_address,
      p_pickup_address: item.pickup_address,
      p_delivery: item.delivery,
      p_pickup: item.pickup,
      p_online: item.online,
      p_stock: item.stock === '' ? null : Number(item.stock),
      p_pics: item.pics,
    })
    setSubmitting(false)
    if (error) {
      if (error.message.includes('Invalid form login')) {
        setAuthed(null)
        setLoginError('This form is no longer available — please contact AutoFly.')
      } else {
        setStatus('Error: ' + error.message)
      }
      return
    }
    setStatus(`✓ Item saved (id ${data.item_id}). Submit another one below, or close this page when you are done.`)
    setItem(blankItem())
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          to: NOTIFY_EMAIL,
          subject: `New provider item — ${authed.providerName}`,
          table: 'store_items',
          record: { store: authed.providerName, ...item, item_id: data.item_id },
        },
      })
    } catch (err) {
      setStatus(s => s + ' (Note: the item is saved, but the owner email failed.)')
    }
  }

  return (
    <div>
      <div className="hero-card">
        {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}
        <h2>📝 Provider form</h2>
        {authed
          ? <p>Add items for <b>{authed.providerName}</b> — each submit adds one item to the store.</p>
          : <p>Log in with the username and password AutoFly gave you for this form.</p>}
      </div>

      {!authed && (
        <form onSubmit={login} className="form-card">
          <input required placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <input required placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" disabled={loggingIn}>{loggingIn ? 'Opening...' : 'Open form'}</button>
          {loginError && <p className="status">{loginError}</p>}
        </form>
      )}

      {authed && (
        <form onSubmit={submitItem} className="form-card">
          <label>Store
            <input disabled value={authed.providerName} />
          </label>
          <select required value={item.category_id} onChange={e => setItem({ ...item, category_id: e.target.value })}>
            <option value="">— Category —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input required placeholder="Item name" value={item.name} onChange={e => setItem({ ...item, name: e.target.value })} />
          <input required placeholder="Price" type="number" step="0.01" min="0" value={item.price} onChange={e => setItem({ ...item, price: e.target.value })} />
          <textarea placeholder="Description" value={item.description} onChange={e => setItem({ ...item, description: e.target.value })} />
          <input placeholder="Delivery address (where delivery comes from)" value={item.delivery_address} onChange={e => setItem({ ...item, delivery_address: e.target.value })} />
          <input placeholder="Pickup address (where to pick up)" value={item.pickup_address} onChange={e => setItem({ ...item, pickup_address: e.target.value })} />
          <label><input type="checkbox" checked={item.delivery} onChange={e => setItem({ ...item, delivery: e.target.checked })} /> Delivery available</label>
          <label><input type="checkbox" checked={item.pickup} onChange={e => setItem({ ...item, pickup: e.target.checked })} /> Pickup available</label>
          <label><input type="checkbox" checked={item.online} onChange={e => setItem({ ...item, online: e.target.checked })} /> Sell this item on the Online Store page</label>
          <input placeholder="Stock (how many available — leave empty if not tracked)" type="number" min="0" value={item.stock} onChange={e => setItem({ ...item, stock: e.target.value })} />
          <PicField pics={item.pics} setPics={pics => setItem({ ...item, pics })} />
          <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Submit item'}</button>
          {status && <p className="status">{status}</p>}
        </form>
      )}
    </div>
  )
}
