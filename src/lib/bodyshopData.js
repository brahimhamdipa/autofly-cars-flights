import { submitAndNotify } from './notify'

// Data layer for bodyshop management orders. Mirrors
// insertDealerOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the bodyshop's link and login by hand. No payment is taken here.
export async function insertBodyshopOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'bodyshop_order',
    data,
    subject: `New bodyshop order — ${data.customer_name}`,
    emailExtras,
  })
}
