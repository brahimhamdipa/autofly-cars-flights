import { insertRestaurantOrder } from './restaurantData'
import { insertPosOrder } from './posData'
import { insertBarbershopOrder } from './barbershopData'
import { insertDealerOrder } from './dealerData'
import { insertEmployeeOrder } from './employeeData'
import { insertBodyshopOrder } from './bodyshopData'
import { insertBarberOrder } from './barberData'
import {
  RESTAURANT_PLAN_KEY,
  POS_PLAN_KEY,
  BARBERSHOP_PLAN_KEY,
  DEALER_PLAN_KEY,
  EMPLOYEE_PLAN_KEY,
  BODYSHOP_PLAN_KEY,
  SAMPLE_PLAN_KEY,
} from './BusinessCartContext'

// Data layer for the unified Business Systems cart. Checkout inserts
// one row per cart item into that item's own order table and emails
// the owner once per item — exactly what the old per-system carts
// did, only now the items share one cart. The per-plan tables stay
// separate (restaurant_order, pos_order, barbershop_order,
// dealer_order, employee_order, bodyshop_order, barber_order),
// because each plan is a different product with a different
// follow-up. No payment is taken here.
const INSERT_BY_KEY = {
  [RESTAURANT_PLAN_KEY]: insertRestaurantOrder,
  [POS_PLAN_KEY]: insertPosOrder,
  [BARBERSHOP_PLAN_KEY]: insertBarbershopOrder,
  [DEALER_PLAN_KEY]: insertDealerOrder,
  [EMPLOYEE_PLAN_KEY]: insertEmployeeOrder,
  [BODYSHOP_PLAN_KEY]: insertBodyshopOrder,
  [SAMPLE_PLAN_KEY]: insertBarberOrder,
}

// items = [{key, name, price}]. Places each item in cart order and
// returns the placed items. If any insert throws, the error
// propagates — items placed before the failure stay placed, and the
// caller reports the error.
export async function placeBusinessOrder({ name, email, phone, note, items }) {
  const placed = []
  for (const item of items || []) {
    const insert = INSERT_BY_KEY[item.key]
    if (!insert) throw new Error('Unknown business plan: ' + item.key)
    await insert({
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      plan: item.name,
      price: item.price,
      note,
    }, { plan: item.name, price: item.price })
    placed.push(item)
  }
  return placed
}
