import { submitAndNotify } from './notify'

// Data layer for car rental website orders. Mirrors
// insertDealerOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the rental company's link and login by hand. No payment is taken here.
export async function insertRentalsOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'rentals_order',
    data,
    subject: `New car rental order — ${data.customer_name}`,
    emailExtras,
  })
}
