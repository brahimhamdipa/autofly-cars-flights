import CarsMenu from './CarsMenu'
import NotifyMe from './NotifyMe'

// Coming-soon page for becoming a Yently Car Seller — seller logins are
// built and working, but not sold yet. Reached from the "Become a Yently
// Car Seller" button on the seller login page (CarSellerFormPage).
export default function CarSellerSoonPage({ go }) {
  const items = [
    'Your own seller login — username and password from Yently',
    'Add your cars one at a time, or many at once',
    'Your cars shown to buyers on the Cars page',
    'Edit or remove a listing any time',
    'Yently checks every listing before it shows',
  ]
  return (
    <div>
      <CarsMenu go={go} />
      <div className="hero-card">
        <span className="tag">Coming Soon</span>
        <h2>🚗 Become a Yently Car Seller</h2>
        <p>Selling your car on Yently is almost here — your own seller login, your cars listed for buyers across the site, and every sale handled in one place. Leave your email below and Yently will tell you the moment seller logins open.</p>
        <div className="sample-note">
          <b>What's coming:</b>
          <ul>
            {items.map(i => <li key={i}>{i}</li>)}
          </ul>
        </div>
        <p className="hint">Want something sooner? Use Contact Us in the menu and tell Yently what you're looking for.</p>
      </div>
      <NotifyMe topic="Car Seller" />
    </div>
  )
}
