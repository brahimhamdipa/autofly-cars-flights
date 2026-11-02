import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { loadProviders, loadItemCategories, loadFromDel, loadToPick, loadSubCategories, syncItemLinks } from '../../lib/storeData'
import { ProviderForm, ItemForm, ProviderFormEditor, ItemCategoryForm, SubCategoryForm } from './StoreFormBits'

// Adding section: the forms live inline on the page (no popups).
// Each saves straight into its table (admin RLS: owner's email only).
// Items link to categories, options and locations right here; Manage → Items is only for editing links later.
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const blankProvider = () => ({ name: '', phone: '', email: '', address: '', city: '', country: '', zip: '', hours: '', about: '', pics: [], holdorder: false, payorder: true })

const blankItem = () => ({ provider_id: '', name: '', price: '', description: '', delivery_address: '', pickup_address: '', delivery: true, pickup: true, is_active: true, stock: '', pics: [] })

const blankItemCategory = () => ({ label: '' })

const blankSubCategory = () => ({ category_id: '', flavor: '', color: '', packof: '', size: '', weight: '', unit: '' })

const blankProviderForm = () => ({ provider_id: '', f: '', u: '', p: '', comment: '' })

export default function AdminStoreAdd() {
  const [providers, setProviders] = useState([])
  const [itemCategories, setItemCategories] = useState([])
  const [status, setStatus] = useState('')
  const [p, setP] = useState(blankProvider)
  const [it, setIt] = useState(blankItem)
  const [ic, setIc] = useState(blankItemCategory)
  const [sc, setSc] = useState(blankSubCategory)
  const [forms, setForms] = useState([])
  const [pf, setPf] = useState(blankProviderForm)
  const [fromdel, setFromdel] = useState([])
  const [topick, setTopick] = useState([])
  const [subcats, setSubcats] = useState([])
  const [link, setLink] = useState({ categoryIds: [], fromdelIds: [], topickIds: [], subcategoryIds: [] })

  const loadForms = () => supabase.from('providersForm').select('provider_id, f').then(({ data }) => setForms(data || [])).catch(() => {})

  useEffect(() => {
    loadProviders().then(setProviders).catch(() => {})
    loadItemCategories().then(setItemCategories).catch(() => {})
    loadForms()
    loadFromDel().then(setFromdel).catch(() => {})
    loadToPick().then(setTopick).catch(() => {})
    loadSubCategories().then(setSubcats).catch(() => {})
  }, [])
  const toggleLink = (kind, id) => {
    setLink(prev => {
      const key = kind === 'cat' ? 'categoryIds' : kind === 'from' ? 'fromdelIds' : kind === 'to' ? 'topickIds' : 'subcategoryIds'
      const next = { ...prev }
      next[key] = prev[key].includes(id) ? prev[key].filter(x => x !== id) : [...prev[key], id]
      // Unchecking a category also drops that category's subcategory picks.
      if (kind === 'cat' && prev[key].includes(id)) {
        const subIds = subcats.filter(s => s.category_id === id).map(s => s.id)
        next.subcategoryIds = next.subcategoryIds.filter(x => !subIds.includes(x))
      }
      return next
    })
  }

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
  const { data, error } = await supabase.from('store_items').insert({
      provider_id: Number(it.provider_id), name: it.name,
      price: Number(it.price), description: it.description, delivery_address: it.delivery_address,
      pickup_address: it.pickup_address, delivery: it.delivery, pickup: it.pickup,
      is_active: it.is_active,
      stock: it.stock === '' ? null : Number(it.stock),
      pics: it.pics,
      barCode: it.barCode || '',
    }).select('id').single()
    if (error) { setStatus('Error: ' + error.message); return }
    try {
      await syncItemLinks(data.id, { categoryIds: link.categoryIds, fromdelIds: link.fromdelIds, topickIds: link.topickIds, subcategoryIds: link.subcategoryIds })
    } catch (linkErr) {
      setStatus(`✓ Item "${it.name}" saved, but its links failed: ${linkErr.message}`)
      setIt(blankItem())
      setLink({ categoryIds: [], fromdelIds: [], topickIds: [], subcategoryIds: [] })
      return
    }
    setStatus(`✓ Item "${it.name}" saved.`)
    setIt(blankItem())
    setLink({ categoryIds: [], fromdelIds: [], topickIds: [], subcategoryIds: [] })
  }

  const saveItemCategory = async (e) => {
    e.preventDefault()
    setStatus('Saving...')
    const { error } = await supabase.from('category').insert({ label: ic.label, slug: slugify(ic.label) })
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Item category "${ic.label}" saved.`)
    setIc(blankItemCategory())
    loadItemCategories().then(setItemCategories).catch(() => {})
  }

  const saveSubCategory = async (e) => {
    e.preventDefault()
    setStatus('Saving...')
    const { error } = await supabase.from('subCategory').insert({
      category_id: Number(sc.category_id), flavor: sc.flavor, color: sc.color,
      packof: sc.packof === '' || sc.packof === null ? null : Number(sc.packof),
      size: sc.size, weight: sc.weight === '' || sc.weight === null ? null : Number(sc.weight), unit: sc.unit,
    })
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Sub category saved.`)
    setSc(blankSubCategory())
  }

  const saveProviderForm = async (e) => {
    e.preventDefault()
    const f = slugify(pf.f || '')
    if (!f) { setStatus('Error: the form name has to contain a letter or number.'); return }
    if (f === 'admin') { setStatus('Error: "admin" is reserved — pick another form name.'); return }
    const { data: passRows } = await supabase.from('fPasses').select('id').eq('formName', f)
    if (passRows && passRows.length > 0) { setStatus('That form name is already used by an employee pass — pick another.'); return }
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
        <p>Each form below saves straight into its table. Providers must exist before you add items for them; link items to categories, options and locations right here — Manage → Items is only needed to edit links later.</p>
        {status && <p className="hint">{status}</p>}
      </div>

      <h3>➕ Add Provider</h3>
      <ProviderForm draft={p} setDraft={setP} onSubmit={saveProvider} submitLabel="Save provider" />

      <h3>➕ Add Item</h3>
      <ItemForm draft={it} setDraft={setIt} onSubmit={saveItem} submitLabel="Save item" providers={providers} linkData={{ itemCategories, fromdel, topick, subcats, selected: link, onToggle: toggleLink }} />

      <h3>➕ Add Item Category</h3>
      <ItemCategoryForm draft={ic} setDraft={setIc} onSubmit={saveItemCategory} submitLabel="Save item category" />

      <h3>➕ Add Sub Category</h3>
      <SubCategoryForm draft={sc} setDraft={setSc} onSubmit={saveSubCategory} submitLabel="Save sub category" itemCategories={itemCategories} />

      <h3>➕ Create Provider Form</h3>
      <p className="hint">A temporary login form for one store: the store opens autofly.us.com/&lt;form name&gt;, logs in with the username and password you set here, and submits items straight into that store's items. Delete the form in Manage when they are done — items already submitted stay.</p>
      <ProviderFormEditor draft={pf} setDraft={setPf} onSubmit={saveProviderForm} submitLabel="Save provider form" providers={providers} takenProviderIds={forms.map(x => x.provider_id)} />
    </div>
  )
}
