import { useEffect, useMemo, useRef, useState } from 'react'

import { supabase } from '../../lib/supabaseClient'

import { loadProviders, syncItemLinks, loadItemCategories, loadFromDel, loadToPick, loadSubCategories } from '../../lib/storeData'

import { ProviderForm, ItemForm, ProviderFormEditor, FromDelForm, ToPickForm, ItemCategoryForm, SubCategoryForm, JobForm, EmployeeForm, LanguageForm, EmployeePassForm, BarberStoreForm, BarberLocationForm, OpenTimeForm, BarberCustomerForm, BarberStyleForm, WebsiteDomainForm, WebsiteTypeForm, WebsiteHeaderForm, WebsiteBodyForm, WebsiteFooterForm, BarberReservationForm } from './StoreFormBits'

import { money } from '../../lib/storeData'

// Editing/Deleting section: one page per table, same pattern as the
// Products & Stock page — a form above the table (blank for a new row,
// filled when Edit is tapped) and Edit/Delete on every row. No popups.
// A provider that still has items cannot be deleted until those items
// are gone first — the database refuses it, and the error is shown
// plainly. Categories live ONLY in the new category table ("Item
// Categories" tab) and link to items via tick boxes on the Items form;
// the old store_categories table is gone.
const TABLES = [
  ['providers', 'Store Add.Edit.Del', 'store_providers'],
  ['items', 'Items Add.Edit.Del.Approve', 'store_items'],
  ['item_batches', 'Items Approval', 'store_item_batches'],
  ['forms', 'Store Passes', 'providersForm'],
  ['fromdel', 'Delivery Add.Edit.Del', 'fromDel'],
  ['topick', 'Pickup Add.Edit.Del', 'toPick'],
  ['itemcats', 'Category Add.Edit.Del', 'category'],
  ['subcats', 'SubCategory Add.Edit.Del', 'subCategory'],
  ['jobs', 'Job Add.Edit.Del', 'jobs'],
  ['employees', 'Employee Add.Edit.Del', 'employees'],
  ['languages', 'Language Add.Edit.Del', 'languages'],
  ['passes', 'Employee Passes', 'fPasses'],
  ['barber_stores', 'Header2', 'barber_store'],
  ['barber_locations', 'Body4', 'barber_location'],
  ['open_times', 'Body5', 'open_time'],
  ['barber_customers', 'Customers List', 'barber_customer'],
  ['barber_styles', 'Body3', 'barber_style'],
  ['website_domains', 'Website PrePasses -Domain', 'website_domain'],
  ['website_types', 'Website Types', 'website_type'],
  ['website_headers', 'Header1', 'website_header'],
  ['website_bodies', 'Body 2.6.titles', 'website_body'],
  ['website_footers', 'Website Footers', 'website_footer'],
  ['barber_reservations', 'Cust.Subm.DB', 'barber_reservation'],
  ['barber_orders', 'Barbers', 'barber_order'],
  ['restaurant_orders', 'Restaurants', 'restaurant_order'],
  ['intake_forms', 'Website Add.Edit Pass', 'barber_intake_forms'],
  ['intake_submissions', 'Website Submission.Approval', 'barber_intake_submissions'],
  ['upload_forms', 'Upload Forms', 'upload_forms'],
  ['diner_restaurants', 'Diner Passes', 'diner_restaurants'],
  ['diner_approvals', 'Diner Approvals', 'diner_restaurants'],
  ['diner_orders', 'Diner Kitchen', 'diner_orders'],
  ['barbershop_shops', 'Barber Passes', 'barbershop_shops'],
  ['barbershop_approvals', 'Barbershop Approvals', 'barbershop_shops'],
  ['barbershop_bookings', 'Barber Bookings', 'barbershop_bookings'],
  ['barbershop_orders', 'Barbershop Orders', 'barbershop_order'],
  ['tv_gallery_orders', 'TV Gallery Orders', 'tv_gallery_order'],
  ['live_chat_orders', 'Live Chat Orders', 'live_chat_order'],
  ['pos_stores', 'POS Passes', 'pos_stores'],
  ['pos_approvals', 'POS Approval', 'pos_stores'],
  ['pos_sales', 'POS Sales', 'pos_sales'],
  ['pos_orders', 'POS Orders', 'pos_order'],
  ['dealer_shops', 'Dealer Passes', 'dealer_shops'],
  ['dealer_approvals', 'Dealer Approval', 'dealer_shops'],
  ['dealer_testdrives', 'Dealer Test Drives', 'dealer_testdrives'],
  ['dealer_tradeins', 'Dealer Trade-ins', 'dealer_tradeins'],
  ['dealer_orders', 'Dealer Orders', 'dealer_order'],
  ['employee_shops', 'Employee Passes', 'employee_shops'],
  ['employee_approvals', 'Employee Approval', 'employee_shops'],
  ['employee_timelogs', 'Employee Records', 'employee_timelogs'],
  ['employee_orders', 'Employee Orders', 'employee_order'],
  ['bodyshop_shops', 'Bodyshop Passes', 'bodyshop_shops'],
  ['bodyshop_approvals', 'Bodyshop Approval', 'bodyshop_shops'],
  ['bodyshop_jobs', 'Bodyshop Jobs', 'bodyshop_jobs'],
  ['bodyshop_orders', 'Bodyshop Orders', 'bodyshop_order'],
  ['kids_math_shops', 'Kids Math Passes', 'kids_math_shops'],
  ['kids_math_approvals', 'Kids Math Approvals', 'kids_math_shops'],
  ['kids_math_orders', 'Kids Math Orders', 'kids_math_order'],
  ['kids_english_shops', 'Kids English Passes', 'kids_english_shops'],
  ['kids_english_approvals', 'Kids English Approvals', 'kids_english_shops'],
  ['kids_english_orders', 'Kids English Orders', 'kids_english_order'],
  ['kids_arabic_shops', 'Kids Arabic Passes', 'kids_arabic_shops'],
  ['kids_arabic_approvals', 'Kids Arabic Approvals', 'kids_arabic_shops'],
  ['kids_arabic_orders', 'Kids Arabic Orders', 'kids_arabic_order'],
  ['kids_french_shops', 'Kids French Passes', 'kids_french_shops'],
  ['kids_french_approvals', 'Kids French Approvals', 'kids_french_shops'],
  ['kids_french_orders', 'Kids French Orders', 'kids_french_order'],
  ['kids_spanish_shops', 'Kids Spanish Passes', 'kids_spanish_shops'],
  ['kids_spanish_approvals', 'Kids Spanish Approvals', 'kids_spanish_shops'],
  ['kids_spanish_orders', 'Kids Spanish Orders', 'kids_spanish_order'],
  ['kids_science_shops', 'Kids Science Passes', 'kids_science_shops'],
  ['kids_science_approvals', 'Kids Science Approvals', 'kids_science_shops'],
  ['kids_science_orders', 'Kids Science Orders', 'kids_science_order'],
  ['kids_geography_shops', 'Kids Geography Passes', 'kids_geography_shops'],
  ['kids_geography_approvals', 'Kids Geography Approvals', 'kids_geography_shops'],
  ['kids_geography_orders', 'Kids Geography Orders', 'kids_geography_order'],
  ['kids_coding_shops', 'Kids Coding Passes', 'kids_coding_shops'],
  ['kids_coding_approvals', 'Kids Coding Approvals', 'kids_coding_shops'],
  ['kids_coding_orders', 'Kids Coding Orders', 'kids_coding_order'],
  ['kids_reading_shops', 'Kids Reading Passes', 'kids_reading_shops'],
  ['kids_reading_approvals', 'Kids Reading Approvals', 'kids_reading_shops'],
  ['kids_reading_orders', 'Kids Reading Orders', 'kids_reading_order'],
]

// Yently Kids: one shops table + one approvals view + one orders table
// per subject. The three tables share the subject slug in the key
// (kids_math_shops / kids_math_approvals / kids_math_orders), so one
// helper covers all nine subjects instead of 27 separate branches.
const KIDS_SUBJECTS = {
  math: { label: 'Math', folder: 'kids-math' },
  english: { label: 'English', folder: 'kids-english' },
  arabic: { label: 'Arabic', folder: 'kids-arabic' },
  french: { label: 'French', folder: 'kids-french' },
  spanish: { label: 'Spanish', folder: 'kids-spanish' },
  science: { label: 'Science', folder: 'kids-science' },
  geography: { label: 'Geography', folder: 'kids-geography' },
  coding: { label: 'Coding', folder: 'kids-coding' },
  reading: { label: 'Reading', folder: 'kids-reading' },
}
const kidsSubjectOf = (table) => {
  const m = /^kids_([a-z]+)_(shops|approvals|orders)$/.exec(table || '')
  return m ? m[1] : null
}
const KIDS_SHOP_TABLES = Object.keys(KIDS_SUBJECTS).map(s => 'kids_' + s + '_shops')
const KIDS_APPROVAL_TABLES = Object.keys(KIDS_SUBJECTS).map(s => 'kids_' + s + '_approvals')
const KIDS_ORDER_TABLES = Object.keys(KIDS_SUBJECTS).map(s => 'kids_' + s + '_orders')

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const blankDraft = (table) => {
  if (table === 'providers') return { name: '', phone: '', email: '', address: '', city: '', country: '', zip: '', hours: '', about: '', pics: [], holdorder: false, payorder: true }
  if (table === 'items') return { provider_id: '', name: '', price: '', description: '', delivery_address: '', pickup_address: '', delivery: true, pickup: true, is_active: true, stock: '', pics: [] }
  if (table === 'forms') return { provider_id: '', f: '', u: '', p: '', comment: '' }
  if (table === 'fromdel') return { fname: '', faddress: '', fcity: '', fstate: '', fzip: '', fcountry: '', fcounty: '', ftownship: '', fcomment: '' }
  if (table === 'topick') return { tname: '', taddress: '', tcity: '', tstate: '', tzip: '', tcountry: '', tcounty: '', ttownship: '', tcomment: '' }
  if (table === 'itemcats') return { label: '' }
  if (table === 'subcats') return { category_id: '', flavor: '', color: '', packof: '', size: '', weight: '', unit: '' }
  if (table === 'jobs') return { jobTitle: '', jobDescription: '' }
  if (table === 'employees') return { firstName: '', lastName: '', job_id: '', address: '', city: '', zip: '', state: '', county: '', dob: '', email1: '', email2: '', pictures: [], phone1: '', phone2: '', about: '', maritalStatus: '', gender: '', notes: '' }
  if (table === 'languages') return { language: '', note: '', employee_id: '' }
  if (table === 'passes') return { employee_id: '', formName: '', u: '', p: '', note: '', chat: true }
  if (table === 'barber_stores') return { store_name: '', owner_name: '', tel: '', email: '', url: '', about: '', pics: [], text_message: false }
  if (table === 'barber_locations') return { store_id: '', address: '', city: '', zip: '', state: '', country: '', county: '', township: '', note: '' }
  if (table === 'open_times') return { store_id: '', monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '', closed: '', hours_may_differ: false }
  if (table === 'barber_customers') return { store_id: '', fname: '', lname: '', location_gps: '', note: '' }
  if (table === 'barber_styles') return { store_id: '', name: '', price: '', description: '', time_to_finish: '', pics: [] }
  if (table === 'website_domains') return { store_id: '', type_id: '', slug: '', domain: '', description: '', note: '', tel: '', email1: '', email2: '' }
  if (table === 'website_types') return { name: '', description: '', note: '', pics: [] }
  if (table === 'website_headers') return { domain_id: '', header_name: '', header_logo: [], header_slogan: '', header_description: '', header_note: '' }
  if (table === 'website_bodies') return { domain_id: '', name: '', description: '', note: '', text1: '', text2: '', text3: '', text4: '', text5: '', h1: '', h2: '', h3: '', h4: '', h5: '', pics: [] }
  if (table === 'website_footers') return { domain_id: '', footer_name: '', footer_logo: [], footer_slogan: '', footer_description: '', footer_note: '' }
  if (table === 'barber_reservations') return { store_id: '', domain_id: '', style_id: '', customer_name: '', customer_phone: '', customer_email: '', reservation_date: '', reservation_time: '', note: '', status: 'pending' }
  if (table === 'barber_orders') return { customer_name: '', customer_email: '', customer_phone: '', plan: 'Barber website', price: 10, note: '' }
  if (table === 'restaurant_orders') return { customer_name: '', customer_email: '', customer_phone: '', plan: 'Restaurant ordering page', price: 20, note: '' }
  if (table === 'intake_forms') return { f: '', u: '', p: '', note: '' }
  if (table === 'intake_submissions') return {}
  if (table === 'diner_restaurants') return { slug: '', name: '', u: '', p: '', epass: '', note: '' }
  if (table === 'diner_approvals') return {}
  if (table === 'diner_orders') return {}
  if (table === 'barbershop_shops') return { slug: '', name: '', u: '', p: '', epass: '', note: '' }
  if (table === 'barbershop_approvals') return {}
  if (table === 'barbershop_bookings') return {}
  if (table === 'barbershop_orders') return { customer_name: '', customer_email: '', customer_phone: '', plan: 'Barbershop booking page', price: 15, note: '' }
  if (table === 'tv_gallery_orders') return { customer_name: '', customer_email: '', customer_phone: '', plan: 'TV Gallery page', price: 2, note: '' }
  if (table === 'live_chat_orders') return { customer_name: '', customer_email: '', customer_phone: '', plan: 'Live chat page', price: 3, note: '' }
  if (table === 'pos_stores') return { slug: '', name: '', u: '', p: '', epass: '', note: '' }
  if (table === 'pos_approvals') return {}
  if (table === 'pos_sales') return {}
  if (table === 'pos_orders') return { customer_name: '', customer_email: '', customer_phone: '', plan: 'Point of sale page', price: 29, note: '' }
  if (table === 'dealer_shops') return { slug: '', name: '', u: '', p: '', epass: '', note: '' }
  if (table === 'dealer_approvals') return {}
  if (table === 'dealer_testdrives') return {}
  if (table === 'dealer_tradeins') return {}
  if (table === 'dealer_orders') return { customer_name: '', customer_email: '', customer_phone: '', plan: 'Dealer website', price: 20, note: '' }
  if (table === 'employee_shops') return { slug: '', name: '', u: '', p: '', epass: '', note: '' }
  if (table === 'employee_approvals') return {}
  if (table === 'employee_timelogs') return {}
  if (table === 'employee_orders') return { customer_name: '', customer_email: '', customer_phone: '', plan: 'Employee time page', price: 20, note: '' }
  if (table === 'bodyshop_shops') return { slug: '', name: '', u: '', p: '', epass: '', note: '' }
  if (table === 'bodyshop_approvals') return {}
  if (table === 'bodyshop_jobs') return {}
  if (table === 'bodyshop_orders') return { customer_name: '', customer_email: '', customer_phone: '', plan: 'Bodyshop management', price: 20, note: '' }
  if (KIDS_SHOP_TABLES.includes(table)) return { slug: '', name: '', u: '', p: '', epass: '', note: '' }
  if (KIDS_APPROVAL_TABLES.includes(table)) return {}
  if (KIDS_ORDER_TABLES.includes(table)) return { customer_name: '', customer_email: '', customer_phone: '', plan: 'Kids ' + KIDS_SUBJECTS[kidsSubjectOf(table)].label + ' page', price: 10, note: '' }
  if (table === 'item_batches') return {}
  if (table === 'upload_forms') return { f: '', u: '', p: '', folder: '', note: '' }
  return { name: '' }
}

function DinerRestaurantForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Restaurant name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input required placeholder="Slug — the word in yently.com/diner?r=slug" value={draft.slug || ''} onChange={e => setDraft({ ...draft, slug: e.target.value })} />
      <p className="hint">The customer shares yently.com/diner?r={(draft.slug || 'slug').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} with their own customers. New restaurants start with the demo menu.</p>
      <input required placeholder="Username for the restaurant" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the restaurant" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">This login is what you sell — use a throwaway password you invent for this restaurant, never your own password. Only you can see it here.</p>
      <input placeholder="Employee password (optional — one shared password for ordering + kitchen)" value={draft.epass || ''} onChange={e => setDraft({ ...draft, epass: e.target.value })} />
      <p className="hint">Give this to the owner with the login above. Anyone with the restaurant link sees the menu, but ordering and the kitchen need this password. Leave it empty and the restaurant stays fully open, as before.</p>
      <input placeholder="Note for yourself (optional — not shown to the restaurant)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

function BarbershopShopForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Shop name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input required placeholder="Slug — the word in yently.com/barbers?s=slug" value={draft.slug || ''} onChange={e => setDraft({ ...draft, slug: e.target.value })} />
      <p className="hint">The customer shares yently.com/barbers?s={(draft.slug || 'slug').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} with their own customers. New shops start with the demo services.</p>
      <input required placeholder="Username for the shop" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the shop" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">This login is what you sell — use a throwaway password you invent for this shop, never your own password. Only you can see it here.</p>
      <input placeholder="Employee password (optional — one shared password for Bookings)" value={draft.epass || ''} onChange={e => setDraft({ ...draft, epass: e.target.value })} />
      <p className="hint">Give this to the owner with the login above. Anyone can book, but Bookings needs this password. Leave it empty and Bookings stays fully open, as before.</p>
      <input placeholder="Note for yourself (optional — not shown to the shop)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

function PosStoreForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Store name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input required placeholder="Slug — the word in yently.com/pos?s=slug" value={draft.slug || ''} onChange={e => setDraft({ ...draft, slug: e.target.value })} />
      <p className="hint">The customer shares yently.com/pos?s={(draft.slug || 'slug').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} with their staff. New stores start empty — the owner adds items in Setup.</p>
      <input required placeholder="Username for the store" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the store" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">This login is what you sell — use a throwaway password you invent for this store, never your own password. Only you can see it here.</p>
      <input placeholder="Employee password (optional — one shared password for Sell + Receipts)" value={draft.epass || ''} onChange={e => setDraft({ ...draft, epass: e.target.value })} />
      <p className="hint">Give this to the owner with the login above. Anyone with the store link sees the price list, but the register and the receipts need this password. Leave it empty and the register stays fully open, as before.</p>
      <input placeholder="Note for yourself (optional — not shown to the store)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

function DealerShopForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Dealer name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input required placeholder="Slug — the word in yently.com/dealer?d=slug" value={draft.slug || ''} onChange={e => setDraft({ ...draft, slug: e.target.value })} />
      <p className="hint">The customer shares yently.com/dealer?d={(draft.slug || 'slug').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} with their own customers. New dealers start empty — the owner adds vehicles in Setup.</p>
      <input required placeholder="Username for the dealer" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the dealer" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">This login is what you sell — use a throwaway password you invent for this dealer, never your own password. Only you can see it here.</p>
      <input placeholder="Employee password (optional — one shared password for Bookings)" value={draft.epass || ''} onChange={e => setDraft({ ...draft, epass: e.target.value })} />
      <p className="hint">Give this to the owner with the login above. Anyone with the dealer link sees the vehicles, but Bookings needs this password. Leave it empty and Bookings stays fully open, as before.</p>
      <input placeholder="Note for yourself (optional — not shown to the dealer)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

function EmployeeShopForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Team name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input required placeholder="Slug — the word in yently.com/employee?e=slug" value={draft.slug || ''} onChange={e => setDraft({ ...draft, slug: e.target.value })} />
      <p className="hint">The customer shares yently.com/employee?e={(draft.slug || 'slug').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} with their staff. New teams start empty — the owner adds staff in Setup.</p>
      <input required placeholder="Username for the team" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the team" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">This login is what you sell — use a throwaway password you invent for this team, never your own password. Only you can see it here.</p>
      <input placeholder="Employee password (optional — one shared password for Log Time + Records)" value={draft.epass || ''} onChange={e => setDraft({ ...draft, epass: e.target.value })} />
      <p className="hint">Give this to the owner with the login above. Anyone with the team link sees the staff list, but logging time and the records need this password. Leave it empty and they stay fully open, as before.</p>
      <input placeholder="Note for yourself (optional — not shown to the team)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

function BodyshopShopForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Bodyshop name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input required placeholder="Slug — the word in yently.com/bodyshop?b=slug" value={draft.slug || ''} onChange={e => setDraft({ ...draft, slug: e.target.value })} />
      <p className="hint">The customer shares yently.com/bodyshop?b={(draft.slug || 'slug').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} with their own customers. New bodyshops start empty — the owner adds customers, estimates, jobs and loan cars in Setup.</p>
      <input required placeholder="Username for the bodyshop" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the bodyshop" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">This login is what you sell — use a throwaway password you invent for this bodyshop, never your own password. Only you can see it here.</p>
      <input placeholder="Employee password (optional — one shared password for Jobs, Estimates, Customers + Loan Cars)" value={draft.epass || ''} onChange={e => setDraft({ ...draft, epass: e.target.value })} />
      <p className="hint">Give this to the owner with the login above. Anyone with the bodyshop link can request an estimate, but the working tabs need this password. Leave it empty and they stay fully open, as before.</p>
      <input placeholder="Note for yourself (optional — not shown to the bodyshop)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

// One form for all nine Yently Kids school tables — the subject and
// folder come from the table (kids_math_shops → Math / kids-math),
// so the nine Passes pages share this instead of nine copies.
function KidsShopForm({ draft, setDraft, onSubmit, submitLabel, onCancel, subject, folder }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="School name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input required placeholder={`Slug — the word in yently.com/${folder}?s=slug`} value={draft.slug || ''} onChange={e => setDraft({ ...draft, slug: e.target.value })} />
      <p className="hint">The customer shares yently.com/{folder}?s={(draft.slug || 'slug').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} with their students. New schools start with the demo {subject} content.</p>
      <input required placeholder="Username for the school" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the school" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">This login is what you sell — use a throwaway password you invent for this school, never your own password. Only you can see it here.</p>
      <input placeholder="Teacher password (optional — one shared password for the Teacher area)" value={draft.epass || ''} onChange={e => setDraft({ ...draft, epass: e.target.value })} />
      <p className="hint">Give this to the owner with the login above. Anyone with the school link can play, but the Teacher area needs this password. Leave it empty and the Teacher area stays fully open, as before.</p>
      <input placeholder="Note for yourself (optional — not shown to the school)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

function IntakeFormForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Form name — given to the barber for login" value={draft.f || ''} onChange={e => setDraft({ ...draft, f: e.target.value })} />
      <p className="hint">The barber logs in at yently.com/barber-intake with this form name, a username, and a password.</p>
      <input required placeholder="Username for the barber" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the barber" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">Use a throwaway password you invent for this barber — never your own password. Only you can see it here.</p>
      <input placeholder="Note for yourself (optional — not shown to the barber)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

function UploadFormForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Form name — the word in yently.com/form-name" value={draft.f || ''} onChange={e => setDraft({ ...draft, f: e.target.value })} />
      <p className="hint">The customer logs in at yently.com/{(draft.f || 'form-name').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} with a username and a password.</p>
      <input required placeholder="Username for the customer" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the customer" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">This login is what you sell — use a throwaway password you invent for this customer, never your own password. Only you can see it here.</p>
      <input required placeholder="Upload folder name — where the pictures will go" value={draft.folder || ''} onChange={e => setDraft({ ...draft, folder: e.target.value })} />
      <p className="hint">Saving creates this folder for real in the picture storage, so the customer can upload into it right away. The customer sees Upload and View on their page.</p>
      <input placeholder="Note for yourself (optional — not shown to the customer)" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

export default function AdminStoreManage({ table: tableProp, onTableChange }) {

  const [tableInner, setTableInner] = useState('providers')

  // The AdminPage menus pick the table (deep links); on its own the
  // Manage section keeps its own table switcher as before.
  const table = tableProp ?? tableInner
  const setTable = onTableChange ?? setTableInner

  const [rows, setRows] = useState(null)

  const [providers, setProviders] = useState([])

  // Lists the Items form links against (new category table, locations).
  const [itemCategories, setItemCategories] = useState([])

  const [fromdel, setFromdel] = useState([])

  const [topick, setTopick] = useState([])
  const [subcats, setSubcats] = useState([])
  const [jobsList, setJobsList] = useState([])
  const [employeesList, setEmployeesList] = useState([])
  const [barberStores, setBarberStores] = useState([])
  const [websiteTypes, setWebsiteTypes] = useState([])
  const [websiteDomains, setWebsiteDomains] = useState([])
  const [barberStyles, setBarberStyles] = useState([])
  const [intakeFormsList, setIntakeFormsList] = useState([])
  const [detail, setDetail] = useState(null)
  const [pageWord, setPageWord] = useState('')
  const [dinerRestaurantsList, setDinerRestaurantsList] = useState([])
  const [barbershopShopsList, setBarbershopShopsList] = useState([])
  const [dealerShopsList, setDealerShopsList] = useState([])
  const [employeeShopsList, setEmployeeShopsList] = useState([])
  const [bodyshopShopsList, setBodyshopShopsList] = useState([])

  const [query, setQuery] = useState('')

  const [draft, setDraft] = useState(() => blankDraft('providers'))

  const [status, setStatus] = useState('')

  const [menuOpen, setMenuOpen] = useState(false)

  const menuRef = useRef(null)

  const tableName = TABLES.find(t => t[0] === table)[2]

  const tableLabel = TABLES.find(t => t[0] === table)[1]

  const reload = () => {
    setRows(null)
    let q = supabase.from(tableName).select('*').order('name')
    if (table === 'items') q = supabase.from(tableName).select('*, provider:store_providers(name)').order('pending_approval', { ascending: false }).order('name')
    if (table === 'forms') q = supabase.from(tableName).select('*').order('f')
    if (table === 'fromdel') q = supabase.from(tableName).select('*').order('fname')
    if (table === 'topick') q = supabase.from(tableName).select('*').order('tname')
    if (table === 'itemcats') q = supabase.from(tableName).select('*').order('label')
    if (table === 'subcats') q = supabase.from(tableName).select('*').order('id')
    if (table === 'jobs') q = supabase.from(tableName).select('*').order('id')
    if (table === 'employees') q = supabase.from(tableName).select('*').order('id')
    if (table === 'languages') q = supabase.from(tableName).select('*').order('id')
    if (table === 'passes') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_stores') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_locations') q = supabase.from(tableName).select('*').order('id')
    if (table === 'open_times') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_customers') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_styles') q = supabase.from(tableName).select('*').order('id')
    if (table === 'website_domains') q = supabase.from(tableName).select('*').order('id')
    if (table === 'website_types') q = supabase.from(tableName).select('*').order('id')
    if (table === 'website_headers') q = supabase.from(tableName).select('*').order('id')
    if (table === 'website_bodies') q = supabase.from(tableName).select('*').order('id')
    if (table === 'website_footers') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_reservations') q = supabase.from(tableName).select('*').order('id')
    if (table === 'barber_orders') q = supabase.from(tableName).select('*').order('id')
    if (table === 'restaurant_orders') q = supabase.from(tableName).select('*').order('id')
    if (table === 'intake_forms') q = supabase.from(tableName).select('*').order('f')
    if (table === 'intake_submissions') q = supabase.from(tableName).select('*').order('status', { ascending: false }).order('id')
    if (table === 'diner_approvals') q = supabase.from(tableName).select('*').eq('draft_status', 'pending').order('id')
    if (table === 'diner_orders') q = supabase.from(tableName).select('*').order('id', { ascending: false })
    if (table === 'barbershop_approvals') q = supabase.from(tableName).select('*').eq('draft_status', 'pending').order('id')
    if (table === 'barbershop_bookings') q = supabase.from(tableName).select('*').order('id', { ascending: false })
    if (table === 'barbershop_orders') q = supabase.from(tableName).select('*').order('id')
    if (table === 'tv_gallery_orders') q = supabase.from(tableName).select('*').order('id')
    if (table === 'live_chat_orders') q = supabase.from(tableName).select('*').order('id')
    if (table === 'pos_approvals') q = supabase.from(tableName).select('*').eq('draft_status', 'pending').order('id')
    if (table === 'pos_sales') q = supabase.from(tableName).select('*, store:pos_stores(name)').order('id', { ascending: false })
    if (table === 'pos_orders') q = supabase.from(tableName).select('*').order('id')
    if (table === 'dealer_approvals') q = supabase.from(tableName).select('*').eq('draft_status', 'pending').order('id')
    if (table === 'dealer_testdrives') q = supabase.from(tableName).select('*').order('id', { ascending: false })
    if (table === 'dealer_tradeins') q = supabase.from(tableName).select('*').order('id', { ascending: false })
    if (table === 'dealer_orders') q = supabase.from(tableName).select('*').order('id')
    if (table === 'employee_approvals') q = supabase.from(tableName).select('*').eq('draft_status', 'pending').order('id')
    if (table === 'employee_timelogs') q = supabase.from(tableName).select('*').order('id', { ascending: false })
    if (table === 'employee_orders') q = supabase.from(tableName).select('*').order('id')
    if (table === 'bodyshop_approvals') q = supabase.from(tableName).select('*').eq('draft_status', 'pending').order('id')
    if (table === 'bodyshop_jobs') q = supabase.from(tableName).select('*').order('id', { ascending: false })
    if (table === 'bodyshop_orders') q = supabase.from(tableName).select('*').order('id')
    if (KIDS_APPROVAL_TABLES.includes(table)) q = supabase.from(tableName).select('*').eq('draft_status', 'pending').order('id')
    if (KIDS_ORDER_TABLES.includes(table)) q = supabase.from(tableName).select('*').order('id')
    if (table === 'item_batches') q = supabase.from(tableName).select('*').eq('status', 'pending').order('id')
    if (table === 'upload_forms') q = supabase.from(tableName).select('*').order('f')
    q.then(({ data, error }) => {
      if (error) { setStatus('Error: ' + error.message); setRows([]) }
      else setRows(data || [])
    })
    loadProviders().then(setProviders).catch(() => {})
    loadItemCategories().then(setItemCategories).catch(() => {})
    loadFromDel().then(setFromdel).catch(() => {})
    loadToPick().then(setTopick).catch(() => {})
    loadSubCategories().then(setSubcats).catch(() => {})
                                               supabase.from('jobs').select('*').order('id').then(({ data}) => setJobsList(data || [])).catch(() => {})
                                                                                                                                              supabase.from('employees').select('*').order('id').then(({ data}) => setEmployeesList(data || [])).catch(() => {})
    supabase.from('barber_store').select('*').order('id').then(({ data }) => setBarberStores(data || [])).catch(() => {})
    supabase.from('website_type').select('*').order('id').then(({ data }) => setWebsiteTypes(data || [])).catch(() => {})
    supabase.from('website_domain').select('*').order('id').then(({ data }) => setWebsiteDomains(data || [])).catch(() => {})
    supabase.from('barber_style').select('*').order('id').then(({ data }) => setBarberStyles(data || [])).catch(() => {})
    supabase.from('barber_intake_forms').select('id,f').order('f').then(({ data }) => setIntakeFormsList(data || [])).catch(() => {})
    supabase.from('diner_restaurants').select('id,slug,name').order('name').then(({ data }) => setDinerRestaurantsList(data || [])).catch(() => {})
    supabase.from('barbershop_shops').select('id,slug,name').order('name').then(({ data }) => setBarbershopShopsList(data || [])).catch(() => {})
    supabase.from('dealer_shops').select('id,slug,name').order('name').then(({ data }) => setDealerShopsList(data || [])).catch(() => {})
    supabase.from('employee_shops').select('id,slug,name').order('name').then(({ data }) => setEmployeeShopsList(data || [])).catch(() => {})
    supabase.from('bodyshop_shops').select('id,slug,name').order('name').then(({ data }) => setBodyshopShopsList(data || [])).catch(() => {})
  }

  useEffect(reload, [table])

  // The AdminPage menus can change the table from outside (deep links),
  // not just through the table switcher below, so the form must reset
  // whenever the table changes — otherwise the previous table's fields
  // leak into the save. (That leak is what made Upload Forms fail with
  // "Could not find the 'about' column": the form still carried the
  // store table's `about` field.)
  useEffect(() => {
    setDraft(blankDraft(table))
    setDetail(null)
    setStatus('')
  }, [table])

  // Outside tap closes the table submenu (same pattern as the website menus).
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const pickTable = (key) => {
    setTable(key)
    setDraft(blankDraft(key))
    setDetail(null)
    setStatus('')
    setMenuOpen(false)
  }

  const filtered = useMemo(() => {
    if (!rows) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(needle))
  }, [rows, query])

  // One label per row, used by the Name cell and the delete confirm.
  const rowLabel = (r) => table === 'forms' ? r.f : table === 'fromdel' ? r.fname : table === 'topick' ? r.tname : table === 'itemcats' ? r.label : table === 'subcats' ? (r.flavor || r.color || ('Sub #' + r.id)) : table === 'jobs' ? r.jobTitle : table === 'employees' ? `${r.firstName} ${r.lastName || ''}`.trim() : table === 'languages' ? r.language : table === 'passes' ? r.formName : table === 'barber_stores' ? r.store_name : table === 'barber_locations' ? r.address : table === 'open_times' ? ('Hours for store ' + r.store_id) : table === 'barber_customers' ? `${r.fname} ${r.lname || ''}`.trim() : table === 'website_domains' ? r.slug : table === 'website_headers' ? r.header_name : table === 'website_footers' ? r.footer_name : table === 'barber_reservations' ? r.customer_name : table === 'barber_orders' ? r.customer_name : table === 'restaurant_orders' ? r.customer_name : table === 'intake_forms' ? r.f : table === 'intake_submissions' ? ((r.payload && r.payload.shop_name) || ('Submission #' + r.id)) : table === 'diner_restaurants' ? r.name : table === 'diner_approvals' ? r.name : table === 'diner_orders' ? ('Order #' + r.id) : table === 'barbershop_shops' ? r.name : table === 'barbershop_approvals' ? r.name : table === 'barbershop_bookings' ? ('Booking #' + r.id) : table === 'barbershop_orders' ? r.customer_name : table === 'item_batches' ? ('Batch #' + r.id) : table === 'upload_forms' ? r.f : table === 'pos_stores' ? r.name : table === 'pos_approvals' ? r.name : table === 'pos_sales' ? ('Sale #' + r.id) : table === 'pos_orders' ? r.customer_name : table === 'dealer_shops' ? r.name : table === 'dealer_approvals' ? r.name : table === 'dealer_testdrives' ? ('Test drive #' + r.id) : table === 'dealer_tradeins' ? ('Trade-in #' + r.id) : table === 'dealer_orders' ? r.customer_name : table === 'employee_shops' ? r.name : table === 'employee_approvals' ? r.name : table === 'employee_timelogs' ? ('Time #' + r.id) : table === 'employee_orders' ? r.customer_name : table === 'bodyshop_shops' ? r.name : table === 'bodyshop_approvals' ? r.name : table === 'bodyshop_jobs' ? (r.number || ('Job #' + r.id)) : table === 'bodyshop_orders' ? r.customer_name : table === 'tv_gallery_orders' ? r.customer_name : kidsSubjectOf(table) ? (table.endsWith('_orders') ? r.customer_name : r.name) : r.name

  const remove = async (row) => {
    const label = rowLabel(row)
    // Deleting an upload form also deletes its folder and every picture
    // in it, so nothing is left behind in storage. The form itself is
    // only deleted once the folder is gone — if the folder cannot be
    // deleted, the form stays so the delete can be tried again.
    if (table === 'upload_forms' && row.folder) {
      if (!window.confirm(`Delete "${label}"? Its folder "${row.folder}" and all the pictures in it will be deleted too. This cannot be undone.`)) return
      let offset = 0
      for (;;) {
        const { data: files, error: listErr } = await supabase.storage.from('product-images').list('store/' + row.folder, { limit: 1000, offset })
        if (listErr) { setStatus(`Cannot delete: the folder "${row.folder}" could not be read (${listErr.message}) — the form was NOT deleted. Try again.`); return }
        const paths = (files || []).map(f => 'store/' + row.folder + '/' + f.name)
        if (paths.length > 0) {
          const { error: rmErr } = await supabase.storage.from('product-images').remove(paths)
          if (rmErr) { setStatus(`Cannot delete: the folder "${row.folder}" could not be deleted (${rmErr.message}) — the form was NOT deleted. Try again.`); return }
        }
        if ((files || []).length < 1000) break
        offset += 1000
      }
      // A storage delete can report no error and still leave files
      // behind, so check the folder is really empty before the form
      // itself is deleted — otherwise the pictures would be orphaned
      // with no form pointing at them.
      const { data: left, error: checkErr } = await supabase.storage.from('product-images').list('store/' + row.folder, { limit: 1 })
      if (checkErr) { setStatus(`Cannot delete: the folder "${row.folder}" could not be checked (${checkErr.message}) — the form was NOT deleted. Try again.`); return }
      if (left && left.length > 0) { setStatus(`Cannot delete: the pictures in "${row.folder}" could not be deleted — the form was NOT deleted. Try again.`); return }
    } else if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return
    const { error } = await supabase.from(tableName).delete().eq('id', row.id)
    if (error) { setStatus('Cannot delete: ' + error.message + (table === 'providers' ? ' — delete or move its items first.' : '')); return }
    setStatus(`✓ Deleted "${label}".`)
    reload()
  }

  // Approval step: a pending provider item goes live with one tap.
  const approve = async (row) => {
    const { error } = await supabase.from('store_items').update({ is_active: true, pending_approval: false }).eq('id', row.id)
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved "${row.name}" — now live.`)
    reload()
  }

  // Intake approval: one tap builds the whole shop (store, location,
  // hours, styles, website domain/header/body/footer) in a single
  // database transaction. A taken page word fails here with a plain
  // message — fix it in Details first, then approve again.
  const approveSubmission = async (row) => {
    const { data, error } = await supabase.rpc('approve_barber_intake', { p_submission_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — shop live at yently.com/${data?.slug || ''}.`)
    setDetail(null)
    reload()
  }

  const savePageWord = async () => {
    if (!detail) return
    const slug = pageWord.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!slug) { setStatus('Error: the page word has to contain a letter or number.'); return }
    if (slug === 'admin') { setStatus('Error: "admin" is reserved — pick another page word.'); return }
    const { error } = await supabase.from('barber_intake_submissions').update({ payload: { ...detail.payload, page_word: slug } }).eq('id', detail.id)
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Page word saved as "${slug}".`)
    setDetail({ ...detail, payload: { ...detail.payload, page_word: slug } })
    reload()
  }

  // Diner approval: one tap makes the pending draft live.
  const approveDiner = async (row) => {
    const { data, error } = await supabase.rpc('approve_diner_draft', { p_restaurant_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — "${data?.name || row.name}" menu is now live.`)
    setDetail(null)
    reload()
  }

  // Barbershop approval: one tap makes the pending draft live.
  const approveBarbershop = async (row) => {
    const { data, error } = await supabase.rpc('approve_barbershop_draft', { p_shop_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — "${data?.name || row.name}" services are now live.`)
    setDetail(null)
    reload()
  }

  // POS approval: one tap makes the pending draft live.
  const approvePos = async (row) => {
    const { data, error } = await supabase.rpc('approve_pos_draft', { p_store_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — "${data?.name || row.name}" store details are now live.`)
    setDetail(null)
    reload()
  }

  // Dealer approval: one tap makes the pending draft live.
  const approveDealer = async (row) => {
    const { error } = await supabase.rpc('approve_dealer_draft', { p_shop_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — "${row.name}" dealer details are now live.`)
    setDetail(null)
    reload()
  }

  // Employee approval: one tap makes the pending draft live.
  const approveEmployee = async (row) => {
    const { error } = await supabase.rpc('approve_employee_draft', { p_shop_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — "${row.name}" team details are now live.`)
    setDetail(null)
    reload()
  }

  // Bodyshop approval: one tap makes the pending draft live.
  const approveBodyshop = async (row) => {
    const { error } = await supabase.rpc('approve_bodyshop_draft', { p_shop_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — "${row.name}" bodyshop details are now live.`)
    setDetail(null)
    reload()
  }

  // Kids approval: one tap makes the pending draft live. The RPC name
  // comes from the table (kids_math_approvals → approve_kids_math_draft),
  // so one function covers all nine subjects.
  const approveKids = async (row) => {
    const subject = kidsSubjectOf(table)
    const { data, error } = await supabase.rpc('approve_kids_' + subject + '_draft', { p_shop_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — "${data?.name || row.name}" Kids ${KIDS_SUBJECTS[subject].label} content is now live.`)
    setDetail(null)
    reload()
  }

  // Items approval: one tap adds every item in the batch to the shop
  // at once (all active, none left pending), then marks the batch done.
  const approveItemBatch = async (row) => {
    const { data, error } = await supabase.rpc('approve_store_item_batch', { p_batch_id: row.id })
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved — ${data?.inserted ?? '?'} item(s) added to the shop.`)
    setDetail(null)
    reload()
  }

  // Items Edit loads the item's current links, so the tick boxes in
  // the form show what is already linked. Other tables edit as before.
  const editItem = async (r) => {
    const [cats, fds, tps, subs] = await Promise.all([
      supabase.from('store_item_categories').select('category_id').eq('item_id', r.id),
      supabase.from('store_item_fromdel').select('fromdel_id').eq('item_id', r.id),
      supabase.from('store_item_topick').select('topick_id').eq('item_id', r.id),
      supabase.from('store_item_subcategories').select('subcategory_id').eq('item_id', r.id),
    ])
    setDraft({
      ...r,
      _catIds: (cats.data || []).map(x => x.category_id),
      _fromIds: (fds.data || []).map(x => x.fromdel_id),
      _toIds: (tps.data || []).map(x => x.topick_id),
      _subIds: (subs.data || []).map(x => x.subcategory_id),
    })
  }

  const editPass = async (r) => {
    const { data } = await supabase.from('fAllowed').select('chat').eq('pass_id', r.id).single()
    setDraft({ ...r, chat: data ? data.chat : true })
  }

  const onToggle = (kind, id) => {
    const key = kind === 'cat' ? '_catIds' : kind === 'from' ? '_fromIds' : kind === 'sub' ? '_subIds' : '_toIds'
    const cur = draft[key] || []
  const next = { ...draft, [key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] }
    if (kind === 'cat' && draft._catIds?.includes(id)) {
      const subIds = subcats.filter(s => s.category_id === id).map(s => s.id)
      next._subIds = (next._subIds || []).filter(x => !subIds.includes(x))
    }
    setDraft(next)
  }

  const save = async (e) => {
    e.preventDefault()
    const { id, created_at, provider, _catIds, _fromIds, _toIds, _subIds, ...fields } = draft
    if (fields.price !== undefined) fields.price = Number(fields.price)
    if (fields.stock !== undefined) fields.stock = fields.stock === '' || fields.stock === null ? null : Number(fields.stock)
    if (fields.provider_id !== undefined) fields.provider_id = Number(fields.provider_id)
    if (fields.packof !== undefined) fields.packof = fields.packof === '' || fields.packof === null ? null : Number(fields.packof)
    if (fields.weight !== undefined) fields.weight = fields.weight === '' || fields.weight === null ? null : Number(fields.weight)
    if (table === 'itemcats' && !id) fields.slug = slugify(fields.label)
    // Only providers/items/forms carry updated_at; the new location /
    // category tables have created_at only, so stamping them would fail.
    if ((table === 'providers' || table === 'items' || table === 'forms') && id) fields.updated_at = new Date().toISOString()
    if (table === 'providers') {
      fields.holdorder = !!fields.holdorder
      fields.payorder = fields.payorder !== false
    }
    if (table === 'forms') {
      fields.f = slugify(fields.f || '')
      if (!fields.f) { setStatus('Error: the form name has to contain a letter or number.'); return }
      if (fields.f === 'admin') { setStatus('Error: "admin" is reserved — pick another form name.'); return }
      const { data: passRowsF } = await supabase.from('fPasses').select('id').eq('formName', fields.f)
      if (passRowsF && passRowsF.length > 0) { setStatus('That form name is already used by an employee pass — pick another.'); return }
      const { data: domainRowsF } = await supabase.from('website_domain').select('id').eq('slug', fields.f)
      if (domainRowsF && domainRowsF.length > 0) { setStatus('That form name is already used by a barber website — pick another.'); return }
      const { data: uploadRowsF } = await supabase.from('upload_forms').select('id').eq('f', fields.f)
      if (uploadRowsF && uploadRowsF.length > 0) { setStatus('That form name is already used by a picture upload form — pick another.'); return }
    }
    if (table === 'employees') {
      if (fields.job_id !== undefined) fields.job_id = fields.job_id === '' ? null : Number(fields.job_id)
    }
    if (table === 'languages') {
      if (fields.employee_id !== undefined) fields.employee_id = Number(fields.employee_id)
    }
    // Barber tables: foreign keys arrive from <select> as strings.
    if (fields.store_id !== undefined) fields.store_id = Number(fields.store_id)
    if (fields.domain_id !== undefined) fields.domain_id = fields.domain_id === '' ? null : Number(fields.domain_id)
    if (fields.type_id !== undefined) fields.type_id = fields.type_id === '' ? null : Number(fields.type_id)
    if (fields.style_id !== undefined) fields.style_id = fields.style_id === '' ? null : Number(fields.style_id)
    if (table === 'barber_stores') fields.text_message = !!fields.text_message
    if (table === 'open_times') fields.hours_may_differ = !!fields.hours_may_differ
    if (table === 'barber_styles' && fields.time_to_finish !== undefined) fields.time_to_finish = fields.time_to_finish === '' || fields.time_to_finish === null ? null : Number(fields.time_to_finish)
    // Barber website slugs are public addresses (yently.com/<slug>),
    // so they follow the same collision rules as provider forms and
    // employee passes. The checks only look at the OTHER tables, so
    // editing a domain without changing its slug never trips them;
    // a slug that duplicates another DOMAIN row is refused by the
    // database's UNIQUE constraint and surfaces as a plain error.
    if (table === 'website_domains') {
      fields.slug = slugify(fields.slug || '')
      if (!fields.slug) { setStatus('Error: the slug has to contain a letter or number.'); return }
      if (fields.slug === 'admin') { setStatus('Error: "admin" is reserved — pick another slug.'); return }
      const { data: formRows } = await supabase.from('providersForm').select('id').eq('f', fields.slug)
      if (formRows && formRows.length > 0) { setStatus('That slug is already used by a provider form — pick another.'); return }
      const { data: passRows } = await supabase.from('fPasses').select('id').eq('formName', fields.slug)
      if (passRows && passRows.length > 0) { setStatus('That slug is already used by an employee pass — pick another.'); return }
      const { data: uploadRowsD } = await supabase.from('upload_forms').select('id').eq('f', fields.slug)
      if (uploadRowsD && uploadRowsD.length > 0) { setStatus('That slug is already used by a picture upload form — pick another.'); return }
    }
    if (table === 'diner_restaurants') {
      fields.slug = slugify(fields.slug || '')
      if (!fields.slug) { setStatus('Error: the slug has to contain a letter or number.'); return }
      if (fields.slug === 'admin') { setStatus('Error: "admin" is reserved — pick another slug.'); return }
      if (!fields.name || !fields.u || !fields.p) { setStatus('Error: name, username and password are all required.'); return }
    }
    if (table === 'barbershop_shops') {
      fields.slug = slugify(fields.slug || '')
      if (!fields.slug) { setStatus('Error: the slug has to contain a letter or number.'); return }
      if (fields.slug === 'admin') { setStatus('Error: "admin" is reserved — pick another slug.'); return }
      if (!fields.name || !fields.u || !fields.p) { setStatus('Error: name, username and password are all required.'); return }
    }
    if (table === 'pos_stores') {
      fields.slug = slugify(fields.slug || '')
      if (!fields.slug) { setStatus('Error: the slug has to contain a letter or number.'); return }
      if (fields.slug === 'admin') { setStatus('Error: "admin" is reserved — pick another slug.'); return }
      if (!fields.name || !fields.u || !fields.p) { setStatus('Error: name, username and password are all required.'); return }
      // A new store starts with its own details live (not the demo
      // store's) — the draft flow only changes them afterwards.
      if (!id) fields.live_data = { name: fields.name, taxRate: 0.08, address: '', phone: '', receiptMessage: 'Thank you for shopping with us!' }
    }
    if (table === 'dealer_shops') {
      fields.slug = slugify(fields.slug || '')
      if (!fields.slug) { setStatus('Error: the slug has to contain a letter or number.'); return }
      if (fields.slug === 'admin') { setStatus('Error: "admin" is reserved — pick another slug.'); return }
      if (!fields.name || !fields.u || !fields.p) { setStatus('Error: name, username and password are all required.'); return }
      // A new dealer starts with its own details live (not the demo
      // dealer's) — the draft flow only changes them afterwards.
      if (!id) fields.live_data = { name: fields.name, address: '', phone: '', hours: '', about: '' }
    }
    if (table === 'employee_shops') {
      fields.slug = slugify(fields.slug || '')
      if (!fields.slug) { setStatus('Error: the slug has to contain a letter or number.'); return }
      if (fields.slug === 'admin') { setStatus('Error: "admin" is reserved — pick another slug.'); return }
      if (!fields.name || !fields.u || !fields.p) { setStatus('Error: name, username and password are all required.'); return }
      // A new team starts with its own details live (not the demo
      // team's) — the draft flow only changes them afterwards.
      if (!id) fields.live_data = { name: fields.name, address: '', phone: '', hours: '', about: '', jobs: [] }
    }
    if (table === 'bodyshop_shops') {
      fields.slug = slugify(fields.slug || '')
      if (!fields.slug) { setStatus('Error: the slug has to contain a letter or number.'); return }
      if (fields.slug === 'admin') { setStatus('Error: "admin" is reserved — pick another slug.'); return }
      if (!fields.name || !fields.u || !fields.p) { setStatus('Error: name, username and password are all required.'); return }
      // A new bodyshop starts with its own details live (not the demo
      // bodyshop's) — the draft flow only changes them afterwards.
      if (!id) fields.live_data = { name: fields.name, address: '', phone: '', hours: '', about: '' }
    }
    if (table === 'intake_forms') {
      fields.f = slugify(fields.f || '')
      if (!fields.f) { setStatus('Error: the form name has to contain a letter or number.'); return }
      if (fields.f === 'admin') { setStatus('Error: "admin" is reserved — pick another form name.'); return }
      if (!fields.u || !fields.p) { setStatus('Error: username and password are both required.'); return }
      const { data: formRowsI } = await supabase.from('providersForm').select('id').eq('f', fields.f)
      if (formRowsI && formRowsI.length > 0) { setStatus('That form name is already used by a provider form — pick another.'); return }
      const { data: passRowsI } = await supabase.from('fPasses').select('id').eq('formName', fields.f)
      if (passRowsI && passRowsI.length > 0) { setStatus('That form name is already used by an employee pass — pick another.'); return }
      const { data: domainRowsI } = await supabase.from('website_domain').select('id').eq('slug', fields.f)
      if (domainRowsI && domainRowsI.length > 0) { setStatus('That form name is already used by a barber website — pick another.'); return }
      const { data: uploadRowsI } = await supabase.from('upload_forms').select('id').eq('f', fields.f)
      if (uploadRowsI && uploadRowsI.length > 0) { setStatus('That form name is already used by a picture upload form — pick another.'); return }
    }
    if (table === 'upload_forms') {
      fields.f = slugify(fields.f || '')
      if (!fields.f) { setStatus('Error: the form name has to contain a letter or number.'); return }
      if (fields.f === 'admin') { setStatus('Error: "admin" is reserved — pick another form name.'); return }
      if (!fields.u || !fields.p) { setStatus('Error: username and password are both required.'); return }
      fields.folder = slugify(fields.folder || '')
      if (!fields.folder) { setStatus('Error: the upload folder name has to contain a letter or number.'); return }
      const { data: formRowsU } = await supabase.from('providersForm').select('id').eq('f', fields.f)
      if (formRowsU && formRowsU.length > 0) { setStatus('That form name is already used by a provider form — pick another.'); return }
      const { data: passRowsU } = await supabase.from('fPasses').select('id').eq('formName', fields.f)
      if (passRowsU && passRowsU.length > 0) { setStatus('That form name is already used by an employee pass — pick another.'); return }
      const { data: domainRowsU } = await supabase.from('website_domain').select('id').eq('slug', fields.f)
      if (domainRowsU && domainRowsU.length > 0) { setStatus('That form name is already used by a barber website — pick another.'); return }
      const { data: intakeRowsU } = await supabase.from('barber_intake_forms').select('id').eq('f', fields.f)
      if (intakeRowsU && intakeRowsU.length > 0) { setStatus('That form name is already used by a barber intake form — pick another.'); return }
    }
    if (table === 'passes') {
      fields.formName = slugify(fields.formName || '')
      if (!fields.formName) { setStatus('Error: the form name has to contain a letter or number.'); return }
      if (fields.formName === 'admin') { setStatus('Error: "admin" is reserved — pick another form name.'); return }
      const { data: formRows } = await supabase.from('providersForm').select('id').eq('f', fields.formName)
      if (formRows && formRows.length > 0) { setStatus('That form name is already used by a provider form — pick another.'); return }
      const { data: domainRowsP } = await supabase.from('website_domain').select('id').eq('slug', fields.formName)
      if (domainRowsP && domainRowsP.length > 0) { setStatus('That form name is already used by a barber website — pick another.'); return }
      const { data: uploadRowsP } = await supabase.from('upload_forms').select('id').eq('f', fields.formName)
      if (uploadRowsP && uploadRowsP.length > 0) { setStatus('That form name is already used by a picture upload form — pick another.'); return }
      const { chat, ...passFields } = fields
      const q = id
      ? supabase.from(tableName).update(passFields).eq('id', id)
        : supabase.from(tableName).insert(passFields).select('id').single()
      const { data, error } = await q
      if (error) { setStatus('Error: ' + error.message); return }
      const savedPassId = id || data?.id
      const { error: allowErr } = await supabase.from('fAllowed').upsert({ pass_id: savedPassId, chat: chat !== false }, { onConflict: 'pass_id' })
      if (allowErr) { setStatus(`✓ Saved "${rowLabel(draft)}" but chat setting failed: ${allowErr.message}`); setDraft(blankDraft(table)); reload(); return }
      setStatus(`✓ Saved "${rowLabel(draft)}".`)
      setDraft(blankDraft(table))
      reload()
      return
    }
    if (table === 'items') {
      const q = id
        ? supabase.from(tableName).update(fields).eq('id', id)
        : supabase.from(tableName).insert(fields).select('id').single()
      const { data, error } = await q
      if (error) { setStatus('Error: ' + error.message); return }
      const savedId = id || data?.id
      try {
        await syncItemLinks(savedId, { categoryIds: draft._catIds || [], fromdelIds: draft._fromIds || [], topickIds: draft._toIds || [], subcategoryIds: draft._subIds || [] })
      } catch (linkErr) {
        setStatus(`✓ Saved "${rowLabel(draft)}" but links failed: ${linkErr.message}`)
        setDraft(blankDraft(table))
        reload()
        return
      }
    } else {
      const q = id
        ? supabase.from(tableName).update(fields).eq('id', id)
        : supabase.from(tableName).insert(fields)
      const { error } = await q
      if (error) { setStatus('Error: ' + error.message); return }
    }
    // Saving an upload form creates its folder for real in the picture
    // storage (an empty marker file), so the customer can upload into
    // it right away. Best effort: a storage failure leaves the form
    // saved and says so, instead of losing the form.
    let folderNote = ''
    if (table === 'upload_forms') {
      const folder = fields.folder || draft.folder
      if (folder) {
        const { error: folderErr } = await supabase.storage.from('product-images').upload('store/' + folder + '/.keep', new Blob([''], { type: 'text/plain' }), { upsert: true })
        if (folderErr) folderNote = ` The folder "${folder}" could not be created (${folderErr.message}) — the form is saved; save it again to retry.`
      }
    }
    setStatus(`✓ Saved "${rowLabel(draft)}".${folderNote}`)
    setDraft(blankDraft(table))
    reload()
  }

  const kindLabel = table === 'providers' ? 'provider' : table === 'items' ? 'item' : table === 'forms' ? 'provider form' : table === 'fromdel' ? 'delivery location' : table === 'topick' ? 'pickup location' : table === 'itemcats' ? 'item category' : table === 'subcats' ? 'sub category' : table === 'jobs' ? 'job' : table === 'employees' ? 'employee' : table === 'languages' ? 'language' : table === 'passes' ? 'employee pass' : table === 'barber_stores' ? 'barber store' : table === 'barber_locations' ? 'barber location' : table === 'open_times' ? 'open hours' : table === 'barber_customers' ? 'barber customer' : table === 'barber_styles' ? 'barber style' : table === 'website_domains' ? 'barber website' : table === 'website_types' ? 'website type' : table === 'website_headers' ? 'website header' : table === 'website_bodies' ? 'website body' : table === 'website_footers' ? 'website footer' : table === 'barber_reservations' ? 'barber reservation' : table === 'barber_orders' ? 'barber order' : table === 'restaurant_orders' ? 'restaurant order' : table === 'intake_forms' ? 'intake form' : table === 'intake_submissions' ? 'intake submission' : table === 'diner_restaurants' ? 'diner restaurant' : table === 'diner_approvals' ? 'diner approval' : table === 'diner_orders' ? 'diner order' : table === 'barbershop_shops' ? 'barbershop shop' : table === 'barbershop_approvals' ? 'barbershop approval' : table === 'barbershop_bookings' ? 'barbershop booking' : table === 'barbershop_orders' ? 'barbershop order' : table === 'item_batches' ? 'items approval' : table === 'upload_forms' ? 'upload form' : table === 'pos_stores' ? 'POS store' : table === 'pos_approvals' ? 'POS approval' : table === 'pos_sales' ? 'POS sale' : table === 'pos_orders' ? 'POS order' : table === 'dealer_shops' ? 'dealer shop' : table === 'dealer_approvals' ? 'dealer approval' : table === 'dealer_testdrives' ? 'dealer test drive' : table === 'dealer_tradeins' ? 'dealer trade-in' : table === 'dealer_orders' ? 'dealer order' : table === 'employee_shops' ? 'employee team' : table === 'employee_approvals' ? 'employee approval' : table === 'employee_timelogs' ? 'employee time record' : table === 'employee_orders' ? 'employee order' : table === 'bodyshop_shops' ? 'bodyshop' : table === 'bodyshop_approvals' ? 'bodyshop approval' : table === 'bodyshop_jobs' ? 'bodyshop job' : table === 'bodyshop_orders' ? 'bodyshop order' : table === 'tv_gallery_orders' ? 'TV Gallery order' : kidsSubjectOf(table) ? ('Kids ' + KIDS_SUBJECTS[kidsSubjectOf(table)].label + (table.endsWith('_approvals') ? ' approval' : table.endsWith('_orders') ? ' order' : ' school')) : 'row'

  const formTitle = table === 'intake_submissions'
    ? (detail ? `Intake submission — ${rowLabel(detail)}` : 'Intake submissions')
    : table === 'diner_approvals'
    ? (detail ? `Diner approval — ${rowLabel(detail)}` : 'Diner approvals')
    : table === 'barbershop_approvals'
    ? (detail ? `Barbershop approval — ${rowLabel(detail)}` : 'Barbershop approvals')
    : table === 'pos_approvals'
    ? (detail ? `POS approval — ${rowLabel(detail)}` : 'POS approvals')
    : table === 'dealer_approvals'
    ? (detail ? `Dealer approval — ${rowLabel(detail)}` : 'Dealer approvals')
    : table === 'employee_approvals'
    ? (detail ? `Employee approval — ${rowLabel(detail)}` : 'Employee approvals')
    : table === 'bodyshop_approvals'
    ? (detail ? `Bodyshop approval — ${rowLabel(detail)}` : 'Bodyshop approvals')
    : table === 'item_batches'
    ? (detail ? `Items approval — ${rowLabel(detail)}` : 'Items approvals')
    : KIDS_APPROVAL_TABLES.includes(table)
    ? (detail ? `Kids ${KIDS_SUBJECTS[kidsSubjectOf(table)].label} approval — ${rowLabel(detail)}` : `Kids ${KIDS_SUBJECTS[kidsSubjectOf(table)].label} approvals`)
    : draft.id ? `Edit ${kindLabel} — ${rowLabel(draft)}` : `New ${kindLabel}`

  const submitLabel = draft.id ? 'Save changes' : `Save ${kindLabel}`

  return (
    <div>
      <div className="hero-card">
        <h2>✏️ Edit or delete store tables</h2>
        <div className="car-submenu-wrap" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen(o => !o)} aria-haspopup="true" aria-expanded={menuOpen}>{tableLabel} ▾</button>
          {menuOpen && (
            <div className="car-submenu">
              {TABLES.map(([key, label]) => (
                <button key={key} type="button" onClick={() => pickTable(key)}>{label}</button>
              ))}
            </div>
          )}
        </div>
        <div className="filters">
          <input placeholder="Search this table..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {status && <p className="hint">{status}</p>}
      </div>

      <h3>{formTitle}</h3>
      {table === 'providers' && (
        <ProviderForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'items' && (
        <ItemForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} providers={providers}
          linkData={{ itemCategories, fromdel, topick, subcats, selected: { categoryIds: draft._catIds || [], fromdelIds: draft._fromIds || [], topickIds: draft._toIds || [], subcategoryIds: draft._subIds || [] }, onToggle }} />
      )}
      {table === 'forms' && (
        <ProviderFormEditor draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} providers={providers}
          takenProviderIds={(rows || []).filter(r => r.id !== draft.id).map(r => r.provider_id)} />
      )}
      {table === 'fromdel' && (
        <FromDelForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'topick' && (
        <ToPickForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'itemcats' && (
        <ItemCategoryForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'subcats' && (
        <SubCategoryForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} itemCategories={itemCategories} />
      )}
      {table === 'jobs' && (
      <JobForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'employees' && (
      <EmployeeForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} jobs={jobsList} />
      )}
      {table === 'languages' && (
      <LanguageForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} employees={employeesList} />
      )}
      {table === 'passes' && (
      <EmployeePassForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} employees={employeesList} />
      )}
      {table === 'barber_stores' && (
      <BarberStoreForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'barber_locations' && (
      <BarberLocationForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} />
      )}
      {table === 'open_times' && (
      <OpenTimeForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} />
      )}
      {table === 'barber_customers' && (
      <BarberCustomerForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} />
      )}
      {table === 'barber_styles' && (
      <BarberStyleForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} />
      )}
      {table === 'website_domains' && (
      <WebsiteDomainForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} types={websiteTypes} />
      )}
      {table === 'website_types' && (
      <WebsiteTypeForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'website_headers' && (
      <WebsiteHeaderForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} domains={websiteDomains} />
      )}
      {table === 'website_bodies' && (
      <WebsiteBodyForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} domains={websiteDomains} />
      )}
      {table === 'website_footers' && (
      <WebsiteFooterForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} domains={websiteDomains} />
      )}
      {table === 'barber_reservations' && (
      <BarberReservationForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
        onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} stores={barberStores} domains={websiteDomains} styles={barberStyles} />
      )}
      {table === 'barber_orders' && (
        <p className="hint">Orders are placed by customers on the site — view and delete only, no editing.</p>
      )}
      {table === 'restaurant_orders' && (
        <p className="hint">Orders are placed by customers on the site — view and delete only, no editing.</p>
      )}
      {table === 'intake_forms' && (
        <IntakeFormForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'diner_restaurants' && (
        <DinerRestaurantForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'diner_approvals' && !detail && (
        <p className="hint">Drafts restaurants uploaded for approval — open Details to review the menu, then Approve to make it live. Deleting a restaurant is done in Diner Passes, not here.</p>
      )}
      {table === 'diner_approvals' && detail && (
        <div className="form-card">
          <h3>{detail.name}</h3>
          <p>Link: yently.com/diner?r={detail.slug} · Status: {detail.draft_status}</p>
          <p>Draft menu (what the restaurant uploaded):</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{detail.draft_data ? JSON.stringify(detail.draft_data, null, 2) : 'No draft yet.'}</pre>
          <div className="store-actions">
            {detail.draft_status === 'pending' && <button type="button" className="btn-primary" onClick={() => approveDiner(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
      {table === 'diner_orders' && (
        <p className="hint">Orders placed by visitors — view and delete only, no editing. The kitchen handles them live on the restaurant page.</p>
      )}
      {table === 'barbershop_shops' && (
        <BarbershopShopForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'barbershop_approvals' && !detail && (
        <p className="hint">Drafts shops uploaded for approval — open Details to review the services, then Approve to make them live. Deleting a shop is done in Barber Passes, not here.</p>
      )}
      {table === 'barbershop_approvals' && detail && (
        <div className="form-card">
          <h3>{detail.name}</h3>
          <p>Link: yently.com/barbers?s={detail.slug} · Status: {detail.draft_status}</p>
          <p>Draft services (what the shop uploaded):</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{detail.draft_data ? JSON.stringify(detail.draft_data, null, 2) : 'No draft yet.'}</pre>
          <div className="store-actions">
            {detail.draft_status === 'pending' && <button type="button" className="btn-primary" onClick={() => approveBarbershop(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
      {table === 'barbershop_bookings' && (
        <p className="hint">Bookings placed by visitors — view and delete only, no editing. The barber handles them live on the shop page.</p>
      )}
      {table === 'pos_stores' && (
        <PosStoreForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'pos_approvals' && !detail && (
        <p className="hint">Drafts stores uploaded for approval — open Details to review the store details, then Approve to make them live. Deleting a store is done in POS Passes, not here.</p>
      )}
      {table === 'pos_approvals' && detail && (
        <div className="form-card">
          <h3>{detail.name}</h3>
          <p>Link: yently.com/pos?s={detail.slug} · Status: {detail.draft_status}</p>
          <p>Draft details (what the store uploaded):</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{detail.draft_data ? JSON.stringify(detail.draft_data, null, 2) : 'No draft yet.'}</pre>
          <div className="store-actions">
            {detail.draft_status === 'pending' && <button type="button" className="btn-primary" onClick={() => approvePos(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
      {table === 'pos_sales' && (
        <p className="hint">Sales rung up on the store pages — view and delete only, no editing. The cashier handles them live on the store page.</p>
      )}
      {table === 'pos_orders' && (
        <p className="hint">Orders are placed by customers on the site — view and delete only, no editing.</p>
      )}
      {table === 'barbershop_orders' && (
        <p className="hint">Orders are placed by customers on the site — view and delete only, no editing.</p>
      )}
      {table === 'tv_gallery_orders' && (
        <p className="hint">Orders are placed by customers on the site — view and delete only, no editing.</p>
      )}
      {table === 'dealer_shops' && (
        <DealerShopForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'dealer_approvals' && !detail && (
        <p className="hint">Drafts dealers uploaded for approval — open Details to review the dealer details, then Approve to make them live. Deleting a dealer is done in Dealer Passes, not here.</p>
      )}
      {table === 'dealer_approvals' && detail && (
        <div className="form-card">
          <h3>{detail.name}</h3>
          <p>Link: yently.com/dealer?d={detail.slug} · Status: {detail.draft_status}</p>
          <p>Draft details (what the dealer uploaded):</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{detail.draft_data ? JSON.stringify(detail.draft_data, null, 2) : 'No draft yet.'}</pre>
          <div className="store-actions">
            {detail.draft_status === 'pending' && <button type="button" className="btn-primary" onClick={() => approveDealer(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
      {table === 'dealer_testdrives' && (
        <p className="hint">Test drives booked by visitors — view and delete only, no editing. The dealer handles them live on the dealer page.</p>
      )}
      {table === 'dealer_tradeins' && (
        <p className="hint">Trade-ins offered by visitors — view and delete only, no editing. The dealer handles them live on the dealer page.</p>
      )}
      {table === 'dealer_orders' && (
        <p className="hint">Orders are placed by customers on the site — view and delete only, no editing.</p>
      )}
      {table === 'employee_shops' && (
        <EmployeeShopForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'employee_approvals' && !detail && (
        <p className="hint">Drafts teams uploaded for approval — open Details to review the team details, then Approve to make them live. Deleting a team is done in Employee Passes, not here.</p>
      )}
      {table === 'employee_approvals' && detail && (
        <div className="form-card">
          <h3>{detail.name}</h3>
          <p>Link: yently.com/employee?e={detail.slug} · Status: {detail.draft_status}</p>
          <p>Draft details (what the team uploaded):</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{detail.draft_data ? JSON.stringify(detail.draft_data, null, 2) : 'No draft yet.'}</pre>
          <div className="store-actions">
            {detail.draft_status === 'pending' && <button type="button" className="btn-primary" onClick={() => approveEmployee(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
      {table === 'employee_timelogs' && (
        <p className="hint">Time logged by staff — view and delete only, no editing. The team handles it live on the team page.</p>
      )}
      {table === 'employee_orders' && (
        <p className="hint">Orders are placed by customers on the site — view and delete only, no editing.</p>
      )}
      {table === 'bodyshop_shops' && (
        <BodyshopShopForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'bodyshop_approvals' && !detail && (
        <p className="hint">Drafts bodyshops uploaded for approval — open Details to review the bodyshop details, then Approve to make them live. Deleting a bodyshop is done in Bodyshop Passes, not here.</p>
      )}
      {table === 'bodyshop_approvals' && detail && (
        <div className="form-card">
          <h3>{detail.name}</h3>
          <p>Link: yently.com/bodyshop?b={detail.slug} · Status: {detail.draft_status}</p>
          <p>Draft details (what the bodyshop uploaded):</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{detail.draft_data ? JSON.stringify(detail.draft_data, null, 2) : 'No draft yet.'}</pre>
          <div className="store-actions">
            {detail.draft_status === 'pending' && <button type="button" className="btn-primary" onClick={() => approveBodyshop(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
      {table === 'bodyshop_jobs' && (
        <p className="hint">Jobs created on the bodyshop page — view and delete only, no editing. The bodyshop handles them live on its page.</p>
      )}
      {table === 'bodyshop_orders' && (
        <p className="hint">Orders are placed by customers on the site — view and delete only, no editing.</p>
      )}
      {KIDS_SHOP_TABLES.includes(table) && (
        <KidsShopForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} subject={KIDS_SUBJECTS[kidsSubjectOf(table)].label} folder={KIDS_SUBJECTS[kidsSubjectOf(table)].folder} />
      )}
      {KIDS_APPROVAL_TABLES.includes(table) && !detail && (
        <p className="hint">Drafts schools uploaded for approval — open Details to review the content, then Approve to make it live. Deleting a school is done in Kids {KIDS_SUBJECTS[kidsSubjectOf(table)].label} Passes, not here.</p>
      )}
      {KIDS_APPROVAL_TABLES.includes(table) && detail && (
        <div className="form-card">
          <h3>{detail.name}</h3>
          <p>Link: yently.com/{KIDS_SUBJECTS[kidsSubjectOf(table)].folder}?s={detail.slug} · Status: {detail.draft_status}</p>
          <p>Draft content (what the school uploaded):</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{detail.draft_data ? JSON.stringify(detail.draft_data, null, 2) : 'No draft yet.'}</pre>
          <div className="store-actions">
            {detail.draft_status === 'pending' && <button type="button" className="btn-primary" onClick={() => approveKids(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
      {KIDS_ORDER_TABLES.includes(table) && (
        <p className="hint">Orders are placed by customers on the site — view and delete only, no editing.</p>
      )}
      {table === 'upload_forms' && (
        <UploadFormForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'item_batches' && !detail && (
        <p className="hint">Item lists stores uploaded for approval — open Details to review the items, then Approve to add them all to the shop at once, or Delete to reject the batch. One-by-one items are still handled in Items Add.Edit.Del.Approve.</p>
      )}
      {table === 'item_batches' && detail && (
        <div className="form-card">
          <h3>{(detail.batch_data && detail.batch_data.provider_name) || ('Batch #' + detail.id)}</h3>
          <p>Store: {(detail.batch_data && detail.batch_data.provider_name) || '—'} · Items: {((detail.batch_data && detail.batch_data.items) || []).length} · Status: {detail.status} · Sent: {(detail.created_at || '').slice(0, 10)}</p>
          <p>Items in this batch:</p>
          {((detail.batch_data && detail.batch_data.items) || []).map((it, i) => (
            <p key={i}>{it.name || ('Item ' + (i + 1))}{it.price !== undefined && it.price !== '' ? ' — $' + it.price : ''}{it.description ? ' — ' + it.description : ''}{it.barCode ? ' — Barcode: ' + it.barCode : ''}</p>
          ))}
          <p>Full list (as uploaded):</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{detail.batch_data ? JSON.stringify(detail.batch_data, null, 2) : 'No items yet.'}</pre>
          <div className="store-actions">
            {detail.status === 'pending' && <button type="button" className="btn-primary" onClick={() => approveItemBatch(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
      {table === 'intake_submissions' && !detail && (
        <p className="hint">Submissions arrive from the intake form — open Details to review, fix the page word if it is taken, then Approve to build the shop, or Delete to reject.</p>
      )}
      {table === 'intake_submissions' && detail && (
        <div className="form-card">
          <h3>{detail.payload.shop_name || ('Submission #' + detail.id)}</h3>
          <p>Form: {intakeFormsList.find(f => f.id === detail.form_id)?.f || detail.form_id} · Status: {detail.status} · Sent: {(detail.created_at || '').slice(0, 10)}</p>
          <h4>Shop</h4>
          <p>{detail.payload.owner_name || '—'} · {detail.payload.phone || '—'} · {detail.payload.email || '—'}</p>
          <p>{detail.payload.website || '—'}</p>
          <p>{detail.payload.about || '—'}</p>
          <p>Pictures: {detail.payload.pictures || '—'}</p>
          <h4>Location</h4>
          <p>{[detail.payload.address, detail.payload.city, detail.payload.state, detail.payload.zip, detail.payload.country, detail.payload.county, detail.payload.township].filter(Boolean).join(', ') || '—'}</p>
          <p>{detail.payload.location_note || '—'}</p>
          <h4>Hours</h4>
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => {
            const h = (detail.payload.hours || {})[d] || {}
            return <p key={d}>{d}: {h.closed ? 'Closed' : (h.open && h.close ? h.open + ' - ' + h.close : '—')}</p>
          })}
          <p>Holiday note: {detail.payload.holiday_hours_note || '—'}</p>
          <h4>Services</h4>
          {(detail.payload.services || []).map((sv, i) => (
            <p key={i}>{sv.name} — {sv.price} ({sv.duration_minutes} min){sv.description ? ' — ' + sv.description : ''}{sv.picture ? ' — ' + sv.picture : ''}</p>
          ))}
          <h4>Page</h4>
          <label>Page word
            <input value={pageWord} onChange={e => setPageWord(e.target.value)} />
          </label>
          <p className="hint">This becomes yently.com/{pageWord || 'page-word'}. If approval says it is taken, change it here, save, then approve.</p>
          <p>Header: {detail.payload.header_slogan || '—'} · {detail.payload.header_description || '—'}</p>
          <p>Body: {detail.payload.body_texts || '—'}</p>
          <p>Footer: {detail.payload.footer_slogan || '—'} · {detail.payload.footer_description || '—'}</p>
          <p>Text messages: {detail.payload.text_message_preference ? 'Yes' : 'No'}</p>
          <div className="store-actions">
            <button type="button" className="btn-primary" onClick={savePageWord}>Save page word</button>
            {detail.status === 'pending' && <button type="button" onClick={() => approveSubmission(detail)}>Approve</button>}
            <button type="button" className="btn-soft" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}

      <div className="hero-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>{table === 'forms' ? 'Store' : 'Name'}</th>
              {table === 'items' &&
                <><th>Price</th><th>Provider</th><th>Delivery</th><th>Pickup</th><th>Shown</th><th>Stock</th><th>Barcode</th></>}
              {table === 'providers' && <><th>City</th><th>Country</th><th>Photos</th><th>Hold orders</th><th>Pay orders</th></>}
              {table === 'forms' && <><th>Form address</th><th>Username</th><th>Comment</th></>}
              {table === 'fromdel' && <><th>Address</th><th>City</th><th>State</th><th>Zip</th><th>Country</th></>}
              {table === 'topick' && <><th>Address</th><th>City</th><th>State</th><th>Zip</th><th>Country</th></>}
              {table === 'itemcats' && <th>Slug</th>}
              {table === 'subcats' && <><th>Category</th><th>Flavor</th><th>Color</th><th>Pack</th><th>Size</th><th>Weight</th><th>Unit</th></>}
              {table === 'jobs' && <th>Description</th>}
              {table === 'employees' && <><th>Job</th><th>Phone</th></>}
              {table === 'languages' && <th>Employee</th>}
              {table === 'passes' && <><th>Form address</th><th>Username</th><th>Note</th></>}
              {table === 'barber_stores' && <><th>Owner</th><th>Phone</th><th>Email</th><th>Photos</th><th>Text msgs</th></>}
              {table === 'barber_locations' && <><th>Address</th><th>City</th><th>State</th><th>Zip</th></>}
              {table === 'open_times' && <><th>Store</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th><th>Closed</th></>}
              {table === 'barber_customers' && <><th>Store</th><th>GPS</th><th>Note</th></>}
              {table === 'barber_styles' && <><th>Store</th><th>Price</th><th>Minutes</th><th>Photos</th></>}
              {table === 'website_domains' && <><th>Store</th><th>Address</th><th>Type</th><th>Domain</th></>}
              {table === 'website_types' && <><th>Description</th><th>Photos</th></>}
              {table === 'website_headers' && <><th>Website</th><th>Slogan</th></>}
              {table === 'website_bodies' && <><th>Website</th><th>Heading 1</th></>}
              {table === 'website_footers' && <><th>Website</th><th>Slogan</th></>}
              {table === 'barber_reservations' && <><th>Store</th><th>Phone</th><th>Date</th><th>Time</th><th>Status</th></>}
              {table === 'barber_orders' && <><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th></>}
              {table === 'restaurant_orders' && <><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th></>}
              {table === 'intake_forms' && <><th>Username</th><th>Note</th></>}
              {table === 'intake_submissions' && <><th>Page word</th><th>Form</th><th>Status</th><th>Sent</th></>}
              {table === 'diner_restaurants' && <><th>Slug</th><th>Username</th><th>Draft</th></>}
              {table === 'diner_approvals' && <><th>Slug</th><th>Draft</th></>}
              {table === 'diner_orders' && <><th>Restaurant</th><th>Table</th><th>Items</th><th>Status</th><th>Date</th></>}
              {table === 'barbershop_shops' && <><th>Slug</th><th>Username</th><th>Draft</th></>}
              {table === 'barbershop_approvals' && <><th>Slug</th><th>Draft</th></>}
              {table === 'barbershop_bookings' && <><th>Shop</th><th>Customer</th><th>Service</th><th>Date</th><th>Status</th></>}
              {table === 'barbershop_orders' && <><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th></>}
              {table === 'tv_gallery_orders' && <><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th></>}
              {table === 'pos_stores' && <><th>Slug</th><th>Username</th><th>Draft</th></>}
              {table === 'pos_approvals' && <><th>Slug</th><th>Draft</th></>}
              {table === 'pos_sales' && <><th>Store</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th></>}
              {table === 'pos_orders' && <><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th></>}
              {table === 'dealer_shops' && <><th>Slug</th><th>Username</th><th>Draft</th></>}
              {table === 'dealer_approvals' && <><th>Slug</th><th>Draft</th></>}
              {table === 'dealer_testdrives' && <><th>Dealer</th><th>Vehicle</th><th>Customer</th><th>Date</th><th>Status</th></>}
              {table === 'dealer_tradeins' && <><th>Dealer</th><th>Vehicle</th><th>Customer</th><th>Status</th></>}
              {table === 'dealer_orders' && <><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th></>}
              {table === 'employee_shops' && <><th>Slug</th><th>Username</th><th>Draft</th></>}
              {table === 'employee_approvals' && <><th>Slug</th><th>Draft</th></>}
              {table === 'employee_timelogs' && <><th>Team</th><th>Employee</th><th>Date</th><th>Hours</th><th>Status</th></>}
              {table === 'employee_orders' && <><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th></>}
              {table === 'bodyshop_shops' && <><th>Slug</th><th>Username</th><th>Draft</th></>}
              {table === 'bodyshop_approvals' && <><th>Slug</th><th>Draft</th></>}
              {table === 'bodyshop_jobs' && <><th>Shop</th><th>Number</th><th>Customer</th><th>Vehicle</th><th>Total</th><th>Status</th></>}
              {table === 'bodyshop_orders' && <><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th></>}
              {KIDS_SHOP_TABLES.includes(table) && <><th>Slug</th><th>Username</th><th>Draft</th></>}
              {KIDS_APPROVAL_TABLES.includes(table) && <><th>Slug</th><th>Draft</th></>}
              {KIDS_ORDER_TABLES.includes(table) && <><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th></>}
              {table === 'item_batches' && <><th>Store</th><th>Items</th><th>Status</th><th>Sent</th></>}
              {table === 'upload_forms' && <><th>Folder</th><th>Username</th></>}
              <th>Edit</th><th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{table === 'forms' ? (providers.find(pr => pr.id === r.provider_id)?.name || r.provider_id) : rowLabel(r)}</td>
                {table === 'items' && (
                  <>
                    <td>{money(r.price)}</td>
                    <td>{r.provider?.name || r.provider_id}</td>
                    <td>{r.delivery ? 'Yes' : 'No'}</td>
                    <td>{r.pickup ? 'Yes' : 'No'}</td>
                    <td>{r.pending_approval ? 'Pending' : r.is_active ? 'Yes' : 'Hidden'}</td>
                    <td>{r.stock === null || r.stock === undefined ? '—' : r.stock}</td>
                    <td>{r.barCode || '—'}</td>
                  </>
                )}
                {table === 'providers' && <><td>{r.city}</td><td>{r.country}</td><td>{(r.pics || []).length}</td><td>{r.holdorder ? 'Yes' : 'No'}</td><td>{r.payorder !== false ? 'Yes' : 'No'}</td></>}
                {table === 'forms' && <><td><a href={`/${r.f}`} target="_blank" rel="noreferrer">yently.com/{r.f}</a></td><td>{r.u}</td><td>{r.comment}</td></>}
                {table === 'fromdel' && <><td>{r.faddress}</td><td>{r.fcity}</td><td>{r.fstate}</td><td>{r.fzip}</td><td>{r.fcountry}</td></>}
                {table === 'topick' && <><td>{r.taddress}</td><td>{r.tcity}</td><td>{r.tstate}</td><td>{r.tzip}</td><td>{r.tcountry}</td></>}
                {table === 'itemcats' && <td>{r.slug}</td>}
                {table === 'subcats' && <><td>{itemCategories.find(c => c.id === r.category_id)?.label || r.category_id}</td><td>{r.flavor}</td><td>{r.color}</td><td>{r.packof ?? '—'}</td><td>{r.size}</td><td>{r.weight ?? '—'}</td><td>{r.unit}</td></>}
                {table === 'jobs' && <td>{r.jobDescription || '—'}</td>}
                {table === 'employees' && <><td>{jobsList.find(j => j.id === r.job_id)?.jobTitle || '—'}</td><td>{r.phone1 || '—'}</td></>}
      {table === 'languages' && <td>{(() => { const e = employeesList.find(x => x.id === r.employee_id); return e ? `${e.firstName} ${e.lastName || ''}`.trim() : '—' })()}</td>}
            {table === 'passes' && <><td><a href={`/${r.formName}`}>yently.com/{r.formName}</a></td><td>{r.u}</td><td>{r.note || '—'}</td></>}
            {table === 'barber_stores' && <><td>{r.owner_name || '—'}</td><td>{r.tel || '—'}</td><td>{r.email || '—'}</td><td>{(r.pics || []).length}</td><td>{r.text_message ? 'Yes' : 'No'}</td></>}
            {table === 'barber_locations' && <><td>{r.address || '—'}</td><td>{r.city || '—'}</td><td>{r.state || '—'}</td><td>{r.zip || '—'}</td></>}
            {table === 'open_times' && <><td>{barberStores.find(s => s.id === r.store_id)?.store_name || r.store_id}</td><td>{r.monday || '—'}</td><td>{r.tuesday || '—'}</td><td>{r.wednesday || '—'}</td><td>{r.thursday || '—'}</td><td>{r.friday || '—'}</td><td>{r.saturday || '—'}</td><td>{r.sunday || '—'}</td><td>{r.closed || '—'}</td></>}
            {table === 'barber_customers' && <><td>{barberStores.find(s => s.id === r.store_id)?.store_name || r.store_id}</td><td>{r.location_gps || '—'}</td><td>{r.note || '—'}</td></>}
            {table === 'barber_styles' && <><td>{barberStores.find(s => s.id === r.store_id)?.store_name || r.store_id}</td><td>{money(r.price)}</td><td>{r.time_to_finish ?? '—'}</td><td>{(r.pics || []).length}</td></>}
            {table === 'website_domains' && <><td>{barberStores.find(s => s.id === r.store_id)?.store_name || r.store_id}</td><td><a href={`/${r.slug}`} target="_blank" rel="noreferrer">yently.com/{r.slug}</a></td><td>{websiteTypes.find(t => t.id === r.type_id)?.name || '—'}</td><td>{r.domain || '—'}</td></>}
            {table === 'website_types' && <><td>{r.description || '—'}</td><td>{(r.pics || []).length}</td></>}
            {table === 'website_headers' && <><td>{websiteDomains.find(d => d.id === r.domain_id)?.slug || r.domain_id}</td><td>{r.header_slogan || '—'}</td></>}
            {table === 'website_bodies' && <><td>{websiteDomains.find(d => d.id === r.domain_id)?.slug || r.domain_id}</td><td>{r.h1 || '—'}</td></>}
            {table === 'website_footers' && <><td>{websiteDomains.find(d => d.id === r.domain_id)?.slug || r.domain_id}</td><td>{r.footer_slogan || '—'}</td></>}
            {table === 'barber_reservations' && <><td>{barberStores.find(s => s.id === r.store_id)?.store_name || r.store_id}</td><td>{r.customer_phone || '—'}</td><td>{r.reservation_date || '—'}</td><td>{r.reservation_time || '—'}</td><td>{r.status || '—'}</td></>}
            {table === 'barber_orders' && <><td>{r.customer_email || '—'}</td><td>{r.customer_phone || '—'}</td><td>{r.plan || '—'}</td><td>{money(r.price)}</td></>}
            {table === 'restaurant_orders' && <><td>{r.customer_email || '—'}</td><td>{r.customer_phone || '—'}</td><td>{r.plan || '—'}</td><td>{money(r.price)}</td></>}
            {table === 'intake_forms' && <><td>{r.u}</td><td>{r.note || '—'}</td></>}
            {table === 'intake_submissions' && <><td>{r.payload?.page_word || '—'}</td><td>{intakeFormsList.find(f => f.id === r.form_id)?.f || r.form_id}</td><td>{r.status}</td><td>{(r.created_at || '').slice(0, 10)}</td></>}
            {table === 'diner_restaurants' && <><td>{r.slug}</td><td>{r.u}</td><td>{r.draft_status}</td></>}
            {table === 'diner_approvals' && <><td>{r.slug}</td><td>{r.draft_status}</td></>}
            {table === 'diner_orders' && <><td>{dinerRestaurantsList.find(x => x.id === r.restaurant_id)?.name || r.restaurant_id}</td><td>{r.order_data?.table ?? '—'}</td><td>{(r.order_data?.items || []).length}</td><td>{r.status}</td><td>{(r.created_at || '').slice(0, 10)}</td></>}
            {table === 'barbershop_shops' && <><td>{r.slug}</td><td>{r.u}</td><td>{r.draft_status}</td></>}
            {table === 'barbershop_approvals' && <><td>{r.slug}</td><td>{r.draft_status}</td></>}
            {table === 'barbershop_bookings' && <><td>{barbershopShopsList.find(x => x.id === r.shop_id)?.name || r.shop_id}</td><td>{r.booking_data?.name || '—'}</td><td>{r.booking_data?.service || '—'}</td><td>{r.booking_data?.date || '—'}</td><td>{r.status}</td></>}
            {table === 'barbershop_orders' && <><td>{r.customer_email || '—'}</td><td>{r.customer_phone || '—'}</td><td>{r.plan || '—'}</td><td>{money(r.price)}</td></>}
            {table === 'tv_gallery_orders' && <><td>{r.customer_email || '—'}</td><td>{r.customer_phone || '—'}</td><td>{r.plan || '—'}</td><td>{money(r.price)}</td></>}
            {table === 'pos_stores' && <><td>{r.slug}</td><td>{r.u}</td><td>{r.draft_status}</td></>}
            {table === 'pos_approvals' && <><td>{r.slug}</td><td>{r.draft_status}</td></>}
            {table === 'pos_sales' && <><td>{r.store?.name || r.store_id}</td><td>{money(r.sale_data?.total)}</td><td>{r.sale_data?.payment || '—'}</td><td>{r.status}</td><td>{(r.created_at || '').slice(0, 10)}</td></>}
            {table === 'pos_orders' && <><td>{r.customer_email || '—'}</td><td>{r.customer_phone || '—'}</td><td>{r.plan || '—'}</td><td>{money(r.price)}</td></>}
            {table === 'dealer_shops' && <><td>{r.slug}</td><td>{r.u}</td><td>{r.draft_status}</td></>}
            {table === 'dealer_approvals' && <><td>{r.slug}</td><td>{r.draft_status}</td></>}
            {table === 'dealer_testdrives' && <><td>{dealerShopsList.find(x => x.id === r.shop_id)?.name || r.shop_id}</td><td>{r.booking_data?.vehicle || '—'}</td><td>{r.booking_data?.name || '—'}</td><td>{r.booking_data?.date || '—'}</td><td>{r.status}</td></>}
            {table === 'dealer_tradeins' && <><td>{dealerShopsList.find(x => x.id === r.shop_id)?.name || r.shop_id}</td><td>{((r.tradein_data?.make || '') + ' ' + (r.tradein_data?.model || '')).trim() || '—'}</td><td>{r.tradein_data?.name || '—'}</td><td>{r.status}</td></>}
            {table === 'dealer_orders' && <><td>{r.customer_email || '—'}</td><td>{r.customer_phone || '—'}</td><td>{r.plan || '—'}</td><td>{money(r.price)}</td></>}
            {table === 'employee_shops' && <><td>{r.slug}</td><td>{r.u}</td><td>{r.draft_status}</td></>}
            {table === 'employee_approvals' && <><td>{r.slug}</td><td>{r.draft_status}</td></>}
            {table === 'employee_timelogs' && <><td>{employeeShopsList.find(x => x.id === r.shop_id)?.name || r.shop_id}</td><td>{r.log_data?.employee_name || '—'}</td><td>{r.log_data?.date || '—'}</td><td>{r.log_data?.hours ?? '—'}</td><td>{r.status}</td></>}
            {table === 'employee_orders' && <><td>{r.customer_email || '—'}</td><td>{r.customer_phone || '—'}</td><td>{r.plan || '—'}</td><td>{money(r.price)}</td></>}
            {table === 'bodyshop_shops' && <><td>{r.slug}</td><td>{r.u}</td><td>{r.draft_status}</td></>}
            {table === 'bodyshop_approvals' && <><td>{r.slug}</td><td>{r.draft_status}</td></>}
            {table === 'bodyshop_jobs' && <><td>{bodyshopShopsList.find(x => x.id === r.shop_id)?.name || r.shop_id}</td><td>{r.number || '—'}</td><td>{r.customer || '—'}</td><td>{r.vehicle || '—'}</td><td>{money(r.total)}</td><td>{r.status}</td></>}
            {table === 'bodyshop_orders' && <><td>{r.customer_email || '—'}</td><td>{r.customer_phone || '—'}</td><td>{r.plan || '—'}</td><td>{money(r.price)}</td></>}
            {KIDS_SHOP_TABLES.includes(table) && <><td>{r.slug}</td><td>{r.u}</td><td>{r.draft_status}</td></>}
            {KIDS_APPROVAL_TABLES.includes(table) && <><td>{r.slug}</td><td>{r.draft_status}</td></>}
            {KIDS_ORDER_TABLES.includes(table) && <><td>{r.customer_email || '—'}</td><td>{r.customer_phone || '—'}</td><td>{r.plan || '—'}</td><td>{money(r.price)}</td></>}
            {table === 'item_batches' && <><td>{r.batch_data?.provider_name || ('Provider ' + (r.batch_data?.provider_id ?? '—'))}</td><td>{(r.batch_data?.items || []).length}</td><td>{r.status}</td><td>{(r.created_at || '').slice(0, 10)}</td></>}
            {table === 'upload_forms' && <><td>{r.folder}</td><td>{r.u}</td></>}
                <td>
                  {table === 'items' && r.pending_approval && <button type="button" className="btn-mini" onClick={() => approve(r)}>Approve</button>}{' '}
                  {table === 'intake_submissions' && <><button type="button" className="btn-mini" onClick={() => { setDetail(r); setPageWord(r.payload?.page_word || '') }}>Details</button>{' '}{r.status === 'pending' && <button type="button" className="btn-mini" onClick={() => approveSubmission(r)}>Approve</button>}{' '}</>}
                  {table === 'diner_approvals' && <><button type="button" className="btn-mini" onClick={() => setDetail(r)}>Details</button>{' '}{r.draft_status === 'pending' && <button type="button" className="btn-mini" onClick={() => approveDiner(r)}>Approve</button>}{' '}</>}
                  {table === 'barbershop_approvals' && <><button type="button" className="btn-mini" onClick={() => setDetail(r)}>Details</button>{' '}{r.draft_status === 'pending' && <button type="button" className="btn-mini" onClick={() => approveBarbershop(r)}>Approve</button>}{' '}</>}
                  {table === 'pos_approvals' && <><button type="button" className="btn-mini" onClick={() => setDetail(r)}>Details</button>{' '}{r.draft_status === 'pending' && <button type="button" className="btn-mini" onClick={() => approvePos(r)}>Approve</button>}{' '}</>}
                  {table === 'dealer_approvals' && <><button type="button" className="btn-mini" onClick={() => setDetail(r)}>Details</button>{' '}{r.draft_status === 'pending' && <button type="button" className="btn-mini" onClick={() => approveDealer(r)}>Approve</button>}{' '}</>}
                  {table === 'employee_approvals' && <><button type="button" className="btn-mini" onClick={() => setDetail(r)}>Details</button>{' '}{r.draft_status === 'pending' && <button type="button" className="btn-mini" onClick={() => approveEmployee(r)}>Approve</button>}{' '}</>}
                  {table === 'bodyshop_approvals' && <><button type="button" className="btn-mini" onClick={() => setDetail(r)}>Details</button>{' '}{r.draft_status === 'pending' && <button type="button" className="btn-mini" onClick={() => approveBodyshop(r)}>Approve</button>}{' '}</>}
                  {KIDS_APPROVAL_TABLES.includes(table) && <><button type="button" className="btn-mini" onClick={() => setDetail(r)}>Details</button>{' '}{r.draft_status === 'pending' && <button type="button" className="btn-mini" onClick={() => approveKids(r)}>Approve</button>}{' '}</>}
                  {table === 'item_batches' && <><button type="button" className="btn-mini" onClick={() => setDetail(r)}>Details</button>{' '}{r.status === 'pending' && <button type="button" className="btn-mini" onClick={() => approveItemBatch(r)}>Approve</button>}{' '}</>}
                  {table !== 'barber_orders' && table !== 'restaurant_orders' && table !== 'intake_submissions' && table !== 'diner_approvals' && table !== 'diner_orders' && table !== 'barbershop_approvals' && table !== 'barbershop_bookings' && table !== 'barbershop_orders' && table !== 'pos_approvals' && table !== 'pos_sales' && table !== 'item_batches' && table !== 'pos_orders' && table !== 'dealer_approvals' && table !== 'dealer_testdrives' && table !== 'dealer_tradeins' && table !== 'dealer_orders' && table !== 'employee_approvals' && table !== 'employee_timelogs' && table !== 'employee_orders' && table !== 'bodyshop_approvals' && table !== 'bodyshop_jobs' && table !== 'bodyshop_orders' && table !== 'tv_gallery_orders' && !KIDS_APPROVAL_TABLES.includes(table) && !KIDS_ORDER_TABLES.includes(table) && <button type="button" className="btn-mini" onClick={() => table === 'items' ? editItem(r) : table === 'passes' ? editPass(r) : setDraft({...r})}>Edit</button>}
                </td>
                <td>{table !== 'diner_approvals' && table !== 'barbershop_approvals' && table !== 'pos_approvals' && table !== 'dealer_approvals' && table !== 'employee_approvals' && table !== 'bodyshop_approvals' && !KIDS_APPROVAL_TABLES.includes(table) && <button type="button" className="btn-mini" onClick={() => remove(r)}>Delete</button>}</td>
              </tr>
            ))}
            {rows && filtered.length === 0 && <tr><td colSpan="12">Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
