import { useBusinessCart } from '../lib/BusinessCartContext'

// Floating Add to cart pill for the Business Systems ad pages —
// fixed bottom-right, gold, always visible, so the visitor never
// has to scroll back to the Add to cart card. The site's "↑ Top"
// pill already sits bottom-left, so this one takes the right side
// and never clashes with it. If the plan is already in the cart
// it says so and goes to My Cart instead of adding it twice.
// The tiny tag above the pill carries the bundle offer (2 systems
// 10% off, 3 systems 15% off, 4+ systems 20% off — see
// bundleFor in BusinessCartContext) — small on purpose, so the
// pill itself stays clean. It sits at the left end of the pill so
// it never hides under the chat bubble bottom-right.
export default function FloatingAddToCart({ planKey, name, price, go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(planKey)
  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 55, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 999, padding: '3px 9px' }}>Bundle &amp; save up to 20%</span>
      <button
        type="button"
        onClick={() => (inCart ? go && go('business-cart') : addPlan(planKey))}
        aria-label={inCart ? `${name} — in your cart, go to My Cart` : `Add ${name} to cart — $${price}/month`}
        style={{ background: '#f5a623', color: '#fff', border: 'none', borderRadius: 999, padding: '12px 18px', fontWeight: 700, fontSize: 15, boxShadow: '0 4px 14px rgba(0,0,0,.25)', cursor: 'pointer' }}
      >
        {inCart ? '✓ In your cart' : `🛒 Add to cart — $${price}/month`}
      </button>
    </div>
  )
}
