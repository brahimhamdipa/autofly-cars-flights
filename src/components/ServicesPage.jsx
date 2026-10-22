import NotifyMe from './NotifyMe'

export default function ServicesPage() {
  return (
    <div>
      <div className="hero-card">
        <span className="tag">Coming Soon</span>
        <h2>Services</h2>
        <p>Everyday services are coming to AutoFly — the same one place where you find cars, flights and groceries will soon let you book trusted local help too. Tell us what you need, send one request, we handle the rest.</p>
      </div>
      <div className="form-card wide">
        <h3>What's coming</h3>
        <p>🚗 Rides & transport — airport rides, local trips, and scheduled pickups.</p>
        <p>📦 Moving & delivery help — movers, hauling, and large-item delivery.</p>
        <p>🧹 Home services — cleaning, handyman work, and small repairs.</p>
        <p>🛠️ Errands & more — everyday tasks and local pros, booked in one place.</p>
        <p className="hint">This service isn't live yet. Check back soon — or send us a message through the Contact Us page and tell us what service you're looking for, and we'll try to arrange it for you.</p>
      </div>
      <NotifyMe topic="Services" />
    </div>
  )
}
