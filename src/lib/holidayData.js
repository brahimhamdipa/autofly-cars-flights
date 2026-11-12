import { submitAndNotify } from './notify'

// Data layer for holiday rentals website orders. Mirrors
// insertRestaurantOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the business's link and login by hand. No payment is taken here.
export async function insertHolidayOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'holiday_order',
    data,
    subject: `New holiday order — ${data.customer_name}`,
    emailExtras,
  })
}
