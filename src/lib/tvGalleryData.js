import { submitAndNotify } from './notify'

// Data layer for TV Gallery page orders. Mirrors
// insertPosOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the customer's upload form and TV link by hand. No payment is taken here.
export async function insertTvGalleryOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'tv_gallery_order',
    data,
    subject: `New TV Gallery order — ${data.customer_name}`,
    emailExtras,
  })
}
