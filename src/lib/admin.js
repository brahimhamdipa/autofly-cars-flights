import { supabase } from './supabaseClient'

// The one and only admin account. The database enforces this too (RLS
// policies check the same email), so even a different signed-up account
// can never read or change admin data.
export const ADMIN_EMAIL = 'brahimhamdipa@gmail.com'

export const isAdminUser = (user) =>
  !!user && (user.email || '').toLowerCase() === ADMIN_EMAIL

export async function fetchAll(table, limit = 500) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export const fmtDate = (s) => {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString()
}
