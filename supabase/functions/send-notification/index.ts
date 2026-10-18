// Supabase Edge Function: send-notification
// Sends an email to brahimhamdipa@gmail.com on every submission
// Deploy: supabase functions deploy send-notification
// Set secrets: supabase secrets set RESEND_API_KEY=re_xxx NOTIFY_TO=brahimhamdipa@gmail.com

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const NOTIFY_TO = Deno.env.get("NOTIFY_TO") ?? "brahimhamdipa@gmail.com"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } })
  }
  try {
    const { to, subject, table, record } = await req.json()
    const recipient = to || NOTIFY_TO

    const html = `
      <h2>New submission: ${table}</h2>
      <p><b>Subject:</b> ${subject}</p>
      <pre>${JSON.stringify(record, null, 2)}</pre>
      <p>Time: ${new Date().toISOString()}</p>
    `

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AutoFly <onboarding@resend.dev>",
        to: [recipient],
        subject: subject || `New submission: ${table}`,
        html,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 })
  }
})
