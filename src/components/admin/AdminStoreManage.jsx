import { useEffect, useMemo, useRef, useState } from 'react'

import { supabase } from '../../lib/supabaseClient'

import { loadProviders, syncItemLinks, loadItemCategories, loadFromDel, loadToPick, loadSubCategories } from '../../lib/storeData'

import { ProviderForm, ItemForm, ProviderFormEditor, FromDelForm, ToPickForm, ItemCategoryForm, SubCategoryForm, JobForm, EmployeeForm, LanguageForm, EmployeePassForm, BarberStoreForm, BarberLocationForm, OpenTimeForm, BarberCustomerForm, BarberStyleForm, WebsiteDomainForm, WebsiteTypeForm, WebsiteHeaderForm, WebsiteBodyForm, WebsiteFooterForm, BarberReservationForm } from './StoreFormBits'

import { money } from '../../lib/storeData'

// Editing/Deleting section: one page per table, same pattern as the
// Products & Stock page — a form above the table (blank for a new row,
// filled when Edit is tapped) and Edit/Delete on every row. No popups.
// A provider that still has items cannot be deleted until those items
// are gone first — the database refuses it, and the error is shown
// plainly. Categories live ONLY in the new category table ("Item
// Categories" tab) and link to items via tick boxes on the Items form;
// the old store_categories table is gone.
const TABLES = [
  ['providers', 'Providers', 'store_providers'],
  ['items', 'Items', 'store_items'],
  ['forms', 'Provider Forms', 'providersForm'],
  ['fromdel', 'Delivery Locations', 'fromDel'],
  ['topick', 'Pickup Locations', 'toPick'],
  ['itemcats', 'Item Categories', 'category'],
  ['subcats', 'Sub Categories', 'subCategory'],
  ['jobs', 'Jobs', 'jobs'],
  ['employees', 'Employees', 'employees'],
  ['languages', 'Languages', 'languages'],
  ['passes', 'Employee Passes', 'fPasses'],
  ['barber_stores', 'Barber Stores', 'barber_store'],
  ['barber_locations', 'Barber Locations', 'barber_location'],
  ['open_times', 'Open Hours', 'open_time'],
  ['barber_customers', 'Barber Customers', 'barber_customer'],
  ['barber_styles', 'Barber Styles', 'barber_style'],
  ['website_domains', 'Barber Websites', 'website_domain'],
  ['website_types', 'Website Types', 'website_type'],
  ['website_headers', 'Website Headers', 'website_header'],
  ['website_bodies', 'Website Bodies', 'website_body'],
  ['website_footers', 'Website Footers', 'website_footer'],
  ['barber_reservations', 'Barber Reservations', 'barber_reservation'],
  ['barber_orders', 'Barber Orders', 'barber_order'],
  ['restaurant_orders', 'Restaurant Orders', 'restaurant_order'],
  ['intake_forms', 'Barber Intake Forms', 'barber_intake_forms'],
  ['intake_submissions', 'Barber Intake Submissions', 'barber_intake_submissions'],
  ['diner_restaurants', 'Diner Restaurants', 'diner_restaurants'],
  ['diner_approvals', 'Diner Approvals', 'diner_restaurants'],
  ['diner_orders', 'Diner Orders', 'diner_orders'],
  ['barbershop_shops', 'Barbershop Shops', 'barbershop_shops'],
  ['barbershop_approvals', 'Barbershop Approvals', 'barbershop_shops'],
  ['barbershop_bookings', 'Barbershop Bookings', 'barbershop_bookings'],
]

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const blankDraft = (table) => {
  if (table === 'providers') return { name: '', phone: '', email: '', address: '', city: '', country: '', zip: '', hours: '', about: '', pics: [], holdorder: false, payorder: true }
  if (table === 'items') return { provider_id: '', name: '', price: '', description: '', delivery_address: '', pickup_address: '', delivery: true, pickup: true, is_active: true, stock: '', pics: [] }
  if (table === 'forms') return { provider_id: '', f: '', u: '', p: '', comment: '' }
  if (table === 'fromdel') return { fname: '', faddress: '', fcity: '', fstate: '', fzip: '', fcountry: '', fcounty: '', ftownship: '', fcomment: '' }
  if (table === 'topick') return { tname: '', taddress: '', tcity: '', tstate: '', tzip: '', tcountry: '', tcounty: '', ttownship: '', tcomment: '' }
  if (table === 'itemcats') return { label: '' }
  if (table === 'subcats') return { category_id: '', flavor: '', color: '', packof: '', size: '', weight: '', unit: '' }
  if (table === 'jobs') return { jobTitle: '', jobDescription: '' }
  if (table === 'employees') return { firstName: '', lastName: '', job_id: '', address: '', city: '', zip: '', state: '', county: '', dob: '', email1: '', email2: '', pictures: [], phone1: '', phone2: '', about: '', maritalStatus: '', gender: '', notes: '' }
  if (table === 'languages') return { language: '', note: '', employee_id: '' }
  if (table === 'passes') return { employee_id: '', formName: '', u: '', p: '', note: '', chat: true }
  if (table === 'barber_stores') return { store_name: '', owner_name: '', tel: '', email: '', url: '', about: '', pics: [], text_message: false }
  if (table === 'barber_locations') return { store_id: '', address: '', city: '', zip: '', state: '', country: '', county: '', township: '', note: '' }
  if (table === 'open_times') return { store_id: '', monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '', closed: '', hours_may_differ: false }
  if (table === 'barber_customers') return { store_id: '', fname: '', lname: '', location_gps: '', note: '' }
  if (table === 'barber_styles') return { store_id: '', name: '', price: '', description: '', time_to_finish: '', pics: [] }
  if (table === 'website_domains') return { store_id: '', type_id: '', slug: '', domain: '', description: '', note: '', tel: '', email1: '', email2: '' }
  if (table === 'website_types') return { name: '', description: '', note: '', pics: [] }
  if (table === 'website_headers') return { domain_id: '', header_name: '', header_logo: [], header_slogan: '', header_description: '', header_note: '' }
  if (table === 'website_bodies') return { domain_id: '', name: '', description: '', note: '', text1: '', text2: '', text3: '', text4: '', text5: '', h1: '', h2: '', h3: '', h4: '', h5: '', pics: [] }
  if (table === 'website_footers') return { domain_id: '', footer_name: '', footer_logo: [], footer_slogan: '', footer_description: '', footer_note: '' }
  if (table === 'barber_reservations') return { store_id: '', domain_id: '', style_id: '', customer_name: '', customer_phone: '', customer_email: '', reservation_date: '', reservation_time: '', note: '', status: 'pending' }
  if (table === 'barber_orders') return { customer_name: '', customer_email: '', customer_phone: '', plan: 'Barber website', price: 10, note: '' }
  if (table === 'restaurant_orders') return { customer_name: '', customer_email: '', customer_phone: '', plan: 'Restaurant ordering page', price: 20, note: '' }
  if (table === 'intake_forms') return { f: '', u: '', p: '', note: '' }
  if (table === 'intake_submissions') return {}
  if (table === 'diner_restaurants') return { slug: '', name: '', u: '', p: '', epass: '', note: '' }
  if (table === 'diner_approvals') return {}
  if (table === 'diner_orders') return {}
  if (table === 'barbershop_shops') return { slug: '', name: '', u: '', p: '', epass: '', note: '' }
  if (table === 'barbershop_approvals') return {}
  if (table === 'barbershop_bookings') return {}
  return { name: '' }
}

function DinerRestaurantForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Restaurant name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input required placeholder="Slug — the word in autofly.us.com/diner?r=slug" value={draft.slug || ''} onChange={e => setDraft({ ...draft, slug: e.target.value })} />
      <p className="hint">The customer shares autofly.us.com/diner?r={(draft.slug || 'slug').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} with their own customers. New restaurants start with the demo menu.</p>
      <input required placeholder="Username for the restaurant" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the restaurant" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">This login is what you sell — use a throwaway password you invent for this restaurant, never your own password. Only you can see it here.</p>
      <input placeholder="Employee password (optional — one shared password for ordering + kitchen)" value={draft.epass || ''} onChange={e => setDraft({ ...draft, epass: e.target.value })} />
      <p className="hint">Give this to the owner with the login above. Anyone with the restaurant link sees the menu, but ordering and the kitchen need this password. Leave it empty and the restaurant stays fully open, as before.</p>
      <input placeholder="Note for yourself (optional — not shown to the restaurant)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

function BarbershopShopForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Shop name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input required placeholder="Slug — the word in autofly.us.com/barbers?s=slug" value={draft.slug || ''} onChange={e => setDraft({ ...draft, slug: e.target.value })} />
      <p className="hint">The customer shares autofly.us.com/barbers?s={(draft.slug || 'slug').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} with their own customers. New shops start with the demo services.</p>
      <input required placeholder="Username for the shop" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the shop" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">This login is what you sell — use a throwaway password you invent for this shop, never your own password. Only you can see it here.</p>
      <input placeholder="Employee password (optional — one shared password for Bookings)" value={draft.epass || ''} onChange={e => setDraft({ ...draft, epass: e.target.value })} />
      <p className="hint">Give this to the owner with the login above. Anyone can book, but Bookings needs this password. Leave it empty and Bookings stays fully open, as before.</p>
      <input placeholder="Note for yourself (optional — not shown to the shop)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

function IntakeFormForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Form name — given to the barber for login" value={draft.f || ''} onChange={e => setDraft({ ...draft, f: e.target.value })} />
      <p className="hint">The barber logs in at autofly.us.com/barber-intake with this form name, a username, and a password.</p>
      <input required placeholder="Username for the barber" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the barber" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">Use a throwaway password you invent for this barber — never your own password. Only you can see it here.</p>
      <input placeholder="Note for yourself (optional — not shown to the barber)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

export default function AdminStoreManage() {

  const [table, setTable] = useState('providers')

  const [rows, setRows] = useState(null)

  const [providers, setProviders] = useState([])

  // Lists the Items form links against (new category table, locations).
  const [itemCategories, setItemCategories] = useState([])

  const [fromdel, setFromdel] = useState([])

  const [topick, setTopick] = useState([])
  const [subcats, setSubcats] = useState([])
  const [jobsList, setJobsList] = useState([])
  const [employeesList, setEmployeesList] = useState([])
  const [barberStores, setBarberStores] = useState([])
  const [websiteTypes, setWebsiteTypes] = useState([])
  const [websiteDomains, setWebsiteDomains] = useState([])
  const [barberStyles, setBarberStyles] = useState([])
  const [intakeFormsList, setIntakeFormsList] = useState([])
  const [detail, setDetail] = useState(null)
  const [pageWord, setPageWord] = useState('')
  const [dinerRestaurantsList, setDinerRestaurantsList] = useState([])
  const [barbershopShopsList, setBarbershopShopsList] = useState([])

  const [query, setQuery] = useState('')

  const [draft, setDraft] = useState(() => blankDraft('providers'))

  const [status, setStatus] = useState('')

  const [menuOpen, setMenuOpen] = useState(false)

  const menuRef = useRef(null)

  const tableName = TABLES.find(t => t[0] === table)[2]

  const tableLabel = TABLES.find(t => t[0] === table)[1]

  const reload = () => {
    setRows(null)
    let q = supabase.from(tableName).select('*').order('name')
    if (table === 'items') q = supabase.from(tableName).select('*, provider:store_providers(name)').order('pending_approval', { ascending: false }).order('name')
    if (table === 'forms') q = supabase.from(tableName).select('*').order('f')
    if (table === 'fromdel') q = supabase.from(tableName).select('*').order('fname')
    if (table === 'topick') q = supabase.from(tableName).select('*').order('tname')
    if (table === 'itemcats') q = supabase.from(tableName).select('*').order('label')
    if (table === 'subcats') q = supabase.from(tableName).select('*').order('id')
    if (table === 'jobs') q = supabase.from(tableName).select('*').order('id')
    if (table === 'employees') q = supabase.from(tableName).select('*').order('id')
    if (table === 'languages') q = supabase.from(tableName).select('*').order('id')
    if (table === 'passes') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_stores') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_locations') q = supabase.from(tableName).select('*').order('id')
    if (table === 'open_times') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_customers') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_styles') q = supabase.from(tableName).select('*').order('id')
    if (table === 'website_domains') q = supabase.from(tableName).select('*').order('id')
    if (table === 'website_types') q = supabase.from(tableName).select('*').order('id')
    if (table === 'website_headers') q = supabase.from(tableName).select('*').order('id')
    if (table === 'website_bodies') q = supabase.from(tableName).select('*').order('id')
    if (table === 'website_footers') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_reservations') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_orders') q = supabase.from(tableName).select('*').order('id')
    if (table === 'restaurant_orders') q = supabase.from(tableName).select('*').order('id')
    if (table === 'intake_forms') q = supabase.from(tableName).select('*').order('f')
    if (table === 'intake_submissions') q = supabase.from(tableName).select('*').order('status', { ascending: false }).order('id')
    if (table === 'diner_approvals') q = supabase.from(tableName).select('*').eq('draft_status', 'pending').order('id')
    if (table === 'diner_orders') q = supabase.from(tableName).select('*').order('id', { ascending: false })
    if (table === 'barbershop_approvals') q = supabase.from(tableName).select('*').eq('draft_status', 'pending').order('id')
    if (table === 'barbershop_bookings') q = supabase.from(tableName).select('*').order('id', { ascending: false })
    q.then(({ data, error }) => {
      if (error) { setStatus('Error: ' + error.message); setRows([]) }
      else setRows(data || [])
    })
    loadProviders().then(setProviders).catch(() => {})
    loadItemCategories().then(setItemCategories).catch(() => {})
    loadFromDel().then(setFromdel).catch(() => {})
    loadToPick().then(setTopick).catch(() => {})
    loadSubCategories().then(setSubcats).catch(() => {})
                                               supabase.from('jobs').select('*').order('id').then(({ data}) => setJobsList(data || [])).catch(() => {})
                                                                                                                                              supabase.from('employees').select('*').order('id').then(({ data}) => setEmployeesList(data || [])).catch(() => {})
    supabase.from('barber_store').select('*').order('id').then(({ data }) => setBarberStores(data || [])).catch(() => {})
    supabase.from('website_type').select('*').order('id').then(({ data }) => setWebsiteTypes(data || [])).catch(() => {})
    supabase.from('website_domain').select('*').order('id').then(({ data }) => setWebsiteDomains(data || [])).catch(() => {})
    supabase.from('barber_style').select('*').order('id').then(({ data }) => setBarberStyles(data || [])).catch(() => {})
    supabase.from('barber_intake_forms').select('id,f').order('f').then(({ data }) => setIntakeFormsList(data || [])).catch(() => {})
    supabase.from('diner_restaurants').select('id,slug,name').order('name').then(({ data }) => setDinerRestaurantsList(data || [])).catch(() => {})
    supabase.from('barbershop_shops').select('id,slug,name').order('name').then(({ data }) => setBarbershopShopsList(data || [])).catch(() => {})
  }

  useEffect(reload, [table])

  // Outside tap closes the table submenu (same pattern as the website menus).
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const pickTable = (key) => {
    setTable(key)
    setDraft(blankDraft(key))
    setDetail(null)
    setStatus('')
    setMenuOpen(false)
  }

  const filtered = useMemo(() => {
    if (!rows) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(needle))
  }, [rows, query])

  // One label per row, used by the Name cell and the delete confirm.
  const rowLabel = (r) => table === 'forms' ? r.f : table === 'fromdel' ? r.fname : table === 'topick' ? r.tname : table === 'itemcats' ? r.label : table === 'subcats' ? (r.flavor || r.color || ('Sub #' + r.id)) : table === 'jobs' ? r.jobTitle : table === 'employees' ? `${r.firstName} ${r.lastName || ''}`.trim() : table === 'languages' ? r.language : table === 'passes' ? r.formName : table === 'barber_stores' ? r.store_name : table === 'barber_locations' ? r.address : table === 'open_times' ? ('Hours for store ' + r.store_id) : table === 'barber_customers' ? `${r.fname} ${r.lname || ''}`.trim() : table === 'website_domains' ? r.slug : table === 'website_headers' ? r.header_name : table === 'website_footers' ? r.footer_name : table === 'barber_reservations' ? r.customer_name : table === 'barber_orders' ? r.customer_name : table === 'restaurant_orders' ? r.customer_name : table === 'intake_forms' ? r.f : table === 'intake_submissions' ? ((r.payload && r.payload.shop_name) || ('Submission #' + r.id)) : table === 'diner_restaurants' ? r.name : table === 'diner_approvals' ? r.name : table === 'diner_orders' ? ('Order #' + r.id) : table === 'barbershop_shops' ? r.name : table === 'barbershop_approvals' ? r.name : table === 'barbershop_bookings' ? ('Booking #' + r.id) : r.name

  const remove = async (row) => {
    const label = rowLabel(row)
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return
    const { error } = await supabase.from(tableName).delete().eq('id', row.id)
    if (error) { setStatus('Cannot delete: ' + error.message + (table === 'providers' ? ' — delete or move its items first.' : '')); return }
    setStatus(`✓ Deleted "${label}".`)
    reload()
  }

  // Approval step: a pending provider item goes live with one tap.
  const approve = async (row) => {
    const { error } = await supabase.from('store_items').update({ is_active: true, pending_approval: false }).eq('id', row.id)
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved "${row.name}" — now live.`)
    reload()
  }

  // Intake approval: one tap builds the whole shop (store, location,
  // hours, styles, website domain/header/body/footer) in a single
  // database transaction. A taken page word fails here with a plain
  // message — fix it in Details first, then approve again.
  const approveSubmission = async (row) => {
    const { data, error } = await supabase.rpc('approve_barber_intake', { p_submission_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — shop live at autofly.us.com/${data?.slug || ''}.`)
    setDetail(null)
    reload()
  }

  const savePageWord = async () => {
    if (!detail) return
    const slug = pageWord.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!slug) { setStatus('Error: the page word has to contain a letter or number.'); return }
    if (slug === 'admin') { setStatus('Error: "admin" is reserved — pick another page word.'); return }
    const { error } = await supabase.from('barber_intake_submissions').update({ payload: { ...detail.payload, page_word: slug } }).eq('id', detail.id)
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Page word saved as "${slug}".`)
    setDetail({ ...detail, payload: { ...detail.payload, page_word: slug } })
    reload()
  }

  // Diner approval: one tap makes the pending draft live.
  const approveDiner = async (row) => {
    const { data, error } = await supabase.rpc('approve_diner_draft', { p_restaurant_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — "${data?.name || row.name}" menu is now live.`)
    setDetail(null)
    reload()
  }

  // Barbershop approval: one tap makes the pending draft live.
  const approveBarbershop = async (row) => {
    const { data, error } = await supabase.rpc('approve_barbershop_draft', { p_shop_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — "${data?.name || row.name}" services are now live.`)
    setDetail(null)
    reload()
  }

  // Items Edit loads the item's current links, so the tick boxes in
  // the form show what is already linked. Other tables edit as before.
  const editItem = async (r) => {
    const [cats, fds, tps, subs] = await Promise.all([
      supabase.from('store_item_categories').select('category_id').eq('item_id', r.id),
      supabase.from('store_item_fromdel').select('fromdel_id').eq('item_id', r.id),
      supabase.from('store_item_topick').select('topick_id').eq('item_id', r.id),
      supabase.from('store_item_subcategories').select('subcategory_id').eq('item_id', r.id),
    ])
    setDraft({
      ...r,
      _catIds: (cats.data || []).map(x => x.category_id),
      _fromIds: (fds.data || []).map(x => x.fromdel_id),
      _toIds: (tps.data || []).map(x => x.topick_id),
      _subIds: (subs.data || []).map(x => x.subcategory_id),
    })
  }

  const editPass = async (r) => {
    const { data } = await supabase.from('fAllowed').select('chat').eq('pass_id', r.id).single()
    setDraft({ ...r, chat: data ? data.chat : true })
  }

  const onToggle = (kind, id) => {
    const key = kind === 'cat' ? '_catIds' : kind === 'from' ? '_fromIds' : kind === 'sub' ? '_subIds' : '_toIds'
    const cur = draft[key] || []
  const next = { ...draft, [key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] }
    if (kind === 'cat' && draft._catIds?.includes(id)) {
      const subIds = subcats.filter(s => s.category_id === id).map(s => s.id)
      next._subIds = (next._subIds || []).filter(x => !subIds.includes(x))
    }
    setDraft(next)
  }

  const save = async (e) => {
    e.preventDefault()
    const { id, created_at, provider, _catIds, _fromIds, _toIds, _subIds, ...fields } = draft
    if (fields.price !== undefined) fields.price = Number(fields.price)
    if (fields.stock !== undefined) fields.stock = fields.stock === '' || fields.stock === null ? null : Number(fields.stock)
    if (fields.provider_id !== undefined) fields.provider_id = Number(fields.provider_id)
    if (fields.packof !== undefined) fields.packof = fields.packof === '' || fields.packof === null ? null : Number(fields.packof)
    if (fields.weight !== undefined) fields.weight = fields.weight === '' || fields.weight === null ? null : Number(fields.weight)
    if (table === 'itemcats' && !id) fields.slug = slugify(fields.label)
    // Only providers/items/forms carry updated_at; the new location /
    // category tables have created_at only, so stamping them would fail.
    if ((table === 'providers' || table === 'items' || table === 'forms') && id) fields.updated_at = new Date().toISOString()
    if (table === 'providers') {
      fields.holdorder = !!fields.holdorder
      fields.payorder = fields.payorder !== false
    }
    if (table === 'forms') {
      fields.f = slugify(fields.f || '')
      if (!fields.f) { setStatus('Error: the form name has to contain a letter or number.'); return }
      if (fields.f === 'admin') { setStatus('Error: "admin" is reserved — pick another form name.'); return }
      const { data: passRowsF } = await supabase.from('fPasses').select('id').eq('formName', fields.f)
      if (passRowsF && passRowsF.length > 0) { setStatus('That form name is already used by an employee pass — pick another.'); return }
      const { data: domainRowsF } = await supabase.from('website_domain').select('id').eq('slug', fields.f)
      if (domainRowsF && domainRowsF.length > 0) { setStatus('That form name is already used by a barber website — pick another.'); return }
    }
    if (table === 'employees') {
      if (fields.job_id !== undefined) fields.job_id = fields.job_id === '' ? null : Number(fields.job_id)
    }
    if (table === 'languages') {
      if (fields.employee_id !== undefined) fields.employee_id = Number(fields.employee_id)
    }
    // Barber tables: foreign keys arrive from <select> as strings.
    if (fields.store_id !== undefined) fields.store_id = Number(fields.store_id)
    if (fields.domain_id !== undefined) fields.domain_id = fields.domain_id === '' ? null : Number(fields.domain_id)
    if (fields.type_id !== undefined) fields.type_id = fields.type_id === '' ? null : Number(fields.type_id)
    if (fields.style_id !== undefined) fields.style_id = fields.style_id === '' ? null : Number(fields.style_id)
    if (table === 'barber_stores') fields.text_message = !!fields.text_message
    if (table === 'open_times') fields.hours_may_differ = !!fields.hours_may_differ
    if (table === 'barber_styles' && fields.time_to_finish !== undefined) fields.time_to_finish = fields.time_to_finish === '' || fields.time_to_finish === null ? null : Number(fields.time_to_finish)
    // Barber website slugs are public addresses (autofly.us.com/<slug>),
    // so they follow the same collision rules as provider forms and
    // employee passes. The checks only look at the OTHER tables, so
    // editing a domain without changing its slug never trips them;
    // a slug that duplicates another DOMAIN row is refused by the
    // database's UNIQUE constraint and surfaces as a plain error.
    if (table === 'website_domains') {
      fields.slug = slugify(fields.slug || '')
      if (!fields.slug) { setStatus('Error: the slug has to contain a letter or number.'); return }
      if (fields.slug === 'admin') { setStatus('Error: "admin" is reserved — pick another slug.'); return }
      const { data: formRows } = await supabase.from('providersForm').select('id').eq('f', fields.slug)
      if (formRows && formRows.length > 0) { setStatus('That slug is already used by a provider form — pick another.'); return }
      const { data: passRows } = await supabase.from('fPasses').select('id').eq('formName', fields.slug)
      if (passRows && passRows.length > 0) { setStatus('That slug is already used by an employee pass — pick another.'); return }
    }
    if (table === 'diner_restaurants') {
      fields.slug = slugify(fields.slug || '')
      if (!fields.slug) { setStatus('Error: the slug has to contain a letter or number.'); return }
      if (fields.slug === 'admin') { setStatus('Error: "admin" is reserved — pick another slug.'); return }
      if (!fields.name || !fields.u || !fields.p) { setStatus('Error: name, username and password are all required.'); return }
    }
    if (table === 'barbershop_shops') {
      fields.slug = slugify(fields.slug || '')
      if (!fields.slug) { setStatus('Error: the slug has to contain a letter or number.'); return }
      if (fields.slug === 'admin') { setStatus('Error: "admin" is reserved — pick another slug.'); return }
      if (!fields.name || !fields.u || !fields.p) { setStatus('Error: name, username and password are all required.'); return }
    }
    if (table === 'intake_forms') {
      fields.f = slugify(fields.f || '')
      if (!fields.f) { setStatus('Error: the form name has to contain a letter or number.'); return }
      if (fields.f === 'admin') { setStatus('Error: "admin" is reserved — pick another form name.'); return }
      if (!fields.u || !fields.p) { setStatus('Error: username and password are both required.'); return }
      const { data: formRowsI } = await supabase.from('providersForm').select('id').eq('f', fields.f)
      if (formRowsI && formRowsI.length > 0) { setStatus('That form name is already used by a provider form — pick another.'); return }
      const { data: passRowsI } = await supabase.from('fPasses').select('id').eq('formName', fields.f)
      if (passRowsI && passRowsI.length > 0) { setStatus('That form name is already used by an employee pass — pick another.'); return }
      const { data: domainRowsI } = await supabase.from('website_domain').select('id').eq('slug', fields.f)
      if (domainRowsI && domainRowsI.length > 0) { setStatus('That form name is already used by a barber website — pick another.'); return }
    }
    if (table === 'passes') {
      fields.formName = slugify(fields.formName || '')
      if (!fields.formName) { setStatus('Error: the form name has to contain a letter or number.'); return }
      if (fields.formName === 'admin') { setStatus('Error: "admin" is reserved — pick another form name.'); return }
      const { data: formRows } = await supabase.from('providersForm').select('id').eq('f', fields.formName)
      if (formRows && formRows.length > 0) { setStatus('That form name is already used by a provider form — pick another.'); return }
      const { data: domainRowsP } = await supabase.from('website_domain').select('id').eq('slug', fields.formName)
      if (domainRowsP && domainRowsP.length > 0) { setStatus('That form name is already used by a barber website — pick another.'); return }
      const { chat, ...passFields } = fields
      const q = id
      ? supabase.from(tableName).update(passFields).eq('id', id)
        : supabase.from(tableName).insert(passFields).select('id').single()
      const { data, error } = await q
      if (error) { setStatus('Error: ' + error.message); return }
      const savedPassId = id || data?.id
      const { error: allowErr } = await supabase.from('fAllowed').upsert({ pass_id: savedPassId, chat: chat !== false }, { onConflict: 'pass_id' })
      if (allowErr) { setStatus(`✓ Saved "${rowLabel(draft)}" but chat setting failed: ${allowErr.message}`); setDraft(blankDraft(table)); reload(); return }
      setStatus(`✓ Saved "${rowLabel(draft)}".`)
      setDraft(blankDraft(table))
      reload()
      return
    }
    if (table === 'items') {
      const q = id
        ? supabase.from(tableName).update(fields).eq('id', id)
        : supabase.from(tableName).insert(fields).select('id').single()
      const { data, error } = await q
      if (error) { setStatus('Error: ' + error.message); return }
      const savedId = id || data?.id
      try {
        await syncItemLinks(savedId, { categoryIds: draft._catIds || [], fromdelIds: draft._fromIds || [], topickIds: draft._toIds || [], subcategoryIds: draft._subIds || [] })
      } catch (linkErr) {
        setStatus(`✓ Saved "${rowLabel(draft)}" but links failed: ${linkErr.message}`)
        setDraft(blankDraft(table))
        reload()
        return
      }
    } else {
      const q = id
        ? supabase.from(tableName).update(fields).eq('id', id)
        : supabase.from(tableName).insert(fields)
      const { error } = await q
      if (error) { setStatus('Error: ' + error.message); return }
    }
    setStatus(`✓ Saved "${rowLabel(draft)}".`)
    setDraft(blankDraft(table))
    reload()
  }

  const kindLabel = table === 'providers' ? 'provider' : table === 'items' ? 'item' : table === 'forms' ? 'provider form' : table === 'fromdel' ? 'delivery location' : table === 'topick' ? 'pickup location' : table === 'itemcats' ? 'item category' : table === 'subcats' ? 'sub category' : table === 'jobs' ? 'job' : table === 'employees' ? 'employee' : table === 'languages' ? 'language' : table === 'passes' ? 'employee pass' : table === 'barber_stores' ? 'barber store' : table === 'barber_locations' ? 'barber location' : table === 'open_times' ? 'open hours' : table === 'barber_customers' ? 'barber customer' : table === 'barber_styles' ? 'barber style' : table === 'website_domains' ? 'barber website' : table === 'website_types' ? 'website type' : table === 'website_headers' ? 'website header' : table === 'website_bodies' ? 'website body' : table === 'website_footers' ? 'website footer' : table === 'barber_reservations' ? 'barber reservation' : table === 'barber_orders' ? 'barber order' : table === 'restaurant_orders' ? 'restaurant order' : table === 'intake_forms' ? 'intake form' : table === 'intake_submissions' ? 'intake submission' : table === 'diner_restaurants' ? 'diner restaurant' : table === 'diner_approvals' ? 'diner approval' : table === 'diner_orders' ? 'diner order' : table === 'barbershop_shops' ? 'barbershop shop' : table === 'barbershop_approvals' ? 'barbershop approval' : table === 'barbershop_bookings' ? 'barbershop booking' : 'row'

  const formTitle = table === 'intake_submissions'
    ? (detail ? `Intake submission — ${rowLabel(detail)}` : 'Intake submissions')
    : table === 'diner_approvals'
    ? (detail ? `Diner approval — ${rowLabel(detail)}` : 'Diner approvals')
    : table === 'barbershop_approvals'
    ? (detail ? `Barbershop approval — ${rowLabel(detail)}` : 'Barbershop approvals')
    : draft.id ? `Edit ${kindLabel} — ${rowLabel(draft)}` : `New ${kindLabel}`

  const submitLabel = draft.id ? 'Save changes' : `Save ${kindLabel}`

  return (
    <div>
      <div className="hero-card">
        <h2>✏️ Edit or delete store tables</h2>
        <div className="car-submenu-wrap" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen(o => !o)} aria-haspopup="true" aria-expanded={menuOpen}>{tableLabel} ▾</button>
          {menuOpen && (
            <div className="car-submenu">
              {TABLES.map(([key, label]) => (
                <button key={key} type="button" onClick={() => pickTable(key)}>{label}</button>
              ))}
            </div>
          )}
        </div>
        <div className="filters">
          <input placeholder="Search this table..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {status && <p className="hint">{status}</p>}
      </div>

      <h3>{formTitle}</h3>
      {table === 'providers' && (
        <ProviderForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'items' && (
        <ItemForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} providers={providers}
          linkData={{ itemCategories, fromdel, topick, subcats, selected: { categoryIds: draft._catIds || [], fromdelIds: draft._fromIds || [], topickIds: draft._toIds || [], subcategoryIds: draft._subIds || [] }, onToggle }} />
      )}
      {table === 'forms' && (
        <ProviderFormEditor draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} providers={providers}
          takenProviderIds={(rows || []).filter(r => r.id !== draft.id).map(r => r.provider_id)} />
      )}
      {table === 'fromdel' && (
        <FromDelForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'topick' && (
        <ToPickForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'itemcats' && (
        <ItemCategoryForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'subcats' && (
        <SubCategoryForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} itemCategories={itemCategories} />
      )}
      {table === 'jobs' && (
      <JobForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'employees' && (
      <EmployeeForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} jobs={jobsList} />
      )}
      {table === 'languages' && (
      <LanguageForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} employees={employeesList} />
      )}
      {table === 'passes' && (
      <EmployeePassForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} employees={employeesList} />
      )}
      {table === 'barber_stores' && (
      <BarberStoreForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'barber_locations' && (
      <BarberLocationForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} />
      )}
      {table === 'open_times' && (
      <OpenTimeForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} />
      )}
      {table === 'barber_customers' && (
      <BarberCustomerForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} />
      )}
      {table === 'barber_styles' && (
      <BarberStyleForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} />
      )}
      {table === 'website_domains' && (
      <WebsiteDomainForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} types={websiteTypes} />
      )}
      {table === 'website_types' && (
      <WebsiteTypeForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'website_headers' && (
      <WebsiteHeaderForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} domains={websiteDomains} />
      )}
      {table === 'website_bodies' && (
      <WebsiteBodyForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} domains={websiteDomains} />
      )}
      {table === 'website_footers' && (
      <WebsiteFooterForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} domains={websiteDomains} />
      )}
      {table === 'barber_reservations' && (
      <BarberReservationForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} domains={websiteDomains} styles={barberStyles} />
      )}
      {table === 'barber_orders' && (
        <p className="hint">Orders are placed by customers on the site — view and delete only, no editing.</p>
      )}
      {table === 'restaurant_orders' && (
        <p className="hint">Orders are placed by customers on the site — view and delete only, no editing.</p>
      )}
      {table === 'intake_forms' && (
        <IntakeFormForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'diner_restaurants' && (
        <DinerRestaurantForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'diner_approvals' && !detail && (
        <p className="hint">Drafts restaurants uploaded for approval — open Details to review the menu, then Approve to make it live. Deleting a restaurant is done in Diner Restaurants, not here.</p>
      )}
      {table === 'diner_approvals' && detail && (
        <div className="form-card">
          <h3>{detail.name}</h3>
          <p>Link: autofly.us.com/diner?r={detail.slug} · Status: {detail.draft_status}</p>
          <p>Draft menu (what the restaurant uploaded):</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{detail.draft_data ? JSON.stringify(detail.draft_data, null, 2) : 'No draft yet.'}</pre>
          <div className="store-actions">
            {detail.draft_status === 'pending' && <button type="button" className="btn-primary" onClick={() => approveDiner(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
      {table === 'diner_orders' && (
        <p className="hint">Orders placed by visitors — view and delete only, no editing. The kitchen handles them live on the restaurant page.</p>
      )}
      {table === 'barbershop_shops' && (
        <BarbershopShopForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'barbershop_approvals' && !detail && (
        <p className="hint">Drafts shops uploaded for approval — open Details to review the services, then Approve to make them live. Deleting a shop is done in Barbershop Shops, not here.</p>
      )}
      {table === 'barbershop_approvals' && detail && (
        <div className="form-card">
          <h3>{detail.name}</h3>
          <p>Link: autofly.us.com/barbers?s={detail.slug} · Status: {detail.draft_status}</p>
          <p>Draft services (what the shop uploaded):</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{detail.draft_data ? JSON.stringify(detail.draft_data, null, 2) : 'No draft yet.'}</pre>
          <div className="store-actions">
            {detail.draft_status === 'pending' && <button type="button" className="btn-primary" onClick={() => approveBarbershop(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
      {table === 'barbershop_bookings' && (
        <p className="hint">Bookings placed by visitors — view and delete only, no editing. The barber handles them live on the shop page.</p>
      )}
      {table === 'intake_submissions' && !detail && (
        <p className="hint">Submissions arrive from the intake form — open Details to review, fix the page word if it is taken, then Approve to build the shop, or Delete to reject.</p>
      )}
      {table === 'intake_submissions' && detail && (
        <div className="form-card">
          <h3>{detail.payload.shop_name || ('Submission #' + detail.id)}</h3>
          <p>Form: {intakeFormsList.find(f => f.id === detail.form_id)?.f || detail.form_id} · Status: {detail.status} · Sent: {(detail.created_at || '').slice(0, 10)}</p>
          <h4>Shop</h4>
          <p>{detail.payload.owner_name || '—'} · {detail.payload.phone || '—'} · {detail.payload.email || '—'}</p>
          <p>{detail.payload.website || '—'}</p>
          <p>{detail.payload.about || '—'}</p>
          <p>Pictures: {detail.payload.pictures || '—'}</p>
          <h4>Location</h4>
          <p>{[detail.payload.address, detail.payload.city, detail.payload.state, detail.payload.zip, detail.payload.country, detail.payload.county, detail.payload.township].filter(Boolean).join(', ') || '—'}</p>
          <p>{detail.payload.location_note || '—'}</p>
          <h4>Hours</h4>
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => {
            const h = (detail.payload.hours || {})[d] || {}
            return <p key={d}>{d}: {h.closed ? 'Closed' : (h.open && h.close ? h.open + ' - ' + h.close : '—')}</p>
          })}
          <p>Holiday note: {detail.payload.holiday_hours_note || '—'}</p>
          <h4>Services</h4>
          {(detail.payload.services || []).map((sv, i) => (
            <p key={i}>{sv.name} — {sv.price} ({sv.duration_minutes} min){sv.description ? ' — ' + sv.description : ''}{sv.picture ? ' — ' + sv.picture : ''}</p>
          ))}
          <h4>Page</h4>
          <label>Page word
            <input value={pageWord} onChange={e => setPageWord(e.target.value)} />
          </label>
          <p className="hint">This becomes autofly.us.com/{pageWord || 'page-word'}. If approval says it is taken, change it here, save, then approve.</p>
          <p>Header: {detail.payload.header_slogan || '—'} · {detail.payload.header_description || '—'}</p>
          <p>Body: {detail.payload.body_texts || '—'}</p>
          <p>Footer: {detail.payload.footer_slogan || '—'} · {detail.payload.footer_description || '—'}</p>
          <p>Text messages: {detail.payload.text_message_preference ? 'Yes' : 'No'}</p>
          <div className="store-actions">
            <button type="button" className="btn-primary" onClick={savePageWord}>Save page word</button>
            {detail.status === 'pending' && <button type="button" onClick={() => approveSubmission(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}

      <div className="hero-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>{table === 'forms' ? 'Store' : 'Name'}</th>
              {table === 'items' &&
                <><th>Price</th><th>Provider</th><th>Delivery</th><th>Pickup</th><th>Shown</th><th>Stock</th></>}
              {table === 'providers' && <><th>City</th><th>Country</th><th>Photos</th><th>Hold orders</th><th>Pay orders</th></>}
              {table === 'forms' && <><th>Form address</th><th>Username</th><th>Comment</th></>}
              {table === 'fromdel' && <><th>Address</th><th>City</th><th>State</th><th>Zip</th><th>Country</th></>}
              {table === 'topick' && <><th>Address</th><th>City</th><th>State</th><th>Zip</th><th>Country</th></>}
              {table === 'itemcats' && <th>Slug</th>}
              {table === 'subcats' && <><th>Category</th><th>Flavor</th><th>Color</th><th>Pack</th><th>Size</th><th>Weight</th><th>Unit</th></>}
              {table === 'jobs' && <th>Description</th>}
              {table === 'employees' && <><th>Job</th><th>Phone</th></>}
              {table === 'languages' && <th>Employee</th>}
              {table === 'passes' && <><th>Form address</th><th>Username</th><th>Note</th></>}
              {table === 'barber_stores' && <><th>Owner</th><th>Phone</th><th>Email</th><th>Photos</th><th>Text msgs</th></>}
              {table === 'barber_locations' && <><th>Address</th><th>City</th><th>State</th><th>Zip</th></>}
              {table === 'open_times' && <><th>Store</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th><th>Closed</th></>}
              {table === 'barber_customers' && <><th>Store</th><th>GPS</th><th>Note</th></>}
              {table === 'barber_styles' && <><th>Store</th><th>Price</th><th>Minutes</th><th>Photos</th></>}
              {table === 'website_domains' && <><th>Store</th><th>Address</th><th>Type</th><th>Domain</th></>}
              {table === 'website_types' && <><th>Description</th><th>Photos</th></>}
              {table === 'website_headers' && <><th>Website</th><th>Slogan</th></>}
              {table === 'website_bodies' && <><th>Website</th><th>Heading 1</th></>}
              {table === 'website_footers' && <><th>Website</th><th>Slogan</th></>}
              {table === 'barber_reservations' && <><th>Store</th><th>Phone</th><th>Date</th><th>Time</th><th>Status</th></>}
              {table === 'barber_orders' && <><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th></>}
              {table === 'restaurant_orders' && <><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th></>}
              {table === 'intake_forms' && <><th>Username</th><th>Note</th></>}
              {table === 'intake_submissions' && <><th>Page word</th><th>Form</th><th>Status</th><th>Sent</th></>}
              {table === 'diner_restaurants' && <><th>Slug</th><th>Username</th><th>Draft</th></>}
              {table === 'diner_approvals' && <><th>Slug</th><th>Draft</th></>}
              {table === 'diner_orders' && <><th>Restaurant</th><th>Table</th><th>Items</th><th>Status</th><th>Date</th></>}
              {table === 'barbershop_shops' && <><th>Slug</th><th>Username</th><th>Draft</th></>}
              {table === 'barbershop_approvals' && <><th>Slug</th><th>Draft</th></>}
              {table === 'barbershop_bookings' && <><th>Shop</th><th>Customer</th><th>Service</th><th>Date</th><th>Status</th></>}
              <th>Edit</th><th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{table === 'forms' ? (providers.find(pr => pr.id === r.provider_id)?.name || r.provider_id) : rowLabel(r)}</td>
                {table === 'items' && (
                  <>
                    <td>{money(r.price)}</td>
                    <td>{r.provider?.name || r.provider_id}</td>
                    <td>{r.delivery ? 'Yes' : 'No'}</td>
                    <td>{r.pickup ? 'Yes' : 'No'}</td>
                    <td>{r.pending_approval ? 'Pending' : r.is_active ? 'Yes' : 'Hidden'}</td>
                    <td>{r.stock === null || r.stock === undefined ? '—' : r.stock}</td>
                  </>
                )}
                {table === 'providers' && <><td>{r.city}</td><td>{r.country}</td><td>{(r.pics || []).length}</td><td>{r.holdorder ? 'Yes' : 'No'}</td><td>{r.payorder !== false ? 'Yes' : 'No'}</td></>}
                {table === 'forms' && <><td><a href={`/${r.f}`} target="_blank" rel="noreferrer">autofly.us.com/{r.f}</a></td><td>{r.u}</td><td>{r.comment}</td></>}
                {table === 'fromdel' && <><td>{r.faddress}</td><td>{r.fcity}</td><td>{r.fstate}</td><td>{r.fzip}</td><td>{r.fcountry}</td></>}
                {table === 'topick' && <><td>{r.taddress}</td><td>{r.tcity}</td><td>{r.tstate}</td><td>{r.tzip}</td><td>{r.tcountry}</td></>}
                {table === 'itemcats' && <td>{r.slug}</td>}
                {table === 'subcats' && <><td>{itemCategories.find(c => c.id === r.category_id)?.label || r.category_id}</td><td>{r.flavor}</td><td>{r.color}</td><td>{r.packof ?? '—'}</td><td>{r.size}</td><td>{r.weight ?? '—'}</td><td>{r.unit}</td></>}
                {table === 'jobs' && <td>{r.jobDescription || '—'}</td>}
                {table === 'employees' && <><td>{jobsList.find(j => j.id === r.job_id)?.jobTitle || '—'}</td><td>{r.phone1 || '—'}</td></>}
      {table === 'languages' && <td>{(() => { const e = employeesList.find(x => x.id === r.employee_id); return e ? `${e.firstName} ${e.lastName || ''}`.trim() : '—' })()}</td>}
            {table === 'passes' && <><td><a href={`/${r.formName}`}>autofly.us.com/{r.formName}</a></td><td>{r.u}</td><td>{r.note || '—'}</td></>}
            {table === 'barber_stores' && <><td>{r.owner_name || '—'}</td><td>{r.tel || '—'}</td><td>{r.email || '—'}</td><td>{(r.pics || []).length}</td><td>{r.text_message ? 'Yes' : 'No'}</td></>}
            {table === 'barber_locations' && <><td>{r.address || '—'}</td><td>{r.city || '—'}</td><td>{r.state || '—'}</td><td>{r.zip || '—'}</td></>}
            {table === 'open_times' && <><td>{barberStores.find(s => s.id === r.store_id)?.store_name || r.store_id}</td><td>{r.monday || '—'}</td><td>{r.tuesday || '—'}</td><td>{r.wednesday || '—'}</td><td>{r.thursday || '—'}</td><td>{r.friday || '—'}</td><td>{r.saturday || '—'}</td><td>{r.sunday || '—'}</td><td>{r.closed || '—'}</td></>}
            {table === 'barber_customers' && <><td>{barberStores.find(s => s.id === r.store_id)?.store_name || r.store_id}</td><td>{r.location_gps || '—'}</td><td>{r.note || '—'}</td></>}
            {table === 'barber_styles' && <><td>{barberStores.find(s => s.id === r.store_id)?.store_name || r.store_id}</td><td>{money(r.price)}</td><td>{r.time_to_finish ?? '—'}</td><td>{(r.pics || []).length}</td></>}
            {table === 'website_domains' && <><td>{barberStores.find(s => s.id === r.store_id)?.store_name || r.store_id}</td><td><a href={`/${r.slug}`} target="_blank" rel="noreferrer">autofly.us.com/{r.slug}</a></td><td>{websiteTypes.find(t => t.id === r.type_id)?.name || '—'}</td><td>{r.domain || '—'}</td></>}
            {table === 'website_types' && <><td>{r.description || '—'}</td><td>{(r.pics || []).length}</td></>}
            {table === 'website_headers' && <><td>{websiteDomains.find(d => d.id === r.domain_id)?.slug || r.domain_id}</td><td>{r.header_slogan || '—'}</td></>}
            {table === 'website_bodies' && <><td>{websiteDomains.find(d => d.id === r.domain_id)?.slug || r.domain_id}</td><td>{r.h1 || '—'}</td></>}
            {table === 'website_footers' && <><td>{websiteDomains.find(d => d.id === r.domain_id)?.slug || r.domain_id}</td><td>{r.footer_slogan || '—'}</td></>}
            {table === 'barber_reservations' && <><td>{barberStores.find(s => s.id === r.store_id)?.store_name || r.store_id}</td><td>{r.customer_phone || '—'}</td><td>{r.reservation_date || '—'}</td><td>{r.reservation_time || '—'}</td><td>{r.status || '—'}</td></>}
            {table === 'barber_orders' && <><td>{r.customer_email || '—'}</td><td>{r.customer_phone || '—'}</td><td>{r.plan || '—'}</td><td>{money(r.price)}</td></>}
            {table === 'restaurant_orders' && <><td>{r.customer_email || '—'}</td><td>{r.customer_phone || '—'}</td><td>{r.plan || '—'}</td><td>{money(r.price)}</td></>}
            {table === 'intake_forms' && <><td>{r.u}</td><td>{r.note || '—'}</td></>}
            {table === 'intake_submissions' && <><td>{r.payload?.page_word || '—'}</td><td>{intakeFormsList.find(f => f.id === r.form_id)?.f || r.form_id}</td><td>{r.status}</td><td>{(r.created_at || '').slice(0, 10)}</td></>}
            {table === 'diner_restaurants' && <><td>{r.slug}</td><td>{r.u}</td><td>{r.draft_status}</td></>}
            {table === 'diner_approvals' && <><td>{r.slug}</td><td>{r.draft_status}</td></>}
            {table === 'diner_orders' && <><td>{dinerRestaurantsList.find(x => x.id === r.restaurant_id)?.name || r.restaurant_id}</td><td>{r.order_data?.table ?? '—'}</td><td>{(r.order_data?.items || []).length}</td><td>{r.status}</td><td>{(r.created_at || '').slice(0, 10)}</td></>}
            {table === 'barbershop_shops' && <><td>{r.slug}</td><td>{r.u}</td><td>{r.draft_status}</td></>}
            {table === 'barbershop_approvals' && <><td>{r.slug}</td><td>{r.draft_status}</td></>}
            {table === 'barbershop_bookings' && <><td>{barbershopShopsList.find(x => x.id === r.shop_id)?.name || r.shop_id}</td><td>{r.booking_data?.name || '—'}</td><td>{r.booking_data?.service || '—'}</td><td>{r.booking_data?.date || '—'}</td><td>{r.status}</td></>}
                <td>
                  {table === 'items' && r.pending_approval && <button type="button" className="btn-mini" onClick={() => approve(r)}>Approve</button>}{' '}
                  {table === 'intake_submissions' && <><button type="button" className="btn-mini" onClick={() => { setDetail(r); setPageWord(r.payload?.page_word || '') }}>Details</button>{' '}{r.status === 'pending' && <button type="button" className="btn-mini" onClick={() => approveSubmission(r)}>Approve</button>}{' '}</>}
                  {table === 'diner_approvals' && <><button type="button" className="btn-mini" onClick={() => setDetail(r)}>Details</button>{' '}{r.draft_status === 'pending' && <button type="button" className="btn-mini" onClick={() => approveDiner(r)}>Approve</button>}{' '}</>}
                  {table === 'barbershop_approvals' && <><button type="button" className="btn-mini" onClick={() => setDetail(r)}>Details</button>{' '}{r.draft_status === 'pending' && <button type="button" className="btn-mini" onClick={() => approveBarbershop(r)}>Approve</button>}{' '}</>}
                  {table !== 'barber_orders' && table !== 'restaurant_orders' && table !== 'intake_submissions' && table !== 'diner_approvals' && table !== 'diner_orders' && table !== 'barbershop_approvals' && table !== 'barbershop_bookings' && <button type="button" className="btn-mini" onClick={() => table === 'items' ? editItem(r) : table === 'passes' ? editPass(r) : setDraft({...r})}>Edit</button>}
                </td>
                <td>{table !== 'diner_approvals' && table !== 'barbershop_approvals' && <button type="button" className="btn-mini" onClick={() => remove(r)}>Delete</button>}</td>
              </tr>
            ))}
            {rows && filtered.length === 0 && <tr><td colSpan="12">Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
