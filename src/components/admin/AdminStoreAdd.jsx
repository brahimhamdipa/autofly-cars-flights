import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { loadProviders, loadCategories } from '../../lib/storeData'
import { ProviderForm, ItemForm, CategoryForm, ProviderFormEditor } from './StoreFormBits'

// Adding section: the three forms live inline on the page (no popups).
// Each saves straight into its table (admin RLS: owner's email only).
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const blankProvider = () => ({ name: '', phone: '', email: '', address: '', city: '', country: '', zip: '', hours: '', about: '', pics: [], holdorder: false, payorder: true })
const blankItem = () => ({ provider_id: '', category_id: '', name: '', price: '', description: '', delivery_address: '', pickup_address: '', delivery: true, pickup: true, is_active: true, online: false, stock: '', pics: [] })
const blankCategory = () => ({ name: '' })
const blankProviderForm = () => ({ provider_id: '', f: '', u: '', p: '', comment: '' })

export default function AdminStoreAdd() {
  const [providers, setProviders] = useState([])
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('')

  const [p, setP] = useState(blankProvider)
  const [it, setIt] = useState(blankItem)
  const [cat, setCat] = useState(blankCategory)
  const [forms, setForms] = useState([])
  const [pf, setPf] = useState(blankProviderForm)

  const loadForms = () => supabase.from('providersForm').select('provider_id, f').then(({ data }) => setForms(data || [])).catch(() => {})
  useEffect(() => {
    loadProviders().then(setProviders).catch(() => {})
    loadCategories().then(setCategories).catch(() => {})
    loadForms()
  }, [])

  const saveProvider = async (e) => {
    e.preventDefault()
    setStatus('Saving...')
    const { error } = await supabase.from('store_providers').insert({
      name: p.name, phone: p.phone, email: p.email, address: p.address, city: p.city,
      country: p.country, zip: p.zip, hours: p.hours, about: p.about, pics: p.pics,
      holdorder: !!p.holdorder, payorder: p.payorder !== false,
    })
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Provider "${p.name}" saved.`)
    setP(blankProvider())
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
    setIt(blankItem())
  }

  const saveCategory = async (e) => {
    e.preventDefault()
    setStatus('Saving...')
    const { error } = await supabase.from('store_categories').insert({ name: cat.name, slug: slugify(cat.name) })
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Category "${cat.name}" saved.`)
    setCat(blankCategory())
    loadCategories().then(setCategories).catch(() => {})
  }

  const saveProviderForm = async (e) => {
    e.preventDefault()
    const f = slugify(pf.f || '')
    if (!f) { setStatus('Error: the form name has to contain a letter or number.'); return }
    if (f === 'admin') { setStatus('Error: "admin" is reserved — pick another form name.'); return }
    setStatus('Saving...')
    const { error } = await supabase.from('providersForm').insert({
      provider_id: Number(pf.provider_id), f, u: pf.u, p: pf.p, comment: pf.comment,
    })
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Provider form saved — the store opens autofly.us.com/${f} and logs in with the username and password above.`)
    setPf(blankProviderForm())
    loadForms()
  }

  return (
    <div>
      <div className="hero-card">
        <h2>➕ Add to the store tables</h2>
        <p>Each form below saves straight into its table. Providers and categories must exist before you add items that use them.</p>
        {status && <p className="hint">{status}</p>}
      </div>

      <h3>➕ Add Provider</h3>
      <ProviderForm draft={p} setDraft={setP} onSubmit={saveProvider} submitLabel="Save provider" />

      <h3>➕ Add Item</h3>
      <ItemForm draft={it} setDraft={setIt} onSubmit={saveItem} submitLabel="Save item" providers={providers} categories={categories} />

      <h3>➕ Add Category</h3>
      <CategoryForm draft={cat} setDraft={setCat} onSubmit={saveCategory} submitLabel="Save category" />

      <h3>➕ Create Provider Form</h3>
      <p className="hint">A temporary login form for one store: the store opens autofly.us.com/&lt;form name&gt;, logs in with the username and password you set here, and submits items straight into that store's items. Delete the form in Manage when they are done — items already submitted stay.</p>
      <ProviderFormEditor draft={pf} setDraft={setPf} onSubmit={saveProviderForm} submitLabel="Save provider form" providers={providers} takenProviderIds={forms.map(x => x.provider_id)} />
    </div>
  )
}
