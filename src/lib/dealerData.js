import { submitAndNotify } from './notify'

// Data layer for dealer website orders. Mirrors
// insertRestaurantOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the dealership's link and login by hand. No payment is taken here.
export async function insertDealerOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'dealer_order',
    data,
    subject: `New dealer order — ${data.customer_name}`,
    emailExtras,
  })
}
