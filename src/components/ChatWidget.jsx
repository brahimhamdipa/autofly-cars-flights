import { useEffect, useRef, useState } from 'react'
import { getVisitorId, loadChatEnabled, loadMessages, sendCustomerMessage, listChatLanguages, startLanguageChat, closeVisitorChat, saveChatThread, getChatThread, clearChatThread } from '../lib/chat'

// Floating customer chat: a 💬 button on every page (only when the
// admin has chat switched on). Flow: the visitor picks a language, and
// the chat starts with the first employee who speaks it. Closing the
// chat deletes it from the visitor's side (the thread is kept for the
// employee) — reopening starts fresh with the language list again.
// No account needed — the conversation follows this browser until closed.
export default function ChatWidget() {
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState('languages') // 'languages' | 'chat'
  const [languages, setLanguages] = useState(null)
  const [pickedLang, setPickedLang] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [name, setName] = useState('')
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('')
  const [starting, setStarting] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadChatEnabled().then(setEnabled).catch(() => {})
  }, [])

  const refresh = async (cid, vid) => {
    try {
      setMessages(await loadMessages(cid, vid))
    } catch { /* chat table not set up yet */ }
  }

  // Resume an active thread when the panel opens; otherwise show languages.
  useEffect(() => {
    if (!open) return
    const thread = getChatThread()
    const vid = getVisitorId()
    if (thread && thread.visitorId === vid && thread.conversationId) {
      setConversationId(thread.conversationId)
      setEmployeeName(thread.employeeName || '')
      setStep('chat')
      refresh(thread.conversationId, vid)
    } else {
      setStep('languages')
      setConversationId(null)
      setMessages([])
      listChatLanguages().then(setLanguages).catch(() => setLanguages([]))
    }
  }, [open])

  // Poll for replies while the chat panel is open.
  useEffect(() => {
    if (!open || step !== 'chat' || !conversationId) return
    const vid = getVisitorId()
    const t = setInterval(() => refresh(conversationId, vid), 8000)
    return () => clearInterval(t)
  }, [open, step, conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, open])

  const start = async (e) => {
    e.preventDefault()
    if (!pickedLang) return
    setStarting(true)
    setStatus('')
    try {
      const vid = getVisitorId()
      const data = await startLanguageChat(vid, pickedLang, name.trim(), '')
      setConversationId(data.conversation_id)
      setEmployeeName(data.employee_name || '')
      saveChatThread({ visitorId: vid, conversationId: data.conversation_id, language: pickedLang, employeeName: data.employee_name || '' })
      setStep('chat')
      await refresh(data.conversation_id, vid)
    } catch (err) {
      setStatus(err.message && err.message.includes('No employee speaks')
        ? `No one on our team speaks ${pickedLang} yet — please pick another language.`
        : 'Error: ' + err.message)
    }
    setStarting(false)
  }

  // Close deletes the chat from the visitor's side (the employee keeps
  // it). The local clear alone would already hide it; the RPC marks it
  // closed server-side too. A failed RPC never blocks closing.
  const close = async () => {
    const vid = getVisitorId()
    if (conversationId) {
      try {
        await closeVisitorChat(conversationId, vid)
      } catch { /* local clear still hides it */ }
    }
    clearChatThread()
    setConversationId(null)
    setMessages([])
    setStep('languages')
    setOpen(false)
  }

  const send = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !conversationId) return
    setSending(true)
    setStatus('')
    try {
      const vid = getVisitorId()
      await sendCustomerMessage(conversationId, vid, body, { name: name.trim(), email: '' })
      setDraft('')
      await refresh(conversationId, vid)
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
            <button type="button" className="modal-close" onClick={close} aria-label="Close chat">✕</button>
          </div>

          {step === 'languages' ? (
            <form className="chat-form" onSubmit={start}>
              <p className="hint">Pick your language — we'll connect you with someone on our team who speaks it.</p>
              {languages === null && <p className="hint">Loading languages...</p>}
              {languages !== null && languages.length === 0 && <p className="hint">No languages available yet — please check back soon.</p>}
              {(languages || []).map(lang => (
                <label key={lang} style={{ display: 'block', marginBottom: 6 }}>
                  <input type="radio" name="chat-lang" checked={pickedLang === lang} onChange={() => setPickedLang(lang)} /> {lang}
                </label>
              ))}
              <input placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} />
              <div className="chat-sendrow">
                <button type="submit" disabled={starting || !pickedLang}>{starting ? '…' : 'Start chat'}</button>
              </div>
              {status && <p className="hint">{status}</p>}
            </form>
          ) : (
            <>
              <div className="chat-messages">
                {employeeName && <p className="hint">You're chatting with {employeeName}.</p>}
                {messages.map(m => (
                  <div key={m.id} className={`chat-msg ${m.sender === 'customer' ? 'mine' : 'theirs'}`}>
                    <span>{m.body}</span>
                    <small>{new Date(m.created_at).toLocaleString()}</small>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form className="chat-form" onSubmit={send}>
                <div className="chat-sendrow">
                  <input required placeholder="Type your message..." value={draft} onChange={e => setDraft(e.target.value)} />
                  <button type="submit" disabled={sending}>{sending ? '…' : 'Send'}</button>
                </div>
                {status && <p className="hint">{status}</p>}
              </form>
            </>
          )}
        </div>
      )}
      <button type="button" className="chat-fab" onClick={() => { if (open) close(); else setOpen(true) }} aria-label="Chat with us">
        💬
      </button>
    </div>
  )
}
