import { submitAndNotify } from './notify'

// Data layer for barbershop booking-page orders. Mirrors
// insertPosOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the barbershop's link and login by hand. No payment is taken here.
export async function insertBarbershopOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'barbershop_order',
    data,
    subject: `New barbershop order — ${data.customer_name}`,
    emailExtras,
  })
}
