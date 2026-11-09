import { submitAndNotify } from './notify'

// Data layer for Kids Geography page orders. Mirrors
// insertTvGalleryOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the customer's school page and link by hand. No payment is taken here.
export async function insertKidsGeographyOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'kids_geography_order',
    data,
    subject: `New Kids Geography order — ${data.customer_name}`,
    emailExtras,
  })
}
