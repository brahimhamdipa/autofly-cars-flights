import { submitAndNotify } from './notify'

// Data layer for doctor website orders. Mirrors
// insertDealerOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the clinic's link and login by hand. No payment is taken here.
export async function insertDoctorOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'doctor_order',
    data,
    subject: `New doctor order — ${data.customer_name}`,
    emailExtras,
  })
}
