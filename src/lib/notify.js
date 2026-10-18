import { supabase, NOTIFY_EMAIL } from './supabaseClient'

/**
 * Insert a submission into Supabase and trigger email notification
 * to brahimhamdipa@gmail.com via the Edge Function.
 */
export async function submitAndNotify({ table, data, subject }) {
  // 1. Save to Supabase
  const { data: inserted, error } = await supabase.from(table).insert(data).select().single()
  if (error) throw error

  // 2. Trigger email notification (Edge Function: send-notification)
  // The function sends an email to NOTIFY_EMAIL with the submission details.
  try {
    await supabase.functions.invoke('send-notification', {
      body: {
        to: NOTIFY_EMAIL,
        subject: subject || `New submission: ${table}`,
        table,
        record: inserted,
      },
    })
  } catch (e) {
    console.warn('Email notification failed (Edge Function not deployed yet):', e.message)
    // Submission is still saved; email can be retried from Supabase dashboard
  }

  return inserted
}
