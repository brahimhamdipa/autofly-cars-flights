/* Barbers page app — ONE folder for every barber shop.
   The shop comes from the link (?s=<slug>), and its services, info,
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

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null; // live services/info (visitors)
  var draft = null; // staff draft (Setup)
  var draftStatus = 'editing';
  var staffCreds = null; // {u, p} in memory only, never stored
  var empPass = null; // employee password in memory only, never stored
  var empUnlocked = false; // true once the employee password is entered, or when the shop has none set
  var bookings = []; // employee view (full details)
  var serving = []; // public Serving Now rows (initials only)
  var bookingsTimer = null;
  var servingTimer = null;
  var servingClock = null;
  var currentView = 'book';

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

  /* ---------- Staff sign-in (owner, Setup only) ---------- */
  function staffUnlocked() { return !!staffCreds; }
  function renderStaffLogin(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the username and password AutoFly gave this shop.</p>' +
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
    var html = info + '<h2>Services</h2>';
    if (services.length === 0) {
      html += '<p class="info">No services listed yet — check back soon.</p>';
    } else {
      html += '<div class="menu-grid">';
      services.forEach(function (s) {
        html += '<div class="menu-item"><h3>' + esc(s.name) + '</h3>' +
          (s.description ? '<div class="desc">' + esc(s.description) + '</div>' : '') +
          '<div class="row"><span class="price">' + money(s.price) + '</span>' +
          '<span class="info">' + (s.duration ? s.duration + ' min' : '') + '</span></div></div>';
      });
      html += '</div>';
    }
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
        '<button class="danger" data-cancel="' + b.id + '">Cancel</button></div></div>';
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
        if (!window.confirm('Cancel this booking?')) return;
        update(btn.getAttribute('data-cancel'), 'cancelled', null);
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
    if (draftStatus === 'pending') return 'Your changes were sent to AutoFly and are waiting for approval. Visitors still see the approved services.';
    if (draftStatus === 'approved') return 'Your last upload was approved and is now live.';
    return 'Your changes are saved as a draft. Visitors still see the approved services until you upload and AutoFly approves.';
  }
  function renderSetup() {
    var el = $('view-setup');
    function field(label, id, value, type) {
      return '<label>' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '">';
    }
    var html = '<h2>Setup</h2>' +
      '<div class="note">' + esc(statusLine()) + '</div>' +
      '<div class="card">' +
      field('Shop name', 'setup-name', draft.name) +
      field('About text', 'setup-about', draft.about) +
      field('Phone', 'setup-phone', draft.phone) +
      field('Email', 'setup-email', draft.email, 'email') +
      field('Address', 'setup-address', draft.address) +
      field('Hours', 'setup-hours', draft.hours) +
      '</div><h2>Services</h2><div id="setup-services"></div>' +
      '<button id="setup-add" class="secondary">+ Add service</button>' +
      '<div class="row" style="margin-top:16px"><button id="setup-save" class="secondary">Save draft</button>' +
      '<button id="setup-upload">Upload for approval</button></div>' +
      '<div id="setup-out" style="margin-top:12px"></div>';
    el.innerHTML = html;
    var listEl = $('setup-services');
    function serviceRow(s, i) {
      var row = document.createElement('div');
      row.className = 'card';
      row.innerHTML =
        '<label>Service name</label><input data-f="name" value="' + esc(s.name) + '">' +
        '<label>Price</label><input data-f="price" type="number" step="0.01" min="0" value="' + esc(s.price) + '">' +
        '<label>Duration in minutes</label><input data-f="duration" type="number" min="0" value="' + esc(s.duration == null ? '' : s.duration) + '">' +
        '<label>Description</label><input data-f="description" value="' + esc(s.description || '') + '">' +
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
      return row;
    }
    function drawServices() {
      listEl.innerHTML = '';
      draft.services.forEach(function (s, i) { listEl.appendChild(serviceRow(s, i)); });
    }
    drawServices();
    $('setup-add').addEventListener('click', function () {
      draft.services.push({ name: 'New service', price: 0, duration: 30, description: '' });
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
        out.innerHTML = '<p class="info">Uploaded! Your changes were sent to AutoFly and are waiting for approval. We will confirm once they are live.</p>';
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
    $('view-book').innerHTML = '<div class="error">This link doesn\'t point to a barber shop. Check the link and try again — a shop link looks like autofly.us.com/barbers?s=your-shop.</div>';
  } else {
    rpc('get_barbershop_live', { p_slug: SLUG }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.services = data.services || [];
      document.title = data.name || 'Barber shop';
      var logo = $('site-logo');
      if (data.logo) { logo.src = (/^https?:\/\//.test(data.logo) ? data.logo : BASE + data.logo); logo.hidden = false; }
      $('site-name').textContent = data.name || 'Barber shop';
      $('site-about').textContent = data.about || '';
      var foot = [];
      if (data.address) foot.push(esc(data.address));
      if (data.phone) foot.push(esc(data.phone));
      if (data.hours) foot.push(esc(data.hours));
      var firstLine = foot.join(' · ');
      $('site-footer').innerHTML = (firstLine ? '<div>' + firstLine + '</div>' : '') +
        '<div>Powered by AutoFly</div>';
      updateBadges();
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
