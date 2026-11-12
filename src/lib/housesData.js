import { submitAndNotify } from './notify'

// Data layer for houses website orders. Mirrors
// insertDealerOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the agency's link and login by hand. No payment is taken here.
export async function insertHousesOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'houses_order',
    data,
    subject: `New houses order — ${data.customer_name}`,
    emailExtras,
  })
}
