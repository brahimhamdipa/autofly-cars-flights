import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { loadProviders, loadCategories } from '../../lib/storeData'
import { Modal, PicField } from './StoreFormBits'

// Adding section: three popup forms — Add Provider, Add Item, Add Category.
// Each saves straight into its table (admin RLS: owner's email only).
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function AdminStoreAdd() {
  const [which, setWhich] = useState(null)
  const [providers, setProviders] = useState([])
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    loadProviders().then(setProviders).catch(() => {})
    loadCategories().then(setCategories).catch(() => {})
  }, [])

  const [p, setP] = useState({ name: '', phone: '', email: '', address: '', city: '', country: '', zip: '', hours: '', about: '', pics: [] })
  const [it, setIt] = useState({ provider_id: '', category_id: '', name: '', price: '', description: '', delivery_address: '', pickup_address: '', delivery: true, pickup: true, is_active: true, online: false, stock: '', pics: [] })
  const [cat, setCat] = useState({ name: '' })

  const saveProvider = async (e) => {
    e.preventDefault()
    setStatus('Saving...')
    const { error } = await supabase.from('store_providers').insert({
      name: p.name, phone: p.phone, email: p.email, address: p.address, city: p.city,
      country: p.country, zip: p.zip, hours: p.hours, about: p.about, pics: p.pics,
    })
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Provider "${p.name}" saved.`)
    setWhich(null)
    loadProviders().then(setProviders).catch(() => {})
  }

  const saveItem = async (e) => {
    e.preventDefault()
    setStatus('Saving...')
    const { error } = await supabase.from('store_items').insert({
      provider_id: Number(it.provider_id), category_id: Number(it.category_id), name: it.name,
      price: Number(it.price), description: it.description, delivery_address: it.delivery_address,
      pickup_address: it.pickup_address, delivery: it.delivery, pickup: it.pickup,
      is_active: it.is_active, online: it.online,
      stock: it.stock === '' ? null : Number(it.stock),
      pics: it.pics,
    })
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Item "${it.name}" saved.`)
    setWhich(null)
  }

  const saveCategory = async (e) => {
    e.preventDefault()
    setStatus('Saving...')
    const { error } = await supabase.from('store_categories').insert({ name: cat.name, slug: slugify(cat.name) })
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Category "${cat.name}" saved.`)
    setWhich(null)
    loadCategories().then(setCategories).catch(() => {})
  }

  return (
    <div>
      <div className="hero-card">
        <h2>➕ Add to the store tables</h2>
        <p>Each button opens a form that saves straight into its table. Providers and categories must exist before you add items that use them.</p>
        <div className="store-actions">
          <button onClick={() => setWhich('provider')}>➕ Add Provider</button>
          <button onClick={() => setWhich('item')}>➕ Add Item</button>
          <button onClick={() => setWhich('category')}>➕ Add Category</button>
        </div>
        {status && <p className="hint">{status}</p>}
      </div>

      {which === 'provider' && (
        <Modal title="Add Provider" onClose={() => setWhich(null)}>
          <form onSubmit={saveProvider} className="modal-form">
            <input required placeholder="Store name" value={p.name} onChange={e => setP({ ...p, name: e.target.value })} />
            <input placeholder="Phone" value={p.phone} onChange={e => setP({ ...p, phone: e.target.value })} />
            <input placeholder="Email" type="email" value={p.email} onChange={e => setP({ ...p, email: e.target.value })} />
            <input placeholder="Address" value={p.address} onChange={e => setP({ ...p, address: e.target.value })} />
            <input placeholder="City" value={p.city} onChange={e => setP({ ...p, city: e.target.value })} />
            <input placeholder="Country" value={p.country} onChange={e => setP({ ...p, country: e.target.value })} />
            <input placeholder="Zip code" value={p.zip} onChange={e => setP({ ...p, zip: e.target.value })} />
            <input placeholder="Hours" value={p.hours} onChange={e => setP({ ...p, hours: e.target.value })} />
            <textarea placeholder="About the store" value={p.about} onChange={e => setP({ ...p, about: e.target.value })} />
            <PicField pics={p.pics} setPics={pics => setP({ ...p, pics })} />
            <button type="submit">Save provider</button>
          </form>
        </Modal>
      )}

      {which === 'item' && (
        <Modal title="Add Item" onClose={() => setWhich(null)}>
          <form onSubmit={saveItem} className="modal-form">
            <select required value={it.provider_id} onChange={e => setIt({ ...it, provider_id: e.target.value })}>
              <option value="">— Provider —</option>
              {providers.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
            </select>
            <select required value={it.category_id} onChange={e => setIt({ ...it, category_id: e.target.value })}>
              <option value="">— Category —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input required placeholder="Item name" value={it.name} onChange={e => setIt({ ...it, name: e.target.value })} />
            <input required placeholder="Price" type="number" step="0.01" min="0" value={it.price} onChange={e => setIt({ ...it, price: e.target.value })} />
            <textarea placeholder="Description" value={it.description} onChange={e => setIt({ ...it, description: e.target.value })} />
            <input placeholder="Delivery address (where delivery comes from)" value={it.delivery_address} onChange={e => setIt({ ...it, delivery_address: e.target.value })} />
            <input placeholder="Pickup address (where to pick up)" value={it.pickup_address} onChange={e => setIt({ ...it, pickup_address: e.target.value })} />
            <label><input type="checkbox" checked={it.delivery} onChange={e => setIt({ ...it, delivery: e.target.checked })} /> Delivery available</label>
            <label><input type="checkbox" checked={it.pickup} onChange={e => setIt({ ...it, pickup: e.target.checked })} /> Pickup available</label>
            <label><input type="checkbox" checked={it.is_active} onChange={e => setIt({ ...it, is_active: e.target.checked })} /> Show this item on the site (uncheck to hide it)</label>
            <label><input type="checkbox" checked={it.online} onChange={e => setIt({ ...it, online: e.target.checked })} /> Sell this item on the Online Store page (otherwise it shows on "Groceries / General Products" for Store products)</label>
            <input placeholder="Stock (how many available — leave empty if not tracked, e.g. services)" type="number" min="0" value={it.stock} onChange={e => setIt({ ...it, stock: e.target.value })} />
            <PicField pics={it.pics} setPics={pics => setIt({ ...it, pics })} />
            <button type="submit">Save item</button>
          </form>
        </Modal>
      )}

      {which === 'category' && (
        <Modal title="Add Category" onClose={() => setWhich(null)}>
          <form onSubmit={saveCategory} className="modal-form">
            <input required placeholder="Category name (e.g. Bakery)" value={cat.name} onChange={e => setCat({ name: e.target.value })} />
            <p className="hint">The category's link name is made from this automatically (e.g. "Bakery" → bakery).</p>
            <button type="submit">Save category</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
