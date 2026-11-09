import { insertRestaurantOrder } from './restaurantData'
import { insertPosOrder } from './posData'
import { insertBarbershopOrder } from './barbershopData'
import { insertDealerOrder } from './dealerData'
import { insertEmployeeOrder } from './employeeData'
import { insertBodyshopOrder } from './bodyshopData'
import { insertBarberOrder } from './barberData'
import { insertTvGalleryOrder } from './tvGalleryData'
import { insertLiveChatOrder } from './liveChatData'
import { insertCleanLinkOrder } from './cleanLinkData'
import { insertKidsMathOrder } from './kidsMathData'
import { insertKidsEnglishOrder } from './kidsEnglishData'
import { insertKidsArabicOrder } from './kidsArabicData'
import { insertKidsFrenchOrder } from './kidsFrenchData'
import { insertKidsSpanishOrder } from './kidsSpanishData'
import { insertKidsScienceOrder } from './kidsScienceData'
import { insertKidsGeographyOrder } from './kidsGeographyData'
import { insertKidsCodingOrder } from './kidsCodingData'
import { insertKidsReadingOrder } from './kidsReadingData'
import {
  RESTAURANT_PLAN_KEY,
  POS_PLAN_KEY,
  BARBERSHOP_PLAN_KEY,
  DEALER_PLAN_KEY,
  EMPLOYEE_PLAN_KEY,
  BODYSHOP_PLAN_KEY,
  SAMPLE_PLAN_KEY,
  TV_PLAN_KEY,
  CHAT_PLAN_KEY,
  KIDS_MATH_PLAN_KEY,
  KIDS_ENGLISH_PLAN_KEY,
  KIDS_ARABIC_PLAN_KEY,
  KIDS_FRENCH_PLAN_KEY,
  KIDS_SPANISH_PLAN_KEY,
  KIDS_SCIENCE_PLAN_KEY,
  KIDS_GEOGRAPHY_PLAN_KEY,
  KIDS_CODING_PLAN_KEY,
  KIDS_READING_PLAN_KEY,
} from './BusinessCartContext'

// Data layer for the unified Business Systems cart. Checkout inserts
// one row per cart item into that item's own order table and emails
// the owner once per item — exactly what the old per-system carts
// did, only now the items share one cart. The per-plan tables stay
// separate (restaurant_order, pos_order, barbershop_order,
// dealer_order, employee_order, bodyshop_order, barber_order,
// tv_gallery_order, live_chat_order, clean_link_order, kids_math_order,
// kids_english_order, kids_arabic_order, kids_french_order,
// kids_spanish_order, kids_science_order, kids_geography_order,
// kids_coding_order, kids_reading_order),
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
  [TV_PLAN_KEY]: insertTvGalleryOrder,
  [CHAT_PLAN_KEY]: insertLiveChatOrder,
  [CLEAN_PLAN_KEY]: insertCleanLinkOrder,
  [KIDS_MATH_PLAN_KEY]: insertKidsMathOrder,
  [KIDS_ENGLISH_PLAN_KEY]: insertKidsEnglishOrder,
  [KIDS_ARABIC_PLAN_KEY]: insertKidsArabicOrder,
  [KIDS_FRENCH_PLAN_KEY]: insertKidsFrenchOrder,
  [KIDS_SPANISH_PLAN_KEY]: insertKidsSpanishOrder,
  [KIDS_SCIENCE_PLAN_KEY]: insertKidsScienceOrder,
  [KIDS_GEOGRAPHY_PLAN_KEY]: insertKidsGeographyOrder,
  [KIDS_CODING_PLAN_KEY]: insertKidsCodingOrder,
  [KIDS_READING_PLAN_KEY]: insertKidsReadingOrder,
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
