import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Employee chat view: after an employee logs in with their form pass
// (the same /<slug> page serves provider forms and employee passes —
// see ProviderFormPage), they see the conversations assigned to them,
// answer them, and can save a conversation. Conversations stay here even
// after the visitor closes (the visitor just stops seeing them).
// Login is re-checked on every call (pass credentials travel per call),
// the same pattern as the provider-form submits.
export default function EmployeeChatView({ creds, employee, goBack }) {
  const [convs, setConvs] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const rpcArgs = { p_form: creds.form, p_username: creds.username, p_password: creds.password }

  const loadConvs = async () => {
    try {
      const { data, error } = await supabase.rpc('list_employee_conversations', rpcArgs)
      if (error) throw error
      setConvs(data || [])
    } catch (e) {
      setStatus('Error: ' + e.message)
    }
  }

  const loadMessages = async (cid) => {
    try {
      const { data, error } = await supabase.rpc('get_employee_messages', { ...rpcArgs, p_conversation_id: cid })
      if (error) throw error
      setMessages(data || [])
    } catch (e) {
      setStatus('Error: ' + e.message)
    }
  }

  // The conversation list refreshes on its own every 8 seconds, so a chat
  // that starts AFTER this window opens shows up without reloading the
  // page. (Previously the list loaded once on open and never refreshed
  // unless a conversation was clicked — an empty window stayed empty
  // forever, which is why new chats never appeared.)
  useEffect(() => {
    loadConvs()
    const t = setInterval(loadConvs, 8000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!activeId) return
    loadMessages(activeId)
    const t = setInterval(() => { loadMessages(activeId) }, 8000)
    return () => clearInterval(t)
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const active = (convs || []).find(c => c.id === activeId) || null

  const send = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !activeId) return
    setSending(true)
    setStatus('')
    try {
      const { error } = await supabase.rpc('send_employee_message', { ...rpcArgs, p_conversation_id: activeId, p_body: body })
      if (error) throw error
      setDraft('')
      await loadMessages(activeId)
      await loadConvs()
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setSending(false)
  }

  const toggleSave = async () => {
    if (!active) return
    try {
      const { error } = await supabase.rpc('save_employee_conversation', { ...rpcArgs, p_conversation_id: active.id, p_saved: !active.saved })
      if (error) throw error
      await loadConvs()
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  return (
    <div>
      <div className="hero-card">
        {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}
        <h2>💬 Employee chat</h2>
        <p>
          Conversations assigned to <b>{employee.firstName}{employee.lastName ? ` ${employee.lastName}` : ''}</b>
          {employee.jobTitle ? ` (${employee.jobTitle})` : ''} — reply here; visitors see your replies as AutoFly.
          A conversation stays here even after the visitor closes it.
          New chats appear in the list on their own — no need to reload the page.
        </p>
        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn-soft" onClick={() => { loadConvs(); if (activeId) loadMessages(activeId) }}>↻ Refresh</button>
        </div>
        {status && <p className="hint">{status}</p>}
      </div>

      {convs === null && <div className="hero-card"><p>Loading conversations...</p></div>}
      {convs !== null && convs.length === 0 && <div className="hero-card"><p>No conversations yet.</p></div>}

      {convs !== null && convs.length > 0 && (
        <div className="hero-card">
          {convs.map(c => (
            <button
              key={c.id}
              type="button"
              className="btn-soft"
              style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 8 }}
              onClick={() => setActiveId(c.id)}
            >
              {c.customer_name || 'Visitor'}{c.language ? ` · ${c.language}` : ''}{c.saved ? ' · ⭐ Saved' : ''}{c.visitor_hidden ? ' · (visitor closed)' : ''}
              <br /><small>{new Date(c.updated_at).toLocaleString()}</small>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="hero-card">
          <h3>{active.customer_name || 'Visitor'}{active.language ? ` · ${active.language}` : ''}</h3>
          <p className="hint">
            {active.customer_email || ''}
            {active.visitor_hidden ? ' · Visitor closed this chat (kept here).' : ''}
          </p>
          <button type="button" className="btn-soft" onClick={toggleSave}>
            {active.saved ? '★ Saved — tap to unsave' : '☆ Save conversation'}
          </button>
          <div className="chat-messages">
            {messages.map(m => (
              <div key={m.id} className={`chat-msg ${m.sender === 'customer' ? 'theirs' : 'mine'}`}>
                <span>{m.body}</span>
                <small>{new Date(m.created_at).toLocaleString()}</small>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form className="chat-form" onSubmit={send}>
            <div className="chat-sendrow">
              <input required placeholder="Type your reply..." value={draft} onChange={e => setDraft(e.target.value)} />
              <button type="submit" disabled={sending}>{sending ? '…' : 'Send'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
