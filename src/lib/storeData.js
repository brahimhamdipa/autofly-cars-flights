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
export function buildReceiptPdf({ kind, refId, storeName, customer, lines, total, fulfillment, deliveryAddress }) {
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
