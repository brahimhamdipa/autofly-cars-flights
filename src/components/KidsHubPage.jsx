import { KidsTopBar } from './KidsMenu'

// Yently Kids hub page — reached from More ▾ → Yently Kids. Same
// shape as the Business Systems hub: every subject in one place,
// each row linking to its own ad page. Prices match the ad pages
// exactly (every subject $10/month, first month free). No Add to
// cart here on purpose: each ad page has its own. Bundle tiers
// (2 plans 10% off, 3 plans 15% off, 4+ plans 20% off) apply
// automatically in My Cart — and because the cart is shared, Kids
// subjects count together with Business Systems plans.
const SUBJECTS = [
  { name: 'Math', price: 10, blurb: 'Four games — adding, taking away, multiplying, and dividing — by level.', tab: 'kids-math' , video: true },
  { name: 'English', price: 10, blurb: 'Spell it, pick the word, and what does it mean? — from your own word list.', tab: 'kids-english' , video: true },
  { name: 'Arabic', price: 10, blurb: 'Letters, words, and numbers in Arabic — right-to-left, big and clear.', tab: 'kids-arabic' , video: true },
  { name: 'French', price: 10, blurb: 'French words and meanings — spell them, pick them, know them.', tab: 'kids-french' , video: true },
  { name: 'Spanish', price: 10, blurb: 'Spanish words and meanings — spell them, pick them, know them.', tab: 'kids-spanish' , video: true },
  { name: 'Science', price: 10, blurb: 'Quizzes by topic — animals, space, the human body, and more.', tab: 'kids-science' , video: true },
  { name: 'Geography', price: 10, blurb: 'Countries, capitals, and flags — a quiz that travels the world.', tab: 'kids-geography' , video: true },
  { name: 'Coding', price: 10, blurb: 'Build a program from blocks and watch the robot run it.', tab: 'kids-coding' , video: true },
  { name: 'Reading', price: 10, blurb: 'A bookshelf of your own — pick a book, read it, finish it.', tab: 'kids-reading' , video: true },
]

function SubjectRow({ item, first, go }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: first ? 'none' : '1px solid #f1f2f5' }}>
      <div>
        <b>{item.name} — ${item.price}/month</b>
        <p style={{ margin: '4px 0 0' }}>{item.blurb}</p>
        {item.video && (
          <a href="#" onClick={(e) => { e.preventDefault(); if (go) go(item.tab) }} style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>▶ Watch the video — about a minute</a>
        )}
      </div>
      <button type="button" onClick={() => go && go(item.tab)} style={{ flexShrink: 0 }}>See it →</button>
    </div>
  )
}

export default function KidsHubPage({ go }) {
  return (
    <div>
      <KidsTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🧒 Yently Kids</h2>
        <p style={{ fontSize: 18, color: '#fff' }}>Learning that feels like play.</p>
        <p>Nine subjects, one link per school — we build it, host it, and keep it running. First month free on every subject. No setup fee.</p>
      </div>

      <div className="hero-card">
        <h3>Subjects</h3>
        {SUBJECTS.map((s, i) => (
          <SubjectRow key={s.tab} item={s} first={i === 0} go={go} />
        ))}
      </div>

      <div className="hero-card">
        <h3>Books for Kids</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0' }}>
          <div>
            <b>Books for Kids — Coming Soon</b>
            <p style={{ margin: '4px 0 0' }}>Real books delivered to your door — starting in the US first.</p>
          </div>
          <button type="button" onClick={() => go && go('kids-books')} style={{ flexShrink: 0 }}>See it →</button>
        </div>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Bundle &amp; save</h3>
        <p>2 subjects 10% off, 3 subjects 15% off, 4+ subjects 20% off — your saving is applied automatically, no code needed. Kids subjects count together with Business Systems plans.</p>
        <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
      </div>
    </div>
  )
}
