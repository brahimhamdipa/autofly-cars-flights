import { submitAndNotify } from './notify'

// Data layer for restaurant ordering-page orders. Mirrors
// insertBarberOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the restaurant's link and login by hand. No payment is taken here.
export async function insertRestaurantOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'restaurant_order',
    data,
    subject: `New restaurant order — ${data.customer_name}`,
    emailExtras,
  })
}
