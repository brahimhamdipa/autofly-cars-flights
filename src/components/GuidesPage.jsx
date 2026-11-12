import { Fragment } from 'react'

// GuidesPage — every price, video and step-by-step guide, in one place.
//
// DATA-DRIVEN: to add a future video or PDF, add one row to the arrays
// below (and put the file in public/videos/ or public/guides/). Nothing
// else on the page needs to change.

const PRICE_GROUPS = [
  {
    title: 'Business Systems',
    rows: [
      { name: 'Restaurant', blurb: 'Your own ordering page + live kitchen screen', price: 40, tab: 'restaurants' },
      { name: 'POS', blurb: 'Your own point-of-sale register, stock + receipts', price: 50, tab: 'pos' },
      { name: 'Barber', blurb: 'Booking page + Serving Now board', price: 15, tab: 'barbers' },
      { name: 'Dealer', blurb: 'Your dealer website: vehicles, test drives, trade-ins', price: 20, tab: 'dealer' },
      { name: 'Employee', blurb: 'Time tracking + employee records', price: 20, tab: 'employee' },
      { name: 'Bodyshop', blurb: 'Estimates, jobs, customers + loan cars', price: 20, tab: 'bodyshop' },
      { name: 'Houses', blurb: 'Your houses page: listings, photos + mortgage calculator', price: 20, tab: 'houses' },
      { name: 'Doctor', blurb: 'Your clinic page: doctors, prices + appointments', price: 20, tab: 'doctor' },
      { name: 'Holiday', blurb: 'Your holiday rentals page: properties, dates + bookings', price: 20, tab: 'holiday' },
      { name: 'Car Rental', blurb: 'Your car rental page: cars, drivers + bookings', price: 20, tab: 'rentals' },
      { name: 'Laundry', blurb: 'Your laundry page: services, prices + orders with pickup or delivery', price: 20, tab: 'laundry' },
      { name: 'Simple Website', blurb: 'Any website, built for you — your name, logo, services, and pictures', price: 10, tab: 'simple-barbershop' },
    ],
  },
  {
    title: 'Add-ons',
    rows: [
      { name: 'TV Gallery', blurb: 'Your pictures on a TV screen', price: 2, tab: 'tv-gallery' },
      { name: 'Live Chat', blurb: 'Live chat on your website', price: 3, tab: 'live-chat' },
      { name: 'Clean Link', blurb: 'A short, clean link for your system', price: 2, tab: 'clean-link' },
      { name: 'Direct Upload', blurb: 'Your uploads go live straight away — no waiting for approval', price: 5, tab: 'direct-upload' },
    ],
  },
  {
    title: 'Yently Kids',
    rows: [
      { name: 'Any subject', blurb: 'Math, English, Arabic, French, Spanish, Science, Geography, Coding, Reading — one price per subject', price: 10, tab: 'kids-hub' },
    ],
  },
]

// video: path under /videos/ (null = no video yet). pdf: path under /guides/
const SYSTEM_GUIDES = [
  { name: 'Restaurant', tab: 'restaurants', video: '/videos/restaurant-guide.mp4', length: '2:19', pdf: '/guides/restaurant-guide.pdf' },
  { name: 'POS', tab: 'pos', video: '/videos/pos-guide.mp4', length: '2:04', pdf: '/guides/pos-guide.pdf' },
  { name: 'Barber', tab: 'barbers', video: '/videos/barber-guide.mp4', length: '2:16', pdf: '/guides/barber-guide.pdf' },
  { name: 'Dealer', tab: 'dealer', video: '/videos/dealer-guide.mp4', length: '1:59', pdf: '/guides/dealer-guide.pdf' },
  { name: 'Employee', tab: 'employee', video: '/videos/employee-guide.mp4', length: '2:07', pdf: '/guides/employee-guide.pdf' },
  { name: 'Bodyshop', tab: 'bodyshop', video: '/videos/bodyshop-guide.mp4', length: '2:09', pdf: '/guides/bodyshop-guide.pdf' },
  { name: 'Add-Ons', tab: 'business-hub', video: '/videos/addons-guide.mp4', length: '2:15', pdf: '/guides/addons-guide.pdf' },
  { name: 'Direct Upload', tab: 'direct-upload', video: null, length: null, pdf: null },
]

const KIDS_GUIDES = [
  { name: 'Math', tab: 'kids-math', video: '/videos/kids-math-guide.mp4', length: '1:24', pdf: '/guides/kids-math-guide.pdf' },
  { name: 'English', tab: 'kids-english', video: '/videos/kids-english-guide.mp4', length: '1:22', pdf: '/guides/kids-english-guide.pdf' },
  { name: 'Arabic', tab: 'kids-arabic', video: '/videos/kids-arabic-guide.mp4', length: '1:26', pdf: '/guides/kids-arabic-guide.pdf' },
  { name: 'French', tab: 'kids-french', video: '/videos/kids-french-guide.mp4', length: '1:23', pdf: '/guides/kids-french-guide.pdf' },
  { name: 'Spanish', tab: 'kids-spanish', video: '/videos/kids-spanish-guide.mp4', length: '1:26', pdf: '/guides/kids-spanish-guide.pdf' },
  { name: 'Science', tab: 'kids-science', video: '/videos/kids-science-guide.mp4', length: '1:29', pdf: '/guides/kids-science-guide.pdf' },
  { name: 'Geography', tab: 'kids-geography', video: '/videos/kids-geography-guide.mp4', length: '1:27', pdf: '/guides/kids-geography-guide.pdf' },
  { name: 'Coding', tab: 'kids-coding', video: '/videos/kids-coding-guide.mp4', length: '1:27', pdf: '/guides/kids-coding-guide.pdf' },
  { name: 'Reading', tab: 'kids-reading', video: '/videos/kids-reading-guide.mp4', length: '1:16', pdf: '/guides/kids-reading-guide.pdf' },
]

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 15 }
const thStyle = { background: '#161d44', color: '#fff', textAlign: 'left', padding: '9px 10px' }
const tdStyle = { borderBottom: '1px solid #e5e7eb', padding: '9px 10px', verticalAlign: 'top' }
const groupStyle = { background: '#eef1fb', fontWeight: 700, padding: '8px 10px', textAlign: 'left' }
const linkStyle = { color: '#2563eb', fontWeight: 700 }

export default function GuidesPage({ go }) {
  return (
    <div>
      <div className="hero-card">
        <h2>Guides</h2>
        <p>Every price, every video, every step-by-step guide — all in one place. Watch how a system works, or read the guide from buying it to using it every day.</p>
      </div>

      <div className="form-card wide">
        <h3>Prices &amp; offers</h3>
        <p>Every plan below is per month. The first month is free on every plan, there is no setup fee, and there is no commission on what you sell — ever.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Plan</th>
                <th style={thStyle}>What you get</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Price / month</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>First month</th>
              </tr>
            </thead>
            <tbody>
              {PRICE_GROUPS.map(g => (
                <Fragment key={g.title}>
                  <tr><td colSpan={4} style={groupStyle}>{g.title}</td></tr>
                  {g.rows.map(r => (
                    <tr key={r.name}>
                      <td style={tdStyle}><a onClick={() => go(r.tab)} style={{ ...linkStyle, cursor: 'pointer' }}>{r.name}</a></td>
                      <td style={tdStyle}>{r.blurb}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>${r.price}/month</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>Free</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ background: '#fff8e1', border: '1px solid #f5c542', borderRadius: 10, padding: '12px 14px', marginTop: 14 }}>
          <b>Bundle &amp; save — your saving is applied automatically, no code needed.</b>
          <p style={{ margin: '6px 0 0' }}>2 plans: 10% off &nbsp;·&nbsp; 3 plans: 15% off &nbsp;·&nbsp; 4 or more plans: 20% off. Add-ons and Yently Kids subjects count too. For example, Restaurant $40 + POS $50 is $90 — with 10% off you pay $81/month.</p>
        </div>
      </div>

      <div className="form-card wide">
        <h3>Videos &amp; step-by-step guides — Business Systems</h3>
        <p>Every system has a short video and a step-by-step guide (PDF) that walks you through it — from buying it to using it every day.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>System</th>
                <th style={thStyle}>Video</th>
                <th style={thStyle}>Step-by-step guide (PDF)</th>
              </tr>
            </thead>
            <tbody>
              {SYSTEM_GUIDES.map(s => (
                <tr key={s.name}>
                  <td style={tdStyle}><a onClick={() => go(s.tab)} style={{ ...linkStyle, cursor: 'pointer' }}>{s.name}</a></td>
                  <td style={tdStyle}>
                    {s.video
                      ? <a href={s.video} target="_blank" rel="noreferrer" style={linkStyle}>Watch — {s.length}</a>
                      : <span style={{ color: '#6b7280' }}>Coming soon</span>}
                  </td>
                  <td style={tdStyle}>
                    {s.pdf
                      ? <a href={s.pdf} target="_blank" rel="noreferrer" style={linkStyle}>Download the guide (PDF)</a>
                      : <span style={{ color: '#6b7280' }}>Coming soon</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="form-card wide">
        <h3>Videos — Yently Kids</h3>
        <p>One short video for every subject — about a minute each. Every subject has its own step-by-step guide — download it below.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Subject</th>
                <th style={thStyle}>Video</th>
                <th style={thStyle}>Step-by-step guide (PDF)</th>
              </tr>
            </thead>
            <tbody>
              {KIDS_GUIDES.map(s => (
                <tr key={s.name}>
                  <td style={tdStyle}><a onClick={() => go(s.tab)} style={{ ...linkStyle, cursor: 'pointer' }}>{s.name}</a></td>
                  <td style={tdStyle}><a href={s.video} target="_blank" rel="noreferrer" style={linkStyle}>Watch — {s.length}</a></td>
                  <td style={tdStyle}>
                    {s.pdf
                      ? <a href={s.pdf} target="_blank" rel="noreferrer" style={linkStyle}>Download the guide (PDF)</a>
                      : <span style={{ color: '#6b7280' }}>Coming soon</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">More guides are added here as they are made — check back, or ask us about any system.</p>
      </div>
    </div>
  )
}
