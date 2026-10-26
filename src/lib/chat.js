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
