import { submitAndNotify } from './notify'

// Data layer for point-of-sale-page orders. Mirrors
// insertRestaurantOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the store's link and login by hand. No payment is taken here.
export async function insertPosOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'pos_order',
    data,
    subject: `New point of sale order — ${data.customer_name}`,
    emailExtras,
  })
}
