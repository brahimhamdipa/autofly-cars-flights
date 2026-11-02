import { supabase, NOTIFY_EMAIL } from './supabaseClient'

// Customer chat data layer. Visitors are identified by a random id kept
// in their browser (no account needed), and they only ever touch their
// own conversation: all reads/writes go through security-definer RPCs
// that check the visitor id, so one visitor can never read another's
// chat. The admin reads/writes the tables directly (owner-email RLS).

const VISITOR_KEY = 'autofly-visitor-id'

export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2))
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

export async function loadChatEnabled() {
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'chat_enabled').single()
  if (error) return true // no setting row yet = chat on
  return data.value === 'true'
}

export async function getConversation(visitorId, name, email) {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    p_visitor_id: visitorId, p_name: name || '', p_email: email || '',
  })
  if (error) throw error
  return data
}

export async function loadMessages(conversationId, visitorId) {
  const { data, error } = await supabase.rpc('get_chat_messages', {
    p_conversation_id: conversationId, p_visitor_id: visitorId,
  })
  if (error) throw error
  return data || []
}

export async function sendCustomerMessage(conversationId, visitorId, body, customer) {
  const { error } = await supabase.rpc('send_chat_message', {
    p_conversation_id: conversationId, p_visitor_id: visitorId, p_body: body,
  })
  if (error) throw error
  // The owner gets an email for every customer message (same rule as
  // every other form on the site). A failure here never blocks the chat.
  try {
    await supabase.functions.invoke('send-notification', {
      body: {
        to: NOTIFY_EMAIL,
        subject: 'New chat message from a customer',
        table: 'chat_messages',
        record: { conversation_id: conversationId, customer: customer?.name || '', customer_email: customer?.email || '', message: body },
      },
    })
  } catch (e) {
    console.warn('Chat email failed:', e.message)
  }
}

// --- Language chat (batch 3) ---
// The visitor's active thread (conversation + language + employee) is
// kept in localStorage so reopening the panel resumes it. Closing the
// chat clears it: the visitor starts fresh next time, while the thread
// itself stays on the employee side (see closeVisitorChat).

const THREAD_KEY = 'autofly-chat-thread'

export function saveChatThread(thread) {
  try {
    localStorage.setItem(THREAD_KEY, JSON.stringify(thread))
  } catch { /* ignore */ }
}

export function getChatThread() {
  try {
    const raw = localStorage.getItem(THREAD_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearChatThread() {
  try {
    localStorage.removeItem(THREAD_KEY)
  } catch { /* ignore */ }
}

// Distinct language names only — no employee data leaks through this.
export async function listChatLanguages() {
  const { data, error } = await supabase.rpc('list_chat_languages')
  if (error) throw error
  return data || []
}

// Start (or resume) a chat in a language: the first employee who speaks
// it. Returns { conversation_id, employee_name? }.
export async function startLanguageChat(visitorId, language, name, email) {
  const { data, error } = await supabase.rpc('start_language_chat', {
    p_visitor_id: visitorId, p_language: language, p_name: name || '', p_email: email || '',
  })
  if (error) throw error
  return data
}

// Mark the visitor's chat closed (hidden from the visitor, kept for the
// employee). The widget clears its local thread regardless of this call.
export async function closeVisitorChat(conversationId, visitorId) {
  const { error } = await supabase.rpc('close_visitor_chat', {
    p_conversation_id: conversationId, p_visitor_id: visitorId,
  })
  if (error) throw error
}
