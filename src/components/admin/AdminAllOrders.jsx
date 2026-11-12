import { Fragment, useEffect, useMemo, useState } from 'react'
import { fetchAll, fmtDate } from '../../lib/admin'
import { money } from '../../lib/storeData'
import { supabase } from '../../lib/supabaseClient'

// All Orders: every order the Business cart ever wrote, in one place —
// one row per plan ordered, newest first. Edit and delete live here:
// Edit turns the row's expanded details into an in-page form, Delete
// asks in-page first (never window.confirm) — both write back to the
// row's own order table by id, and the table, summary and totals
// update from local state, no reload.
//
// There are 25 order tables, one per plan, all written by the same
// cart (placeBusinessOrder). Every table has the same standard
// columns — customer_name, customer_email, customer_phone, plan,
// price (numeric, the plan's monthly LIST price), note, created_at —
// and nothing else: no status column (except Clean Link, below),
// no payment column (nothing is paid before launch), and no shared
// checkout id, so one row = one plan order and rows are never grouped
// into multi-plan checkouts. Bundle discounts are NOT stored on any
// row (they live only in the owner email), so every total here is a
// list-price total — see the footnote under the summary.
//
// Two tables carry extras:
//   - clean_link_order also has business_name, system, shop_slug,
//     clean_slug and status ('pending' until activation flips it to
//     'active'). business_name is never filled in by the cart, and the
//     three meta fields are null when the plan was added from the hub
//     cart — nulls show as '—' and are never filtered on.
//   - direct_upload_order: its DDL was not found in the repo, so its
//     columns are only inferred as the standard 8. It is loaded the
//     same way as the rest, but one missing or broken table can never
//     blank the page (see grab() below), and a row with no created_at
//     sorts by id instead.
//
// fetchAll caps at 500 rows per table. The summary shows a per-plan
// count, so a table that hit the cap is visible as "500+".

// group: 'systems' | 'addons' | 'kids'. The label is the plan name —
// never the table name (barber_order is the Simple Website, while
// barbershop_order is the Barber system).
const PLANS = [
  // Systems (12)
  { table: 'restaurant_order', label: 'Restaurant', group: 'systems', price: 40 },
  { table: 'pos_order', label: 'Point of sale', group: 'systems', price: 50 },
  { table: 'barbershop_order', label: 'Barbershop', group: 'systems', price: 15 },
  { table: 'dealer_order', label: 'Dealer', group: 'systems', price: 20 },
  { table: 'employee_order', label: 'Employee', group: 'systems', price: 20 },
  { table: 'bodyshop_order', label: 'Bodyshop', group: 'systems', price: 20 },
  { table: 'houses_order', label: 'Houses', group: 'systems', price: 20 },
  { table: 'doctor_order', label: 'Doctor', group: 'systems', price: 20 },
  { table: 'holiday_order', label: 'Holiday', group: 'systems', price: 20 },
  { table: 'rentals_order', label: 'Car Rental', group: 'systems', price: 20 },
  { table: 'laundry_order', label: 'Laundry', group: 'systems', price: 20 },
  { table: 'barber_order', label: 'Simple Website', group: 'systems', price: 10 },
  // Add-ons (4)
  { table: 'tv_gallery_order', label: 'TV Gallery', group: 'addons', price: 2 },
  { table: 'live_chat_order', label: 'Live Chat', group: 'addons', price: 3 },
  { table: 'clean_link_order', label: 'Clean Link', group: 'addons', price: 2 },
  { table: 'direct_upload_order', label: 'Direct Upload', group: 'addons', price: 5 },
  // Yently Kids (9)
  { table: 'kids_math_order', label: 'Kids Math', group: 'kids', price: 10 },
  { table: 'kids_english_order', label: 'Kids English', group: 'kids', price: 10 },
  { table: 'kids_arabic_order', label: 'Kids Arabic', group: 'kids', price: 10 },
  { table: 'kids_french_order', label: 'Kids French', group: 'kids', price: 10 },
  { table: 'kids_spanish_order', label: 'Kids Spanish', group: 'kids', price: 10 },
  { table: 'kids_science_order', label: 'Kids Science', group: 'kids', price: 10 },
  { table: 'kids_geography_order', label: 'Kids Geography', group: 'kids', price: 10 },
  { table: 'kids_coding_order', label: 'Kids Coding', group: 'kids', price: 10 },
  { table: 'kids_reading_order', label: 'Kids Reading', group: 'kids', price: 10 },
]

const GROUPS = [
  { key: 'systems', title: 'Systems' },
  { key: 'addons', title: 'Add-ons' },
  { key: 'kids', title: 'Yently Kids' },
]

const PLAN_BY_TABLE = Object.fromEntries(PLANS.map(p => [p.table, p]))

// Raw sort time: missing/unparseable created_at sorts as the oldest
// possible, so a direct_upload_order row without created_at still
// shows up (at the bottom) instead of breaking the sort.
const rowTime = (r) => {
  const t = r.created_at ? new Date(r.created_at).getTime() : NaN
  return Number.isNaN(t) ? -Infinity : t
}

const monthKey = (r) => {
  const t = rowTime(r)
  if (t === -Infinity) return ''
  const d = new Date(t)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}
const thisMonthKey = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}
const monthLabel = (key) => {
  if (!key) return ''
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

const truncate = (s, n) => {
  const t = s || ''
  return t.length > n ? t.slice(0, n) + '…' : t
}

export default function AdminAllOrders() {
  const [orders, setOrders] = useState(null)
  const [failed, setFailed] = useState([])
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('newest')
  const [expandedKey, setExpandedKey] = useState(null)
  const [status, setStatus] = useState('')

  // Edit state: which row is being edited, and its draft values.
  // The form lives inside that row's expanded details, so no other
  // row grows. Clean Link extras are only in the draft (and only
  // saved) for clean_link_order rows.
  const [editingKey, setEditingKey] = useState(null)
  const [edit, setEdit] = useState({ customer_name: '', customer_email: '', customer_phone: '', price: '', note: '', business_name: '', system: '', shop_slug: '', clean_slug: '' })
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete state: the row waiting for its in-page confirmation
  // (same pattern as All Passes — never window.confirm).
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setOrders(null)
    setFailed([])
    setEditingKey(null)
    setConfirmDelete(null)
    setExpandedKey(null)
    const failedTables = []
    // One bad table must never blank the page: fetchAll throws, so
    // each table is grabbed on its own and a failure just records
    // the table name and contributes no rows.
    const grab = async (table) => {
      try { return await fetchAll(table) }
      catch (e) { failedTables.push(table); return [] }
    }
    const results = await Promise.all(PLANS.map(p => grab(p.table)))
    const all = []
    results.forEach((rows, i) => {
      const plan = PLANS[i]
      for (const r of rows || []) {
        all.push({
          key: plan.table + ':' + r.id,
          table: plan.table,
          label: plan.label,
          group: plan.group,
          id: r.id,
          customer_name: r.customer_name || '',
          customer_email: r.customer_email || '',
          customer_phone: r.customer_phone || '',
          plan: r.plan || '',
          price: Number(r.price) || 0,
          note: r.note || '',
          created_at: r.created_at || null,
          // Clean Link extras only; undefined on every other table.
          business_name: r.business_name ?? null,
          system: r.system ?? null,
          shop_slug: r.shop_slug ?? null,
          clean_slug: r.clean_slug ?? null,
          status: r.status ?? null,
        })
      }
    })
    setOrders(all)
    setFailed(failedTables)
  }

  useEffect(() => { load() }, [])

  // ----- Edit -----

  const startEdit = (r) => {
    setEditingKey(r.key)
    setExpandedKey(r.key)
    setEdit({
      customer_name: r.customer_name || '',
      customer_email: r.customer_email || '',
      customer_phone: r.customer_phone || '',
      price: String(r.price ?? ''),
      note: r.note || '',
      business_name: r.business_name || '',
      system: r.system || '',
      shop_slug: r.shop_slug || '',
      clean_slug: r.clean_slug || '',
    })
    setEditError('')
    setStatus('')
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditError('')
  }

  // Save writes the edited fields back to the row's OWN order table,
  // by id — the table name comes from the row itself (r.table), never
  // from a label or dropdown, so an edit can never land in the wrong
  // plan's table. The plan text and the order date are never edited.
  // Clean Link extras are only sent for clean_link_order rows; every
  // other table has no such columns. Status is deliberately NOT here:
  // a Clean Link's status is flipped by the activate_clean_link RPC
  // on the Clean Link Orders page (activating also creates the
  // clean_links row), so a raw status write from here would desync
  // the link from the order — change status there, not here.
  const saveEdit = async (r) => {
    const price = Number(edit.price)
    if (edit.price === '' || Number.isNaN(price) || price < 0) { setEditError('Price must be a number, 0 or more.'); return }
    const fields = {
      customer_name: edit.customer_name.trim(),
      customer_email: edit.customer_email.trim(),
      customer_phone: edit.customer_phone.trim(),
      price,
      note: edit.note.trim(),
    }
    if (r.table === 'clean_link_order') {
      fields.business_name = edit.business_name.trim() || null
      fields.system = edit.system.trim() || null
      fields.shop_slug = edit.shop_slug.trim() || null
      fields.clean_slug = edit.clean_slug.trim() || null
    }
    setSavingEdit(true)
    try {
      const { error } = await supabase.from(r.table).update(fields).eq('id', r.id)
      if (error) { setEditError('Cannot save: ' + error.message); return }
      setOrders(prev => (prev || []).map(o => o.key === r.key ? { ...o, ...fields } : o))
      setStatus(`✓ Saved — ${r.label} order for ${fields.customer_name || fields.customer_email || '—'}.`)
      setEditingKey(null)
      setEditError('')
    } catch (err) {
      setEditError('Cannot save: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  // ----- Delete -----

  const deleteLabel = (r) => `${r.label} order — ${r.customer_name || r.customer_email || 'no name'} (${money(r.price)}/mo)`

  const doDelete = async () => {
    const r = confirmDelete
    if (!r) return
    setDeleting(true)
    setDeleteError('')
    try {
      // The table name comes from the row itself (r.table), never from
      // a label or dropdown, so a delete can never hit the wrong
      // plan's table.
      const { error } = await supabase.from(r.table).delete().eq('id', r.id)
      if (error) { setDeleteError('Cannot delete: ' + error.message); return }
      setOrders(prev => (prev || []).filter(o => o.key !== r.key))
      setStatus(`✓ Deleted — ${deleteLabel(r)}.`)
      setConfirmDelete(null)
      if (editingKey === r.key) setEditingKey(null)
      if (expandedKey === r.key) setExpandedKey(null)
    } catch (err) {
      setDeleteError('Cannot delete: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  // Months present in the data, newest first, for the month selector.
  const months = useMemo(() => {
    if (!orders) return []
    const set = new Set()
    for (const r of orders) { const k = monthKey(r); if (k) set.add(k) }
    return [...set].sort().reverse()
  }, [orders])

  // Summary per plan, computed from everything loaded (not the
  // filtered set): all-time count, this-month count, monthly value
  // (sum of price — every row's price IS that plan's monthly price),
  // latest order date. A count of exactly 500 means the fetch cap
  // may have cut the table off, so it shows as "500+".
  const summary = useMemo(() => {
    if (!orders) return {}
    const out = {}
    const thisMonth = thisMonthKey()
    for (const p of PLANS) out[p.table] = { count: 0, thisMonth: 0, value: 0, latest: null, capped: false }
    for (const r of orders) {
      const s = out[r.table]
      s.count += 1
      s.value += r.price
      if (monthKey(r) === thisMonth) s.thisMonth += 1
      const t = rowTime(r)
      if (t !== -Infinity && (s.latest === null || t > s.latest)) s.latest = t
    }
    for (const p of PLANS) out[p.table].capped = out[p.table].count >= 500
    return out
  }, [orders])

  const filtered = useMemo(() => {
    if (!orders) return []
    const q = search.trim().toLowerCase()
    const min = minPrice === '' ? null : Number(minPrice)
    const max = maxPrice === '' ? null : Number(maxPrice)
    const list = orders.filter(r => {
      if (groupFilter !== 'all' && r.group !== groupFilter) return false
      if (planFilter !== 'all' && r.table !== planFilter) return false
      if (monthFilter !== 'all' && monthKey(r) !== monthFilter) return false
      if (min !== null && !Number.isNaN(min) && r.price < min) return false
      if (max !== null && !Number.isNaN(max) && r.price > max) return false
      if (q) {
        const hay = [r.customer_name, r.customer_email, r.customer_phone, r.plan, r.note, r.clean_slug, r.shop_slug].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const byTimeDesc = (a, b) => (rowTime(b) - rowTime(a)) || (Number(b.id) - Number(a.id))
    const byTimeAsc = (a, b) => (rowTime(a) - rowTime(b)) || (Number(a.id) - Number(b.id))
    if (sort === 'oldest') list.sort(byTimeAsc)
    else if (sort === 'price-desc') list.sort((a, b) => (b.price - a.price) || byTimeDesc(a, b))
    else if (sort === 'price-asc') list.sort((a, b) => (a.price - b.price) || byTimeDesc(a, b))
    else if (sort === 'customer') list.sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || '') || byTimeDesc(a, b))
    else list.sort(byTimeDesc) // newest first (default)
    return list
  }, [orders, search, groupFilter, planFilter, monthFilter, minPrice, maxPrice, sort])

  const filteredTotal = useMemo(() => filtered.reduce((s, r) => s + r.price, 0), [filtered])

  const clearFilters = () => {
    setSearch('')
    setGroupFilter('all')
    setPlanFilter('all')
    setMonthFilter('all')
    setMinPrice('')
    setMaxPrice('')
    setSort('newest')
  }
  const filtersActive = search.trim() !== '' || groupFilter !== 'all' || planFilter !== 'all' || monthFilter !== 'all' || minPrice !== '' || maxPrice !== '' || sort !== 'newest'

  // Clicking a summary cell filters the table below to that plan.
  // The "Orders this month" cell also narrows to this month.
  const filterToPlan = (table, onlyThisMonth) => {
    const plan = PLAN_BY_TABLE[table]
    setPlanFilter(table)
    setGroupFilter(plan.group)
    setMonthFilter(onlyThisMonth ? thisMonthKey() : 'all')
    setExpandedKey(null)
  }

  if (orders === null) return <div className="hero-card"><p>Loading orders…</p></div>

  const totalOrders = orders.length
  const totalValue = orders.reduce((s, r) => s + r.price, 0)

  return (
    <div>
      <div className="hero-card">
        <h2>🧾 All Orders {totalOrders > 0 && `(${totalOrders})`}</h2>
        <p>Every plan order from the Business cart, in one place — one row per plan ordered, newest first. Tap a row for the full details. Edit or delete any order from its row: Edit opens a form in the row's details, Delete asks first. Prices are the plan's monthly list price, so the monthly value of a plan is simply its orders added up.</p>
      </div>

      {status && <p>{status}</p>}

      {confirmDelete && (
        <div className="form-card">
          <h3>Delete this order?</h3>
          <p>Delete “{deleteLabel(confirmDelete)}”?</p>
          <p className="hint">This removes the order from the {confirmDelete.label} orders only — nothing else is touched. This cannot be undone.</p>
          <div className="store-actions">
            <button type="button" className="btn-primary" onClick={doDelete} disabled={deleting}>Delete</button>
            <button type="button" className="btn-soft" onClick={() => { setConfirmDelete(null); setDeleteError('') }}>Cancel</button>
          </div>
          {deleteError && <p className="hint">{deleteError}</p>}
        </div>
      )}

      {failed.length > 0 && (
        <p className="status">Could not load {failed.length} table{failed.length > 1 ? 's' : ''} ({failed.join(', ')}) — those orders are missing below. Tap Refresh to try again.</p>
      )}

      <h3>Summary by plan</h3>
      <p className="hint">Tap a number to filter the orders below to that plan. Tap an “Orders this month” number to filter to that plan, this month only.</p>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Plan</th><th>Orders</th><th>Orders this month</th><th>Monthly value</th><th>Latest order</th></tr>
          </thead>
          <tbody>
            {GROUPS.map(g => (
              <Fragment key={'g-' + g.key}>
                <tr>
                  <td colSpan={5}><b>{g.title}</b></td>
                </tr>
                {PLANS.filter(p => p.group === g.key).map(p => {
                  const s = summary[p.table] || { count: 0, thisMonth: 0, value: 0, latest: null, capped: false }
                  const active = planFilter === p.table
                  return (
                    <tr key={p.table} style={active ? { background: '#fff8e1' } : undefined}>
                      <td><b>{p.label}</b> <span className="hint">{money(p.price)}/mo</span></td>
                      <td><button type="button" className="link-btn" onClick={() => filterToPlan(p.table, false)}>{s.count}{s.capped ? '+' : ''}</button></td>
                      <td><button type="button" className="link-btn" onClick={() => filterToPlan(p.table, true)}>{s.thisMonth}</button></td>
                      <td><button type="button" className="link-btn" onClick={() => filterToPlan(p.table, false)}>{money(s.value)}</button></td>
                      <td><button type="button" className="link-btn" onClick={() => filterToPlan(p.table, false)}>{s.latest ? fmtDate(new Date(s.latest).toISOString()) : '—'}</button></td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Totals are list prices — bundle discounts are not stored on order rows, so a customer who ordered several plans at a discount still shows here at full list price. Counts are capped at 500 rows per table, so “500+” means that plan may have more orders than shown.</p>
      <p className="hint">All plans together: {totalOrders} orders, {money(totalValue)} a month at list prices.</p>

      <div className="form-card">
        <input placeholder="Search name, email, phone, plan, note, clean link..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="row">
          <select value={groupFilter} onChange={e => { setGroupFilter(e.target.value); if (e.target.value !== 'all' && planFilter !== 'all' && PLAN_BY_TABLE[planFilter]?.group !== e.target.value) setPlanFilter('all') }} aria-label="Group">
            <option value="all">All groups</option>
            {GROUPS.map(g => <option key={g.key} value={g.key}>{g.title}</option>)}
          </select>
          <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); if (e.target.value !== 'all') setGroupFilter(PLAN_BY_TABLE[e.target.value].group) }} aria-label="Plan">
            <option value="all">All plans</option>
            {GROUPS.map(g => (
              <optgroup key={g.key} label={g.title}>
                {PLANS.filter(p => p.group === g.key).map(p => <option key={p.table} value={p.table}>{p.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="row">
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} aria-label="Month">
            <option value="all">All months</option>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="price-desc">Price: high to low</option>
            <option value="price-asc">Price: low to high</option>
            <option value="customer">Customer A–Z</option>
          </select>
        </div>
        <div className="row">
          <input type="number" min="0" step="1" placeholder="Min price ($)" value={minPrice} onChange={e => setMinPrice(e.target.value)} aria-label="Minimum price" />
          <input type="number" min="0" step="1" placeholder="Max price ($)" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} aria-label="Maximum price" />
        </div>
        <div className="store-actions">
          <button type="button" className="btn-soft" onClick={load}>↻ Refresh</button>
          {filtersActive && <button type="button" className="btn-soft" onClick={clearFilters}>Clear filters</button>}
        </div>
      </div>

      <p><b>{filtered.length} order{filtered.length === 1 ? '' : 's'}</b> · <b>{money(filteredTotal)}</b> a month at list prices</p>
      {filtered.length === 0 && <p className="hint">{totalOrders === 0 ? 'No orders yet — nothing has been ordered through the Business cart.' : 'No orders match these filters.'}</p>}
      {filtered.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Date</th><th>System / Plan</th><th>Customer</th><th>Email</th><th>Phone</th><th>Price</th><th>Status</th><th>Note</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const expanded = expandedKey === r.key
                const editing = editingKey === r.key
                const listPrice = PLAN_BY_TABLE[r.table]?.price
                return (
                  <Fragment key={r.key}>
                    <tr onClick={() => setExpandedKey(expanded ? null : r.key)} style={{ cursor: 'pointer' }}>
                      <td>{r.created_at ? fmtDate(r.created_at) : '—'}</td>
                      <td>{r.label}</td>
                      <td>{r.customer_name || '—'}</td>
                      <td>{r.customer_email || '—'}</td>
                      <td>{r.customer_phone || '—'}</td>
                      <td>{money(r.price)}</td>
                      {/* Status only means something on Clean Link orders
                          — every other order table has no status column,
                          so those rows show '—' rather than an invented
                          value. Clean Link status is shown, never edited
                          here: activation lives on Clean Link Orders. */}
                      <td>{r.table === 'clean_link_order' ? (r.status || '—') : '—'}</td>
                      <td>{truncate(r.note, 60) || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button type="button" className="btn-mini" onClick={() => startEdit(r)}>✏️ Edit</button>{' '}
                        <button type="button" className="btn-mini" onClick={() => { setConfirmDelete(r); setDeleteError('') }}>🗑 Delete</button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={9}>
                          {editing ? (
                            <>
                              <p><b>Edit order</b> — {r.label} · ordered {r.created_at ? fmtDate(r.created_at) : '—'}</p>
                              <div className="row">
                                <input placeholder="Customer name" value={edit.customer_name} onChange={e => setEdit({ ...edit, customer_name: e.target.value })} aria-label="Customer name" />
                                <input placeholder="Customer email" type="email" value={edit.customer_email} onChange={e => setEdit({ ...edit, customer_email: e.target.value })} aria-label="Customer email" />
                              </div>
                              <div className="row">
                                <input placeholder="Customer phone" value={edit.customer_phone} onChange={e => setEdit({ ...edit, customer_phone: e.target.value })} aria-label="Customer phone" />
                                <input placeholder="Price ($/month)" type="number" min="0" step="1" value={edit.price} onChange={e => setEdit({ ...edit, price: e.target.value })} aria-label="Price" />
                              </div>
                              <input placeholder="Note" value={edit.note} onChange={e => setEdit({ ...edit, note: e.target.value })} aria-label="Note" />
                              {r.table === 'clean_link_order' && (
                                <>
                                  <div className="row">
                                    <input placeholder="System (e.g. diner, pos, kids-math)" value={edit.system} onChange={e => setEdit({ ...edit, system: e.target.value })} aria-label="System" />
                                    <input placeholder="Shop slug" value={edit.shop_slug} onChange={e => setEdit({ ...edit, shop_slug: e.target.value })} aria-label="Shop slug" />
                                  </div>
                                  <div className="row">
                                    <input placeholder="Clean slug — the word after yently.com/" value={edit.clean_slug} onChange={e => setEdit({ ...edit, clean_slug: e.target.value })} aria-label="Clean slug" />
                                    <input placeholder="Business name" value={edit.business_name} onChange={e => setEdit({ ...edit, business_name: e.target.value })} aria-label="Business name" />
                                  </div>
                                  <p className="hint">Status ({r.status || '—'}) is not editable here — activate the link from Admin → Clean Link Orders, which flips the status and creates the live link together.</p>
                                </>
                              )}
                              <div className="store-actions">
                                <button type="button" className="btn-primary" onClick={() => saveEdit(r)} disabled={savingEdit}>Save</button>
                                <button type="button" className="btn-soft" onClick={cancelEdit}>Cancel</button>
                              </div>
                              {editError && <p className="hint">{editError}</p>}
                            </>
                          ) : (
                            <>
                              <p><b>Plan ordered:</b> {r.plan || r.label} · <b>Price:</b> {money(r.price)}/month (list price){listPrice !== undefined && r.price !== listPrice && <> — the plan's list price is {money(listPrice)}/month, so this order's price was changed</>}</p>
                              <p><b>Customer:</b> {r.customer_name || '—'}{r.customer_email ? ` · ${r.customer_email}` : ''}{r.customer_phone ? ` · ${r.customer_phone}` : ''}</p>
                              <p><b>Note:</b> {r.note || '—'}</p>
                              <p><b>Order #{r.id}</b> · {r.label}</p>
                              {r.table === 'clean_link_order' && (
                                <>
                                  <p><b>Clean link:</b> {r.clean_slug ? 'yently.com/' + r.clean_slug : '—'}</p>
                                  <p><b>System:</b> {r.system || '—'} · <b>Shop:</b> {r.shop_slug || '—'} · <b>Business name:</b> {r.business_name || '—'} · <b>Status:</b> {r.status || '—'}</p>
                                </>
                              )}
                              <p className="hint">Tap the row again to close. Use Edit on the row to change the customer, price or note — or Delete to remove this order.</p>
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
