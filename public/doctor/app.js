/* Doctor page app — ONE folder for every clinic.
   The clinic comes from its own private link, and its info,
   doctors, and appointments live in the database — there is no data.json
   file here. Every clinic has its own doctors and appointments, but
   they all use this same page.
   Visitors browse the doctors, see the fee and visit length, and book
   an appointment. This page books appointments only — it does not
   diagnose, treat, or give medical advice, and no payment is taken
   online: you pay at the clinic. Appointments are emailed to Yently.
   The Bookings tab needs the clinic's shared employee password
   (one password for all staff, set by the admin; clinics with
   none set stay fully open). Setup needs the owner's own username +
   password. Setup edits save as a draft, and the Upload button sends
   the draft to the admin for approval — approval makes it live
   instantly. Doctors are different: the owner adds, edits, and
   deletes doctors live in Setup, no approval needed. All credentials
   live in memory only: a reload asks again, exactly like the dealer,
   diner, barbershop, and POS pages. */
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
  var SLUG = String(params.doc || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
  var SLUG_FROM_PATH = false;
  var slugResolved = false;
  if (!SLUG) {
    // Clean link (yently.com/<slug>): the middleware rewrites the
    // page server-side, so location.search is empty in the browser.
    // The shop slug is then the last path segment. Ignore this
    // system's own folder name, so a bare /doctor visit still
    // shows "not found" by design.
    var segs = location.pathname.split('/').filter(function (s) { return s; });
    var lastSeg = (segs[segs.length - 1] || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    if (lastSeg && lastSeg !== 'doctor') { SLUG = lastSeg; SLUG_FROM_PATH = true; }
  }
  // Clean link (yently.com/<slug>): the name in the link is the CLEAN
  // name, which usually differs from the shop's own slug. The middleware
  // rewrites the page, but the browser address stays clean, so look the
  // clean name up in clean_links (public read) and use the real shop
  // slug. Only runs when the slug came from the path (no ?doc= query).
  // Fails open: any error keeps the path slug, and the shop just shows
  // "not found" as before.
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

  var SPECIALTIES = ['General Practice', 'Cardiology', 'Pediatrics', 'Dermatology', 'Other'];

  var clinic = null; // live clinic info + doctors (visitors)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var ownerCreds = null; // {u, p} in memory only, never stored
  var empPass = null; // employee password in memory only, never stored
  var empUnlocked = false; // true once the employee password is entered, or when the clinic has none set
  var passLocked = false;
  var bookings = [];
  var bookingsTimer = null;
  var currentView = 'doctors';
  var doctorEditId = null; // doctor being edited in Setup, null = adding
  var cancelConfirmId = null; // booking id awaiting an in-page cancel confirmation
  var bookingsErr = ''; // last bookings error, shown inline above the list
  var delConfirmId = null; // doctor id awaiting an in-page delete confirmation
  var pendingBookDoctorId = null; // doctor to preselect in Book

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* Amounts use thousands separators: $1,200, not $1200.00. Whole
     amounts stay plain ($80); amounts with cents show two decimals. */
  function money(n) {
    var v = Number(n || 0);
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  }
  function fmtDT(iso) {
    var d = new Date(iso);
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function todayLocal() {
    var d = new Date();
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
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
  /* Best-effort owner email, same shape as the dealer page: the
     table differs per call (appointment, draft approval). */
  function notifyEmail(subject, table, record) {
    try {
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ subject: subject, table: table, record: record })
      }).catch(function () {});
    } catch (e) {}
  }
  /* ---------- "?" help popups (request forms) ---------- */
  /* Same pattern as the Direct Upload form on the main site: a small
     "?" next to a field label opens a short explanation under the
     label; tap again, or anywhere else, to close it. The popup is
     anchored to the field label (see .direct-help in style.css), so
     it can never run past the page edge and zoom the page on a phone. */
  function helpHtml(text) {
    return '<span class="help"><button type="button" class="help-btn" aria-label="Help">?</button>' +
      '<span class="help-pop" hidden>' + esc(text) + '</span></span>';
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest('.help-btn');
    if (btn) {
      var pop = btn.parentNode.querySelector('.help-pop');
      var wasHidden = pop ? pop.hidden : true;
      document.querySelectorAll('.help-pop').forEach(function (p) { p.hidden = true; });
      if (pop) pop.hidden = !wasHidden;
      return;
    }
    if (!t.closest('.help')) {
      document.querySelectorAll('.help-pop').forEach(function (p) { p.hidden = true; });
    }
  });
  /* ---------- Icon picture (one small square image) ---------- */
  /* The icon lives in the draft/live data as `icon` — a public URL or ''.
     It is uploaded to the product-images bucket, shrunk to 200px on its
     long edge first (same rules as the shop picture uploads: JPEG 0.8,
     PNGs stay PNG, small pictures untouched, any failure falls back to
     the original file). Same pattern as the dealer, POS, diner,
     barbershop, and employee pages. */
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
      var out = $('setup-icon-out');
      if (out) out.textContent = 'Icon removed — save the draft to keep it removed.';
      var file = $('setup-icon-file');
      if (file) file.value = '';
    });
  }
  function doctorById(id) {
    return (clinic.doctors || []).filter(function (d) { return String(d.id) === String(id); })[0] || null;
  }
  function loadClinic() {
    return rpc('get_doctor_live', { p_slug: SLUG }).then(function (d) {
      clinic = d;
      setHeader();
      return d;
    });
  }

  /* ---------- views ---------- */
  function show(view) {
    currentView = view;
    ['doctors', 'book', 'bookings', 'setup'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.hidden = v !== view;
    });
    var tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    if (bookingsTimer) { clearInterval(bookingsTimer); bookingsTimer = null; }
    if (view === 'doctors') renderDoctors();
    if (view === 'book') renderBook();
    if (view === 'bookings') { renderBookings(); bookingsTimer = setInterval(function () { if (currentView === 'bookings' && empUnlocked) loadBookings(true); }, 5000); }
    if (view === 'setup') renderSetup();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
  });
  $('to-top').addEventListener('click', function () { window.scrollTo(0, 0); });

  function setHeader() {
    $('site-name').textContent = clinic ? clinic.name : 'Doctor';
    renderHeaderIcon(clinic && clinic.icon ? clinic.icon : '');
    $('site-about').textContent = clinic
      ? [clinic.address, clinic.phone].filter(Boolean).join(' · ')
      : '';
    $('site-footer').innerHTML = clinic
      ? esc([clinic.address, clinic.phone].filter(Boolean).join(' · ')) + '<br>Powered by Yently'
      : 'Powered by Yently';
    document.title = (clinic ? clinic.name : 'Doctor') + ' — Doctor booking';
  }

  /* ---------- Doctors (public list) ---------- */
  function renderDoctors() {
    var el = $('view-doctors');
    if (!clinic) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var h = '<h2>' + esc(clinic.name) + '</h2>';
    if (clinic.about) h += '<p class="info">' + esc(clinic.about) + '</p>';
    if (clinic.address || clinic.phone || clinic.hours) {
      h += '<div class="card info">';
      if (clinic.address) h += '<p>📍 ' + esc(clinic.address) + '</p>';
      if (clinic.phone) h += '<p>📞 ' + esc(clinic.phone) + '</p>';
      if (clinic.hours) h += '<p>🕐 ' + esc(clinic.hours) + '</p>';
      h += '</div>';
    }
    var doctors = clinic.doctors || [];
    if (!doctors.length) {
      h += '<div class="card"><p class="info">No doctors listed yet — the owner adds doctors in Setup.</p></div>';
      el.innerHTML = h;
      return;
    }
    h += '<div class="item-grid">';
    doctors.forEach(function (d) {
      h += '<div class="item-card">' +
        '<span class="cat">' + esc(d.specialty || 'Other') + '</span>' +
        '<h3>' + esc(d.name) + '</h3>' +
        (d.description ? '<p class="info">' + esc(d.description) + '</p>' : '') +
        '<span class="price">' + money(d.price) + '</span>' +
        '<span class="stock">about ' + esc(d.duration) + ' min</span>' +
        '<div class="row"><button data-book="' + d.id + '">Book with this doctor</button></div>' +
        '</div>';
    });
    h += '</div>';
    h += '<div class="card"><p class="info">Pick a doctor above, or book from the <b>Book</b> tab. Pay at the clinic — no payment is taken online, and this page does not give medical advice.</p></div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-book]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pendingBookDoctorId = Number(btn.getAttribute('data-book'));
        show('book');
      });
    });
  }

  /* ---------- Book (public form) ---------- */
  function timeOptions() {
    var h = '';
    ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM', '6:00 PM'].forEach(function (t) {
      h += '<option value="' + t + '">' + t + '</option>';
    });
    return h;
  }
  function renderBook() {
    var el = $('view-book');
    if (!clinic) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var doctors = clinic.doctors || [];
    var h = '<h2>Book an appointment — ' + esc(clinic.name) + '</h2><div class="card direct-help">' +
      '<div class="note">Pay at the clinic. Booking here reserves your appointment — no payment is taken online, and this page does not give medical advice.</div>' +
      '<span class="field-label">Doctor ' + helpHtml('Pick the doctor you want to see. The fee and visit length are shown next to each name.') + '</span>' +
      '<select id="bk-doctor">' +
      (doctors.length
        ? doctors.map(function (d) { return '<option value="' + d.id + '"' + (String(pendingBookDoctorId) === String(d.id) ? ' selected' : '') + '>' + esc(d.name) + ' — ' + esc(d.specialty || 'Other') + ' — ' + money(d.price) + '</option>'; }).join('')
        : '<option value="">No doctors yet</option>') +
      '</select>' +
      '<span class="field-label">Your name ' + helpHtml('Your full name, so the clinic knows who the appointment is for.') + '</span>' +
      '<input id="bk-name" type="text" placeholder="Full name">' +
      '<span class="field-label">Phone ' + helpHtml('A phone number the clinic can reach you on to confirm or change the appointment.') + '</span>' +
      '<input id="bk-phone" type="tel" placeholder="Phone number">' +
      '<span class="field-label">Your email (optional) ' + helpHtml('Optional — the clinic can send you a confirmation here.') + '</span>' +
      '<input id="bk-email" type="email" placeholder="Email address">' +
      '<span class="field-label">Date ' + helpHtml('Pick the day you want to come in.') + '</span>' +
      '<input id="bk-date" type="date" value="' + todayLocal() + '">' +
      '<span class="field-label">Time ' + helpHtml('Pick a time that suits you. The clinic confirms the exact time.') + '</span>' +
      '<select id="bk-time">' + timeOptions() + '</select>' +
      '<span class="field-label">Reason for visit (optional) ' + helpHtml('Optional — a short reason for your visit, so the doctor is ready.') + '</span>' +
      '<textarea id="bk-note" rows="3"></textarea>' +
      '<div class="row"><button id="bk-go">Confirm booking</button></div>' +
      '<p class="error" id="bk-err" hidden></p>' +
      '<div id="bk-out" style="margin-top:12px"></div></div>';
    el.innerHTML = h;
    pendingBookDoctorId = null;
    $('bk-go').addEventListener('click', function () {
      var err = $('bk-err');
      var out = $('bk-out');
      var d = doctorById($('bk-doctor').value);
      var name = $('bk-name').value.trim();
      var phone = $('bk-phone').value.trim();
      var email = $('bk-email').value.trim();
      var date = $('bk-date').value;
      var time = $('bk-time').value;
      var note = $('bk-note').value.trim();
      if (!d) { err.hidden = false; err.textContent = 'Pick a doctor first.'; return; }
      if (!name) { err.hidden = false; err.textContent = 'Your name is required.'; return; }
      if (!phone) { err.hidden = false; err.textContent = 'Your phone number is required.'; return; }
      if (!date) { err.hidden = false; err.textContent = 'Pick a date.'; return; }
      if (!time) { err.hidden = false; err.textContent = 'Pick a time.'; return; }
      err.hidden = true;
      rpc('place_doctor_appointment', { p_slug: SLUG, p_doctor: d.name, p_name: name, p_phone: phone, p_email: email, p_date: date, p_time: time, p_note: note }).then(function (res) {
        var bid = (res && typeof res === 'object') ? (res.id != null ? res.id : res.booking_id) : res;
        var ref = 'AP-' + String(bid).padStart(6, '0');
        out.innerHTML = '<div class="receipt"><h3>Booking confirmed</h3>' +
          '<p><strong>Reference:</strong> ' + esc(ref) + '<br>' +
          '<strong>Doctor:</strong> ' + esc(d.name) + ' — ' + money(d.price) + ' (about ' + esc(d.duration) + ' min)<br>' +
          '<strong>When:</strong> ' + esc(date) + ' at ' + esc(time) + '<br>' +
          '<strong>Name:</strong> ' + esc(name) + '<br>' +
          '<strong>Phone:</strong> ' + esc(phone) + '</p>' +
          '<p class="hint">Pay at the clinic. Find this booking any time in the Bookings tab.</p>' +
          '<p id="bk-mail" class="hint">Sending the clinic a copy…</p></div>';
        notifyEmail('Doctor appointment: ' + d.name, 'doctor_booking', { slug: SLUG, name: name, phone: phone, email: email, doctor: d.name, date: date, time: time, note: note });
      }).catch(function (e) {
        err.hidden = false;
        err.textContent = 'Error: ' + e.message;
      });
    });
  }

  /* ---------- Bookings (employee password) ---------- */
  function empGate(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the employee password for this clinic to see bookings.</p>' +
      '<label>Employee password</label><input id="emp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="emp-go">Unlock</button></div>' +
      '<p class="error" id="emp-err" hidden></p></div>';
    $('emp-go').addEventListener('click', function () {
      var pw = $('emp-pass').value;
      rpc('check_doctor_employee_pass', { p_slug: SLUG, p_password: pw }).then(function (ok) {
        if (!ok) {
          var e = $('emp-err');
          e.hidden = false;
          e.textContent = 'Wrong employee password.';
          return;
        }
        empPass = pw;
        empUnlocked = true;
        after();
      }).catch(function (err) {
        var e = $('emp-err');
        e.hidden = false;
        e.textContent = 'Error: ' + err.message;
      });
    });
  }
  function loadBookings(quiet) {
    return rpc('list_doctor_bookings', { p_slug: SLUG, p_epass: empPass }).then(function (d) {
      bookings = d || [];
      if (currentView === 'bookings') renderBookingsList();
      return bookings;
    }).catch(function (e) { if (!quiet) throw e; });
  }
  function renderBookings() {
    var el = $('view-bookings');
    if (!clinic) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Bookings', renderBookings); return; }
    el.innerHTML = '<h2>Bookings — ' + esc(clinic.name) + '</h2><p class="info">Appointments refresh on their own every few seconds.</p><div id="bookings-list"><p class="info">Loading…</p></div>';
    loadBookings().catch(function (e) {
      var l = $('bookings-list');
      if (l) l.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  function bookingDetails(b) {
    var d = b.data || {};
    var lines = [];
    if (d.doctor) lines.push('Doctor: <b>' + esc(d.doctor) + '</b>');
    if (d.date) lines.push('When: ' + esc(d.date) + (d.time ? ' at ' + esc(d.time) : ''));
    if (d.name) lines.push('<b>' + esc(d.name) + '</b>');
    if (d.phone) lines.push('Phone: ' + esc(d.phone));
    if (d.email) lines.push('Email: ' + esc(d.email));
    if (d.note) lines.push('Reason: ' + esc(d.note));
    return lines.join('<br>');
  }
  function renderBookingsList() {
    var el = $('bookings-list');
    if (!el) return;
    if (!bookings.length) { el.innerHTML = '<div class="card"><p class="info">No bookings yet.</p></div>'; return; }
    var h = '';
    if (bookingsErr) h += '<p class="error">' + esc(bookingsErr) + '</p>';
    bookings.forEach(function (b) {
      h += '<div class="card"><h3>Appointment #' + esc(b.id) +
        (b.status && b.status !== 'active' ? ' <span class="voided">(' + esc(b.status) + ')</span>' : '') + '</h3>' +
        '<p class="info">' + esc(fmtDT(b.created_at)) + '</p>' +
        '<p>' + bookingDetails(b) + '</p>' +
        (b.status === 'active'
          ? (cancelConfirmId === b.id
            ? '<p><b>Cancel this booking?</b></p><div class="row"><button class="small danger" data-cancel-yes="' + b.id + '" data-kind="appointment">Yes, cancel</button><button class="small secondary" data-cancel-no="' + b.id + '">Keep it</button></div>'
            : '<div class="row"><button class="small" data-done="' + b.id + '" data-kind="appointment">Mark done</button><button class="small danger" data-cancel="' + b.id + '" data-kind="appointment">Cancel</button></div>')
          : '') +
        '</div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-done]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-done'));
        var kind = btn.getAttribute('data-kind');
        btn.disabled = true;
        rpc('update_doctor_booking', { p_slug: SLUG, p_epass: empPass, p_kind: kind, p_id: id, p_status: 'done' })
          .then(function () { bookingsErr = ''; return loadBookings(); })
          .catch(function (e) { bookingsErr = 'Error: ' + e.message; renderBookingsList(); });
      });
    });
    el.querySelectorAll('[data-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        cancelConfirmId = Number(btn.getAttribute('data-cancel'));
        bookingsErr = '';
        renderBookingsList();
      });
    });
    el.querySelectorAll('[data-cancel-no]').forEach(function (btn) {
      btn.addEventListener('click', function () { cancelConfirmId = null; renderBookingsList(); });
    });
    el.querySelectorAll('[data-cancel-yes]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-cancel-yes'));
        var kind = btn.getAttribute('data-kind');
        btn.disabled = true;
        rpc('update_doctor_booking', { p_slug: SLUG, p_epass: empPass, p_kind: kind, p_id: id, p_status: 'cancelled' })
          .then(function () { cancelConfirmId = null; bookingsErr = ''; return loadBookings(); })
          .catch(function (e) { cancelConfirmId = null; bookingsErr = 'Error: ' + e.message; renderBookingsList(); });
      });
    });
  }

  /* ---------- Setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    if (!clinic) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (!ownerCreds) {
      el.innerHTML = '<h2>Setup</h2><div class="card">' +
        '<p class="info">Enter the username and password Yently gave this clinic.</p>' +
        '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
        '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
        '<div class="row"><button id="st-go">Log in</button></div>' +
        '<p class="error" id="st-err" hidden></p></div>';
      $('st-go').addEventListener('click', function () {
        var u = $('st-user').value.trim();
        var p = $('st-pass').value;
        rpc('check_doctor_login', { p_slug: SLUG, p_u: u, p_p: p }).then(function (ok) {
          if (!ok) {
            var e = $('st-err');
            e.hidden = false;
            e.textContent = 'Wrong username or password.';
            return;
          }
          ownerCreds = { u: u, p: p };
          loadDraft();
        }).catch(function (err) {
          var e = $('st-err');
          e.hidden = false;
          e.textContent = 'Error: ' + err.message;
        });
      });
      return;
    }
    if (!draft) {
      el.innerHTML = '<p class="info">Loading your setup…</p>';
      loadDraft();
      return;
    }
    var specOpts = function (sel) {
      return SPECIALTIES.map(function (s) {
        return '<option value="' + esc(s) + '"' + (s === sel ? ' selected' : '') + '>' + esc(s) + '</option>';
      }).join('');
    };
    var h = '<h2>Setup — ' + esc(clinic.name) + '</h2>' +
      '<div class="card"><h3>Clinic details</h3>' +
      '<p class="info">Changes save as a draft. Upload for approval and the admin makes them live.</p>' +
      '<label>Clinic name</label><input id="d-name" type="text" value="' + esc(draft.name || '') + '">' +
      '<label>Icon picture</label>' +
      '<div class="icon-field">' +
      '<img id="setup-icon-preview" class="icon-preview" src="' + esc(draft.icon || '') + '" alt=""' + (draft.icon ? '' : ' hidden') + '>' +
      '<input id="setup-icon-file" type="file" accept="image/*">' +
      '<button type="button" id="setup-icon-remove" class="small secondary">Remove icon</button>' +
      '</div>' +
      '<p class="info" id="setup-icon-out">One small picture shown next to the clinic name. It is shrunk to 200px before uploading.</p>' +
      '<label>Address</label><input id="d-address" type="text" value="' + esc(draft.address || '') + '">' +
      '<label>Phone</label><input id="d-phone" type="tel" value="' + esc(draft.phone || '') + '">' +
      '<label>Hours</label><input id="d-hours" type="text" value="' + esc(draft.hours || '') + '">' +
      '<label>About</label><textarea id="d-about">' + esc(draft.about || '') + '</textarea>' +
      '<div class="row"><button id="d-save">Save draft</button>' +
      '<button id="d-upload" class="secondary">Upload for approval</button></div>' +
      '<p class="info" id="d-status">Draft status: ' + esc(draftStatus) + (draftStatus === 'pending' ? ' — waiting for Yently to approve it.' : draftStatus === 'approved' ? ' — approved, live now.' : ' — not sent yet.') + '</p>' +
      '<p class="error" id="d-err" hidden></p></div>' +
      '<div class="card"><h3>Doctors</h3>' +
      '<p class="info">Doctors go live right away — no approval needed.</p>' +
      '<div id="doctors-list"></div>' +
      '<h3 id="doctor-form-title">Add a doctor</h3>' +
      '<label>Doctor name</label><input id="dc-name" type="text" placeholder="e.g. Dr. Robin Fox">' +
      '<label>Specialty</label><select id="dc-spec">' + specOpts('Other') + '</select>' +
      '<label>Consultation fee ($)</label><input id="dc-price" type="number" min="0" step="0.01" inputmode="decimal">' +
      '<label>Duration (minutes)</label><input id="dc-dur" type="number" min="1" step="1" inputmode="numeric" value="30">' +
      '<label>Description</label><textarea id="dc-desc"></textarea>' +
      '<div class="row"><button id="dc-save">Save doctor</button>' +
      '<button id="dc-cancel" class="secondary" hidden>Cancel edit</button></div>' +
      '<p class="error" id="dc-err" hidden></p></div>';
    el.innerHTML = h;
    renderDoctorsList();
    $('d-save').addEventListener('click', function () { saveDraft(false); });
    $('d-upload').addEventListener('click', function () { saveDraft(true); });
    $('dc-save').addEventListener('click', saveDoctor);
    $('dc-cancel').addEventListener('click', function () { doctorEditId = null; renderSetup(); });
    wireIconField();
  }
  function renderDoctorsList() {
    var el = $('doctors-list');
    if (!el) return;
    var doctors = clinic.doctors || [];
    if (!doctors.length) { el.innerHTML = '<p class="info">No doctors yet.</p>'; return; }
    var h = '';
    doctors.forEach(function (d) {
      h += '<div class="cart-line"><div><b>' + esc(d.name) + '</b><br><span class="info">' + esc(d.specialty || 'Other') + ' · ' + money(d.price) + ' · about ' + esc(d.duration) + ' min</span></div>' +
        '<div class="row"><button class="small secondary" data-edit="' + d.id + '">Edit</button>' +
        (delConfirmId === d.id
          ? '<span><b>Delete "' + esc(d.name) + '"?</b> <button class="small danger" data-del-yes="' + d.id + '">Yes, delete</button> <button class="small secondary" data-del-no="' + d.id + '">Keep it</button></span>'
          : '<button class="small danger" data-del="' + d.id + '">Delete</button>') + '</div></div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = doctorById(Number(b.getAttribute('data-edit')));
        if (!d) return;
        doctorEditId = d.id;
        $('dc-name').value = d.name || '';
        $('dc-spec').value = d.specialty || 'Other';
        $('dc-price').value = d.price == null ? '' : d.price;
        $('dc-dur').value = d.duration == null ? '' : d.duration;
        $('dc-desc').value = d.description || '';
        $('doctor-form-title').textContent = 'Edit doctor — ' + d.name;
        $('dc-cancel').hidden = false;
        window.scrollTo(0, document.getElementById('doctor-form-title').offsetTop - 80);
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        delConfirmId = Number(b.getAttribute('data-del'));
        renderDoctorsList();
      });
    });
    el.querySelectorAll('[data-del-no]').forEach(function (b) {
      b.addEventListener('click', function () { delConfirmId = null; renderDoctorsList(); });
    });
    el.querySelectorAll('[data-del-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = doctorById(Number(b.getAttribute('data-del-yes')));
        if (!d) return;
        b.disabled = true;
        rpc('delete_doctor', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_doctor_id: d.id })
          .then(function () { delConfirmId = null; return loadClinic(); })
          .then(function () { renderSetup(); })
          .catch(function (e) { delConfirmId = null; renderDoctorsList(); var er = $('dc-err'); if (er) { er.hidden = false; er.textContent = 'Error: ' + e.message; } });
      });
    });
  }
  function collectDraft() {
    return {
      name: $('d-name').value.trim(),
      address: $('d-address').value.trim(),
      phone: $('d-phone').value.trim(),
      hours: $('d-hours').value.trim(),
      about: $('d-about').value.trim(),
      icon: draft.icon || ''
    };
  }
  function saveDraft(upload) {
    var d = collectDraft();
    var err = $('d-err');
    if (!d.name) { err.hidden = false; err.textContent = 'Clinic name is required.'; return; }
    err.hidden = true;
    rpc('save_doctor_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_draft: d })
      .then(function () {
        draft = d;
        draftStatus = 'editing';
        if (!upload) {
          $('d-status').textContent = 'Draft status: editing — saved, not sent yet.';
          return;
        }
        return rpc('submit_doctor_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p }).then(function () {
          draftStatus = 'pending';
          $('d-status').textContent = 'Draft status: pending — waiting for Yently to approve it.';
          notifyEmail('Doctor draft for approval: ' + d.name, 'doctor_draft', { slug: SLUG, name: d.name });
        });
      })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function collectDoctor() {
    var price = $('dc-price').value.trim();
    var dur = $('dc-dur').value.trim();
    return {
      name: $('dc-name').value.trim(),
      specialty: $('dc-spec').value,
      price: price === '' ? 0 : Number(price),
      duration: dur === '' ? 30 : Math.floor(Number(dur)),
      description: $('dc-desc').value.trim()
    };
  }
  function saveDoctor() {
    var err = $('dc-err');
    var d = collectDoctor();
    if (!d.name) { err.hidden = false; err.textContent = 'Doctor name is required.'; return; }
    if (!(d.price >= 0)) { err.hidden = false; err.textContent = 'Price must be 0 or more.'; return; }
    err.hidden = true;
    if (doctorEditId) d.id = doctorEditId;
    rpc('save_doctor', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_doctor: d })
      .then(function () { doctorEditId = null; return loadClinic(); })
      .then(function () { renderSetup(); })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function loadDraft() {
    rpc('get_doctor_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p })
      .then(function (d) {
        draft = d || {};
        draftStatus = 'editing';
        renderSetup();
      })
      .catch(function (e) {
        var el = $('view-setup');
        el.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
      });
  }

  /* ---------- start ---------- */
  function init() {
    if (!SLUG) {
      $('site-name').textContent = 'Doctor';
      $('view-doctors').innerHTML = '<div class="card"><h2>Doctor not found</h2><p class="info">This clinic page needs your own clinic link — ask Yently for it.</p></div>';
      return;
    }
    loadClinic().then(function (d) {
      if (!d) {
        $('site-name').textContent = 'Doctor';
        $('view-doctors').innerHTML = '<div class="card"><h2>Doctor not found</h2><p class="info">No clinic with this link yet. Ask Yently to set it up.</p></div>';
        return;
      }
      return rpc('doctor_pass_status', { p_slug: SLUG }).then(function (st) {
        passLocked = st === 'locked';
        empUnlocked = !passLocked;
        renderDoctors();
      });
    }).catch(function (e) {
      $('view-doctors').innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  resolveSlug().then(function () { init(); });
})();
