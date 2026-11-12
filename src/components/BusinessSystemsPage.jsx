import { BusinessTopBar } from './BusinessMenu'

// Business Systems hub page — the first nav button and the default
// tab. Every system and add-on in one place, each row linking to its
// own ad page. Prices match the ad pages exactly (Restaurant $40,
// POS $50, Barber $15, Dealer $20, Employee $20, Bodyshop $20, Houses $20,
// Doctor $20, Holiday $20, Car Rental $20, Laundry $20,
// Simple Website $10, TV Gallery $2, Live Chat $3 — all per month,
// first month free). No Add to cart here on purpose: each ad page
// has its own. Bundle tiers (2 plans 10% off, 3 plans 15% off, 4+
// plans 20% off) apply automatically in My Cart.
const SYSTEMS = [
  { name: 'Restaurant', price: 40, blurb: 'Your own ordering page — menu, live kitchen, and orders.', tab: 'restaurants', video: true },
  { name: 'POS', price: 50, blurb: 'Your own register — stock, sales, and receipts.', tab: 'pos', video: true },
  { name: 'Barber', price: 15, blurb: 'Your own booking page — live queue and a stopwatch for every cut.', tab: 'barbers', video: true },
  { name: 'Dealer', price: 20, blurb: 'Your own dealer page — vehicles, test drives, and trade-ins.', tab: 'dealer', video: true },
  { name: 'Employee', price: 20, blurb: 'Your own employee time page — log time and keep records.', tab: 'employee', video: true },
  { name: 'Bodyshop', price: 20, blurb: 'Your own bodyshop page — estimates, jobs, and loan cars.', tab: 'bodyshop', video: true },
  { name: 'Houses', price: 20, blurb: 'Your own houses page — listings, photos, and a mortgage calculator.', tab: 'houses', video: false },
  { name: 'Doctor', price: 20, blurb: 'Your own clinic page — doctors, prices, and appointments.', tab: 'doctor', video: false },
  { name: 'Holiday', price: 20, blurb: 'Your own holiday rentals page — properties, dates, and bookings.', tab: 'holiday', video: false },
  { name: 'Car Rental', price: 20, blurb: 'Your own car rental page — cars, drivers, and bookings.', tab: 'rentals', video: false },
  { name: 'Laundry', price: 20, blurb: 'Your own laundry page — services, prices, and orders with pickup or delivery.', tab: 'laundry', video: false },
  { name: 'Simple Website', price: 10, blurb: 'Any website, built for you — your name, logo, services, and pictures.', tab: 'simple-barbershop' },
]

const ADDONS = [
  { name: 'TV Gallery', price: 2, blurb: 'Your pictures on the big screen — slideshow and one-picture display.', tab: 'tv-gallery' },
  { name: 'Live Chat', price: 3, blurb: 'A chat bubble on your website — every message to your email.', tab: 'live-chat' },
  { name: 'Clean Link', price: 2, blurb: 'Your shop at a clean address — yently.com/your-name.', tab: 'clean-link' },
  { name: 'Direct Upload', price: 5, blurb: 'Your uploads go live straight away — no waiting for approval.', tab: 'direct-upload' },
]

function SystemRow({ item, first, go }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: first ? 'none' : '1px solid #f1f2f5' }}>
      <div>
        <b>{item.name} — ${item.price}/month</b>
        <p style={{ margin: '4px 0 0' }}>{item.blurb}</p>
        {item.video && (
          <p style={{ margin: '6px 0 0' }}>
            <a href="#" onClick={(e) => { e.preventDefault(); if (go) go(item.tab) }} style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>▶ Watch the video — 2 min</a>
          </p>
        )}
      </div>
      <button type="button" onClick={() => go && go(item.tab)} style={{ flexShrink: 0 }}>See it →</button>
    </div>
  )
}

export default function BusinessSystemsPage({ go }) {
  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🏢 Business Systems</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Everything your business runs on, in one place.</p>
        <p>We build it, host it, and keep it running — you just use it. First month free on every plan. No setup fee.</p>
      </div>

      <div className="hero-card">
        <h3>Systems</h3>
        {SYSTEMS.map((s, i) => (
          <SystemRow key={s.tab} item={s} first={i === 0} go={go} />
        ))}
      </div>

      <div className="hero-card">
        <h3>Add-ons</h3>
        <p className="hint">Add one to any system — or get one on its own.</p>
        <h4 style={{ margin: '14px 0 6px' }}>🎥 What are Add-Ons? — 2 minutes</h4>
        <p className="hint" style={{ margin: '0 0 10px' }}>A quick video guide — the add-ons explained, with TV Gallery and the others as examples.</p>
        <video controls preload="metadata" poster="/videos/addons-guide-poster.jpg" src="/videos/addons-guide.mp4" style={{ width: '100%', maxWidth: 720, borderRadius: 10, background: '#000' }} />
        <p style={{ marginTop: 10 }}>Prefer to read it? <a href="/guides/addons-guide.pdf" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>Download the step-by-step guide (PDF)</a> — TV Gallery, Live Chat and Clean Link, explained.</p>
        {ADDONS.map((s, i) => (
          <SystemRow key={s.tab} item={s} first={i === 0} go={go} />
        ))}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Bundle &amp; save</h3>
        <p>2 systems 10% off, 3 systems 15% off, 4+ systems 20% off — your saving is applied automatically, no code needed.</p>
        <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
      </div>
    </div>
  )
}
