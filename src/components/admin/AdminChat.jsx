import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Admin Chat section: the on/off switch for the customer chat button,
// plus every customer conversation with a reply box. Unread customer
// messages show a "New" badge; opening a conversation marks them read.
export default function AdminChat() {
  const [enabled, setEnabled] = useState(null)
  const [conversations, setConversations] = useState(null)
  const [allMessages, setAllMessages] = useState([])
  const [openId, setOpenId] = useState(null)
  const [reply, setReply] = useState('')
  const [status, setStatus] = useState('')

  const load = async () => {
    const { data: setting } = await supabase.from('site_settings').select('value').eq('key', 'chat_enabled').single()
    setEnabled(!setting || setting.value === 'true')
    const { data: convs } = await supabase.from('chat_conversations').select('*').order('updated_at', { ascending: false })
    setConversations(convs || [])
    if (convs && convs.length > 0) {
      const { data: msgs } = await supabase.from('chat_messages')
        .select('*')
        .in('conversation_id', convs.map(c => c.id))
        .order('created_at', { ascending: true })
      setAllMessages(msgs || [])
    } else {
      setAllMessages([])
    }
  }
  useEffect(() => { load() }, [])

  const unreadByConv = useMemo(() => {
    const out = {}
    for (const m of allMessages) {
      if (m.sender === 'customer' && !m.read_by_owner) out[m.conversation_id] = (out[m.conversation_id] || 0) + 1
    }
    return out
  }, [allMessages])

  const lastMessage = (cid) => {
    const list = allMessages.filter(m => m.conversation_id === cid)
    return list[list.length - 1] || null
  }

  const openConversation = async (cid) => {
    setOpenId(cid)
    await supabase.from('chat_messages')
      .update({ read_by_owner: true })
      .eq('conversation_id', cid)
      .eq('sender', 'customer')
      .eq('read_by_owner', false)
    load()
  }

  const toggle = async () => {
    const next = !enabled
    setStatus('Saving...')
    const { error } = await supabase.from('site_settings')
      .upsert({ key: 'chat_enabled', value: next ? 'true' : 'false' })
    if (error) { setStatus('Error: ' + error.message); return }
    setEnabled(next)
    setStatus(next ? '✓ Chat is ON — customers see the 💬 button.' : '✓ Chat is OFF — the 💬 button is hidden.')
  }

  const sendReply = async (e) => {
    e.preventDefault()
    const body = reply.trim()
    if (!body || !openId) return
    setStatus('Sending...')
    const { error } = await supabase.from('chat_messages').insert({
      conversation_id: openId, sender: 'owner', body,
    })
    if (error) { setStatus('Error: ' + error.message); return }
    await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', openId)
    setReply('')
    setStatus('')
    load()
  }

  const openMessages = allMessages.filter(m => m.conversation_id === openId)
  const openConv = (conversations || []).find(c => c.id === openId)

  return (
    <div>
      <div className="hero-card">
        <h2>💬 Chat with customers</h2>
        <p>When chat is ON, every visitor sees a 💬 button on the site and can message you. Their messages also arrive in your email. Reply here — they see it in their chat panel.</p>
        <div className="store-actions">
          <button type="button" onClick={toggle} disabled={enabled === null}>
            {enabled === null ? 'Loading...' : enabled ? '🔴 Turn chat OFF' : '🟢 Turn chat ON'}
          </button>
        </div>
        {status && <p className="hint">{status}</p>}
      </div>

      <div className="hero-card">
        <h3>Conversations</h3>
        {conversations === null && <p>Loading...</p>}
        {conversations && conversations.length === 0 && <p>No chats yet.</p>}
        {conversations && conversations.map(c => {
          const last = lastMessage(c.id)
          const unread = unreadByConv[c.id] || 0
          return (
            <div key={c.id} className="cart-line">
              <span>
                <b>{c.customer_name || 'Anonymous visitor'}</b>
                {c.customer_email ? ` (${c.customer_email})` : ''}
                {unread > 0 && <span className="menu-count"> {unread} new</span>}
                <br />
                <small className="hint">{last ? `${last.sender === 'owner' ? 'You: ' : ''}${last.body.slice(0, 80)}` : 'No messages yet'}</small>
              </span>
              <button type="button" className="btn-mini" onClick={() => openConversation(c.id)}>Open</button>
            </div>
          )
        })}
      </div>

      {openConv && (
        <div className="hero-card">
          <h3>Chat with {openConv.customer_name || 'visitor'}{openConv.customer_email ? ` (${openConv.customer_email})` : ''}</h3>
          <div className="chat-messages admin-chat-thread">
            {openMessages.map(m => (
              <div key={m.id} className={`chat-msg ${m.sender === 'owner' ? 'mine' : 'theirs'}`}>
                <span>{m.body}</span>
                <small>{new Date(m.created_at).toLocaleString()}</small>
              </div>
            ))}
            {openMessages.length === 0 && <p className="hint">No messages yet.</p>}
          </div>
          <form className="chat-form" onSubmit={sendReply}>
            <div className="chat-sendrow">
              <input required placeholder="Type your reply..." value={reply} onChange={e => setReply(e.target.value)} />
              <button type="submit">Send reply</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
