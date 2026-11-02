import { supabase, NOTIFY_EMAIL } from './supabaseClient'

/**
 * Insert a submission into Supabase and trigger email notification
 * to brahimhamdipa@gmail.com via the Edge Function.
 */
export async function submitAndNotify({ table, data, subject, emailExtras, attachment, to }) {
  // 1. Save to Supabase.
  // Note: no .select() here — the tables have insert-only RLS policies,
  // so reading the row back after insert would be blocked.
  const { error } = await supabase.from(table).insert(data)
  if (error) throw error

  // 2. Trigger email notification (Edge Function: send-notification)
  // The function sends an email to NOTIFY_EMAIL with the submission details,
  // unless the caller passed `to` (e.g. a barber reservation, emailed to
  // the store itself). The Edge Function already accepts a `to` field
  // and falls back to NOTIFY_TO when it is absent — this only surfaces it.
  // emailExtras (optional) are merged into the emailed record only — useful
  // for details that may not have database columns yet.
  try {
    await supabase.functions.invoke('send-notification', {
      body: {
        to: to || NOTIFY_EMAIL,
        subject: subject || `New submission: ${table}`,
        table,
        record: { ...data, ...(emailExtras || {}) },
        ...(attachment ? { attachment } : {}),
      },
    })
  } catch (e) {
    console.warn('Email notification failed (Edge Function not deployed yet):', e.message)
    // Submission is still saved; email can be retried from Supabase dashboard
  }

  return data
}
