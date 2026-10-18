import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase env vars. Copy .env.example to .env and fill them in.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const NOTIFY_EMAIL = 'brahimhamdipa@gmail.com'
