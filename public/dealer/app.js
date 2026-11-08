/* Dealer page app — ONE folder for every dealership.
   The dealership comes from its own private link, and its info,
   vehicles, and bookings live in the database — there is no data.json
   file here. Every dealership has its own vehicles and bookings, but
   they all use this same page.
   Visitors browse the vehicles, estimate financing, book a test drive,
   or ask for a valuation on their own car. The Finance tab is an
   estimate only — no credit check happens here and no financing is
   arranged online. Test drives and trade-ins are emailed to AutoFly.
   The Bookings tab needs the dealership's shared employee password
   (one password for all staff, set by the admin; dealerships with
   none set stay fully open). Setup needs the owner's own username +
   password. Setup edits save as a draft, and the Upload button sends
   the draft to the admin for approval — approval makes it live
   instantly. Vehicles are different: the owner adds, edits, and
   deletes vehicles live in Setup, no approval needed. All credentials
   live in memory only: a reload asks again, exactly like the diner,
   barbershop, and POS pages. */
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
  var SLUG = String(params.d || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var dealer = null; // live dealership info + vehicles (visitors)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var ownerCreds = null; // {u, p} in memory only, never stored
  var empPass = null; // employee password in memory only, never stored
  var empUnlocked = false; // true once the employee password is entered, or when the dealership has none set
  var passLocked = false;
  var bookings = [];
  var bookingsTimer = null;
  var currentView = 'vehicles';
  var vehicleEditId = null; // vehicle being edited in Setup, null = adding
  var cancelConfirmId = null; // booking id awaiting an in-page cancel confirmation
  var bookingsErr = ''; // last bookings error, shown inline above the list
  var delConfirmId = null; // vehicle id awaiting an in-page delete confirmation
  var vehicleSearch = ''; // public vehicles search text, kept while typing
  var slideIdx = {}; // vehicle id -> current slideshow picture index
  var detailVehicleId = null; // vehicle id shown in the details popup
  var pendingTestDriveVehicleId = null; // vehicle to preselect in Test Drive
  var vehiclePics = []; // picture URLs for the vehicle being added/edited in Setup

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* Vehicle and finance amounts use thousands separators: $16,500, not
     $16500.00. Whole amounts stay plain ($3); amounts with cents show
     two decimals ($345.44, $312.50). */
  function money(n) {
    var v = Number(n || 0);
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function fmtNum(n) { return Number(n || 0).toLocaleString('en-US'); }
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
  /* Best-effort owner email, same shape as the diner and POS pages: the
     table differs per call (test drive, trade-in, draft approval). */
  function notifyEmail(subject, table, record) {
    try {
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ subject: subject, table: table, record: record })
      }).catch(function () {});
    } catch (e) {}
  }
  /* ---------- Icon picture (one small square image) ---------- */
  /* The icon lives in the draft/live data as `icon` — a public URL or ''.
     It is uploaded to the product-images bucket, shrunk to 200px on its
     long edge first (same rules as the shop picture uploads: JPEG 0.8,
     PNGs stay PNG, small pictures untouched, any failure falls back to
     the original file). Same pattern as the POS, diner, barbershop, and
     employee pages. */
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
  function vehicleById(id) {
    return (dealer.vehicles || []).filter(function (v) { return String(v.id) === String(id); })[0] || null;
  }
  function vehicleLabel(v) {
    return [v.year, v.make, v.model].filter(function (x) { return x !== '' && x != null; }).join(' ');
  }
  function loadDealer() {
    return rpc('get_dealer_live', { p_slug: SLUG }).then(function (d) {
      dealer = d;
      setHeader();
      return d;
    });
  }

  /* ---------- views ---------- */
  function show(view) {
    currentView = view;
    ['vehicles', 'testdrive', 'sell', 'finance', 'bookings', 'setup'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.hidden = v !== view;
    });
    var tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    if (bookingsTimer) { clearInterval(bookingsTimer); bookingsTimer = null; }
    if (view === 'vehicles') renderVehicles();
    if (view === 'testdrive') renderTestDrive();
    if (view === 'sell') renderSell();
    if (view === 'finance') renderFinance();
    if (view === 'bookings') { renderBookings(); bookingsTimer = setInterval(function () { if (currentView === 'bookings' && empUnlocked) loadBookings(true); }, 5000); }
    if (view === 'setup') renderSetup();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
  });
  $('to-top').addEventListener('click', function () { window.scrollTo(0, 0); });

  function setHeader() {
    $('site-name').textContent = dealer ? dealer.name : 'Dealer';
    renderHeaderIcon(dealer && dealer.icon ? dealer.icon : '');
    $('site-about').textContent = dealer
      ? [dealer.address, dealer.phone].filter(Boolean).join(' · ')
      : '';
    $('site-footer').innerHTML = dealer
      ? esc([dealer.address, dealer.phone].filter(Boolean).join(' · ')) + '<br>Powered by AutoFly'
      : 'Powered by AutoFly';
    document.title = (dealer ? dealer.name : 'Dealer') + ' — Car Dealership';
  }

  /* ---------- Vehicles (public inventory) ---------- */
  function vehiclePicsOf(v) { return (v && Array.isArray(v.pics)) ? v.pics : []; }
  function vehicleMatches(v, q) {
    if (!q) return true;
    var hay = [v.make, v.model, v.year, v.price, money(v.price), v.stock_no, v.description]
      .map(function (x) { return String(x == null ? '' : x).toLowerCase(); }).join(' ');
    return hay.indexOf(q) !== -1;
  }
  /* One picture shows static, 2+ get ‹ › arrows and a "1 of N" counter,
     none gets a plain grey placeholder block. The arrows keep their
     position per vehicle in slideIdx, so flipping through one car does
     not reset the others. */
  function vehicleSlideshowHtml(v) {
    var pics = vehiclePicsOf(v);
    if (!pics.length) return '<div class="slideshow"><div class="slide-empty">No picture yet</div></div>';
    var idx = slideIdx[v.id] || 0;
    if (idx >= pics.length) idx = 0;
    var h = '<div class="slideshow"><img class="slide-img" src="' + esc(pics[idx]) + '" alt="' + esc(vehicleLabel(v)) + '">';
    if (pics.length > 1) {
      h += '<button class="slide-btn prev" data-slide-prev="' + v.id + '" aria-label="Previous picture">‹</button>' +
        '<button class="slide-btn next" data-slide-next="' + v.id + '" aria-label="Next picture">›</button>' +
        '<span class="slide-count">' + (idx + 1) + ' of ' + pics.length + '</span>';
    }
    h += '</div>';
    return h;
  }
  function vehicleCardHtml(v) {
    var specs = [];
    if (v.mileage != null && v.mileage !== '') specs.push(fmtNum(v.mileage) + ' miles');
    if (v.fuel) specs.push(v.fuel);
    if (v.transmission) specs.push(v.transmission);
    if (v.body_style) specs.push(v.body_style);
    if (v.condition) specs.push(v.condition);
    if (v.drivetrain) specs.push(v.drivetrain);
    if (v.doors) specs.push(v.doors + ' doors');
    if (v.exterior) specs.push(v.exterior + ' exterior');
    if (v.interior) specs.push(v.interior + ' interior');
    return '<div class="item-card">' + vehicleSlideshowHtml(v) +
      '<h3>' + esc(vehicleLabel(v)) + '</h3>' +
      '<span class="price">' + money(v.price) + '</span>' +
      (specs.length ? '<span class="stock">' + esc(specs.join(' · ')) + '</span>' : '') +
      (v.stock_no ? '<span class="stock">Stock no. ' + esc(v.stock_no) + '</span>' : '') +
      (v.description ? '<p class="info">' + esc(v.description) + '</p>' : '') +
      '<div class="row"><button data-testdrive="' + v.id + '">Test Drive</button>' +
      '<button class="small btn-soft" data-details="' + v.id + '" aria-label="View details">→</button></div>' +
      '</div>';
  }
  function renderVehiclesGrid() {
    var grid = $('vehicles-grid');
    if (!grid) return;
    var q = (vehicleSearch || '').toLowerCase();
    var vehicles = (dealer.vehicles || []).filter(function (v) { return vehicleMatches(v, q); });
    if (!vehicles.length) {
      grid.innerHTML = '<div class="card"><p class="info">No vehicles match your search.</p></div>';
      return;
    }
    var h = '<div class="item-grid">';
    vehicles.forEach(function (v) { h += vehicleCardHtml(v); });
    h += '</div>';
    grid.innerHTML = h;
  }
  function attachVehicleCardListeners(root) {
    root.querySelectorAll('[data-slide-prev]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-slide-prev');
        var pics = vehiclePicsOf(vehicleById(id));
        if (!pics.length) return;
        slideIdx[id] = ((slideIdx[id] || 0) - 1 + pics.length) % pics.length;
        renderVehicles();
      });
    });
    root.querySelectorAll('[data-slide-next]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-slide-next');
        var pics = vehiclePicsOf(vehicleById(id));
        if (!pics.length) return;
        slideIdx[id] = ((slideIdx[id] || 0) + 1) % pics.length;
        renderVehicles();
      });
    });
    root.querySelectorAll('[data-testdrive]').forEach(function (b) {
      b.addEventListener('click', function () {
        pendingTestDriveVehicleId = Number(b.getAttribute('data-testdrive'));
        detailVehicleId = null;
        show('testdrive');
      });
    });
    root.querySelectorAll('[data-details]').forEach(function (b) {
      b.addEventListener('click', function () {
        detailVehicleId = Number(b.getAttribute('data-details'));
        renderVehicles();
      });
    });
  }
  /* Details popup, modelled on the Cars "I'm interested" popup: an
     overlay that closes on a backdrop tap, a card with a ✕ button,
     the pictures up top and every field below. */
  function vehicleDetailsHtml(v) {
    var rows = [
      ['Make', v.make], ['Model', v.model], ['Year', v.year],
      ['Price', money(v.price)],
      ['Mileage', (v.mileage != null && v.mileage !== '') ? fmtNum(v.mileage) + ' miles' : ''],
      ['Fuel', v.fuel], ['Transmission', v.transmission], ['Body style', v.body_style],
      ['Condition', v.condition], ['Exterior', v.exterior], ['Interior', v.interior],
      ['Doors', v.doors], ['Drivetrain', v.drivetrain], ['Stock no.', v.stock_no]
    ];
    var h = '<div class="modal-overlay" data-close-details><div class="modal">' +
      '<button class="modal-close" data-close-details aria-label="Close">✕</button>' +
      vehicleSlideshowHtml(v) +
      '<h3>' + esc(vehicleLabel(v)) + '</h3>' +
      '<span class="price">' + money(v.price) + '</span>' +
      '<div class="detail-list">';
    rows.forEach(function (r) {
      if (r[1] === '' || r[1] == null) return;
      h += '<div class="detail-row"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>';
    });
    h += '</div>';
    if (v.description) h += '<p class="info">' + esc(v.description) + '</p>';
    h += '<div class="row"><button data-testdrive="' + v.id + '">Test Drive</button></div></div></div>';
    return h;
  }
  function renderVehicles() {
    var el = $('view-vehicles');
    if (!dealer) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var h = '<h2>' + esc(dealer.name) + '</h2>';
    if (dealer.about) h += '<p class="info">' + esc(dealer.about) + '</p>';
    if (dealer.address || dealer.phone || dealer.hours) {
      h += '<div class="card info">';
      if (dealer.address) h += '<p>📍 ' + esc(dealer.address) + '</p>';
      if (dealer.phone) h += '<p>📞 ' + esc(dealer.phone) + '</p>';
      if (dealer.hours) h += '<p>🕐 ' + esc(dealer.hours) + '</p>';
      h += '</div>';
    }
    var vehicles = dealer.vehicles || [];
    if (!vehicles.length) {
      h += '<div class="card"><p class="info">No vehicles yet — the owner adds vehicles in Setup.</p></div>';
      el.innerHTML = h;
      return;
    }
    h += '<input id="veh-search" type="text" placeholder="Search vehicles…" value="' + esc(vehicleSearch) + '" class="veh-search">';
    h += '<div id="vehicles-grid"></div>';
    h += '<div class="card"><p class="info">Like one? Book a test drive from the <b>Test Drive</b> tab, or estimate the monthly payment on the <b>Finance</b> tab.</p></div>';
    if (detailVehicleId != null) {
      var dv = vehicleById(detailVehicleId);
      if (dv) h += vehicleDetailsHtml(dv);
      else detailVehicleId = null;
    }
    el.innerHTML = h;
    var search = $('veh-search');
    if (search) search.addEventListener('input', function () {
      vehicleSearch = search.value;
      renderVehiclesGrid();
      attachVehicleCardListeners($('vehicles-grid'));
    });
    renderVehiclesGrid();
    attachVehicleCardListeners(el);
    el.querySelectorAll('[data-close-details]').forEach(function (n) {
      n.addEventListener('click', function (e) {
        if (e && e.target && e.target !== n) return;
        detailVehicleId = null;
        renderVehicles();
      });
    });
  }

  /* ---------- Test Drive (public form) ---------- */
  function timeOptions() {
    var h = '';
    ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM', '6:00 PM'].forEach(function (t) {
      h += '<option value="' + t + '">' + t + '</option>';
    });
    return h;
  }
  function renderTestDrive() {
    var el = $('view-testdrive');
    if (!dealer) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var vehicles = dealer.vehicles || [];
    var h = '<h2>Book a test drive — ' + esc(dealer.name) + '</h2><div class="card">' +
      '<label>Vehicle</label><select id="td-vehicle">' +
      (vehicles.length
        ? vehicles.map(function (v) { return '<option value="' + v.id + '">' + esc(vehicleLabel(v)) + ' — ' + money(v.price) + '</option>'; }).join('')
        : '<option value="">No vehicles yet</option>') +
      '</select>' +
      '<label>Your name</label><input id="td-name" type="text" placeholder="Full name">' +
      '<label>Phone</label><input id="td-phone" type="tel" placeholder="Phone number">' +
      '<label>Email (optional)</label><input id="td-email" type="email" placeholder="Email address">' +
      '<label>Date</label><input id="td-date" type="date" value="' + todayLocal() + '">' +
      '<label>Time</label><select id="td-time">' + timeOptions() + '</select>' +
      '<div class="row"><button id="td-go">Book test drive</button></div>' +
      '<p class="error" id="td-err" hidden></p>' +
      '<div id="td-out" style="margin-top:12px"></div></div>';
    el.innerHTML = h;
    if (pendingTestDriveVehicleId != null) {
      var sel = $('td-vehicle');
      if (sel && vehicleById(pendingTestDriveVehicleId)) sel.value = pendingTestDriveVehicleId;
      pendingTestDriveVehicleId = null;
    }
    $('td-go').addEventListener('click', function () {
      var err = $('td-err');
      var out = $('td-out');
      var v = vehicleById($('td-vehicle').value);
      var name = $('td-name').value.trim();
      var phone = $('td-phone').value.trim();
      var email = $('td-email').value.trim();
      var date = $('td-date').value;
      var time = $('td-time').value;
      if (!v) { err.hidden = false; err.textContent = 'Pick a vehicle first.'; return; }
      if (!name) { err.hidden = false; err.textContent = 'Your name is required.'; return; }
      if (!phone) { err.hidden = false; err.textContent = 'Your phone number is required.'; return; }
      if (!date) { err.hidden = false; err.textContent = 'Pick a date.'; return; }
      err.hidden = true;
      var label = vehicleLabel(v);
      rpc('place_dealer_testdrive', { p_slug: SLUG, p_vehicle: label, p_name: name, p_phone: phone, p_email: email, p_date: date, p_time: time }).then(function (res) {
        var id = (res && typeof res === 'object') ? (res.id != null ? res.id : res.booking_id) : res;
        out.innerHTML = '<p class="info">✓ Booked — test drive #' + esc(id) + ': ' + esc(label) + ' on ' + esc(date) + ' at ' + esc(time) + ' for ' + esc(name) + '. Show your name at the dealership when you arrive.</p>';
        notifyEmail('Dealer test drive: ' + label, 'dealer_testdrive', { slug: SLUG, name: name, phone: phone, email: email, vehicle: label, date: date, time: time });
      }).catch(function (e) {
        err.hidden = false;
        err.textContent = 'Error: ' + e.message;
      });
    });
  }

  /* ---------- Sell Your Car (public form) ---------- */
  function renderSell() {
    var el = $('view-sell');
    if (!dealer) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var h = '<h2>Sell your car — ' + esc(dealer.name) + '</h2><div class="card">' +
      '<p class="info">Tell us about your car and we will be in touch with a valuation. This is a valuation request, not a purchase offer.</p>' +
      '<label>Your name</label><input id="tr-name" type="text" placeholder="Full name">' +
      '<label>Phone</label><input id="tr-phone" type="tel" placeholder="Phone number">' +
      '<label>Email (optional)</label><input id="tr-email" type="email" placeholder="Email address">' +
      '<label>Make</label><input id="tr-make" type="text" placeholder="e.g. Toyota">' +
      '<label>Model</label><input id="tr-model" type="text" placeholder="e.g. Camry LE">' +
      '<label>Year</label><input id="tr-year" type="number" min="1900" max="2100" step="1" inputmode="numeric" placeholder="e.g. 2018">' +
      '<label>Mileage</label><input id="tr-mileage" type="number" min="0" step="1" inputmode="numeric" placeholder="Miles on the car">' +
      '<label>Condition</label><select id="tr-condition"><option value="Excellent">Excellent</option><option value="Good" selected>Good</option><option value="Fair">Fair</option></select>' +
      '<label>Message (optional)</label><textarea id="tr-message" placeholder="Anything else about the car?"></textarea>' +
      '<div class="row"><button id="tr-go">Send valuation request</button></div>' +
      '<p class="error" id="tr-err" hidden></p>' +
      '<div id="tr-out" style="margin-top:12px"></div></div>';
    el.innerHTML = h;
    $('tr-go').addEventListener('click', function () {
      var err = $('tr-err');
      var out = $('tr-out');
      var name = $('tr-name').value.trim();
      var phone = $('tr-phone').value.trim();
      var email = $('tr-email').value.trim();
      var make = $('tr-make').value.trim();
      var model = $('tr-model').value.trim();
      var year = $('tr-year').value.trim();
      var mileage = $('tr-mileage').value.trim();
      var condition = $('tr-condition').value;
      var message = $('tr-message').value.trim();
      if (!name) { err.hidden = false; err.textContent = 'Your name is required.'; return; }
      if (!phone) { err.hidden = false; err.textContent = 'Your phone number is required.'; return; }
      if (!make || !model) { err.hidden = false; err.textContent = 'Make and model are required.'; return; }
      err.hidden = true;
      rpc('place_dealer_tradein', { p_slug: SLUG, p_name: name, p_phone: phone, p_make: make, p_model: model, p_email: email, p_year: year ? Number(year) : 0, p_mileage: mileage ? Number(mileage) : 0, p_condition: condition, p_message: message }).then(function (res) {
        var id = (res && typeof res === 'object') ? (res.id != null ? res.id : res.tradein_id) : res;
        out.innerHTML = '<p class="info">✓ Received — trade-in #' + esc(id) + ': ' + esc(make) + ' ' + esc(model) + (year ? ' (' + esc(year) + ')' : '') + '. Thanks, ' + esc(name) + ' — the dealership will be in touch about your car.</p>';
        notifyEmail('Dealer trade-in: ' + make + ' ' + model, 'dealer_tradein', { slug: SLUG, name: name, phone: phone, email: email, make: make, model: model, year: year, mileage: mileage, condition: condition, message: message });
      }).catch(function (e) {
        err.hidden = false;
        err.textContent = 'Error: ' + e.message;
      });
    });
  }

  /* ---------- Finance (public calculator, no database) ---------- */
  function monthlyPayment(price, down, ratePct, months) {
    var principal = Math.max(0, Number(price || 0) - Number(down || 0));
    var n = Math.max(1, Math.floor(Number(months || 0)));
    var r = Number(ratePct || 0) / 100 / 12;
    if (r === 0) return round2(principal / n);
    return round2(principal * r / (1 - Math.pow(1 + r, -n)));
  }
  function renderFinance() {
    var el = $('view-finance');
    if (!dealer) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var vehicles = dealer.vehicles || [];
    var h = '<h2>Finance estimator — ' + esc(dealer.name) + '</h2><div class="card">' +
      '<div class="note">Estimate only: this calculator shows what a monthly payment could look like. No credit check happens here and no financing is arranged online — talk to the dealership for the real offer.</div>' +
      '<label>Vehicle (fills in the price)</label><select id="fin-vehicle">' +
      '<option value="">— Type a price instead —</option>' +
      vehicles.map(function (v) { return '<option value="' + v.id + '">' + esc(vehicleLabel(v)) + ' — ' + money(v.price) + '</option>'; }).join('') +
      '</select>' +
      '<label>Vehicle price</label><input id="fin-price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0">' +
      '<label>Down payment</label><input id="fin-down" type="number" min="0" step="0.01" inputmode="decimal" value="0">' +
      '<label>Annual interest rate (%)</label><input id="fin-rate" type="number" min="0" step="0.1" inputmode="decimal" value="6">' +
      '<label>Term (months)</label><input id="fin-months" type="number" min="1" step="1" inputmode="numeric" value="48">' +
      '<div class="row"><button id="fin-go">Calculate</button></div>' +
      '<p class="error" id="fin-err" hidden></p>' +
      '<div id="fin-out" style="margin-top:12px"></div></div>';
    el.innerHTML = h;
    $('fin-vehicle').addEventListener('change', function () {
      var v = vehicleById($('fin-vehicle').value);
      if (v) $('fin-price').value = v.price;
    });
    $('fin-go').addEventListener('click', function () {
      var err = $('fin-err');
      var out = $('fin-out');
      var price = Number($('fin-price').value || 0);
      var down = Number($('fin-down').value || 0);
      var rate = Number($('fin-rate').value || 0);
      var months = Math.floor(Number($('fin-months').value || 0));
      if (!(price > 0)) { err.hidden = false; err.textContent = 'Enter a vehicle price above 0.'; return; }
      if (down < 0) { err.hidden = false; err.textContent = 'Down payment cannot be negative.'; return; }
      if (down >= price) { err.hidden = false; err.textContent = 'Down payment must be less than the price.'; return; }
      if (!(months >= 1)) { err.hidden = false; err.textContent = 'Term must be at least 1 month.'; return; }
      err.hidden = true;
      var pay = monthlyPayment(price, down, rate, months);
      var principal = price - down;
      var totalPaid = round2(pay * months + down);
      var interest = round2(pay * months - principal);
      out.innerHTML = '<div class="total">Monthly payment <span class="big">' + money(pay) + '</span><br>' +
        'Total paid ' + money(totalPaid) + '<br>' +
        'Total interest ' + money(interest) + '<br>' +
        '<span class="info">' + months + ' payments of ' + money(pay) + ' + ' + money(down) + ' down</span></div>';
    });
  }

  /* ---------- Bookings (employee password) ---------- */
  function empGate(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the employee password for this dealership to see bookings.</p>' +
      '<label>Employee password</label><input id="emp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="emp-go">Unlock</button></div>' +
      '<p class="error" id="emp-err" hidden></p></div>';
    $('emp-go').addEventListener('click', function () {
      var pw = $('emp-pass').value;
      rpc('check_dealer_employee_pass', { p_slug: SLUG, p_password: pw }).then(function (ok) {
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
    return rpc('list_dealer_bookings', { p_slug: SLUG, p_epass: empPass }).then(function (d) {
      bookings = d || [];
      if (currentView === 'bookings') renderBookingsList();
      return bookings;
    }).catch(function (e) { if (!quiet) throw e; });
  }
  function renderBookings() {
    var el = $('view-bookings');
    if (!dealer) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Bookings', renderBookings); return; }
    el.innerHTML = '<h2>Bookings — ' + esc(dealer.name) + '</h2><p class="info">Test drives and trade-in requests refresh on their own every few seconds.</p><div id="bookings-list"><p class="info">Loading…</p></div>';
    loadBookings().catch(function (e) {
      var l = $('bookings-list');
      if (l) l.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  function bookingDetails(b) {
    var d = b.data || {};
    var lines = [];
    if (d.name) lines.push('<b>' + esc(d.name) + '</b>');
    if (d.phone) lines.push('Phone: ' + esc(d.phone));
    if (d.email) lines.push('Email: ' + esc(d.email));
    if (b.kind === 'testdrive') {
      if (d.vehicle) lines.push('Vehicle: ' + esc(d.vehicle));
      if (d.date) lines.push('When: ' + esc(d.date) + (d.time ? ' at ' + esc(d.time) : ''));
    } else {
      if (d.make || d.model) lines.push('Car: ' + esc([d.year, d.make, d.model].filter(Boolean).join(' ')));
      if (d.mileage != null && d.mileage !== '') lines.push('Mileage: ' + fmtNum(d.mileage) + ' miles');
      if (d.condition) lines.push('Condition: ' + esc(d.condition));
      if (d.message) lines.push('Message: ' + esc(d.message));
    }
    return lines.join('<br>');
  }
  function renderBookingsList() {
    var el = $('bookings-list');
    if (!el) return;
    if (!bookings.length) { el.innerHTML = '<div class="card"><p class="info">No bookings yet.</p></div>'; return; }
    var h = '';
    if (bookingsErr) h += '<p class="error">' + esc(bookingsErr) + '</p>';
    bookings.forEach(function (b) {
      var kindLabel = b.kind === 'tradein' ? 'Trade-in' : 'Test drive';
      h += '<div class="card"><h3>' + kindLabel + ' #' + esc(b.id) +
        (b.status && b.status !== 'active' ? ' <span class="voided">(' + esc(b.status) + ')</span>' : '') + '</h3>' +
        '<p class="info">' + esc(fmtDT(b.created_at)) + '</p>' +
        '<p>' + bookingDetails(b) + '</p>' +
        (b.status === 'active'
          ? (cancelConfirmId === b.id
            ? '<p><b>Cancel this booking?</b></p><div class="row"><button class="small danger" data-cancel-yes="' + b.id + '" data-kind="' + b.kind + '">Yes, cancel</button><button class="small secondary" data-cancel-no="' + b.id + '">Keep it</button></div>'
            : '<div class="row"><button class="small" data-done="' + b.id + '" data-kind="' + b.kind + '">Mark done</button><button class="small danger" data-cancel="' + b.id + '" data-kind="' + b.kind + '">Cancel</button></div>')
          : '') +
        '</div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-done]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-done'));
        var kind = btn.getAttribute('data-kind');
        btn.disabled = true;
        rpc('update_dealer_booking', { p_slug: SLUG, p_epass: empPass, p_kind: kind, p_id: id, p_status: 'done' })
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
        rpc('update_dealer_booking', { p_slug: SLUG, p_epass: empPass, p_kind: kind, p_id: id, p_status: 'cancelled' })
          .then(function () { cancelConfirmId = null; bookingsErr = ''; return loadBookings(); })
          .catch(function (e) { cancelConfirmId = null; bookingsErr = 'Error: ' + e.message; renderBookingsList(); });
      });
    });
  }

  /* ---------- Setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    if (!dealer) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (!ownerCreds) {
      el.innerHTML = '<h2>Setup</h2><div class="card">' +
        '<p class="info">Enter the username and password AutoFly gave this dealership.</p>' +
        '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
        '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
        '<div class="row"><button id="st-go">Log in</button></div>' +
        '<p class="error" id="st-err" hidden></p></div>';
      $('st-go').addEventListener('click', function () {
        var u = $('st-user').value.trim();
        var p = $('st-pass').value;
        rpc('check_dealer_login', { p_slug: SLUG, p_u: u, p_p: p }).then(function (ok) {
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
    var h = '<h2>Setup — ' + esc(dealer.name) + '</h2>' +
      '<div class="card"><h3>Dealership details</h3>' +
      '<p class="info">Changes save as a draft. Upload for approval and the admin makes them live.</p>' +
      '<label>Dealership name</label><input id="d-name" type="text" value="' + esc(draft.name || '') + '">' +
      '<label>Icon picture</label>' +
      '<div class="icon-field">' +
      '<img id="setup-icon-preview" class="icon-preview" src="' + esc(draft.icon || '') + '" alt=""' + (draft.icon ? '' : ' hidden') + '>' +
      '<input id="setup-icon-file" type="file" accept="image/*">' +
      '<button type="button" id="setup-icon-remove" class="small secondary">Remove icon</button>' +
      '</div>' +
      '<p class="info" id="setup-icon-out">One small picture shown next to the dealership name. It is shrunk to 200px before uploading.</p>' +
      '<label>Address</label><input id="d-address" type="text" value="' + esc(draft.address || '') + '">' +
      '<label>Phone</label><input id="d-phone" type="tel" value="' + esc(draft.phone || '') + '">' +
      '<label>Hours</label><input id="d-hours" type="text" value="' + esc(draft.hours || '') + '">' +
      '<label>About</label><textarea id="d-about">' + esc(draft.about || '') + '</textarea>' +
      '<div class="row"><button id="d-save">Save draft</button>' +
      '<button id="d-upload" class="secondary">Upload for approval</button></div>' +
      '<p class="info" id="d-status">Draft status: ' + esc(draftStatus) + (draftStatus === 'pending' ? ' — waiting for AutoFly to approve it.' : draftStatus === 'approved' ? ' — approved, live now.' : ' — not sent yet.') + '</p>' +
      '<p class="error" id="d-err" hidden></p></div>' +
      '<div class="card"><h3>Vehicles</h3>' +
      '<p class="info">Vehicles go live right away — no approval needed.</p>' +
      '<div id="vehicles-list"></div>' +
      '<h3 id="vehicle-form-title">Add a vehicle</h3>' +
      '<label>Make</label><input id="v-make" type="text" placeholder="e.g. Toyota">' +
      '<label>Model</label><input id="v-model" type="text" placeholder="e.g. Camry LE">' +
      '<label>Year</label><input id="v-year" type="number" min="1900" max="2100" step="1" inputmode="numeric">' +
      '<label>Price</label><input id="v-price" type="number" min="0" step="0.01" inputmode="decimal">' +
      '<label>Mileage</label><input id="v-mileage" type="number" min="0" step="1" inputmode="numeric">' +
      '<label>Fuel</label><input id="v-fuel" type="text" placeholder="Petrol, Diesel, Electric, Hybrid…">' +
      '<label>Transmission</label><input id="v-transmission" type="text" placeholder="Automatic, Manual…">' +
      '<label>Body style</label><input id="v-body" type="text" placeholder="Sedan, SUV, Pickup…">' +
      '<label>Condition</label><select id="v-condition"><option value="Used" selected>Used</option><option value="New">New</option></select>' +
      '<label>Exterior colour</label><input id="v-exterior" type="text">' +
      '<label>Interior colour</label><input id="v-interior" type="text">' +
      '<label>Doors</label><input id="v-doors" type="number" min="0" step="1" inputmode="numeric">' +
      '<label>Drivetrain</label><input id="v-drivetrain" type="text" placeholder="Front Wheel Drive…">' +
      '<label>Stock no.</label><input id="v-stock" type="text" placeholder="e.g. DL-001">' +
      '<label>Description</label><textarea id="v-desc"></textarea>' +
      '<label>Pictures (up to 7)</label>' +
      '<input id="v-pics" type="file" accept="image/*" multiple>' +
      '<div id="v-pics-list"></div>' +
      '<p class="error" id="v-pics-status" hidden></p>' +
      '<div class="row"><button id="v-save">Save vehicle</button>' +
      '<button id="v-cancel" class="secondary" hidden>Cancel edit</button></div>' +
      '<p class="error" id="v-err" hidden></p></div>';
    el.innerHTML = h;
    renderVehiclesList();
    $('d-save').addEventListener('click', function () { saveDraft(false); });
    $('d-upload').addEventListener('click', function () { saveDraft(true); });
    $('v-save').addEventListener('click', saveVehicle);
    $('v-cancel').addEventListener('click', function () { vehicleEditId = null; renderSetup(); });
    if (!vehicleEditId) vehiclePics = [];
    renderVehiclePics();
    $('v-pics').addEventListener('change', onVehiclePicsChosen);
    wireIconField();
  }
  function renderVehiclesList() {
    var el = $('vehicles-list');
    if (!el) return;
    var vehicles = dealer.vehicles || [];
    if (!vehicles.length) { el.innerHTML = '<p class="info">No vehicles yet.</p>'; return; }
    var h = '';
    vehicles.forEach(function (v) {
      h += '<div class="cart-line"><div><b>' + esc(vehicleLabel(v)) + '</b><br><span class="info">' + money(v.price) + (v.mileage != null && v.mileage !== '' ? ' · ' + fmtNum(v.mileage) + ' miles' : '') + (v.stock_no ? ' · ' + esc(v.stock_no) : '') + '</span></div>' +
        '<div class="row"><button class="small secondary" data-edit="' + v.id + '">Edit</button>' +
        (delConfirmId === v.id
          ? '<span><b>Delete "' + esc(vehicleLabel(v)) + '"?</b> <button class="small danger" data-del-yes="' + v.id + '">Yes, delete</button> <button class="small secondary" data-del-no="' + v.id + '">Keep it</button></span>'
          : '<button class="small danger" data-del="' + v.id + '">Delete</button>') + '</div></div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = vehicleById(Number(b.getAttribute('data-edit')));
        if (!v) return;
        vehicleEditId = v.id;
        $('v-make').value = v.make || '';
        $('v-model').value = v.model || '';
        $('v-year').value = v.year == null ? '' : v.year;
        $('v-price').value = v.price == null ? '' : v.price;
        $('v-mileage').value = v.mileage == null ? '' : v.mileage;
        $('v-fuel').value = v.fuel || '';
        $('v-transmission').value = v.transmission || '';
        $('v-body').value = v.body_style || '';
        $('v-condition').value = v.condition || 'Used';
        $('v-exterior').value = v.exterior || '';
        $('v-interior').value = v.interior || '';
        $('v-doors').value = v.doors == null ? '' : v.doors;
        $('v-drivetrain').value = v.drivetrain || '';
        $('v-stock').value = v.stock_no || '';
        $('v-desc').value = v.description || '';
        vehiclePics = (v.pics || []).slice();
        renderVehiclePics();
        $('vehicle-form-title').textContent = 'Edit vehicle — ' + vehicleLabel(v);
        $('v-cancel').hidden = false;
        window.scrollTo(0, document.getElementById('vehicle-form-title').offsetTop - 80);
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        delConfirmId = Number(b.getAttribute('data-del'));
        renderVehiclesList();
      });
    });
    el.querySelectorAll('[data-del-no]').forEach(function (b) {
      b.addEventListener('click', function () { delConfirmId = null; renderVehiclesList(); });
    });
    el.querySelectorAll('[data-del-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = vehicleById(Number(b.getAttribute('data-del-yes')));
        if (!v) return;
        b.disabled = true;
        rpc('delete_dealer_vehicle', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_vehicle_id: v.id })
          .then(function () { delConfirmId = null; return loadDealer(); })
          .then(function () { renderSetup(); })
          .catch(function (e) { delConfirmId = null; renderVehiclesList(); var er = $('v-err'); if (er) { er.hidden = false; er.textContent = 'Error: ' + e.message; } });
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
    if (!d.name) { err.hidden = false; err.textContent = 'Dealership name is required.'; return; }
    err.hidden = true;
    rpc('save_dealer_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_draft: d })
      .then(function () {
        draft = d;
        draftStatus = 'editing';
        if (!upload) {
          $('d-status').textContent = 'Draft status: editing — saved, not sent yet.';
          return;
        }
        return rpc('submit_dealer_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p }).then(function () {
          draftStatus = 'pending';
          $('d-status').textContent = 'Draft status: pending — waiting for AutoFly to approve it.';
          notifyEmail('Dealer draft for approval: ' + d.name, 'dealer_draft', { slug: SLUG, name: d.name });
        });
      })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  /* ---------- Vehicle pictures (Setup) ---------- */
  /* Shrink a picture in the browser before it is stored. Vehicle
     pictures are shrunk to 800px on the long edge at JPEG quality 0.8
     — big enough to see the car, not high quality. PNGs stay PNG,
     small pictures untouched, and anything that fails falls back to
     the original file. */
  function shrinkImage(file, maxEdge, quality) {
    maxEdge = maxEdge || 1600;
    quality = quality || 0.85;
    try {
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(file);
        var image = new Image();
        image.onload = function () {
          URL.revokeObjectURL(url);
          var w0 = image.naturalWidth, h0 = image.naturalHeight;
          if (!w0 || !h0 || Math.max(w0, h0) <= maxEdge) { resolve(file); return; }
          var scale = maxEdge / Math.max(w0, h0);
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(w0 * scale);
          canvas.height = Math.round(h0 * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          var outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          canvas.toBlob(function (blob) {
            if (!blob) { resolve(file); return; }
            var name = outType === 'image/jpeg' ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
            resolve(new File([blob], name, { type: outType }));
          }, outType, quality);
        };
        image.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
        image.src = url;
      }).catch(function () { return file; });
    } catch (e) {
      return Promise.resolve(file);
    }
  }
  /* Upload one picture to the product-images bucket, under store/dealer/,
     and return its public URL. Anon uploads are only allowed under
     store/ — this path qualifies, and the bucket is publicly readable. */
  function uploadVehiclePicture(file) {
    return shrinkImage(file, 800, 0.8).then(function (up) {
      var safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = 'store/dealer/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
      return fetch(SUPABASE_URL + '/storage/v1/object/product-images/' + path, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: up
      }).then(function (res) {
        if (!res.ok) throw new Error('Picture upload failed');
        return SUPABASE_URL + '/storage/v1/object/public/product-images/' + path;
      });
    });
  }
  function renderVehiclePics() {
    var el = $('v-pics-list');
    if (!el) return;
    var h = '<p class="info">' + vehiclePics.length + ' of 7 pictures</p>';
    if (vehiclePics.length) {
      h += '<div class="pic-thumbs">';
      vehiclePics.forEach(function (url, i) {
        h += '<div class="pic-thumb"><img src="' + esc(url) + '" alt="Vehicle picture ' + (i + 1) + '"><button class="small danger" data-pic-remove="' + i + '">Remove</button></div>';
      });
      h += '</div>';
    }
    el.innerHTML = h;
    el.querySelectorAll('[data-pic-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        vehiclePics.splice(Number(b.getAttribute('data-pic-remove')), 1);
        renderVehiclePics();
      });
    });
  }
  function onVehiclePicsChosen() {
    var input = $('v-pics');
    var status = $('v-pics-status');
    var files = (input && input.files) ? Array.prototype.slice.call(input.files) : [];
    if (!files.length) return;
    var room = 7 - vehiclePics.length;
    if (room <= 0) {
      if (status) { status.hidden = false; status.textContent = 'This vehicle already has 7 pictures — remove one to add another.'; }
      input.value = '';
      return;
    }
    if (files.length > room) {
      if (status) { status.hidden = false; status.textContent = 'Only 7 pictures per vehicle — the extra ' + (files.length - room) + ' picture(s) were not added.'; }
    } else if (status) { status.hidden = true; }
    input.value = '';
    var chain = Promise.resolve();
    files.slice(0, room).forEach(function (file) {
      chain = chain.then(function () { return uploadVehiclePicture(file); }).then(function (url) {
        vehiclePics.push(url);
        renderVehiclePics();
      }).catch(function (err) {
        if (status) { status.hidden = false; status.textContent = 'Upload failed: ' + err.message; }
      });
    });
  }
  function collectVehicle() {
    var year = $('v-year').value.trim();
    var price = $('v-price').value.trim();
    var mileage = $('v-mileage').value.trim();
    var doors = $('v-doors').value.trim();
    return {
      make: $('v-make').value.trim(),
      model: $('v-model').value.trim(),
      year: year === '' ? null : Math.floor(Number(year)),
      price: price === '' ? 0 : Number(price),
      mileage: mileage === '' ? null : Math.floor(Number(mileage)),
      fuel: $('v-fuel').value.trim(),
      transmission: $('v-transmission').value.trim(),
      body_style: $('v-body').value.trim(),
      condition: $('v-condition').value,
      exterior: $('v-exterior').value.trim(),
      interior: $('v-interior').value.trim(),
      doors: doors === '' ? null : Math.floor(Number(doors)),
      drivetrain: $('v-drivetrain').value.trim(),
      stock_no: $('v-stock').value.trim(),
      description: $('v-desc').value.trim(),
      pics: vehiclePics.slice()
    };
  }
  function saveVehicle() {
    var err = $('v-err');
    var v = collectVehicle();
    if (!v.make || !v.model) { err.hidden = false; err.textContent = 'Make and model are required.'; return; }
    if (!(v.price >= 0)) { err.hidden = false; err.textContent = 'Price must be 0 or more.'; return; }
    err.hidden = true;
    if (vehicleEditId) v.id = vehicleEditId;
    rpc('save_dealer_vehicle', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_vehicle: v })
      .then(function () { vehicleEditId = null; return loadDealer(); })
      .then(function () { renderSetup(); })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function loadDraft() {
    rpc('get_dealer_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p })
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
      $('site-name').textContent = 'Dealer';
      $('view-vehicles').innerHTML = '<div class="card"><h2>Dealer not found</h2><p class="info">This dealer page needs your own dealership link — ask AutoFly for it.</p></div>';
      return;
    }
    loadDealer().then(function (d) {
      if (!d) {
        $('site-name').textContent = 'Dealer';
        $('view-vehicles').innerHTML = '<div class="card"><h2>Dealer not found</h2><p class="info">No dealership with this link yet. Ask AutoFly to set it up.</p></div>';
        return;
      }
      return rpc('dealer_pass_status', { p_slug: SLUG }).then(function (st) {
        passLocked = st === 'locked';
        empUnlocked = !passLocked;
        renderVehicles();
      });
    }).catch(function (e) {
      $('view-vehicles').innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  init();
})();
