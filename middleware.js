// Routing Middleware — clean links (yently.com/<slug>).
// When someone opens a single-segment path that is a paid clean link,
// rewrite (server-side, the browser URL stays clean) to the shop's
// real page: /<system>?<param>=<shop_slug> (e.g. /demo-pos ->
// /pos?s=demo-pos). The one exception is the live-chat demo:
// /demo-chat -> /demo-live-chat, the public chat demo page (no shop
// folder, no query param). A clean link's own files (style.css, app.js,
// html5-qrcode.min.js, …) are rewritten the same way:
// /<slug>/<file> -> /<system>/<file>, because the shop app's
// bootstrap loads its files relative to the URL it was opened at.
// Everything else passes through untouched (next()), so a bad lookup
// or a missing slug can never break the site — the SPA just handles
// the path as before.
//
// Fail-open by design: any error (Supabase down, bad row, unknown
// system) falls through to next(). Known routes, system folders and
// static assets are skipped before any database call.
//
// NOTE: a server-side rewrite does NOT change location.search in the
// browser, so each shop app also reads its slug from the last path
// segment when the query param is empty (see the SLUG fallback in
// public/<system>/app.js). The middleware + that fallback together
// make the clean link work.

import { next, rewrite } from '@vercel/functions'

export const config = {
  // A clean link page (one segment) and its files (slug + a path).
  matcher: ['/:slug', '/:slug/:path*'],
  runtime: 'nodejs',
}

const SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr'

// Paths that are NOT clean links — skip before any database call.
// System folders (real static files), the SPA's own routes and its
// asset folder.
const KNOWN = new Set([
  'admin',
  'assets',
  'demo-live-chat',
  'demo-tv-gallery',
  'direct-upload',
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
  return Boolean(PARAM_BY_SYSTEM[system]) || system.startsWith('kids-') || system === 'live-chat'
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/+|\/+$/g, '')
    if (!path) return next()
    const parts = path.split('/')
    // A file at the root (favicon.ico, robots.txt, …) — not a clean
    // link. Only checked for single-segment paths: a clean link's
    // own files (/demo-pos/app.js) always contain a dot in the file
    // name, so they must not be skipped here.
    if (parts.length === 1 && parts[0].includes('.')) return next()
    const first = parts[0].toLowerCase()
    if (KNOWN.has(first)) return next()
    const slug = first.replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '')
    if (!slug) return next()

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

    if (parts.length === 1) {
      // Live-chat demo: /demo-chat -> /demo-live-chat (the public
      // chat demo page — no shop folder, no query param).
      if (row.system === 'live-chat') {
        return rewrite(new URL('/demo-live-chat', request.url))
      }
      // Clean-link page: /<slug> -> /<system>?<param>=<shop_slug>.
      const param = paramFor(row.system)
      if (!param) return next()
      const target = new URL(`/${row.system}`, request.url)
      target.search = `?${param}=${encodeURIComponent(row.shop_slug)}`
      return rewrite(target)
    }

    // The live-chat demo has no files of its own — nothing to rewrite.
    if (row.system === 'live-chat') return next()

    // Clean-link file: /<slug>/<rest...> -> /<system>/<rest...>.
    // The shop app's bootstrap loads style.css, app.js and the
    // scanner library relative to the URL, so these must resolve to
    // the real system folder.
    const rest = parts.slice(1).join('/')
    if (!rest) return next()
    const target = new URL(`/${row.system}/${rest}`, request.url)
    target.search = url.search
    return rewrite(target)
  } catch (e) {
    // Fail open — never break the site because the lookup failed.
    return next()
  }
}
