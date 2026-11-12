import { submitAndNotify } from './notify'

// Data layer for laundry website orders. Mirrors
// insertDealerOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the laundry's link and login by hand. No payment is taken here.
export async function insertLaundryOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'laundry_order',
    data,
    subject: `New laundry order — ${data.customer_name}`,
    emailExtras,
  })
}
