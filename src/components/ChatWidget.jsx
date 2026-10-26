import { useEffect, useRef, useState } from 'react'
import { getVisitorId, loadChatEnabled, getConversation, loadMessages, sendCustomerMessage } from '../lib/chat'

// Floating customer chat: a 💬 button on every page (only when the
// admin has chat switched on). Opens a panel where the customer writes
// to the store; the owner replies from Admin → Chat, and replies show
// up here within seconds (the panel refreshes while open). No account
// needed — the conversation follows this browser.
export default function ChatWidget() {
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadChatEnabled().then(setEnabled).catch(() => {})
  }, [])

  const refresh = async (cid, vid) => {
    try {
      const msgs = await loadMessages(cid, vid)
      setMessages(msgs)
    } catch { /* chat table not set up yet */ }
  }

  // Poll for owner replies while the panel is open.
  useEffect(() => {
    if (!open || !conversationId) return
    const vid = getVisitorId()
    refresh(conversationId, vid)
    const t = setInterval(() => refresh(conversationId, vid), 8000)
    return () => clearInterval(t)
  }, [open, conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, open])

  const send = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setSending(true)
    setStatus('')
    try {
      const vid = getVisitorId()
      let cid = conversationId
      if (!cid) {
        cid = await getConversation(vid, name.trim(), email.trim())
        setConversationId(cid)
      }
      await sendCustomerMessage(cid, vid, body, { name: name.trim(), email: email.trim() })
      setDraft('')
      await refresh(cid, vid)
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setSending(false)
  }

  if (!enabled) return null

  return (
    <div className="chat-wrap">
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <b>💬 Chat with AutoFly</b>
            <button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="hint">Hi! Ask us anything about our stores, items, delivery or pickup — we'll reply here as soon as we can.</p>
            )}
            {messages.map(m => (
              <div key={m.id} className={`chat-msg ${m.sender === 'customer' ? 'mine' : 'theirs'}`}>
                <span>{m.body}</span>
                <small>{new Date(m.created_at).toLocaleString()}</small>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form className="chat-form" onSubmit={send}>
            {messages.length === 0 && (
              <>
                <input placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} />
                <input placeholder="Email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </>
            )}
            <div className="chat-sendrow">
              <input required placeholder="Type your message..." value={draft} onChange={e => setDraft(e.target.value)} />
              <button type="submit" disabled={sending}>{sending ? '…' : 'Send'}</button>
            </div>
            {status && <p className="hint">{status}</p>}
          </form>
        </div>
      )}
      <button type="button" className="chat-fab" onClick={() => setOpen(o => !o)} aria-label="Chat with us">
        💬
      </button>
    </div>
  )
}
