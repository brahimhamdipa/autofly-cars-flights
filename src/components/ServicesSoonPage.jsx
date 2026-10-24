import ServicesMenu from './ServicesMenu'
import NotifyMe from './NotifyMe'

// Coming-soon page for the Services-area categories that aren't open yet
// (Home Services, Business Services) — same style as the other coming-soon
// pages, with the Services submenu on top.
export default function ServicesSoonPage({ go, title, emoji, intro, items, topic }) {
  return (
    <div>
      <ServicesMenu go={go} />
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
        <p className="hint">Want something sooner? Use Contact Us in the menu and tell the Services Department what you're looking for.</p>
      </div>
      <NotifyMe topic={topic} />
    </div>
  )
}
