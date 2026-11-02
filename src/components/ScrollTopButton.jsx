// Shared "back to top" button, bottom-left, same idea as the admin
// page's fixed ↑ Top button. Used on Products, Stores and every
// Shop-with-us (store order) page. Bottom-left so it never collides
// with the Chat button (bottom-right).
export default function ScrollTopButton() {
  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 9000, width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#1e2a5a', color: '#fff', fontSize: 20, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
    >
      ↑
    </button>
  )
}
