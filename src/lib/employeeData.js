import { submitAndNotify } from './notify'

// Data layer for employee time-page orders. Mirrors
// insertDealerOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then creates
// the team's link and login by hand. No payment is taken here.
export async function insertEmployeeOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'employee_order',
    data,
    subject: `New employee order — ${data.customer_name}`,
    emailExtras,
  })
}
