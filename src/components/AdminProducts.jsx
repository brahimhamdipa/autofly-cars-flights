import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { money, priceOf } from './CartCheckout'

const CATEGORIES = ['Groceries', 'Fresh Fish', 'Produce', 'Dairy & Eggs', 'Bakery', 'Meats', 'Lunches/Snacks', 'Drinks', 'Snacks', 'Household', 'Other']
const BLANK = {
  name: '', description: '', category: 'Groceries', price: '', sale_price: '',
  unit: 'each', stock: '', sku: '', brand: '', weight: '', tags: '',
  delivery_address: '', pickup_address: '', sort_order: '', is_available: true, images: [],
}

const storagePathFromUrl = (url) => {
  const marker = '/storage/v1/object/public/product-images/'
  const i = (url || '').indexOf(marker)
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null
}

// Product editor: every field of grocery_products, plus multi-picture
// uploads to the product-images storage bucket (the URLs are saved in the
// product's `images` list and shown as the shop slideshow).
export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(BLANK)
  const [editingId, setEditingId] = useState(null)
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    const { data, error } = await supabase
      .from('grocery_products')
      .select('*')
      .order('sort_order')
      .order('name')
    if (error) setStatus('Error loading products: ' + error.message)
    else setProducts(data || [])
  }
  useEffect(() => { load() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const startEdit = (p) => {
    setEditingId(p.id)
    setForm({
      ...BLANK, ...p,
      price: String(p.price ?? ''), sale_price: p.sale_price == null ? '' : String(p.sale_price),
      stock: String(p.stock ?? ''), sort_order: String(p.sort_order ?? ''),
      images: Array.isArray(p.images) ? p.images : [],
    })
    setStatus(`Editing "${p.name}" — change anything and tap Save product.`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startNew = () => { setEditingId(null); setForm(BLANK); setStatus('New product — fill it in and tap Save product.') }

  const uploadPictures = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    setStatus(`Uploading ${files.length} picture(s)...`)
    const urls = []
    try {
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
        const { error } = await supabase.storage.from('product-images').upload(path, file)
        if (error) throw error
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
      setForm(f => ({ ...f, images: [...f.images, ...urls] }))
      setStatus(`✓ ${urls.length} picture(s) uploaded — remember to Save product.`)
    } catch (err) {
      setStatus('Upload error: ' + err.message)
    }
    setUploading(false)
  }

  const removePicture = async (url) => {
    setForm(f => ({ ...f, images: f.images.filter(u => u !== url) }))
    const path = storagePathFromUrl(url)
    if (path) { try { await supabase.storage.from('product-images').remove([path]) } catch { /* best effort */ } }
  }

  const save = async (e) => {
    e.preventDefault()
    const payload = {
      name: form.name.trim(),
      description: form.description || '',
      category: form.category || 'Groceries',
      price: parseFloat(form.price) || 0,
      sale_price: form.sale_price === '' ? null : parseFloat(form.sale_price),
      unit: form.unit || 'each',
      stock: parseInt(form.stock, 10) || 0,
      sku: form.sku || '', brand: form.brand || '', weight: form.weight || '', tags: form.tags || '',
      delivery_address: form.delivery_address || '',
      pickup_address: form.pickup_address || '',
      sort_order: parseInt(form.sort_order, 10) || 0,
      is_available: !!form.is_available,
      images: form.images || [],
      image_url: (form.images && form.images[0]) || '',
      updated_at: new Date().toISOString(),
    }
    if (!payload.name) { setStatus('Please give the product a name.'); return }
    setStatus('Saving...')
    try {
      let doneMsg
      if (editingId) {
        const { error } = await supabase.from('grocery_products').update(payload).eq('id', editingId)
        if (error) throw error
        doneMsg = `✓ "${payload.name}" updated.`
      } else {
        const { error } = await supabase.from('grocery_products').insert(payload)
        if (error) throw error
        doneMsg = `✓ "${payload.name}" added to the store.`
      }
      setEditingId(null)
      setForm(BLANK)
      setStatus(doneMsg)
      load()
    } catch (err) {
      setStatus('Save error: ' + err.message)
    }
  }

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}" from the store? This cannot be undone.`)) return
    const { error } = await supabase.from('grocery_products').delete().eq('id', p.id)
    if (error) { setStatus('Delete error: ' + error.message); return }
    if (editingId === p.id) startNew()
    setStatus(`"${p.name}" deleted.`)
    load()
  }

  return (
    <div>
      <div className="hero-card">
        <h2>🛒 Products & Stock</h2>
        <p>Add and edit everything the shop sells. Pictures you upload here become the product's slideshow on the Groceries page, and the stock number is what customers see under each product.</p>
        <button type="button" className="no-print" onClick={startNew}>➕ Add new product</button>
      </div>

      <form className="form-card wide no-print" onSubmit={save}>
        <h3>{editingId ? 'Edit product' : 'New product'}</h3>
        <div className="row">
          <input required placeholder="Product name *" value={form.name} onChange={e => set('name', e.target.value)} />
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <textarea placeholder="Description" value={form.description} onChange={e => set('description', e.target.value)} />
        <div className="row">
          <input placeholder="Price ($) *" type="number" step="0.01" min="0" value={form.price} onChange={e => set('price', e.target.value)} />
          <input placeholder="Sale price ($) — optional" type="number" step="0.01" min="0" value={form.sale_price} onChange={e => set('sale_price', e.target.value)} />
          <input placeholder="Unit (each, lb, pack...)" value={form.unit} onChange={e => set('unit', e.target.value)} />
        </div>
        <div className="row">
          <input placeholder="Stock (how many available)" type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} />
          <input placeholder="Display order (0 = first)" type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} />
        </div>
        <div className="row">
          <input placeholder="Brand" value={form.brand} onChange={e => set('brand', e.target.value)} />
          <input placeholder="Weight / size" value={form.weight} onChange={e => set('weight', e.target.value)} />
          <input placeholder="SKU / code" value={form.sku} onChange={e => set('sku', e.target.value)} />
        </div>
        <input placeholder="Tags (comma separated)" value={form.tags} onChange={e => set('tags', e.target.value)} />
        <input placeholder="Delivery address (where this item ships from)" value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} />
        <input placeholder="Pickup address (where customers pick this item up)" value={form.pickup_address} onChange={e => set('pickup_address', e.target.value)} />
        <label className="check-row">
          <input type="checkbox" checked={form.is_available} onChange={e => set('is_available', e.target.checked)} />
          Available for sale (visible in the shop)
        </label>

        <div className="img-upload-box">
          <b>Product pictures</b> <span className="hint">(shown as a slideshow — first picture is the main one)</span>
          <div className="img-thumbs">
            {form.images.map((url, i) => (
              <span key={url + i} className="img-thumb">
                <img src={url} alt={`Product picture ${i + 1}`} />
                <button type="button" onClick={() => removePicture(url)} aria-label="Remove picture">✕</button>
              </span>
            ))}
            {form.images.length === 0 && <span className="hint">No pictures yet.</span>}
          </div>
          <label className="upload-btn">
            {uploading ? 'Uploading...' : '📷 Upload pictures'}
            <input type="file" accept="image/*" multiple hidden onChange={uploadPictures} disabled={uploading} />
          </label>
        </div>

        <button type="submit">Save product</button>
        {status && <p className="status">{status}</p>}
      </form>

      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Available</th><th className="no-print">Actions</th></tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td>{(Array.isArray(p.images) && p.images[0]) || p.image_url
                  ? <img className="thumb-sm" src={(Array.isArray(p.images) && p.images[0]) || p.image_url} alt="" />
                  : <span className="thumb-sm thumb-empty">🛒</span>}</td>
                <td><b>{p.name}</b>{p.brand ? <><br /><small>{p.brand}</small></> : null}</td>
                <td>{p.category}</td>
                <td>{p.sale_price ? <>{money(priceOf(p))} <small>(was {money(p.price)})</small></> : money(p.price)}</td>
                <td className={p.stock <= 0 ? 'cell-bad' : p.stock <= 10 ? 'cell-warn' : ''}>{p.stock}</td>
                <td>{p.is_available ? 'Yes' : '—'}</td>
                <td className="no-print">
                  <button type="button" className="btn-mini" onClick={() => startEdit(p)}>Edit</button>{' '}
                  <button type="button" className="btn-mini btn-danger" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
