import { submitAndNotify } from './notify'

// Data layer for Kids Science page orders. Mirrors
// insertTvGalleryOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the customer's school page and link by hand. No payment is taken here.
export async function insertKidsScienceOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'kids_science_order',
    data,
    subject: `New Kids Science order — ${data.customer_name}`,
    emailExtras,
  })
}
