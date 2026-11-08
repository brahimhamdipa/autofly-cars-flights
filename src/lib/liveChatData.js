import { submitAndNotify } from './notify'

// Data layer for Live Chat page orders. Mirrors
// insertTvGalleryOrder: the order row is insert-only for visitors
// (customer PII), and placing it emails the owner, who then adds
// the chat bubble to the customer's website and sets up the owner
// login by hand. No payment is taken here.
export async function insertLiveChatOrder(data, emailExtras) {
  return submitAndNotify({
    table: 'live_chat_order',
    data,
    subject: `New Live Chat order — ${data.customer_name}`,
    emailExtras,
  })
}
