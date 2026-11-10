import { GroceryTopBar } from './GroceryMenu'
import NotifyMe from './NotifyMe'

// Coming-soon page for becoming a Yently Shop Seller — seller logins are
// built and working, but not sold yet. Reached from the "Become a Yently
// Shop Seller" button on the Shop seller login page (ShopSellerFormPage).
export default function ShopSellerSoonPage({ go }) {
  const items = [
    'Your own seller login — username and password from Yently',
    'Your own store — even if it is just you and one item',
    'Add your items one at a time, or many at once',
    'Your items shown to shoppers on the Products page',
    'Edit or remove a listing any time',
  ]
  return (
    <div>
      <GroceryTopBar go={go} />
      <div className="hero-card">
        <span className="tag">Coming Soon</span>
        <h2>🛍️ Become a Yently Shop Seller</h2>
        <p>Selling in the Yently Shop is almost here — your own seller login, your items listed for shoppers, whether you sell one thing or a whole homemade range. Leave your email below and Yently will tell you the moment seller logins open.</p>
        <div className="sample-note">
          <b>What's coming:</b>
          <ul>
            {items.map(i => <li key={i}>{i}</li>)}
          </ul>
        </div>
        <p className="hint">Want something sooner? Use Contact Us in the menu and tell Yently what you're looking for.</p>
      </div>
      <NotifyMe topic="Shop Seller" />
    </div>
  )
}
