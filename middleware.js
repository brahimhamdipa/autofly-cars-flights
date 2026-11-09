// Routing Middleware — clean links (yently.com/<slug>).
// When someone opens a single-segment path that is a paid clean link,
// rewrite (server-side, the browser URL stays clean) to the shop's
// real page: /<system>?<param>=<shop_slug> (e.g. /demo-pos ->
// /pos?s=demo-pos). Everything else passes through untouched
// (next()), so a bad lookup or a missing slug can never break the
// site — the SPA just handles the path as before.
//
// Fail-open by design: any error (Supabase down, bad row, unknown
// system) falls through to next(). Known routes, system folders and
// static assets are skipped before any database call.

import { next, rewrite } from '@vercel/functions'

export const config = {
  // One path segment only (the SPA catch-all already serves /:slug).
  // Static files and multi-segment paths never reach this.
  matcher: ['/:slug'],
  runtime: 'nodejs',
}

const SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr'

// Paths that are NOT clean links — skip before any database call.
// System folders (real static files) and the SPA's own routes.
const KNOWN = new Set([
  'admin',
  'demo-live-chat',
  'demo-tv-gallery',
  'pos',
  'diner',
  'barbers',
  'dealer',
  'employee',
  'bodyshop',
  'kids-math',
  'kids-english',
  'kids-arabic',
  'kids-french',
  'kids-spanish',
  'kids-science',
  'kids-geography',
  'kids-coding',
  'kids-reading',
])

// Query-param each system reads its slug from.
const PARAM_BY_SYSTEM = {
  pos: 's',
  diner: 'r',
  barbers: 's',
  dealer: 'd',
  employee: 'e',
  bodyshop: 'b',
}

function paramFor(system) {
  if (PARAM_BY_SYSTEM[system]) return PARAM_BY_SYSTEM[system]
  if (system.startsWith('kids-')) return 's'
  return null // unknown system — do not rewrite
}

function isKnownSystem(system) {
  return Boolean(PARAM_BY_SYSTEM[system]) || system.startsWith('kids-')
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url)
    const seg = url.pathname.replace(/^\/+|\/+$/g, '')
    // Not a single clean segment (root, multi-segment, or a file).
    if (!seg || seg.includes('/') || seg.includes('.')) return next()
    const slug = seg.toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '')
    if (!slug || KNOWN.has(slug)) return next()

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/clean_links?slug=eq.${encodeURIComponent(slug)}&select=system,shop_slug`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    )
    if (!res.ok) return next()
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return next()
    const row = rows[0]
    if (!row.system || !row.shop_slug || !isKnownSystem(row.system)) return next()
    const param = paramFor(row.system)
    if (!param) return next()
    const target = new URL(`/${row.system}`, request.url)
    target.search = `?${param}=${encodeURIComponent(row.shop_slug)}`
    return rewrite(target)
  } catch (e) {
    // Fail open — never break the site because the lookup failed.
    return next()
  }
}
