// Shared "back to top" button, bottom-left — exactly the admin
// page's fixed ↑ Top button (same class, same look). Used on
// Products, Stores and every Shop-with-us (store order) page.
// Bottom-left so it never collides with the Chat button (bottom-right).
export default function ScrollTopButton() {
  return (
    <button
      type="button"
      className="admin-to-top no-print"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      ↑ Top
    </button>
  )
}
