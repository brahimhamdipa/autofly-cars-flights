import { submitAndNotify } from './notify'

// Data layer for Kids English page orders. Mirrors
// insertTvGalleryOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the customer's school page and link by hand. No payment is taken here.
export async function insertKidsEnglishOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'kids_english_order',
    data,
    subject: `New Kids English order — ${data.customer_name}`,
    emailExtras,
  })
}
