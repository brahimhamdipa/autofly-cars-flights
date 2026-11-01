import { supabase, NOTIFY_EMAIL } from './supabaseClient'
import { jsPDF } from 'jspdf'

// Data layer for the table-driven Stores system (replaces Stores/* folders).
// Tables: store_categories, store_providers, store_items, store_orders,
// store_holds. Public reads; orders and holds go through security-definer
// RPCs so totals are always computed from database prices.

export async function loadCategories() {
  const { data, error } = await supabase.from('store_categories').select('*').order('name')
  if (error) throw error
  return data || []
}

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

// Items with their provider + category joined. Filters: providerId,
// categorySlug (e.g. 'store-products'), activeOnly (default true),
// onlineFilter: true = only items sold on the Online Store page,
// false = only items NOT sold online, null/undefined = all items.
export async function loadItems({ providerId, categorySlug, activeOnly = true, onlineFilter } = {}) {
  let q = supabase.from('store_items')
    .select('*, provider:store_providers(id, name, country, city), category:store_categories(id, name, slug)')
    .order('name')
  if (providerId) q = q.eq('provider_id', providerId)
  if (activeOnly) q = q.eq('is_active', true)
  if (onlineFilter === true) q = q.eq('online', true)
  if (onlineFilter === false) q = q.eq('online', false)
  let { data, error } = await q
  if (error) throw error
  if (categorySlug) {
    data = (data || []).filter(i => i.category && i.category.slug === categorySlug)
  }
  return data || []
}

// One item with provider + category (the item detail page).
export async function loadItem(id) {
  const { data, error } = await supabase.from('store_items')
    .select('*, provider:store_providers(id, name, country, city, phone, address), category:store_categories(id, name, slug)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// Store items by id (used by the unified cart to resolve its lines).
export async function loadItemsByIds(ids) {
  if (!ids || ids.length === 0) return []
  const { data, error } = await supabase.from('store_items')
    .select('*, provider:store_providers(id, name, country, city)')
    .in('id', ids)
  if (error) throw error
  return data || []
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
    p_items: cart.map(c => ({ id: c.id, qty: c.qty })),
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
    p_items: cart.map(c => ({ id: c.id, qty: c.qty })),
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
