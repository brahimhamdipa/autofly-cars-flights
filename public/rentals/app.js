/* Car rental page app — ONE folder for every rental company.
   The company comes from its own private link, and its info, cars,
   drivers, and bookings live in the database — there is no data.json
   file here. Every company has its own cars, drivers, and bookings,
   but they all use this same page.
   Visitors browse the cars and book one, with a driver or self-drive,
   for pickup and return dates. The price is per day, and the total is
   days × price per day. Bookings are emailed to Yently. Payment is
   at pickup — nothing is charged online.
   The Bookings tab needs the company's shared employee password
   (one password for all staff, set by the admin; companies with
   none set stay fully open). Setup needs the owner's own username +
   password. Setup edits save as a draft, and the Upload button sends
   the draft to the admin for approval — approval makes it live
   instantly. Cars and drivers are different: the owner adds, edits,
   and deletes them live in Setup, no approval needed. All credentials
   live in memory only: a reload asks again, exactly like the diner,
   barbershop, dealer, and POS pages. */
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
  var SLUG = String(params.c || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
  var SLUG_FROM_PATH = false;
  var slugResolved = false;
  if (!SLUG) {
    // Clean link (yently.com/<slug>): the middleware rewrites the
    // page server-side, so location.search is empty in the browser.
    // The shop slug is then the last path segment. Ignore this
    // system's own folder name, so a bare /rentals visit still
    // shows "not found" by design.
    var segs = location.pathname.split('/').filter(function (s) { return s; });
    var lastSeg = (segs[segs.length - 1] || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    if (lastSeg && lastSeg !== 'rentals') { SLUG = lastSeg; SLUG_FROM_PATH = true; }
  }
  // Clean link (yently.com/<slug>): the name in the link is the CLEAN
  // name, which usually differs from the shop's own slug.
  // The middleware rewrites the page, but the browser address stays
  // clean, so look the clean name up in clean_links (public read)
  // and use the real shop slug. Only runs when the slug came from
  // the path (no ?c= query). Fails open: any error keeps
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

  /* Public by design: the same publishable key the main Yently site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var rental = null; // live rental company info + cars + drivers (visitors)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var ownerCreds = null; // {u, p} in memory only, never stored
  var empPass = null; // employee password in memory only, never stored
  var empUnlocked = false; // true once the employee password is entered, or when the company has none set
  var passLocked = false;
  var bookings = [];
  var bookingsTimer = null;
  var currentView = 'cars';
  var carEditId = null; // car being edited in Setup, null = adding
  var driverEditId = null; // driver being edited in Setup, null = adding
  var cancelConfirmId = null; // booking id awaiting an in-page cancel confirmation
  var bookingsErr = ''; // last bookings error, shown inline above the list
  var delConfirmId = null; // car id awaiting an in-page delete confirmation
  var delDriverConfirmId = null; // driver id awaiting an in-page delete confirmation
  var carSearch = ''; // public cars search text, kept while typing
  var slideIdx = {}; // car id -> current slideshow picture index
  var detailCarId = null; // car id shown in the details popup
  var pendingBookCarId = null; // car to preselect in Book
  var carPics = []; // picture URLs for the car being added/edited in Setup

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* Amounts use thousands separators: $1,500, not $1500.00. Whole
     amounts stay plain ($45); amounts with cents show two decimals. */
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
  function tomorrowLocal() {
    var d = new Date(Date.now() + 86400000);
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
  /* Best-effort owner email, same shape as the dealer and POS pages: the
     table differs per call (booking, draft approval). */
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
  /* Same pattern as the Direct Upload form on the main site: a "?"
     next to a field label opens a short explanation under it. Tap
     again — or anywhere else on the page — to close it. The popups
     anchor to the field label, so they can never run past the page
     edge and zoom the page on a phone. */
  var HELP_TEXT = {
    car: 'Pick the car you want to rent. Each car shows its price per day — the total is the number of days times that price.',
    driver: 'Pick a driver, or choose Self-drive to drive the car yourself. Drivers are the company\u2019s own drivers.',
    name: 'Your own name — the person booking the car. The rental company uses it to know who the booking is for.',
    phone: 'Your phone number, so the rental company can reach you about pickup. Digits only is fine — spaces or dashes do no harm.',
    email: 'Your email address — optional. The rental company can send your booking details here.',
    pickup: 'The day you pick the car up. That day counts as the first rental day.',
    ret: 'The day you bring the car back. The rental runs from the pickup day to this day — at least one day in total.'
  };
  function helpHtml(key) {
    return '<span class="help"><button type="button" class="help-btn" data-help-btn aria-label="Help">?</button><span class="help-pop" hidden>' + esc(HELP_TEXT[key] || '') + '</span></span>';
  }
  function wireHelp(root) {
    root.querySelectorAll('[data-help-btn]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var pop = b.parentNode.querySelector('.help-pop');
        if (!pop) return;
        var wasHidden = pop.hidden;
        root.querySelectorAll('.help-pop').forEach(function (p) { p.hidden = true; });
        pop.hidden = !wasHidden;
      });
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.help')) return;
    document.querySelectorAll('.help-pop').forEach(function (p) { p.hidden = true; });
  });
  /* ---------- Icon picture (one small square image) ---------- */
  /* The icon lives in the draft/live data as `icon` — a public URL or ''.
     It is uploaded to the product-images bucket, shrunk to 200px on its
     long edge first (same rules as the shop picture uploads: JPEG 0.8,
     PNGs stay PNG, small pictures untouched, any failure falls back to
     the original file). Same pattern as the POS, diner, barbershop,
     employee, and dealer pages. */
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
  function carById(id) {
    return (rental.cars || []).filter(function (c) { return String(c.id) === String(id); })[0] || null;
  }
  function driverById(id) {
    return (rental.drivers || []).filter(function (d) { return String(d.id) === String(id); })[0] || null;
  }
  function carLabel(c) {
    return [c.year, c.make, c.model].filter(function (x) { return x !== '' && x != null; }).join(' ');
  }
  function loadRental() {
    return rpc('get_rentals_live', { p_slug: SLUG }).then(function (d) {
      rental = d;
      setHeader();
      return d;
    });
  }

  /* ---------- views ---------- */
  function show(view) {
    currentView = view;
    ['cars', 'book', 'bookings', 'setup'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.hidden = v !== view;
    });
    var tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    if (bookingsTimer) { clearInterval(bookingsTimer); bookingsTimer = null; }
    if (view === 'cars') renderCars();
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
    $('site-name').textContent = rental ? rental.name : 'Car Rental';
    renderHeaderIcon(rental && rental.icon ? rental.icon : '');
    $('site-about').textContent = rental
      ? [rental.address, rental.phone].filter(Boolean).join(' · ')
      : '';
    $('site-footer').innerHTML = rental
      ? esc([rental.address, rental.phone].filter(Boolean).join(' · ')) + '<br>Powered by Yently'
      : 'Powered by Yently';
    document.title = (rental ? rental.name : 'Car Rental') + ' — Car Rental';
  }

  /* ---------- Cars (public inventory) ---------- */
  function carPicsOf(c) { return (c && Array.isArray(c.pics)) ? c.pics : []; }
  function carMatches(c, q) {
    if (!q) return true;
    var hay = [c.plate, c.make, c.model, c.year, c.fuel, c.transmission, c.price_per_day, money(c.price_per_day), c.description]
      .map(function (x) { return String(x == null ? '' : x).toLowerCase(); }).join(' ');
    return hay.indexOf(q) !== -1;
  }
  /* One picture shows static, 2+ get ‹ › arrows and a "1 of N" counter,
     none gets a plain grey placeholder block. The arrows keep their
     position per car in slideIdx, so flipping through one car does
     not reset the others. */
  function carSlideshowHtml(c) {
    var pics = carPicsOf(c);
    if (!pics.length) return '<div class="slideshow"><div class="slide-empty">No picture yet</div></div>';
    var idx = slideIdx[c.id] || 0;
    if (idx >= pics.length) idx = 0;
    var h = '<div class="slideshow"><img class="slide-img" src="' + esc(pics[idx]) + '" alt="' + esc(carLabel(c)) + '">';
    if (pics.length > 1) {
      h += '<button class="slide-btn prev" data-slide-prev="' + c.id + '" aria-label="Previous picture">‹</button>' +
        '<button class="slide-btn next" data-slide-next="' + c.id + '" aria-label="Next picture">›</button>' +
        '<span class="slide-count">' + (idx + 1) + ' of ' + pics.length + '</span>';
    }
    h += '</div>';
    return h;
  }
  function carCardHtml(c) {
    var specs = [];
    if (c.plate) specs.push('Plate ' + c.plate);
    if (c.seats) specs.push(c.seats + ' seats');
    if (c.fuel) specs.push(c.fuel);
    if (c.transmission) specs.push(c.transmission);
    return '<div class="item-card">' + carSlideshowHtml(c) +
      '<h3>' + esc(carLabel(c)) + '</h3>' +
      '<span class="price">' + money(c.price_per_day) + '/day</span>' +
      (specs.length ? '<span class="stock">' + esc(specs.join(' · ')) + '</span>' : '') +
      (c.description ? '<p class="info">' + esc(c.description) + '</p>' : '') +
      '<div class="row"><button data-book="' + c.id + '">Book this car</button>' +
      '<button class="small btn-soft" data-details="' + c.id + '" aria-label="View details">→</button></div>' +
      '</div>';
  }
  function renderCarsGrid() {
    var grid = $('cars-grid');
    if (!grid) return;
    var q = (carSearch || '').toLowerCase();
    var cars = (rental.cars || []).filter(function (c) { return carMatches(c, q); });
    if (!cars.length) {
      grid.innerHTML = '<div class="card"><p class="info">No cars match your search.</p></div>';
      return;
    }
    var h = '<div class="item-grid">';
    cars.forEach(function (c) { h += carCardHtml(c); });
    h += '</div>';
    grid.innerHTML = h;
  }
  function attachCarCardListeners(root) {
    root.querySelectorAll('[data-slide-prev]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-slide-prev');
        var pics = carPicsOf(carById(id));
        if (!pics.length) return;
        slideIdx[id] = ((slideIdx[id] || 0) - 1 + pics.length) % pics.length;
        renderCars();
      });
    });
    root.querySelectorAll('[data-slide-next]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-slide-next');
        var pics = carPicsOf(carById(id));
        if (!pics.length) return;
        slideIdx[id] = ((slideIdx[id] || 0) + 1) % pics.length;
        renderCars();
      });
    });
    root.querySelectorAll('[data-book]').forEach(function (b) {
      b.addEventListener('click', function () {
        pendingBookCarId = Number(b.getAttribute('data-book'));
        detailCarId = null;
        show('book');
      });
    });
    root.querySelectorAll('[data-details]').forEach(function (b) {
      b.addEventListener('click', function () {
        detailCarId = Number(b.getAttribute('data-details'));
        renderCars();
      });
    });
  }
  /* Details popup, modelled on the Cars "I'm interested" popup: an
     overlay that closes on a backdrop tap, a card with a ✕ button,
     the pictures up top and every field below. */
  function carDetailsHtml(c) {
    var rows = [
      ['Plate', c.plate], ['Make', c.make], ['Model', c.model], ['Year', c.year],
      ['Seats', c.seats], ['Fuel', c.fuel], ['Transmission', c.transmission],
      ['Price per day', money(c.price_per_day)]
    ];
    var h = '<div class="modal-overlay" data-close-details><div class="modal">' +
      '<button class="modal-close" data-close-details aria-label="Close">✕</button>' +
      carSlideshowHtml(c) +
      '<h3>' + esc(carLabel(c)) + '</h3>' +
      '<span class="price">' + money(c.price_per_day) + '/day</span>' +
      '<div class="detail-list">';
    rows.forEach(function (r) {
      if (r[1] === '' || r[1] == null) return;
      h += '<div class="detail-row"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>';
    });
    h += '</div>';
    if (c.description) h += '<p class="info">' + esc(c.description) + '</p>';
    h += '<div class="row"><button data-book="' + c.id + '">Book this car</button></div></div></div>';
    return h;
  }
  function renderCars() {
    var el = $('view-cars');
    if (!rental) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var h = '<h2>' + esc(rental.name) + '</h2>';
    if (rental.about) h += '<p class="info">' + esc(rental.about) + '</p>';
    if (rental.address || rental.phone || rental.hours) {
      h += '<div class="card info">';
      if (rental.address) h += '<p>📍 ' + esc(rental.address) + '</p>';
      if (rental.phone) h += '<p>📞 ' + esc(rental.phone) + '</p>';
      if (rental.hours) h += '<p>🕐 ' + esc(rental.hours) + '</p>';
      h += '</div>';
    }
    var cars = rental.cars || [];
    if (!cars.length) {
      h += '<div class="card"><p class="info">No cars yet — the owner adds cars in Setup.</p></div>';
      el.innerHTML = h;
      return;
    }
    h += '<input id="car-search" type="text" placeholder="Search cars…" value="' + esc(carSearch) + '" class="veh-search">';
    h += '<div id="cars-grid"></div>';
    h += '<div class="card"><p class="info">Found one you like? Book it from the <b>Book</b> tab — pick your dates and see the total before you send it. You pay at pickup.</p></div>';
    if (detailCarId != null) {
      var dc = carById(detailCarId);
      if (dc) h += carDetailsHtml(dc);
      else detailCarId = null;
    }
    el.innerHTML = h;
    var search = $('car-search');
    if (search) search.addEventListener('input', function () {
      carSearch = search.value;
      renderCarsGrid();
      attachCarCardListeners($('cars-grid'));
    });
    renderCarsGrid();
    attachCarCardListeners(el);
    el.querySelectorAll('[data-close-details]').forEach(function (n) {
      n.addEventListener('click', function (e) {
        if (e && e.target && e.target !== n) return;
        detailCarId = null;
        renderCars();
      });
    });
  }

  /* ---------- Book (public form) ---------- */
  function bookDays() {
    var pick = $('bk-pickup') ? $('bk-pickup').value : '';
    var ret = $('bk-return') ? $('bk-return').value : '';
    if (!pick || !ret) return 0;
    var d = Math.round((new Date(ret + 'T12:00:00') - new Date(pick + 'T12:00:00')) / 86400000);
    return Math.max(1, d);
  }
  function updateBookTotal() {
    var out = $('bk-total');
    if (!out) return;
    var c = carById($('bk-car').value);
    var pick = $('bk-pickup').value;
    var ret = $('bk-return').value;
    if (!c) { out.innerHTML = ''; return; }
    if (!pick || !ret) {
      out.innerHTML = '<div class="total">' + money(c.price_per_day) + '/day — pick your dates to see the total</div>';
      return;
    }
    if (ret < pick) {
      out.innerHTML = '<div class="total">Return date must be on or after the pickup date.</div>';
      return;
    }
    var days = bookDays();
    var total = round2(days * Number(c.price_per_day || 0));
    out.innerHTML = '<div class="total">' + days + (days === 1 ? ' day' : ' days') + ' × ' + money(c.price_per_day) + ' = <span class="big">' + money(total) + '</span></div>';
  }
  function renderBook() {
    var el = $('view-book');
    if (!rental) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var cars = rental.cars || [];
    var drivers = rental.drivers || [];
    var h = '<h2>Book a car — ' + esc(rental.name) + '</h2><div class="card direct-help">' +
      '<span class="field-label">Car ' + helpHtml('car') + '</span><select id="bk-car">' +
      (cars.length
        ? cars.map(function (c) { return '<option value="' + c.id + '">' + esc(carLabel(c)) + (c.plate ? ' (' + esc(c.plate) + ')' : '') + ' — ' + money(c.price_per_day) + '/day</option>'; }).join('')
        : '<option value="">No cars yet</option>') +
      '</select>' +
      '<span class="field-label">Driver ' + helpHtml('driver') + '</span><select id="bk-driver">' +
      '<option value="">Self-drive</option>' +
      drivers.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + '</option>'; }).join('') +
      '</select>' +
      '<span class="field-label">Your name ' + helpHtml('name') + '</span><input id="bk-name" type="text" placeholder="Full name">' +
      '<span class="field-label">Phone ' + helpHtml('phone') + '</span><input id="bk-phone" type="tel" placeholder="Phone number">' +
      '<span class="field-label">Email (optional) ' + helpHtml('email') + '</span><input id="bk-email" type="email" placeholder="Email address">' +
      '<span class="field-label">Pickup date ' + helpHtml('pickup') + '</span><input id="bk-pickup" type="date" value="' + todayLocal() + '">' +
      '<span class="field-label">Return date ' + helpHtml('ret') + '</span><input id="bk-return" type="date" value="' + tomorrowLocal() + '">' +
      '<div id="bk-total"></div>' +
      '<div class="row"><button id="bk-go">Book this car</button></div>' +
      '<p class="error" id="bk-err" hidden></p>' +
      '<div id="bk-out" style="margin-top:12px"></div></div>';
    el.innerHTML = h;
    wireHelp(el);
    if (pendingBookCarId != null) {
      var sel = $('bk-car');
      if (sel && carById(pendingBookCarId)) sel.value = pendingBookCarId;
      pendingBookCarId = null;
    }
    ['bk-car', 'bk-pickup', 'bk-return'].forEach(function (id) {
      $(id).addEventListener('change', updateBookTotal);
    });
    updateBookTotal();
    $('bk-go').addEventListener('click', function () {
      var err = $('bk-err');
      var out = $('bk-out');
      var c = carById($('bk-car').value);
      var driver = driverById($('bk-driver').value);
      var driverId = driver ? String(driver.id) : '';
      var driverName = driver ? driver.name : 'Self-drive';
      var name = $('bk-name').value.trim();
      var phone = $('bk-phone').value.trim();
      var email = $('bk-email').value.trim();
      var pickup = $('bk-pickup').value;
      var ret = $('bk-return').value;
      if (!c) { err.hidden = false; err.textContent = 'Pick a car first.'; return; }
      if (!name) { err.hidden = false; err.textContent = 'Your name is required.'; return; }
      if (!phone) { err.hidden = false; err.textContent = 'Your phone number is required.'; return; }
      if (!pickup) { err.hidden = false; err.textContent = 'Pick a pickup date.'; return; }
      if (!ret) { err.hidden = false; err.textContent = 'Pick a return date.'; return; }
      if (ret < pickup) { err.hidden = false; err.textContent = 'Return date must be on or after the pickup date.'; return; }
      err.hidden = true;
      var label = carLabel(c) + (c.plate ? ' (' + c.plate + ')' : '');
      var days = bookDays();
      var total = round2(days * Number(c.price_per_day || 0));
      rpc('place_rentals_booking', { p_slug: SLUG, p_car: String(c.id), p_driver: driverId, p_name: name, p_phone: phone, p_email: email, p_pickup: pickup, p_return: ret }).then(function (res) {
        var id = (res && typeof res === 'object') ? (res.id != null ? res.id : res.booking_id) : res;
        out.innerHTML = '<p class="info">✓ Booked — rental #RB-' + esc(id) + ': ' + esc(label) + ' from ' + esc(pickup) + ' to ' + esc(ret) + ' (' + days + (days === 1 ? ' day' : ' days') + ', ' + money(total) + ') for ' + esc(name) + '. Pay at pickup — show your name when you collect the car.</p>';
        notifyEmail('Car rental booking: ' + label, 'rentals_booking', { slug: SLUG, name: name, phone: phone, email: email, car: label, driver: driverName, pickup: pickup, return: ret, days: days, total: total });
      }).catch(function (e) {
        err.hidden = false;
        err.textContent = 'Error: ' + e.message;
      });
    });
  }

  /* ---------- Bookings (employee password) ---------- */
  function empGate(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the employee password for this rental company to see bookings.</p>' +
      '<label>Employee password</label><input id="emp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="emp-go">Unlock</button></div>' +
      '<p class="error" id="emp-err" hidden></p></div>';
    $('emp-go').addEventListener('click', function () {
      var pw = $('emp-pass').value;
      rpc('check_rentals_employee_pass', { p_slug: SLUG, p_password: pw }).then(function (ok) {
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
    return rpc('list_rentals_bookings', { p_slug: SLUG, p_epass: empPass }).then(function (d) {
      bookings = d || [];
      if (currentView === 'bookings') renderBookingsList();
      return bookings;
    }).catch(function (e) { if (!quiet) throw e; });
  }
  function renderBookings() {
    var el = $('view-bookings');
    if (!rental) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Bookings', renderBookings); return; }
    el.innerHTML = '<h2>Bookings — ' + esc(rental.name) + '</h2><p class="info">Bookings refresh on their own every few seconds.</p><div id="bookings-list"><p class="info">Loading…</p></div>';
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
    var c = d.car ? carById(d.car) : null;
    if (c) lines.push('Car: ' + esc(carLabel(c)) + (c.plate ? ' (' + esc(c.plate) + ')' : ''));
    else if (d.car) lines.push('Car: ' + esc(d.car));
    var dr = d.driver ? driverById(d.driver) : null;
    lines.push('Driver: ' + esc(dr ? dr.name : 'Self-drive'));
    if (d.pickup || d.return) lines.push('When: ' + esc(d.pickup || '') + (d.return ? ' → ' + esc(d.return) : ''));
    if (d.days != null && d.days !== '') lines.push('Days: ' + esc(d.days));
    if (d.total != null && d.total !== '') lines.push('Total: ' + money(d.total));
    return lines.join('<br>');
  }
  function renderBookingsList() {
    var el = $('bookings-list');
    if (!el) return;
    if (!bookings.length) { el.innerHTML = '<div class="card"><p class="info">No bookings yet.</p></div>'; return; }
    var h = '';
    if (bookingsErr) h += '<p class="error">' + esc(bookingsErr) + '</p>';
    bookings.forEach(function (b) {
      h += '<div class="card"><h3>Booking #RB-' + esc(b.id) +
        (b.status && b.status !== 'active' ? ' <span class="voided">(' + esc(b.status) + ')</span>' : '') + '</h3>' +
        '<p class="info">' + esc(fmtDT(b.created_at)) + '</p>' +
        '<p>' + bookingDetails(b) + '</p>' +
        (b.status === 'active'
          ? (cancelConfirmId === b.id
            ? '<p><b>Cancel this booking?</b></p><div class="row"><button class="small danger" data-cancel-yes="' + b.id + '" data-kind="booking">Yes, cancel</button><button class="small secondary" data-cancel-no="' + b.id + '">Keep it</button></div>'
            : '<div class="row"><button class="small" data-done="' + b.id + '" data-kind="booking">Mark done</button><button class="small danger" data-cancel="' + b.id + '" data-kind="booking">Cancel</button></div>')
          : '') +
        '</div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-done]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-done'));
        var kind = btn.getAttribute('data-kind');
        btn.disabled = true;
        rpc('update_rentals_booking', { p_slug: SLUG, p_epass: empPass, p_kind: kind, p_id: id, p_status: 'done' })
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
        rpc('update_rentals_booking', { p_slug: SLUG, p_epass: empPass, p_kind: kind, p_id: id, p_status: 'cancelled' })
          .then(function () { cancelConfirmId = null; bookingsErr = ''; return loadBookings(); })
          .catch(function (e) { cancelConfirmId = null; bookingsErr = 'Error: ' + e.message; renderBookingsList(); });
      });
    });
  }

  /* ---------- Setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    if (!rental) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (!ownerCreds) {
      el.innerHTML = '<h2>Setup</h2><div class="card">' +
        '<p class="info">Enter the username and password Yently gave this rental company.</p>' +
        '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
        '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
        '<div class="row"><button id="st-go">Log in</button></div>' +
        '<p class="error" id="st-err" hidden></p></div>';
      $('st-go').addEventListener('click', function () {
        var u = $('st-user').value.trim();
        var p = $('st-pass').value;
        rpc('check_rentals_login', { p_slug: SLUG, p_u: u, p_p: p }).then(function (ok) {
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
    var h = '<h2>Setup — ' + esc(rental.name) + '</h2>' +
      '<div class="card"><h3>Rental company details</h3>' +
      '<p class="info">Changes save as a draft. Upload for approval and the admin makes them live.</p>' +
      '<label>Company name</label><input id="d-name" type="text" value="' + esc(draft.name || '') + '">' +
      '<label>Icon picture</label>' +
      '<div class="icon-field">' +
      '<img id="setup-icon-preview" class="icon-preview" src="' + esc(draft.icon || '') + '" alt=""' + (draft.icon ? '' : ' hidden') + '>' +
      '<input id="setup-icon-file" type="file" accept="image/*">' +
      '<button type="button" id="setup-icon-remove" class="small secondary">Remove icon</button>' +
      '</div>' +
      '<p class="info" id="setup-icon-out">One small picture shown next to the company name. It is shrunk to 200px before uploading.</p>' +
      '<label>Address</label><input id="d-address" type="text" value="' + esc(draft.address || '') + '">' +
      '<label>Phone</label><input id="d-phone" type="tel" value="' + esc(draft.phone || '') + '">' +
      '<label>Hours</label><input id="d-hours" type="text" value="' + esc(draft.hours || '') + '">' +
      '<label>About</label><textarea id="d-about">' + esc(draft.about || '') + '</textarea>' +
      '<div class="row"><button id="d-save">Save draft</button>' +
      '<button id="d-upload" class="secondary">Upload for approval</button></div>' +
      '<p class="info" id="d-status">Draft status: ' + esc(draftStatus) + (draftStatus === 'pending' ? ' — waiting for Yently to approve it.' : draftStatus === 'approved' ? ' — approved, live now.' : ' — not sent yet.') + '</p>' +
      '<p class="error" id="d-err" hidden></p></div>' +
      '<div class="card"><h3>Cars</h3>' +
      '<p class="info">Cars go live right away — no approval needed.</p>' +
      '<div id="cars-list"></div>' +
      '<h3 id="car-form-title">Add a car</h3>' +
      '<label>Plate</label><input id="c-plate" type="text" placeholder="e.g. DEMO-001">' +
      '<label>Make</label><input id="c-make" type="text" placeholder="e.g. Toyota">' +
      '<label>Model</label><input id="c-model" type="text" placeholder="e.g. Camry LE">' +
      '<label>Year</label><input id="c-year" type="number" min="1900" max="2100" step="1" inputmode="numeric">' +
      '<label>Seats</label><input id="c-seats" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 5">' +
      '<label>Fuel</label><input id="c-fuel" type="text" placeholder="Petrol, Diesel, Electric, Hybrid…">' +
      '<label>Transmission</label><input id="c-transmission" type="text" placeholder="Automatic, Manual…">' +
      '<label>Price per day</label><input id="c-price" type="number" min="0" step="0.01" inputmode="decimal">' +
      '<label>Description</label><textarea id="c-desc"></textarea>' +
      '<label>Pictures (up to 7)</label>' +
      '<input id="c-pics" type="file" accept="image/*" multiple>' +
      '<div id="c-pics-list"></div>' +
      '<p class="error" id="c-pics-status" hidden></p>' +
      '<div class="row"><button id="c-save">Save car</button>' +
      '<button id="c-cancel" class="secondary" hidden>Cancel edit</button></div>' +
      '<p class="error" id="c-err" hidden></p></div>' +
      '<div class="card"><h3>Drivers</h3>' +
      '<p class="info">Drivers go live right away — no approval needed. Customers pick a driver, or drive themselves.</p>' +
      '<div id="drivers-list"></div>' +
      '<h3 id="driver-form-title">Add a driver</h3>' +
      '<label>Name</label><input id="dr-name" type="text" placeholder="Full name">' +
      '<label>Phone</label><input id="dr-phone" type="tel" placeholder="Phone number">' +
      '<label>Email (optional)</label><input id="dr-email" type="email" placeholder="Email address">' +
      '<label>Licence number</label><input id="dr-licence" type="text" placeholder="e.g. DL-123456">' +
      '<div class="row"><button id="dr-save">Save driver</button>' +
      '<button id="dr-cancel" class="secondary" hidden>Cancel edit</button></div>' +
      '<p class="error" id="dr-err" hidden></p></div>';
    el.innerHTML = h;
    renderCarsList();
    renderDriversList();
    $('d-save').addEventListener('click', function () { saveDraft(false); });
    $('d-upload').addEventListener('click', function () { saveDraft(true); });
    $('c-save').addEventListener('click', saveCar);
    $('c-cancel').addEventListener('click', function () { carEditId = null; renderSetup(); });
    $('dr-save').addEventListener('click', saveDriver);
    $('dr-cancel').addEventListener('click', function () { driverEditId = null; renderSetup(); });
    if (!carEditId) carPics = [];
    renderCarPics();
    $('c-pics').addEventListener('change', onCarPicsChosen);
    wireIconField();
  }
  function renderCarsList() {
    var el = $('cars-list');
    if (!el) return;
    var cars = rental.cars || [];
    if (!cars.length) { el.innerHTML = '<p class="info">No cars yet.</p>'; return; }
    var h = '';
    cars.forEach(function (c) {
      h += '<div class="cart-line"><div><b>' + esc(carLabel(c)) + '</b><br><span class="info">' + money(c.price_per_day) + '/day' + (c.plate ? ' · ' + esc(c.plate) : '') + '</span></div>' +
        '<div class="row"><button class="small secondary" data-edit="' + c.id + '">Edit</button>' +
        (delConfirmId === c.id
          ? '<span><b>Delete "' + esc(carLabel(c)) + '"?</b> <button class="small danger" data-del-yes="' + c.id + '">Yes, delete</button> <button class="small secondary" data-del-no="' + c.id + '">Keep it</button></span>'
          : '<button class="small danger" data-del="' + c.id + '">Delete</button>') + '</div></div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = carById(Number(b.getAttribute('data-edit')));
        if (!c) return;
        carEditId = c.id;
        $('c-plate').value = c.plate || '';
        $('c-make').value = c.make || '';
        $('c-model').value = c.model || '';
        $('c-year').value = c.year == null ? '' : c.year;
        $('c-seats').value = c.seats == null ? '' : c.seats;
        $('c-fuel').value = c.fuel || '';
        $('c-transmission').value = c.transmission || '';
        $('c-price').value = c.price_per_day == null ? '' : c.price_per_day;
        $('c-desc').value = c.description || '';
        carPics = (c.pics || []).slice();
        renderCarPics();
        $('car-form-title').textContent = 'Edit car — ' + carLabel(c);
        $('c-cancel').hidden = false;
        window.scrollTo(0, document.getElementById('car-form-title').offsetTop - 80);
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        delConfirmId = Number(b.getAttribute('data-del'));
        renderCarsList();
      });
    });
    el.querySelectorAll('[data-del-no]').forEach(function (b) {
      b.addEventListener('click', function () { delConfirmId = null; renderCarsList(); });
    });
    el.querySelectorAll('[data-del-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = carById(Number(b.getAttribute('data-del-yes')));
        if (!c) return;
        b.disabled = true;
        rpc('delete_rentals_car', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_car_id: c.id })
          .then(function () { delConfirmId = null; return loadRental(); })
          .then(function () { renderSetup(); })
          .catch(function (e) { delConfirmId = null; renderCarsList(); var er = $('c-err'); if (er) { er.hidden = false; er.textContent = 'Error: ' + e.message; } });
      });
    });
  }
  function renderDriversList() {
    var el = $('drivers-list');
    if (!el) return;
    var drivers = rental.drivers || [];
    if (!drivers.length) { el.innerHTML = '<p class="info">No drivers yet.</p>'; return; }
    var h = '';
    drivers.forEach(function (d) {
      h += '<div class="cart-line"><div><b>' + esc(d.name) + '</b><br><span class="info">' + (d.phone ? esc(d.phone) : '') + (d.licence ? ' · ' + esc(d.licence) : '') + '</span></div>' +
        '<div class="row"><button class="small secondary" data-dr-edit="' + d.id + '">Edit</button>' +
        (delDriverConfirmId === d.id
          ? '<span><b>Delete "' + esc(d.name) + '"?</b> <button class="small danger" data-dr-del-yes="' + d.id + '">Yes, delete</button> <button class="small secondary" data-dr-del-no="' + d.id + '">Keep it</button></span>'
          : '<button class="small danger" data-dr-del="' + d.id + '">Delete</button>') + '</div></div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-dr-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = driverById(Number(b.getAttribute('data-dr-edit')));
        if (!d) return;
        driverEditId = d.id;
        $('dr-name').value = d.name || '';
        $('dr-phone').value = d.phone || '';
        $('dr-email').value = d.email || '';
        $('dr-licence').value = d.licence || '';
        $('driver-form-title').textContent = 'Edit driver — ' + d.name;
        $('dr-cancel').hidden = false;
        window.scrollTo(0, document.getElementById('driver-form-title').offsetTop - 80);
      });
    });
    el.querySelectorAll('[data-dr-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        delDriverConfirmId = Number(b.getAttribute('data-dr-del'));
        renderDriversList();
      });
    });
    el.querySelectorAll('[data-dr-del-no]').forEach(function (b) {
      b.addEventListener('click', function () { delDriverConfirmId = null; renderDriversList(); });
    });
    el.querySelectorAll('[data-dr-del-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = driverById(Number(b.getAttribute('data-dr-del-yes')));
        if (!d) return;
        b.disabled = true;
        rpc('delete_rentals_driver', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_driver_id: d.id })
          .then(function () { delDriverConfirmId = null; return loadRental(); })
          .then(function () { renderSetup(); })
          .catch(function (e) { delDriverConfirmId = null; renderDriversList(); var er = $('dr-err'); if (er) { er.hidden = false; er.textContent = 'Error: ' + e.message; } });
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
    if (!d.name) { err.hidden = false; err.textContent = 'Company name is required.'; return; }
    err.hidden = true;
    rpc('save_rentals_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_draft: d })
      .then(function () {
        draft = d;
        draftStatus = 'editing';
        if (!upload) {
          $('d-status').textContent = 'Draft status: editing — saved, not sent yet.';
          return;
        }
        return rpc('submit_rentals_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p }).then(function () {
          draftStatus = 'pending';
          $('d-status').textContent = 'Draft status: pending — waiting for Yently to approve it.';
          notifyEmail('Car rental draft for approval: ' + d.name, 'rentals_draft', { slug: SLUG, name: d.name });
        });
      })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  /* ---------- Car pictures (Setup) ---------- */
  /* Shrink a picture in the browser before it is stored. Car
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
  /* Upload one picture to the product-images bucket, under store/rentals/,
     and return its public URL. Anon uploads are only allowed under
     store/ — this path qualifies, and the bucket is publicly readable. */
  function uploadCarPicture(file) {
    return shrinkImage(file, 800, 0.8).then(function (up) {
      var safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = 'store/rentals/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
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
  function renderCarPics() {
    var el = $('c-pics-list');
    if (!el) return;
    var h = '<p class="info">' + carPics.length + ' of 7 pictures</p>';
    if (carPics.length) {
      h += '<div class="pic-thumbs">';
      carPics.forEach(function (url, i) {
        h += '<div class="pic-thumb"><img src="' + esc(url) + '" alt="Car picture ' + (i + 1) + '"><button class="small danger" data-pic-remove="' + i + '">Remove</button></div>';
      });
      h += '</div>';
    }
    el.innerHTML = h;
    el.querySelectorAll('[data-pic-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        carPics.splice(Number(b.getAttribute('data-pic-remove')), 1);
        renderCarPics();
      });
    });
  }
  function onCarPicsChosen() {
    var input = $('c-pics');
    var status = $('c-pics-status');
    var files = (input && input.files) ? Array.prototype.slice.call(input.files) : [];
    if (!files.length) return;
    var room = 7 - carPics.length;
    if (room <= 0) {
      if (status) { status.hidden = false; status.textContent = 'This car already has 7 pictures — remove one to add another.'; }
      input.value = '';
      return;
    }
    if (files.length > room) {
      if (status) { status.hidden = false; status.textContent = 'Only 7 pictures per car — the extra ' + (files.length - room) + ' picture(s) were not added.'; }
    } else if (status) { status.hidden = true; }
    input.value = '';
    var chain = Promise.resolve();
    files.slice(0, room).forEach(function (file) {
      chain = chain.then(function () { return uploadCarPicture(file); }).then(function (url) {
        carPics.push(url);
        renderCarPics();
      }).catch(function (err) {
        if (status) { status.hidden = false; status.textContent = 'Upload failed: ' + err.message; }
      });
    });
  }
  function collectCar() {
    var year = $('c-year').value.trim();
    var seats = $('c-seats').value.trim();
    var price = $('c-price').value.trim();
    return {
      plate: $('c-plate').value.trim(),
      make: $('c-make').value.trim(),
      model: $('c-model').value.trim(),
      year: year === '' ? null : Math.floor(Number(year)),
      seats: seats === '' ? null : Math.floor(Number(seats)),
      fuel: $('c-fuel').value.trim(),
      transmission: $('c-transmission').value.trim(),
      price_per_day: price === '' ? 0 : Number(price),
      description: $('c-desc').value.trim(),
      pics: carPics.slice()
    };
  }
  function saveCar() {
    var err = $('c-err');
    var v = collectCar();
    if (!v.make) { err.hidden = false; err.textContent = 'Make is required.'; return; }
    if (!(v.price_per_day >= 0)) { err.hidden = false; err.textContent = 'Price per day must be 0 or more.'; return; }
    err.hidden = true;
    if (carEditId) v.id = carEditId;
    rpc('save_rentals_car', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_car: v })
      .then(function () { carEditId = null; return loadRental(); })
      .then(function () { renderSetup(); })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function collectDriver() {
    return {
      name: $('dr-name').value.trim(),
      phone: $('dr-phone').value.trim(),
      email: $('dr-email').value.trim(),
      licence: $('dr-licence').value.trim()
    };
  }
  function saveDriver() {
    var err = $('dr-err');
    var v = collectDriver();
    if (!v.name) { err.hidden = false; err.textContent = 'Driver name is required.'; return; }
    err.hidden = true;
    if (driverEditId) v.id = driverEditId;
    rpc('save_rentals_driver', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_driver: v })
      .then(function () { driverEditId = null; return loadRental(); })
      .then(function () { renderSetup(); })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function loadDraft() {
    rpc('get_rentals_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p })
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
      $('site-name').textContent = 'Car Rental';
      $('view-cars').innerHTML = '<div class="card"><h2>Car rental not found</h2><p class="info">This car rental page needs your own rental link — ask Yently for it.</p></div>';
      return;
    }
    loadRental().then(function (d) {
      if (!d) {
        $('site-name').textContent = 'Car Rental';
        $('view-cars').innerHTML = '<div class="card"><h2>Car rental not found</h2><p class="info">No rental company with this link yet. Ask Yently to set it up.</p></div>';
        return;
      }
      return rpc('rentals_pass_status', { p_slug: SLUG }).then(function (st) {
        passLocked = st === 'locked';
        empUnlocked = !passLocked;
        renderCars();
      });
    }).catch(function (e) {
      $('view-cars').innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  resolveSlug().then(function () { init(); });
})();
