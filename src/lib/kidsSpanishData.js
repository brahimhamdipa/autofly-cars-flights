import { submitAndNotify } from './notify'

// Data layer for Kids Spanish page orders. Mirrors
// insertTvGalleryOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the customer's school page and link by hand. No payment is taken here.
export async function insertKidsSpanishOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'kids_spanish_order',
    data,
    subject: `New Kids Spanish order — ${data.customer_name}`,
    emailExtras,
  })
}
