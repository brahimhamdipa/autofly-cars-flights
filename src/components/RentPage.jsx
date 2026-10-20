import CarsMenu from './CarsMenu'

export default function RentPage({ go }) {
  return (
    <div>
      <CarsMenu go={go} />
      <div className="hero-card">
        <span className="tag">Coming Soon</span>
        <h2>Rent a Car</h2>
        <p>We're getting ready to offer car rentals — the same simple AutoFly way: pick your car and dates, send one request, we handle the rest.</p>
      </div>
      <div className="form-card wide">
        <h3>What's coming</h3>
        <p>🚗 Everyday rentals — clean, reliable cars for trips, errands, and weekends.</p>
        <p>📅 Daily & weekly rates — flexible rentals that fit your plans.</p>
        <p>🛡️ Insurance options — drive with peace of mind.</p>
        <p className="hint">This service isn't live yet. Check back soon — or reach us through the <b>Contact Us</b> link in the menu at the top-left and ask to be first to know when rentals launch in your area.</p>
      </div>
    </div>
  )
}
