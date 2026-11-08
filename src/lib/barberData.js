import { supabase } from './supabaseClient'
import { submitAndNotify } from './notify'

// Data layer for the barber template websites (batch 4 phase 2).
//
// Privacy shape (from the migration): anon SELECT is allowed on every
// template table EXCEPT barber_customer, barber_reservation and
// barber_order, which are insert-only for visitors. So a public template
// page can read the store, its locations, hours, styles and its
// header/body/footer — but never the customer list, the reservation
// queue, or other customers' orders. The queue is exposed only as an
// aggregate through the barber_wait_estimate RPC (see
// barber-wait-rpc.sql), which returns counts and minutes, no names.

// The website_domain row for a public slug, or null when the slug is
// not a barber website (the caller then falls through to the
// provider/employee login flow).
export async function loadBarberDomain(slug) {
  const { data, error } = await supabase
    .from('website_domain')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data || null
}

// Everything a public template page needs, in one object. The domain
// row carries store_id, so one fetch of the domain unlocks the rest.
export async function loadBarberPageData(domainId) {
  const { data: domain, error: domainError } = await supabase
    .from('website_domain')
    .select('*')
    .eq('id', domainId)
    .single()
  if (domainError) throw domainError

  const [storeRes, locRes, hoursRes, styleRes, headerRes, bodyRes, footerRes] = await Promise.all([
    supabase.from('barber_store').select('*').eq('id', domain.store_id).single(),
    supabase.from('barber_location').select('*').eq('store_id', domain.store_id).order('id'),
    supabase.from('open_time').select('*').eq('store_id', domain.store_id).maybeSingle(),
    supabase.from('barber_style').select('*').eq('store_id', domain.store_id).order('id'),
    supabase.from('website_header').select('*').eq('domain_id', domain.id).maybeSingle(),
    supabase.from('website_body').select('*').eq('domain_id', domain.id).maybeSingle(),
    supabase.from('website_footer').select('*').eq('domain_id', domain.id).maybeSingle(),
  ])
  const firstError = [storeRes, locRes, hoursRes, styleRes, headerRes, bodyRes, footerRes]
    .find(r => r.error)
  if (firstError) throw firstError.error

  return {
    domain,
    store: storeRes.data,
    locations: locRes.data || [],
    openTime: hoursRes.data || null,
    styles: styleRes.data || [],
    header: headerRes.data || null,
    body: bodyRes.data || null,
    footer: footerRes.data || null,
  }
}

// Insert a reservation and email it TO THE STORE's own address (not
// the owner default): the barber is the one who has to act on it.
// `data` is the barber_reservation row; `storeEmail` is the store's
// email from barber_store. The owner still gets nothing extra here —
// the store email IS the notification. (submitAndNotify's `to` param
// is the batch-4 addition to notify.js; without it the email would
// fall back to NOTIFY_TO.)
export async function insertBarberReservation(data, storeEmail, emailExtras) {
  return submitAndNotify({
    table: 'barber_reservation',
    data: { ...data, status: data.status || 'pending' },
    subject: `New barber reservation — ${data.customer_name}`,
    to: storeEmail,
    emailExtras,
  })
}

// Insert a barber-website order and email the OWNER (default
// NOTIFY_TO): the owner is the one who builds the website.
export async function insertBarberOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'barber_order',
    data,
    subject: `New sample website order — ${data.customer_name}`,
    emailExtras,
  })
}
