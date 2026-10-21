import { GroceryTopBar } from './GroceryMenu'
import NotifyMe from './NotifyMe'

// Coming-soon page for the Groceries-area categories that aren't open yet
// (Lunches/Snacks, Meats) — same style as the other coming-soon pages,
// with the Groceries submenu + cart icon on top.
export default function GrocerySoonPage({ go, title, emoji, intro, items, topic }) {
  return (
    <div>
      <GroceryTopBar go={go} />
      <div className="hero-card">
        <span className="tag">Coming Soon</span>
        <h2>{emoji} {title}</h2>
        <p>{intro}</p>
        <div className="sample-note">
          <b>What's coming:</b>
          <ul>
            {items.map(i => <li key={i}>{i}</li>)}
          </ul>
        </div>
        <p className="hint">Want something sooner? Use Contact Us in the menu and tell the Groceries Department what you're looking for.</p>
      </div>
      <NotifyMe topic={topic} />
    </div>
  )
}
