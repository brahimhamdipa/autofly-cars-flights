import { supabase, NOTIFY_EMAIL } from './supabaseClient'
import { jsPDF } from 'jspdf'

// Data layer for the table-driven Stores system (replaces Stores/* folders).
// Tables: store_providers, store_items, store_orders, store_holds,
// category, subCategory, store_item_categories, store_item_fromdel,
// store_item_topick, fromDel, toPick. Public reads; orders and holds go
// through security-definer RPCs so totals are always computed from
// database prices.
//
// NOTE: store_categories is GONE. Items link to categories ONLY through
// the store_item_categories junction (item_id, category_id), and variants
// are category-level: an item's variants are the subCategory rows of its
// linked categories.

export async function loadProviders() {
  const { data, error } = await supabase.from('store_providers').select('*').order('name')
  if (error) throw error
  return data || []
}

export async function loadProvider(id) {
  const { data, error } = await supabase.from('store_providers').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// Attach each item's categories (junction + category table), sorted by
// label, as item.categories = [{ id, slug, label }]. Items with no links
// get an empty array.
async function attachItemCategories(items) {
  if (!items || items.length === 0) return items || []
  const ids = items.map(i => i.id)
  const { data: links, error } = await supabase.from('store_item_categories').select('item_id, category_id').in('item_id', ids)
  if (error) throw error
  const catIds = [...new Set((links || []).map(r => r.category_id))]
  let catsById = {}
  if (catIds.length) {
    const { data: cats, error: catErr } = await supabase.from('category').select('id, slug, label').in('id', catIds)
    if (catErr) throw catErr
    catsById = Object.fromEntries((cats || []).map(c => [c.id, c]))
  }
  const perItem = {}
  for (const r of links || []) {
    const cat = catsById[r.category_id]
    if (!cat) continue
    if (!perItem[r.item_id]) perItem[r.item_id] = []
    if (!perItem[r.item_id].some(c => c.id === cat.id)) perItem[r.item_id].push(cat)
  }
  for (const item of items) {
    item.categories = (perItem[item.id] || []).sort((a, b) => (a.label || '').localeCompare(b.label || ''))
  }
  return items
}

// Items with their provider joined + categories attached. Filters:
// providerId, activeOnly (default true). No category or online filtering
// here — the Products page filters client-side from item.categories.
export async function loadItems({ providerId, activeOnly = true } = {}) {
  let q = supabase.from('store_items')
    .select('*, provider:store_providers(id, name, country, city)')
    .order('name')
  if (providerId) q = q.eq('provider_id', providerId)
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return attachItemCategories(data || [])
}

// One item with provider + categories attached (the item detail page).
export async function loadItem(id) {
  const { data, error } = await supabase.from('store_items')
    .select('*, provider:store_providers(id, name, country, city, phone, address)')
    .eq('id', id)
    .single()
  if (error) throw error
  return (await attachItemCategories([data]))[0]
}

// Store items by id (used by the unified cart to resolve its lines),
// with categories attached.
export async function loadItemsByIds(ids) {
  if (!ids || ids.length === 0) return []
  const { data, error } = await supabase.from('store_items')
    .select('*, provider:store_providers(id, name, country, city)')
    .in('id', ids)
  if (error) throw error
  return attachItemCategories(data || [])
}

// An item's variants, grouped per item id: { itemId: [subCategory rows] }.
// Variants are CATEGORY-level: an item's variants are the subCategory rows
// of every category it is linked to (union, deduped by row id). Items with
// no linked categories, or categories with no subCategory rows, get an
// empty array. Empty input -> {}.
export async function loadItemVariants(itemIds) {
  if (!itemIds || itemIds.length === 0) return {}
  const { data: links, error } = await supabase.from('store_item_categories').select('item_id, category_id').in('item_id', itemIds)
  if (error) throw error
  const catIds = [...new Set((links || []).map(r => r.category_id))]
  if (catIds.length === 0) return {}
  const { data: rows, error: subErr } = await supabase.from('subCategory').select('*').in('category_id', catIds)
  if (subErr) throw subErr
  const catsOfItem = {}
  for (const r of links || []) {
    if (!catsOfItem[r.item_id]) catsOfItem[r.item_id] = new Set()
    catsOfItem[r.item_id].add(r.category_id)
  }
  const rowsByCat = {}
  for (const row of rows || []) {
    if (!rowsByCat[row.category_id]) rowsByCat[row.category_id] = []
    rowsByCat[row.category_id].push(row)
  }
  const out = {}
  for (const id of itemIds) {
    const seen = new Set()
    const list = []
    for (const catId of catsOfItem[id] || []) {
      for (const row of rowsByCat[catId] || []) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        list.push(row)
      }
    }
    out[id] = list
  }
  return out
}

// One-line label for a subCategory row, joining only the fields that are
// set, in this order: flavor, color, size, "Pack of <packof>",
// "<weight> <unit>". Examples: "Mango · Pack of 12", "Red · M".
export function formatVariant(row) {
  if (!row) return ''
  const parts = []
  if (row.flavor) parts.push(String(row.flavor))
  if (row.color) parts.push(String(row.color))
  if (row.size) parts.push(String(row.size))
  if (row.packof !== null && row.packof !== undefined && row.packof !== '') parts.push(`Pack of ${row.packof}`)
  if (row.weight !== null && row.weight !== undefined && row.weight !== '') {
    parts.push(String(row.weight) + (row.unit ? ` ${row.unit}` : ''))
  }
  return parts.join(' · ')
}

// Delivery/pickup locations linked to items, grouped per item id:
// { fromdel: { itemId: [fromDel rows] }, topick: { itemId: [toPick rows] } }.
// Used by the checkout popups. Empty input -> empty maps.
export async function loadItemLocations(itemIds) {
  if (!itemIds || itemIds.length === 0) return { fromdel: {}, topick: {} }
  const [fd, tp] = await Promise.all([
    supabase.from('store_item_fromdel').select('item_id, fromdel_id').in('item_id', itemIds),
    supabase.from('store_item_topick').select('item_id, topick_id').in('item_id', itemIds),
  ])
  if (fd.error) throw fd.error
  if (tp.error) throw tp.error
  const fromIds = [...new Set((fd.data || []).map(r => r.fromdel_id))]
  const toIds = [...new Set((tp.data || []).map(r => r.topick_id))]
  const [fromRows, toRows] = await Promise.all([
    fromIds.length ? supabase.from('fromDel').select('*').in('id', fromIds) : Promise.resolve({ data: [] }),
    toIds.length ? supabase.from('toPick').select('*').in('id', toIds) : Promise.resolve({ data: [] }),
  ])
  if (fromRows.error) throw fromRows.error
  if (toRows.error) throw toRows.error
  const fromById = Object.fromEntries((fromRows.data || []).map(r => [r.id, r]))
  const toById = Object.fromEntries((toRows.data || []).map(r => [r.id, r]))
  const fromdel = {}
  const topick = {}
  for (const r of fd.data || []) {
    const row = fromById[r.fromdel_id]
    if (!row) continue
    if (!fromdel[r.item_id]) fromdel[r.item_id] = []
    fromdel[r.item_id].push(row)
  }
  for (const r of tp.data || []) {
    const row = toById[r.topick_id]
    if (!row) continue
    if (!topick[r.item_id]) topick[r.item_id] = []
    topick[r.item_id].push(row)
  }
  return { fromdel, topick }
}

// New location/category tables (admin lists + checkout popups).
// NOTE: category here is the NEW item-category table, not store_categories.
export async function loadItemCategories() {
  const { data, error } = await supabase.from('category').select('*').order('label')
  if (error) throw error
  return data || []
}

export async function loadFromDel() {
  const { data, error } = await supabase.from('fromDel').select('*').order('fname')
  if (error) throw error
  return data || []
}

export async function loadToPick() {
  const { data, error } = await supabase.from('toPick').select('*').order('tname')
  if (error) throw error
  return data || []
}

export async function loadSubCategories() {
  const { data, error } = await supabase.from('subCategory').select('*').order('id')
  if (error) throw error
  return data || []
}

// Replace one item's links wholesale: delete all its junction rows, then
// insert the given ids (empty arrays insert nothing). Admin use only.
export async function syncItemLinks(itemId, { categoryIds = [], fromdelIds = [], topickIds = [] } = {}) {
  const dels = await Promise.all([
    supabase.from('store_item_categories').delete().eq('item_id', itemId),
    supabase.from('store_item_fromdel').delete().eq('item_id', itemId),
    supabase.from('store_item_topick').delete().eq('item_id', itemId),
  ])
  for (const d of dels) if (d.error) throw d.error
  const inserts = []
  if (categoryIds.length) inserts.push(supabase.from('store_item_categories').insert(categoryIds.map(category_id => ({ item_id: itemId, category_id }))))
  if (fromdelIds.length) inserts.push(supabase.from('store_item_fromdel').insert(fromdelIds.map(fromdel_id => ({ item_id: itemId, fromdel_id }))))
  if (topickIds.length) inserts.push(supabase.from('store_item_topick').insert(topickIds.map(topick_id => ({ item_id: itemId, topick_id }))))
  for (const ins of inserts) {
    const { error } = await ins
    if (error) throw error
  }
}

export async function placeStoreOrder({ providerId, name, email, phone, fulfillment, deliveryAddress, cart }) {
  const { data, error } = await supabase.rpc('place_store_order', {
    p_provider_id: providerId,
    p_customer_name: name,
    p_customer_email: email,
    p_customer_phone: phone || '',
    p_fulfillment: fulfillment,
    p_delivery_address: deliveryAddress || '',
    p_items: cart.map(c => ({ id: c.id, qty: c.qty, variant: c.variant || null })),
  })
  if (error) throw error
  return data
}

export async function placeStoreHold({ itemId, name, email, phone }) {
  const { data, error } = await supabase.rpc('place_store_hold', {
    p_item_id: itemId,
    p_customer_name: name,
    p_customer_email: email,
    p_customer_phone: phone || '',
  })
  if (error) throw error
  return data
}

// Hold a whole cart section with one store: same arguments as
// placeStoreOrder, but the order row is marked is_hold and no payment
// is expected — the customer pays at the store when arranging things.
export async function placeStoreHoldOrder({ providerId, name, email, phone, fulfillment, deliveryAddress, cart }) {
  const { data, error } = await supabase.rpc('place_store_hold_order', {
    p_provider_id: providerId,
    p_customer_name: name,
    p_customer_email: email,
    p_customer_phone: phone || '',
    p_fulfillment: fulfillment,
    p_delivery_address: deliveryAddress || '',
    p_items: cart.map(c => ({ id: c.id, qty: c.qty, variant: c.variant || null })),
  })
  if (error) throw error
  return data
}

// Email a receipt PDF to the store owner (the standing owner-email rule).
// The customer keeps the downloaded PDF; the owner gets the record + PDF.
export async function emailReceipt({ subject, record, pdfBase64, filename }) {
  await supabase.functions.invoke('send-notification', {
    body: {
      to: NOTIFY_EMAIL,
      subject,
      table: 'store_orders',
      record,
      attachment: pdfBase64 ? { filename, content: pdfBase64 } : undefined,
    },
  })
}

export function money(v) {
  return '$' + Number(v || 0).toFixed(2)
}

// Build a receipt PDF (jsPDF) and return it as a base64 string + a
// download helper. kind: 'order' | 'hold'.
export function buildReceiptPdf({ kind, refId, storeName, customer, lines, total, fulfillment, deliveryAddress, locationLabel }) {
  const doc = new jsPDF()
  let y = 20
  doc.setFontSize(18)
  doc.text('AutoFly — Receipt', 14, y)
  y += 10
  doc.setFontSize(12)
  doc.text(`${kind === 'hold' ? 'Hold' : 'Order'} #${refId} — ${storeName}`, 14, y)
  y += 8
  doc.text(`Customer: ${customer.name} (${customer.email}${customer.phone ? ', ' + customer.phone : ''})`, 14, y)
  y += 8
  if (fulfillment) {
    doc.text(`Fulfillment: ${fulfillment}${deliveryAddress ? ' — ' + deliveryAddress : ''}`, 14, y)
    y += 8
  }
  if (locationLabel) {
    doc.text(`Location: ${locationLabel}`, 14, y)
    y += 8
  }
  y += 4
  for (const l of lines) {
    const line = `${l.name} x ${l.qty || 1} — ${money((l.price || 0) * (l.qty || 1))}`
    doc.text(line, 14, y)
    y += 7
    if (y > 270) { doc.addPage(); y = 20 }
  }
  y += 4
  doc.setFontSize(14)
  doc.text(`Total: ${money(total)}`, 14, y)
  y += 12
  doc.setFontSize(11)
  if (kind === 'hold') {
    doc.text('This item is held by the store until you contact them to', 14, y)
    y += 6
    doc.text('arrange pickup or delivery. No payment was taken online —', 14, y)
    y += 6
    doc.text('you pay the store when you make your arrangement.', 14, y)
  } else {
    doc.text('Thank you for ordering with AutoFly.', 14, y)
  }
  const base64 = doc.output('datauristring').split(',')[1]
  const download = (filename) => doc.save(filename)
  return { base64, download }
}
