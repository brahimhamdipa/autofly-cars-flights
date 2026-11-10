import { submitAndNotify } from './notify'

// Data layer for Direct Upload orders. Mirrors insertCleanLinkOrder /
// insertTvGalleryOrder / insertLiveChatOrder: the order row is
// insert-only for visitors (customer PII), and placing it emails the
// owner. No payment is taken here.
//
// Unlike Clean Link, there is no per-order meta to carry: the
// request (direct_upload_requests) already told Yently which shop
// the add-on is for, so the order is just the plan itself. The
// admin switches Direct Upload on for that shop in Admin (Direct
// Upload Orders), and from then on the shop's uploads go live
// straight away.
export async function insertDirectUploadOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'direct_upload_order',
    data,
    subject: `New Direct Upload order — ${data.customer_name}`,
    emailExtras,
  })
}
