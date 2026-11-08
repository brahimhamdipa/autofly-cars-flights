import { useEffect, useRef, useState } from 'react'
import BusinessMenu from './BusinessMenu'

// Live demo of the Live Chat add-on: a sample business page
// ("Demo Café" — fake data only, no real people's names) with the
// chat bubble bottom-right, exactly as a customer would see it on
// their own website. The chat is a client-side demo only: replies
// are scripted, nothing typed here is stored or sent anywhere, and
// the panel says so. Reached from the direct link /demo-live-chat
// (App.jsx tab 'demo-live-chat') and from the Live Chat ad page.
// The ☰ Business Systems submenu sits top left (the real
// BusinessMenu, same as the ad pages); the X top right closes the
// demo back to the ad page; "Want this for your business?" goes
// there too. No FloatingAddToCart here on purpose — its fixed pill
// would sit on top of the chat bubble bottom-right.
// AutoFly's own ChatWidget is hidden on this tab (App.jsx), so the
// demo bubble is the only 💬 on the page.
const DEMO_MENU = [
  { name: 'Espresso', price: '$3.50' },
  { name: 'Cappuccino', price: '$4.00' },
  { name: 'Croissant', price: '$2.75' },
  { name: 'Avocado toast', price: '$7.50' },
  { name: 'Orange juice', price: '$3.00' },
]

// Scripted demo replies — keyword matching only, no server.
function demoReply(text) {
  const t = text.toLowerCase()
  if (/(hour|open|close|when)/.test(t)) return "We're open Monday–Saturday, 8am–6pm, and Sunday 9am–2pm."
  if (/(menu|food|eat|drink|coffee|espresso|cappuccino|croissant|toast|juice|breakfast|lunch)/.test(t)) return "Today's menu: Espresso $3.50, Cappuccino $4.00, Croissant $2.75, Avocado toast $7.50, Orange juice $3.00 — everything made fresh in the morning."
  if (/(address|where|location|find|direction|park)/.test(t)) return "You'll find us at 123 Main Street, right next to the park."
  if (/(phone|call|contact|number)/.test(t)) return "You can reach us at (555) 010-1234 — or just keep chatting here."
  if (/(price|cost|how much|cheap|expensive)/.test(t)) return "Most drinks are $3–$5 and pastries are under $4. The full menu is on this page."
  if (/(thank|thanks)/.test(t)) return "You're welcome! Anything else — hours, the menu, or directions?"
  if (/(hi|hello|hey|good morning|good afternoon)/.test(t)) return "Hi there! Ask me about our hours, the menu, or how to find us."
  return "Thanks for your message! Ask me about our hours, the menu, or directions — this is a demo, so replies are automatic."
}

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function LiveChatDemo({ go }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { from: 'them', body: "Hi! Welcome to Demo Café — ask me about our hours, the menu, or how to find us.", time: now() },
  ])
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, typing, open])

  const send = (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setDraft('')
    setMessages(m => [...m, { from: 'me', body, time: now() }])
    setTyping(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setMessages(m => [...m, { from: 'them', body: demoReply(body), time: now() }])
      setTyping(false)
    }, 900)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, zIndex: 10 }}>
        <BusinessMenu go={go} />
        <button type="button" className="car-submenu-btn" aria-label="Close demo" onClick={() => go && go('live-chat')} style={{ fontSize: 22, color: '#374151' }}>✕</button>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h2>☕ Demo Café</h2>
        <p>Fresh coffee and pastries, right next to the park. This is a demo page — the chat bubble at the bottom right is what your visitors would see on your own website.</p>
        <button type="button" onClick={() => go && go('live-chat')}>Want this for your business?</button>
      </div>

      <div className="hero-card">
        <h3>Our menu</h3>
        <ul>
          {DEMO_MENU.map(item => (
            <li key={item.name}><b>{item.name}</b> — {item.price}</li>
          ))}
        </ul>
      </div>

      <div className="hero-card">
        <h3>Hours &amp; find us</h3>
        <p><b>Open</b> Monday–Saturday, 8am–6pm, and Sunday 9am–2pm.</p>
        <p><b>Address</b> 123 Main Street, right next to the park.</p>
        <p><b>Phone</b> (555) 010-1234.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Like the chat?</h3>
        <p>Tap the 💬 bubble and try it — ask about the hours, the menu, or directions. Replies here are automatic, just to show how it feels.</p>
        <button type="button" onClick={() => go && go('live-chat')}>Want this for your business?</button>
      </div>

      <div className="chat-wrap">
        {open && (
          <div className="chat-panel">
            <div className="chat-head">
              <b>💬 Chat with Demo Café</b>
              <button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
            </div>
            <div className="chat-messages">
              <p className="hint">Demo — replies are automatic. Nothing you type here is stored or sent anywhere.</p>
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.from === 'me' ? 'mine' : 'theirs'}`}>
                  <span>{m.body}</span>
                  <small>{m.time}</small>
                </div>
              ))}
              {typing && (
                <div className="chat-msg theirs">
                  <span>…</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <form className="chat-form" onSubmit={send}>
              <div className="chat-sendrow">
                <input required placeholder="Type your message..." value={draft} onChange={e => setDraft(e.target.value)} />
                <button type="submit">Send</button>
              </div>
            </form>
          </div>
        )}
        <button type="button" className="chat-fab" onClick={() => setOpen(o => !o)} aria-label="Chat with Demo Café">
          💬
        </button>
      </div>
    </div>
  )
}
