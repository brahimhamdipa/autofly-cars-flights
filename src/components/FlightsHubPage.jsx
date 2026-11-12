import FlightsMenu from './FlightsMenu'

// Flights hub page — the landing page for the Flights nav button, in the
// same role as the Business Systems hub. It explains the whole process
// in four steps, so a customer always knows what comes first:
// estimation first, price agreed while talking, reservation form with
// passport-exact names, then Pay Flight for the exact agreed amount.
export default function FlightsHubPage({ go }) {
  return (
    <div>
      <FlightsMenu go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>✈️ Flights</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>We check the price, you agree it, then you book and pay — all in one conversation.</p>
        <p>No searching through fares yourself, no surprise fees. You tell us where you're going, we find the price, and you only book when you like it.</p>
      </div>

      <div className="form-card wide">
        <h3>How it works</h3>
        <ol className="steps">
          <li>
            <b>1. Ask for an estimation.</b> Tell us where you're flying, when, and who's going — with the form, or by chat, call, text, WhatsApp or email. It costs nothing to ask.
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => go && go('flights')}>Get a flight estimation →</button>
            </div>
          </li>
          <li>
            <b>2. We check the price — fast.</b> We check the prices and get back to you as soon as possible, ideally while we're still talking. Flight prices can change in minutes, so the whole thing works best in one conversation — stay in the chat or on the call while we check.
          </li>
          <li>
            <b>3. Agree the price, then reserve.</b> When you like the price, fill in the Flight Reservation form. Every traveler's name must match their passport exactly — airlines won't accept a different spelling.
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => go && go('reserve')}>Fill the Flight Reservation form →</button>
            </div>
          </li>
          <li>
            <b>4. Pay the exact amount we agreed.</b> Tap Pay Flight and pay exactly what we agreed — no more, no less. Once we've got your payment, we email your confirmation, receipt and all the details.
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => go && go('flight-pay')} style={{ background: '#f5c542', color: '#111827', fontWeight: 700 }}>Pay Flight →</button>
            </div>
          </li>
        </ol>
      </div>

      <div className="form-card wide" style={{ marginTop: 16 }}>
        <h3>Prefer to talk it through?</h3>
        <p style={{ margin: 0 }}>Chat with us here, call or text, WhatsApp, or email — whichever is easiest. If you start in the chat, stay there while we check the price, so nothing gets lost between messages.</p>
        <div style={{ marginTop: 10 }}>
          <button type="button" onClick={() => go && go('flight-contact')}>Contact us →</button>
        </div>
      </div>
    </div>
  )
}
