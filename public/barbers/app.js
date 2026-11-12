/* Barbers page app — ONE folder for every barber shop.
   The shop comes from its own private link, and its services, info,
   and bookings live in the database — there is no data.json file here.
   Visitors see the last APPROVED services. Anyone can book an
   appointment (no login); Serving Now is public too, but it shows
   INITIALS ONLY — the server never sends names, phones, emails or
   notes to that page, so customer privacy cannot leak through it.
   The shop's own username + password open Setup (draft + Upload
   for approval, as diner); one shared employee password opens
   Bookings, where the barber runs the Stopwatch beside every
   Cancel button. All credentials live in memory only: a reload
   asks again, exactly like the barber intake form. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var params = {};
  try {
    location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, k, v) {
      params[decodeURIComponent(k)] = decodeURIComponent(v);
    });
  } catch (e) {}
  var SLUG = String(params.s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
  var SLUG_FROM_PATH = false;
  var slugResolved = false;
  if (!SLUG) {
    // Clean link (yently.com/<slug>): the middleware rewrites the
    // page server-side, so location.search is empty in the browser.
    // The shop slug is then the last path segment. Ignore this
    // system's own folder name, so a bare /barbers visit still
    // shows "not found" by design.
    var segs = location.pathname.split('/').filter(function (s) { return s; });
    var lastSeg = (segs[segs.length - 1] || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    if (lastSeg && lastSeg !== 'barbers') { SLUG = lastSeg; SLUG_FROM_PATH = true; }
  }
  // Clean link (yently.com/<slug>): the name in the link is the CLEAN
  // name, which usually differs from the shop's own slug (e.g.
  // yently.com/testlink opens the Demo POS shop, slug demo-pos).
  // The middleware rewrites the page, but the browser address stays
  // clean, so look the clean name up in clean_links (public read)
  // and use the real shop slug. Only runs when the slug came from
  // the path (no ?s=/?r=/... query). Fails open: any error keeps
  // the path slug, and the shop just shows "not found" as before.
  function resolveSlug() {
    if (!SLUG_FROM_PATH || slugResolved || !SLUG) return Promise.resolve();
    slugResolved = true;
    return fetch(SUPABASE_URL + '/rest/v1/clean_links?slug=eq.' + encodeURIComponent(SLUG) + '&select=shop_slug', {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }
    }).then(function (res) { return res.ok ? res.json() : []; }).then(function (rows) {
      if (rows && rows[0] && rows[0].shop_slug) SLUG = String(rows[0].shop_slug).toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    }).catch(function () {});
  }

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null; // live services/info (visitors)
  var draft = null; // staff draft (Setup)
  var draftStatus = 'editing';
  var staffCreds = null; // {u, p} in memory only, never stored
  /* ---------- Shop live chat (per-shop add-on) ---------- */
  /* The visitor bubble mounts once, after the shop's live data loads;
     the shared file checks the per-shop switch itself and renders
     nothing while it is OFF. The owner inbox lives in Setup, behind
     the owner login. NOTE: ShopChat.mountBubble sets its container's
     innerHTML, so it must NOT be given document.body - that would
     wipe the whole page. It gets a dedicated container div instead. */
  var shopChatMounted = false;
  function mountShopChatBubble(shopName, ownerEmail) {
    if (shopChatMounted || !window.ShopChat) return;
    shopChatMounted = true;
    var wrap = document.createElement('div');
    wrap.id = 'shop-chat-wrap';
    document.body.appendChild(wrap);
    window.ShopChat.mountBubble(wrap, { ownerType: 'barbers', ownerKey: SLUG, shopName: shopName || 'this shop', ownerEmail: ownerEmail || '' });
  }
  function stopShopChat() {
    var box = $('setup-chats');
    if (box && box._shopChatStop) box._shopChatStop();
  }
  function wireShopChatInbox() {
    var btn = $('setup-chats-toggle');
    var box = $('setup-chats');
    if (!btn || !box) return;
    btn.addEventListener('click', function () {
      if (box._shopChatStop) {
        box._shopChatStop();
        box._shopChatStop = null;
        box.innerHTML = '';
        btn.textContent = 'Open chats';
        return;
      }
      if (!window.ShopChat) {
        box.innerHTML = '<p class="error">Chat could not load. Please try again in a moment.</p>';
        return;
      }
      window.ShopChat.mountInbox(box, { ownerType: 'barbers', ownerKey: SLUG, creds: { u: staffCreds.u, p: staffCreds.p } });
      btn.textContent = 'Close chats';
    });
  }
  var empPass = null; // employee password in memory only, never stored
  var empUnlocked = false; // true once the employee password is entered, or when the shop has none set
  var bookings = []; // employee view (full details)
  var cancelBookingId = null; // booking id awaiting an in-page cancel confirmation
  var serving = []; // public Serving Now rows (initials only)
  var bookingsTimer = null;
  var servingTimer = null;
  var servingClock = null;
  var currentView = 'book';
  var bookSearch = ''; // public services search text, kept while typing

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n || 0).toFixed(2); }
  function todayLocal() {
    var d = new Date();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function updateBadges() {
    var bc = $('bookings-count');
    var active = bookings.filter(function (b) { return b.status === 'active'; }).length;
    bc.hidden = active === 0;
    bc.textContent = active;
  }
  function rpc(name, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (res) {
      /* Some calls (save/upload) return no body at all — read text first
         and only parse when there is something to parse, so an empty
         success reply is not mistaken for a failure. */
      return res.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!res.ok) throw new Error((j && j.message) || 'request failed');
        return j;
      });
    });
  }
  function notifyEmail(subject, record) {
    try {
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ subject: subject, table: 'barbershop_draft', record: record })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- Icon picture (one small square image) ---------- */
  /* The icon lives in the draft/live data as `icon` — a public URL or ''.
     It is uploaded to the product-images bucket, shrunk to 200px on its
     long edge first (same rules as the shop picture uploads: JPEG 0.8,
     PNGs stay PNG, small pictures untouched, any failure falls back to
     the original file). */
  function shrinkIconImage(file) {
    try {
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          URL.revokeObjectURL(url);
          var w0 = img.naturalWidth, h0 = img.naturalHeight;
          if (!w0 || !h0 || Math.max(w0, h0) <= 200) { resolve(file); return; }
          var scale = 200 / Math.max(w0, h0);
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(w0 * scale);
          canvas.height = Math.round(h0 * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          var outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          canvas.toBlob(function (blob) {
            if (!blob) { resolve(file); return; }
            var name = outType === 'image/jpeg' ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
            resolve(new File([blob], name, { type: outType }));
          }, outType, 0.8);
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
      });
    } catch (e) {
      return Promise.resolve(file);
    }
  }
  function uploadIconImage(file) {
    return shrinkIconImage(file).then(function (up) {
      var safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = 'store/icons/' + SLUG + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
      return fetch(SUPABASE_URL + '/storage/v1/object/product-images/' + path, {
        method: 'POST',
        headers: { 'Content-Type': up.type || 'application/octet-stream', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: up
      }).then(function (res) {
        if (!res.ok) throw new Error('upload failed (HTTP ' + res.status + ')');
        return SUPABASE_URL + '/storage/v1/object/public/product-images/' + path;
      });
    });
  }
  /* One small picture per service, same shrink as the icon (200px,
     JPEG 0.8, PNGs stay PNG). Uploaded at once to store/barber-items/
     and stored on the draft service as `pic` — a public URL or ''. */
  function uploadItemPicture(file) {
    return shrinkIconImage(file).then(function (up) {
      var safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = 'store/barber-items/' + SLUG + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
      return fetch(SUPABASE_URL + '/storage/v1/object/product-images/' + path, {
        method: 'POST',
        headers: { 'Content-Type': up.type || 'application/octet-stream', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: up
      }).then(function (res) {
        if (!res.ok) throw new Error('upload failed (HTTP ' + res.status + ')');
        return SUPABASE_URL + '/storage/v1/object/public/product-images/' + path;
      });
    });
  }
  /* Show the live icon next to the business name in the header — only
     when there is one. Created once and re-used, so repeated header
     renders never duplicate it, and removing the icon restores the
     header exactly as it was. */
  function renderHeaderIcon(url) {
    var nameEl = $('site-name');
    if (!nameEl) return;
    var brand = nameEl.closest ? nameEl.closest('.brand') : null;
    if (!brand) {
      var p = nameEl.parentNode;
      brand = p && p.parentNode;
      if (!brand) return;
    }
    var img = brand.querySelector('img.site-icon');
    if (!url) {
      if (img) img.remove();
      return;
    }
    if (!img) {
      img = document.createElement('img');
      img.className = 'site-icon';
      img.alt = '';
      var ref = nameEl.parentNode;
      if (ref === brand) ref = nameEl;
      brand.insertBefore(img, ref);
    }
    if (img.getAttribute('src') !== url) img.setAttribute('src', url);
  }
  /* Wire the icon field in Setup: picking a picture uploads it at once
     and stores the URL on the draft; Remove clears it. The draft is
     only persisted when the owner saves it, like every other field. */
  function wireIconField() {
    var iconFile = $('setup-icon-file');
    if (iconFile) iconFile.addEventListener('change', function () {
      var f = iconFile.files && iconFile.files[0];
      if (!f) return;
      var out = $('setup-icon-out');
      if (out) out.textContent = 'Uploading icon…';
      uploadIconImage(f).then(function (url) {
        draft.icon = url;
        var prev = $('setup-icon-preview');
        if (prev) { prev.src = url; prev.hidden = false; }
        var urlField = $('setup-icon-url');
        if (urlField) urlField.value = url;
        if (out) out.textContent = 'Icon uploaded — save the draft to keep it.';
        iconFile.value = '';
      }).catch(function (err) {
        if (out) out.textContent = 'Could not upload the icon: ' + (err && err.message ? err.message : 'please try again.');
        iconFile.value = '';
      });
    });
    var iconRemove = $('setup-icon-remove');
    if (iconRemove) iconRemove.addEventListener('click', function () {
      draft.icon = '';
      var prev = $('setup-icon-preview');
      if (prev) { prev.src = ''; prev.hidden = true; }
      var urlField = $('setup-icon-url');
      if (urlField) urlField.value = '';
      var out = $('setup-icon-out');
      if (out) out.textContent = 'Icon removed — save the draft to keep it removed.';
      var file = $('setup-icon-file');
      if (file) file.value = '';
    });
  }

  /* ---------- Staff sign-in (owner, Setup only) ---------- */
  function staffUnlocked() { return !!staffCreds; }
  function renderStaffLogin(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the username and password Yently gave this shop.</p>' +
      '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
      '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="st-go">Sign in</button></div>' +
      '<div id="st-out" style="margin-top:12px"></div></div>';
    $('st-go').addEventListener('click', function () {
      var out = $('st-out');
      var u = $('st-user').value.trim();
      var p = $('st-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_barbershop_login', { p_slug: SLUG, p_username: u, p_password: p }).then(function (ok) {
        if (ok === true) {
          staffCreds = { u: u, p: p };
          after();
        } else {
          out.innerHTML = '<p class="error">Wrong username or password.</p>';
        }
      }).catch(function () {
        out.innerHTML = '<p class="error">Could not reach the sign-in check. Please try again in a moment.</p>';
      });
    });
  }

  /* ---------- Employee unlock (Bookings only) ---------- */
  /* Bookings need the shop's shared employee password — one password
     for everybody, set by the admin. Nothing is stored: a reload
     asks again. Shops with no password set skip this entirely
     (empUnlocked starts true for them, see the start block). */
  function renderEmpPrompt(el, after) {
    el.innerHTML = '<h2>Bookings</h2><div class="card">' +
      '<p class="info">Enter the employee password for this shop to see bookings.</p>' +
      '<label>Employee password</label><input id="emp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="emp-go">Unlock</button></div>' +
      '<div id="emp-out" style="margin-top:12px"></div></div>';
    $('emp-go').addEventListener('click', function () {
      var out = $('emp-out');
      var p = $('emp-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_barbershop_employee_pass', { p_slug: SLUG, p_password: p }).then(function (ok) {
        if (ok === true) {
          empPass = p;
          empUnlocked = true;
          after();
        } else {
          out.innerHTML = '<p class="error">Wrong employee password.</p>';
        }
      }).catch(function () {
        out.innerHTML = '<p class="error">Could not reach the sign-in check. Please try again in a moment.</p>';
      });
    });
  }
  function needEmp(el, view) {
    if (empUnlocked) return false;
    renderEmpPrompt(el, function () { show(view); });
    return true;
  }

  function stopBookingsPoll() {
    if (bookingsTimer) { clearInterval(bookingsTimer); bookingsTimer = null; }
  }
  function stopServingPoll() {
    if (servingTimer) { clearInterval(servingTimer); servingTimer = null; }
    if (servingClock) { clearInterval(servingClock); servingClock = null; }
  }

  function show(view) {
    currentView = view;
    if (view !== 'setup') stopShopChat();
    if (view !== 'bookings') stopBookingsPoll();
    if (view !== 'serving') stopServingPoll();
    ['book', 'bookings', 'serving', 'setup'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
    });
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view);
    });
    if (view === 'book') renderBook();
    if (view === 'bookings') openBookings();
    if (view === 'serving') openServing();
    if (view === 'setup') openSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- Book (public, no login) ---------- */
  function serviceMatches(s, q) {
    if (!q) return true;
    return String(s.name || '').toLowerCase().indexOf(q) !== -1;
  }
  /* The services grid alone, re-rendered as the visitor types in the
     search box, so the search input never loses focus. Each service
     shows its small picture on the right (96×72, the same size as
     the dealer Setup thumbnails); services without one show none. */
  function renderBookGrid() {
    var grid = $('book-grid');
    if (!grid) return;
    var q = (bookSearch || '').toLowerCase();
    var services = (data.services || []).filter(function (s) { return serviceMatches(s, q); });
    if (!services.length) {
      grid.innerHTML = '<p class="info">' + (bookSearch ? 'No services match your search.' : 'No services listed yet — check back soon.') + '</p>';
      return;
    }
    var html = '<div class="menu-grid">';
    services.forEach(function (s) {
      html += '<div class="menu-item"><div class="item-top"><div class="item-text"><h3>' + esc(s.name) + '</h3>' +
        (s.description ? '<div class="desc">' + esc(s.description) + '</div>' : '') + '</div>' +
        (s.pic ? '<img class="item-pic" src="' + esc(s.pic) + '" alt="">' : '') +
        '</div><div class="row"><span class="price">' + money(s.price) + '</span>' +
        '<span class="info">' + (s.duration ? s.duration + ' min' : '') + '</span></div></div>';
    });
    html += '</div>';
    grid.innerHTML = html;
  }
  function renderBook() {
    var el = $('view-book');
    if (!data) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var info = '<div class="card info">';
    if (data.address) info += '<p>📍 ' + esc(data.address) + '</p>';
    if (data.phone) info += '<p>📞 ' + esc(data.phone) + '</p>';
    if (data.email) info += '<p>✉️ ' + esc(data.email) + '</p>';
    if (data.hours) info += '<p>🕐 ' + esc(data.hours) + '</p>';
    info += '</div>';
    var services = data.services || [];
    var html = info + '<h2>Services</h2>' +
      '<input id="book-search" type="text" placeholder="Search services…" value="' + esc(bookSearch) + '">' +
      '<div id="book-grid"></div>';
    var today = todayLocal();
    html += '<h2>Book an appointment</h2><div class="card">' +
      '<label>Your name</label><input id="bk-name" type="text" autocomplete="name">' +
      '<label>Phone</label><input id="bk-phone" type="text" autocomplete="tel">' +
      '<label>Email (optional)</label><input id="bk-email" type="email" autocomplete="email">' +
      '<label>Service</label><select id="bk-service"><option value="">Choose a service…</option>';
    services.forEach(function (s, i) {
      html += '<option value="' + i + '">' + esc(s.name) + ' — ' + money(s.price) +
        (s.duration ? ' · ' + s.duration + ' min' : '') + '</option>';
    });
    html += '</select>' +
      '<label>Date</label><input id="bk-date" type="date" value="' + today + '">' +
      '<label>Time</label><input id="bk-time" type="time">' +
      '<label>Note (optional)</label><input id="bk-note" type="text">' +
      '<div class="row"><button id="bk-go">Book appointment</button></div>' +
      '<div id="bk-out" style="margin-top:12px"></div></div>';
    el.innerHTML = html;
    var search = $('book-search');
    if (search) search.addEventListener('input', function () {
      bookSearch = search.value;
      renderBookGrid();
    });
    renderBookGrid();
    $('bk-go').addEventListener('click', function () {
      var out = $('bk-out');
      var name = $('bk-name').value.trim();
      var phone = $('bk-phone').value.trim();
      var si = $('bk-service').value;
      var date = $('bk-date').value;
      var time = $('bk-time').value;
      if (!name || !phone || si === '' || !date || !time) {
        out.innerHTML = '<p class="error">Please fill in your name, phone, service, date and time.</p>';
        return;
      }
      var s = services[Number(si)];
      var booking = {
        name: name, phone: phone, email: $('bk-email').value.trim(),
        note: $('bk-note').value.trim(), service: s.name, price: s.price,
        duration: s.duration || null, date: date, time: time
      };
      out.innerHTML = '<p class="info">Booking…</p>';
      rpc('place_barbershop_booking', { p_slug: SLUG, p_booking: booking }).then(function (id) {
        out.innerHTML = '<div class="note">✓ Booked — booking #' + id + ': ' + esc(s.name) +
          ' on ' + esc(date) + ' at ' + esc(time) + ' for ' + esc(name) +
          '. Show your name at the shop when you arrive.</div>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not book: ' + esc(err.message) + ' Please try again.</p>';
      });
    });
  }

  /* ---------- Bookings (employee password, shared across devices) ---------- */
  function openBookings() {
    if (needEmp($('view-bookings'), 'bookings')) return;
    fetchBookings();
    stopBookingsPoll();
    bookingsTimer = setInterval(fetchBookings, 5000);
  }
  function fetchBookings() {
    rpc('list_barbershop_bookings_open', { p_slug: SLUG, p_epass: empPass }).then(function (rows) {
      bookings = rows || [];
      updateBadges();
      if (currentView === 'bookings') renderBookings();
    }).catch(function () {
      if (currentView === 'bookings' && !bookings.length) {
        $('view-bookings').innerHTML = '<h2>Bookings</h2><p class="error">Could not load bookings. Please try again in a moment.</p>';
      }
    });
  }
  function renderBookings() {
    var el = $('view-bookings');
    var active = bookings.filter(function (b) { return b.status === 'active'; });
    var past = bookings.filter(function (b) { return b.status !== 'active'; });
    var html = '<h2>Bookings</h2><p class="info">Bookings refresh on their own every few seconds.</p>';
    if (active.length === 0) {
      html += '<p class="info">No active bookings right now.</p>';
    }
    active.forEach(function (b) {
      var d = b.data || {};
      var running = !!b.started_at;
      html += '<div class="card"><h3>' + esc(d.name) + ' — ' + esc(d.service) + '</h3>' +
        '<p class="info">' + esc(d.date || '') + (d.time ? ' at ' + esc(d.time) : '') +
        (d.price != null ? ' · ' + money(d.price) : '') +
        (d.duration ? ' · ' + d.duration + ' min' : '') + '</p>' +
        (d.phone ? '<p>📞 ' + esc(d.phone) + '</p>' : '') +
        (d.email ? '<p>✉️ ' + esc(d.email) + '</p>' : '') +
        (d.note ? '<p>📝 ' + esc(d.note) + '</p>' : '') +
        (running ? '<p class="info">⏱ Serving since ' + new Date(b.started_at).toLocaleTimeString() + ' — see Serving Now for the running time.</p>' : '') +
        '<div class="row" style="margin-top:10px">' +
        '<button data-watch="' + b.id + '">' + (running ? 'Stop' : 'Stopwatch') + '</button>' +
        '<button class="secondary" data-done="' + b.id + '">Mark done</button>' +
        (cancelBookingId === b.id
          ? '<span><b>Cancel this booking?</b> <button class="danger" data-cancel-yes="' + b.id + '">Yes, cancel</button> <button class="secondary" data-cancel-no="' + b.id + '">Keep it</button></span>'
          : '<button class="danger" data-cancel="' + b.id + '">Cancel</button>') + '</div></div>';
    });
    if (past.length > 0) {
      html += '<h2>Past bookings</h2>';
      past.forEach(function (b) {
        var d = b.data || {};
        html += '<div class="card"><h3>' + esc(d.name) + ' — ' + esc(d.service) + '</h3>' +
          '<p class="info">' + esc(d.date || '') + (d.time ? ' at ' + esc(d.time) : '') +
          ' · ' + esc(b.status) + '</p></div>';
      });
    }
    el.innerHTML = html;
    function update(id, status, startedAt) {
      var b = bookings.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!b) return;
      rpc('update_barbershop_booking_open', { p_slug: SLUG, p_booking_id: b.id, p_data: b.data, p_status: status, p_started_at: startedAt, p_epass: empPass }).then(fetchBookings).catch(fetchBookings);
    }
    el.querySelectorAll('[data-watch]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = bookings.filter(function (x) { return String(x.id) === btn.getAttribute('data-watch'); })[0];
        if (!b) return;
        update(b.id, 'active', b.started_at ? null : new Date().toISOString());
      });
    });
    el.querySelectorAll('[data-done]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        update(btn.getAttribute('data-done'), 'done', null);
      });
    });
    el.querySelectorAll('[data-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        cancelBookingId = Number(btn.getAttribute('data-cancel'));
        renderBookings();
      });
    });
    el.querySelectorAll('[data-cancel-no]').forEach(function (btn) {
      btn.addEventListener('click', function () { cancelBookingId = null; renderBookings(); });
    });
    el.querySelectorAll('[data-cancel-yes]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-cancel-yes');
        cancelBookingId = null;
        update(id, 'cancelled', null);
      });
    });
  }

  /* ---------- Serving Now (public, initials only) ---------- */
  function openServing() {
    fetchServing();
    stopServingPoll();
    servingTimer = setInterval(fetchServing, 5000);
    servingClock = setInterval(function () {
      if (currentView === 'serving') renderServing();
    }, 1000);
  }
  function fetchServing() {
    rpc('list_barbershop_serving', { p_slug: SLUG, p_date: todayLocal() }).then(function (rows) {
      serving = rows || [];
      if (currentView === 'serving') renderServing();
    }).catch(function () {
      if (currentView === 'serving' && !serving.length) {
        $('view-serving').innerHTML = '<h2>Serving Now</h2><p class="error">Could not load the queue. Please try again in a moment.</p>';
      }
    });
  }
  function elapsed(startedAt) {
    var ms = Date.now() - new Date(startedAt).getTime();
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return h > 0 ? h + ':' + pad(m) + ':' + pad(sec) : m + ':' + pad(sec);
  }
  function renderServing() {
    var el = $('view-serving');
    var n = serving.length;
    var html = '<h2>Serving Now</h2>';
    if (n === 0) {
      html += '<p class="info">Nobody in line right now.</p>';
    } else {
      html += '<p class="info">' + n + (n === 1 ? ' person in line.' : ' people in line.') +
        ' Bookings refresh on their own every few seconds.</p>';
      serving.forEach(function (row) {
        if (row.status === 'serving') {
          html += '<div class="card serving-card"><div class="initials">' + esc(row.initials) + '</div>' +
            '<div><strong>' + esc(row.service) + '</strong></div>' +
            '<div class="serve-time">⏱ ' + elapsed(row.started_at) + '</div>' +
            '<div class="info">Now serving</div></div>';
        } else {
          html += '<div class="card"><div class="initials">' + esc(row.initials) + '</div>' +
            '<div><strong>' + esc(row.service) + '</strong></div>' +
            '<div class="info">Waiting</div></div>';
        }
      });
    }
    el.innerHTML = html;
  }

  /* ---------- Setup (login only: draft + Upload for approval) ---------- */
  function openSetup() {
    stopShopChat(); // the loading state replaces the Setup view, destroying the inbox container
    if (!staffUnlocked()) {
      renderStaffLogin($('view-setup'), 'Setup sign-in', function () { openSetup(); });
      return;
    }
    var el = $('view-setup');
    el.innerHTML = '<h2>Setup</h2><div class="card"><p class="info">Loading your draft…</p></div>';
    rpc('get_barbershop_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p }).then(function (res) {
      draft = res.data || {};
      draft.services = draft.services || [];
      draftStatus = res.status || 'editing';
      renderSetup();
    }).catch(function () {
      el.innerHTML = '<h2>Setup</h2><div class="card"><p class="error">Could not load your draft. Please try again in a moment.</p></div>';
    });
  }
  function statusLine() {
    if (draftStatus === 'pending') return 'Your changes were sent to Yently and are waiting for approval. Visitors still see the approved services.';
    if (draftStatus === 'approved') return 'Your last upload was approved and is now live.';
    return 'Your changes are saved as a draft. Visitors still see the approved services until you upload and Yently approves.';
  }
  function renderSetup() {
    stopShopChat(); // re-render destroys the inbox container; stop its poll first
    var el = $('view-setup');
    function field(label, id, value, type) {
      return '<label>' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '">';
    }
    var html = '<h2>Setup</h2>' +
      '<div class="note">' + esc(statusLine()) + '</div>' +
      '<div class="card">' +
      field('Shop name', 'setup-name', draft.name) +
      '<label>Icon picture</label>' +
      '<div class="icon-field">' +
      '<img id="setup-icon-preview" class="icon-preview" src="' + esc(draft.icon || '') + '" alt=""' + (draft.icon ? '' : ' hidden') + '>' +
      '<input id="setup-icon-file" type="file" accept="image/*">' +
      '<button type="button" id="setup-icon-remove" class="small secondary">Remove icon</button>' +
      '</div>' +
      '<p class="info" id="setup-icon-out">One small picture shown next to the shop name. It is shrunk to 200px before uploading.</p>' +
      field('About text', 'setup-about', draft.about) +
      field('Phone', 'setup-phone', draft.phone) +
      field('Email', 'setup-email', draft.email, 'email') +
      field('Address', 'setup-address', draft.address) +
      field('Hours', 'setup-hours', draft.hours) +
      '</div><h2>Services</h2><div id="setup-services"></div>' +
      '<button id="setup-add" class="secondary">+ Add service</button>' +
      '<div class="row" style="margin-top:16px"><button id="setup-save" class="secondary">Save draft</button>' +
      '<button id="setup-upload">Upload for approval</button></div>' +
      '<div id="setup-out" style="margin-top:12px"></div>' +
      '<div class="card"><h3>Chats</h3>' +
      '<p class="info">Messages from visitors on this page. Visitors only see the chat bubble once Yently switches live chat on for this shop.</p>' +
      '<div class="row"><button type="button" id="setup-chats-toggle" class="secondary">Open chats</button></div>' +
      '<div id="setup-chats"></div></div>';
    el.innerHTML = html;
    wireShopChatInbox();
    var listEl = $('setup-services');
    function serviceRow(s, i) {
      var row = document.createElement('div');
      row.className = 'card';
      row.innerHTML =
        '<label>Service name</label><input data-f="name" value="' + esc(s.name) + '">' +
        '<label>Price</label><input data-f="price" type="number" step="0.01" min="0" value="' + esc(s.price) + '">' +
        '<label>Duration in minutes</label><input data-f="duration" type="number" min="0" value="' + esc(s.duration == null ? '' : s.duration) + '">' +
        '<label>Description</label><input data-f="description" value="' + esc(s.description || '') + '">' +
        '<label>Picture</label>' +
        '<div class="pic-thumbs">' +
        (s.pic ? '<div class="pic-thumb"><img src="' + esc(s.pic) + '" alt="Service picture"><button class="small danger" data-pic-remove="' + i + '">Remove</button></div>' : '') +
        '</div>' +
        '<input type="file" accept="image/*" data-pic-file="' + i + '">' +
        '<p class="info" data-pic-status="' + i + '" hidden></p>' +
        '<button class="small danger" data-remove="' + i + '">Remove service</button>';
      row.querySelectorAll('[data-f]').forEach(function (input) {
        input.addEventListener('input', function () {
          var f = input.getAttribute('data-f');
          s[f] = (f === 'price' || f === 'duration') ? Number(input.value) : input.value;
        });
      });
      row.querySelector('[data-remove]').addEventListener('click', function () {
        draft.services.splice(i, 1);
        renderSetup();
      });
      /* Picking a picture uploads it at once and stores the URL on the
         draft service; Remove clears it. The draft is only persisted
         when the owner saves it, like every other field. */
      var picFile = row.querySelector('[data-pic-file]');
      if (picFile) picFile.addEventListener('change', function () {
        var f = picFile.files && picFile.files[0];
        if (!f) return;
        var st = row.querySelector('[data-pic-status]');
        if (st) { st.hidden = false; st.textContent = 'Uploading picture…'; }
        uploadItemPicture(f).then(function (url) {
          s.pic = url;
          drawServices();
        }).catch(function (err) {
          if (st) { st.hidden = false; st.textContent = 'Could not upload the picture: ' + (err && err.message ? err.message : 'please try again.'); }
          picFile.value = '';
        });
      });
      var picRemove = row.querySelector('[data-pic-remove]');
      if (picRemove) picRemove.addEventListener('click', function () {
        s.pic = '';
        drawServices();
      });
      return row;
    }
    function drawServices() {
      listEl.innerHTML = '';
      draft.services.forEach(function (s, i) { listEl.appendChild(serviceRow(s, i)); });
    }
    drawServices();
    wireIconField();
    $('setup-add').addEventListener('click', function () {
      draft.services.push({ name: 'New service', price: 0, duration: 30, description: '', pic: '' });
      drawServices();
    });
    function collectDraft() {
      return {
        name: $('setup-name').value.trim() || draft.name,
        about: $('setup-about').value,
        phone: $('setup-phone').value,
        email: $('setup-email').value,
        address: $('setup-address').value,
        hours: $('setup-hours').value,
        logo: draft.logo || '',
        icon: draft.icon || '',
        services: draft.services.filter(function (s) { return s.name.trim() !== ''; })
      };
    }
    $('setup-save').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Saving…</p>';
      var d = collectDraft();
      rpc('save_barbershop_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'editing';
        out.innerHTML = '<p class="info">Draft saved. Visitors still see the approved services.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not save: ' + esc(err.message) + '</p>';
      });
    });
    $('setup-upload').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Uploading…</p>';
      var d = collectDraft();
      rpc('submit_barbershop_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'pending';
        notifyEmail('Barbershop draft for approval: ' + (d.name || SLUG), { shop: d.name || '', slug: SLUG });
        out.innerHTML = '<p class="info">Uploaded! Your changes were sent to Yently and are waiting for approval. We will confirm once they are live.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not upload: ' + esc(err.message) + '</p>';
      });
    });
  }

  /* ---------- Start ---------- */
  document.querySelectorAll('#tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () { show(btn.getAttribute('data-view')); });
  });
  /* Black ↑ Top pill at the bottom-left, exactly like the shop pages:
     always visible, tap it to jump back to the top. */
  var toTop = $('to-top');
  if (toTop) {
    toTop.addEventListener('click', function () { window.scrollTo(0, 0); });
  }
  if (!SLUG) {
    $('site-name').textContent = 'Shop not found';
    $('view-book').innerHTML = '<div class="error">This link doesn\'t point to a barber shop. Check the link and try again — ask Yently for your shop link.</div>';
  } else {
    resolveSlug().then(function () { return rpc('get_barbershop_live', { p_slug: SLUG }); }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.services = data.services || [];
      document.title = data.name || 'Barber shop';
      var logo = $('site-logo');
      if (data.logo) { logo.src = (/^https?:\/\//.test(data.logo) ? data.logo : BASE + data.logo); logo.hidden = false; }
      $('site-name').textContent = data.name || 'Barber shop';
      renderHeaderIcon(data.icon || '');
      $('site-about').textContent = data.about || '';
      var foot = [];
      if (data.address) foot.push(esc(data.address));
      if (data.phone) foot.push(esc(data.phone));
      if (data.hours) foot.push(esc(data.hours));
      var firstLine = foot.join(' · ');
      $('site-footer').innerHTML = (firstLine ? '<div>' + firstLine + '</div>' : '') +
        '<div>Powered by Yently</div>';
      updateBadges();
      mountShopChatBubble(data.name, data.email);
      rpc('barbershop_pass_status', { p_slug: SLUG }).then(function (s) {
        empUnlocked = (s !== 'locked');
        renderBook();
      }).catch(function () {
        /* If the status check itself is unreachable, stay open rather
           than locking everyone out of a working shop. */
        empUnlocked = true;
        renderBook();
      });
    }).catch(function () {
      $('site-name').textContent = 'Shop not found';
      $('view-book').innerHTML = '<div class="error">This link doesn\'t point to a barber shop yet. Check the link and try again.</div>';
    });
  }
})();
