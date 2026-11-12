/* Laundry page app — ONE folder for every laundry.
   The laundry comes from its own private link, and its info,
   services, and orders live in the database — there is no data.json
   file here. Every laundry has its own services and orders,
   but they all use this same page.
   Visitors browse the services, add them to a basket, and place an
   order for pickup or delivery on a chosen date. Payment is when the
   clothes are collected or delivered — nothing is charged online.
   The Orders tab needs the laundry's shared employee password
   (one password for all staff, set by the admin; laundries with
   none set stay fully open). Setup needs the owner's own username +
   password. Setup edits save as a draft, and the Upload button sends
   the draft to the admin for approval — approval makes it live
   instantly. Services are different: the owner adds, edits,
   and deletes them live in Setup, no approval needed. All credentials
   live in memory only: a reload asks again, exactly like the other
   folder pages. */
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
  var SLUG = String(params.l || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
  var SLUG_FROM_PATH = false;
  var slugResolved = false;
  if (!SLUG) {
    // Clean link (yently.com/<slug>): the middleware rewrites the
    // page server-side, so location.search is empty in the browser.
    // The laundry slug is then the last path segment. Ignore this
    // system's own folder name, so a bare /laundry visit still
    // shows "not found" by design.
    var segs = location.pathname.split('/').filter(function (s) { return s; });
    var lastSeg = (segs[segs.length - 1] || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    if (lastSeg && lastSeg !== 'laundry') { SLUG = lastSeg; SLUG_FROM_PATH = true; }
  }
  // Clean link (yently.com/<slug>): the name in the link is the CLEAN
  // name, which usually differs from the laundry's own slug.
  // The middleware rewrites the page, but the browser address stays
  // clean, so look the clean name up in clean_links (public read)
  // and use the real laundry slug. Only runs when the slug came from
  // the path (no ?l= query). Fails open: any error keeps
  // the path slug, and the laundry just shows "not found" as before.
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

  var laundry = null; // live laundry info + services (visitors)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var ownerCreds = null; // {u, p} in memory only, never stored
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
    window.ShopChat.mountBubble(wrap, { ownerType: 'laundry', ownerKey: SLUG, shopName: shopName || 'this shop', ownerEmail: ownerEmail || '' });
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
      window.ShopChat.mountInbox(box, { ownerType: 'laundry', ownerKey: SLUG, creds: { u: ownerCreds.u, p: ownerCreds.p } });
      btn.textContent = 'Close chats';
    });
  }
  var empPass = null; // employee password in memory only, never stored
  var empUnlocked = false; // true once the employee password is entered, or when the laundry has none set
  var passLocked = false;
  var bookings = [];
  var bookingsTimer = null;
  var currentView = 'services';
  var serviceEditId = null; // service being edited in Setup, null = adding
  var cancelConfirmId = null; // order id awaiting an in-page cancel confirmation
  var bookingsErr = ''; // last orders error, shown inline above the list
  var delConfirmId = null; // service id awaiting an in-page delete confirmation
  var serviceSearch = ''; // public services search text, kept while typing
  var slideIdx = {}; // service id -> current slideshow picture index
  var basket = {}; // service id -> quantity
  var servicePics = []; // picture URLs for the service being added/edited in Setup

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
  function refOf(id) {
    return 'LA-' + String(id).padStart(6, '0');
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
  /* Best-effort owner email, same shape as the other folder pages: the
     table differs per call (order, draft approval). */
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
    basket: 'What you picked so far. Change a quantity with + and −, or remove a line entirely, before you send the order.',
    name: 'Your own name — the person placing the order. The laundry uses it to know whose clothes these are.',
    phone: 'Your phone number, so the laundry can reach you about pickup or delivery. Digits only is fine — spaces or dashes do no harm.',
    email: 'Your email address — optional. The laundry can send your order details here.',
    fulfilment: 'Pickup means you bring the clothes in and collect them when they are ready. Delivery means the laundry collects and brings them back.',
    date: 'The day you want the clothes picked up or brought in. The laundry confirms the ready time with you.',
    payment: 'How you want to pay. Either way, you pay when the clothes are collected or delivered — nothing is charged online.',
    note: 'Anything the laundry should know — stains, special care, a gate code for delivery, or when you will be home.'
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
     the original file). Same pattern as the other folder pages. */
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
  function serviceById(id) {
    return (laundry.services || []).filter(function (s) { return String(s.id) === String(id); })[0] || null;
  }
  function loadLaundry() {
    return rpc('get_laundry_live', { p_slug: SLUG }).then(function (d) {
      laundry = d;
      setHeader();
      return d;
    });
  }

  /* ---------- views ---------- */
  function show(view) {
    currentView = view;
    if (view !== 'setup') stopShopChat();
    ['services', 'order', 'orders', 'setup'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.hidden = v !== view;
    });
    var tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    if (bookingsTimer) { clearInterval(bookingsTimer); bookingsTimer = null; }
    if (view === 'services') renderServices();
    if (view === 'order') renderOrder();
    if (view === 'orders') { renderOrders(); bookingsTimer = setInterval(function () { if (currentView === 'orders' && empUnlocked) loadBookings(true); }, 5000); }
    if (view === 'setup') renderSetup();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
  });
  $('to-top').addEventListener('click', function () { window.scrollTo(0, 0); });

  function setHeader() {
    $('site-name').textContent = laundry ? laundry.name : 'Laundry';
    renderHeaderIcon(laundry && laundry.icon ? laundry.icon : '');
    $('site-about').textContent = laundry
      ? [laundry.address, laundry.phone].filter(Boolean).join(' · ')
      : '';
    $('site-footer').innerHTML = laundry
      ? esc([laundry.address, laundry.phone].filter(Boolean).join(' · ')) + '<br>Powered by Yently'
      : 'Powered by Yently';
    document.title = (laundry ? laundry.name : 'Laundry') + ' — Laundry';
  }

  /* ---------- Services (public list + basket) ---------- */
  function servicePicsOf(s) { return (s && Array.isArray(s.pics)) ? s.pics : []; }
  function serviceMatches(s, q) {
    if (!q) return true;
    var hay = [s.name, s.category, s.price, money(s.price), s.description]
      .map(function (x) { return String(x == null ? '' : x).toLowerCase(); }).join(' ');
    return hay.indexOf(q) !== -1;
  }
  function sortedServices() {
    var list = (laundry.services || []).slice();
    list.sort(function (a, b) { return Number(a.price || 0) - Number(b.price || 0); });
    return list;
  }
  /* One picture shows static, 2+ get ‹ › arrows and a "1 of N" counter,
     none gets a plain grey placeholder block. The arrows keep their
     position per service in slideIdx, so flipping through one service
     does not reset the others. */
  function serviceSlideshowHtml(s) {
    var pics = servicePicsOf(s);
    if (!pics.length) return '<div class="slideshow"><div class="slide-empty">No picture yet</div></div>';
    var idx = slideIdx[s.id] || 0;
    if (idx >= pics.length) idx = 0;
    var h = '<div class="slideshow"><img class="slide-img" src="' + esc(pics[idx]) + '" alt="' + esc(s.name) + '">';
    if (pics.length > 1) {
      h += '<button class="slide-btn prev" data-slide-prev="' + s.id + '" aria-label="Previous picture">‹</button>' +
        '<button class="slide-btn next" data-slide-next="' + s.id + '" aria-label="Next picture">›</button>' +
        '<span class="slide-count">' + (idx + 1) + ' of ' + pics.length + '</span>';
    }
    h += '</div>';
    return h;
  }
  function basketQty(id) { return basket[String(id)] || 0; }
  function basketLines() {
    var lines = [];
    Object.keys(basket).forEach(function (id) {
      var q = basket[id];
      if (!q) return;
      var s = serviceById(id);
      if (!s) return;
      lines.push({ service: s, qty: q, lineTotal: round2(Number(s.price || 0) * q) });
    });
    return lines;
  }
  function basketTotal() {
    return round2(basketLines().reduce(function (sum, l) { return sum + l.lineTotal; }, 0));
  }
  function basketCount() {
    return basketLines().reduce(function (sum, l) { return sum + l.qty; }, 0);
  }
  function setQty(id, qty) {
    if (qty <= 0) delete basket[String(id)];
    else basket[String(id)] = qty;
  }
  function serviceCardHtml(s) {
    var q = basketQty(s.id);
    var stepper = q > 0
      ? '<span class="qty"><button data-dec="' + s.id + '" aria-label="One less">−</button><b>' + q + '</b><button data-inc="' + s.id + '" aria-label="One more">+</button></span>'
      : '<button data-add="' + s.id + '">Add</button>';
    return '<div class="item-card">' + serviceSlideshowHtml(s) +
      '<h3>' + esc(s.name) + '</h3>' +
      (s.category ? '<span class="cat">' + esc(s.category) + '</span>' : '') +
      '<span class="price">' + money(s.price) + '</span>' +
      (s.description ? '<p class="info">' + esc(s.description) + '</p>' : '') +
      '<div class="row">' + stepper + '</div>' +
      '</div>';
  }
  function renderServicesGrid() {
    var grid = $('services-grid');
    if (!grid) return;
    var q = (serviceSearch || '').toLowerCase();
    var services = sortedServices().filter(function (s) { return serviceMatches(s, q); });
    if (!services.length) {
      grid.innerHTML = '<div class="card"><p class="info">No services match your search.</p></div>';
      return;
    }
    /* Grouped by category, in the order each category first appears
       after the price sort, so the cheapest service is always first. */
    var cats = [];
    var byCat = {};
    services.forEach(function (s) {
      var c = s.category || 'Services';
      if (!byCat[c]) { byCat[c] = []; cats.push(c); }
      byCat[c].push(s);
    });
    var h = '';
    cats.forEach(function (c) {
      h += '<h3>' + esc(c) + '</h3><div class="item-grid">';
      byCat[c].forEach(function (s) { h += serviceCardHtml(s); });
      h += '</div>';
    });
    grid.innerHTML = h;
  }
  function attachServiceCardListeners(root) {
    root.querySelectorAll('[data-slide-prev]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-slide-prev');
        var pics = servicePicsOf(serviceById(id));
        if (!pics.length) return;
        slideIdx[id] = ((slideIdx[id] || 0) - 1 + pics.length) % pics.length;
        renderServices();
      });
    });
    root.querySelectorAll('[data-slide-next]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-slide-next');
        var pics = servicePicsOf(serviceById(id));
        if (!pics.length) return;
        slideIdx[id] = ((slideIdx[id] || 0) + 1) % pics.length;
        renderServices();
      });
    });
    root.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        setQty(b.getAttribute('data-add'), 1);
        renderServices();
      });
    });
    root.querySelectorAll('[data-inc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-inc');
        setQty(id, basketQty(id) + 1);
        renderServices();
      });
    });
    root.querySelectorAll('[data-dec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-dec');
        setQty(id, basketQty(id) - 1);
        renderServices();
      });
    });
  }
  function renderBasketCard() {
    var el = $('basket-card');
    if (!el) return;
    var lines = basketLines();
    if (!lines.length) {
      el.innerHTML = '<p class="info">Your basket is empty — tap <b>Add</b> on a service to start an order.</p>';
      return;
    }
    var h = '';
    lines.forEach(function (l) {
      h += '<div class="cart-line"><div><b>' + esc(l.service.name) + '</b> × ' + l.qty + '<br><span class="info">' + money(l.service.price) + ' each</span></div>' +
        '<div class="row"><span class="qty"><button data-dec="' + l.service.id + '" aria-label="One less">−</button><b>' + l.qty + '</b><button data-inc="' + l.service.id + '" aria-label="One more">+</button></span>' +
        '<b>' + money(l.lineTotal) + '</b></div></div>';
    });
    h += '<div class="total">Total <span class="big">' + money(basketTotal()) + '</span></div>' +
      '<div class="row"><button id="basket-go">Go to Order</button></div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-inc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-inc');
        setQty(id, basketQty(id) + 1);
        renderServices();
      });
    });
    el.querySelectorAll('[data-dec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-dec');
        setQty(id, basketQty(id) - 1);
        renderServices();
      });
    });
    var go = $('basket-go');
    if (go) go.addEventListener('click', function () { show('order'); });
  }
  function renderServices() {
    var el = $('view-services');
    if (!laundry) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var h = '<h2>' + esc(laundry.name) + '</h2>';
    if (laundry.about) h += '<p class="info">' + esc(laundry.about) + '</p>';
    if (laundry.address || laundry.phone || laundry.hours) {
      h += '<div class="card info">';
      if (laundry.address) h += '<p>📍 ' + esc(laundry.address) + '</p>';
      if (laundry.phone) h += '<p>📞 ' + esc(laundry.phone) + '</p>';
      if (laundry.hours) h += '<p>🕐 ' + esc(laundry.hours) + '</p>';
      h += '</div>';
    }
    var services = laundry.services || [];
    if (!services.length) {
      h += '<div class="card"><p class="info">No services yet — the owner adds services in Setup.</p></div>';
      el.innerHTML = h;
      return;
    }
    h += '<input id="service-search" type="text" placeholder="Search services…" value="' + esc(serviceSearch) + '" class="veh-search">';
    h += '<div id="services-grid"></div>';
    h += '<div class="card"><h3>Your basket' + (basketCount() ? ' <span class="badge">' + basketCount() + '</span>' : '') + '</h3><div id="basket-card"></div></div>';
    h += '<div class="card"><p class="info">Found what you need? Add it to your basket, then finish your order from the <b>Order</b> tab. You pay when the clothes are collected or delivered.</p></div>';
    el.innerHTML = h;
    var search = $('service-search');
    if (search) search.addEventListener('input', function () {
      serviceSearch = search.value;
      renderServicesGrid();
      attachServiceCardListeners($('services-grid'));
    });
    renderServicesGrid();
    attachServiceCardListeners(el);
    renderBasketCard();
  }

  /* ---------- Order (public form + receipt) ---------- */
  function orderFormValue(name) {
    var r = document.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : '';
  }
  function renderOrderBasket() {
    var el = $('ord-basket');
    if (!el) return;
    var lines = basketLines();
    if (!lines.length) {
      el.innerHTML = '<p class="info">Your basket is empty — add services from the <b>Services</b> tab first.</p>';
      return;
    }
    var h = '';
    lines.forEach(function (l) {
      h += '<div class="cart-line"><div><b>' + esc(l.service.name) + '</b><br><span class="info">' + money(l.service.price) + ' each</span></div>' +
        '<div class="row"><span class="qty"><button data-dec="' + l.service.id + '" aria-label="One less">−</button><b>' + l.qty + '</b><button data-inc="' + l.service.id + '" aria-label="One more">+</button></span>' +
        '<b>' + money(l.lineTotal) + '</b>' +
        '<button class="small danger" data-remove="' + l.service.id + '">Remove</button></div></div>';
    });
    h += '<div class="total">Total <span class="big">' + money(basketTotal()) + '</span></div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-inc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-inc');
        setQty(id, basketQty(id) + 1);
        renderOrderBasket();
      });
    });
    el.querySelectorAll('[data-dec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-dec');
        setQty(id, basketQty(id) - 1);
        renderOrderBasket();
      });
    });
    el.querySelectorAll('[data-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        setQty(b.getAttribute('data-remove'), 0);
        renderOrderBasket();
      });
    });
  }
  function renderOrder() {
    var el = $('view-order');
    if (!laundry) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var h = '<h2>Order — ' + esc(laundry.name) + '</h2><div class="card direct-help">' +
      '<span class="field-label">Your basket ' + helpHtml('basket') + '</span><div id="ord-basket"></div>' +
      '<span class="field-label">Your name ' + helpHtml('name') + '</span><input id="ord-name" type="text" placeholder="Full name">' +
      '<span class="field-label">Phone ' + helpHtml('phone') + '</span><input id="ord-phone" type="tel" placeholder="Phone number">' +
      '<span class="field-label">Email (optional) ' + helpHtml('email') + '</span><input id="ord-email" type="email" placeholder="Email address">' +
      '<span class="field-label">Pickup or delivery ' + helpHtml('fulfilment') + '</span>' +
      '<div><label class="choice"><input type="radio" name="ord-fulfilment" value="pickup" checked> Pickup</label>' +
      '<label class="choice"><input type="radio" name="ord-fulfilment" value="delivery"> Delivery</label></div>' +
      '<span class="field-label">Date ' + helpHtml('date') + '</span><input id="ord-date" type="date" value="' + todayLocal() + '" min="' + todayLocal() + '">' +
      '<span class="field-label">Payment ' + helpHtml('payment') + '</span>' +
      '<div><label class="choice"><input type="radio" name="ord-payment" value="Cash" checked> Cash</label>' +
      '<label class="choice"><input type="radio" name="ord-payment" value="Online"> Online</label></div>' +
      '<span class="field-label">Note (optional) ' + helpHtml('note') + '</span><textarea id="ord-note" placeholder="Anything the laundry should know…"></textarea>' +
      '<div class="row"><button id="ord-go">Place order</button></div>' +
      '<p class="error" id="ord-err" hidden></p>' +
      '<div id="ord-out" style="margin-top:12px"></div></div>';
    el.innerHTML = h;
    wireHelp(el);
    renderOrderBasket();
    $('ord-go').addEventListener('click', function () {
      var err = $('ord-err');
      var out = $('ord-out');
      var lines = basketLines();
      var name = $('ord-name').value.trim();
      var phone = $('ord-phone').value.trim();
      var email = $('ord-email').value.trim();
      var fulfilment = orderFormValue('ord-fulfilment') || 'pickup';
      var date = $('ord-date').value;
      var payment = orderFormValue('ord-payment') || 'Cash';
      var note = $('ord-note').value.trim();
      if (!lines.length) { err.hidden = false; err.textContent = 'Your basket is empty — add a service first.'; return; }
      if (!name) { err.hidden = false; err.textContent = 'Your name is required.'; return; }
      if (!phone) { err.hidden = false; err.textContent = 'Your phone number is required.'; return; }
      if (!date) { err.hidden = false; err.textContent = 'Pick a date.'; return; }
      err.hidden = true;
      var total = basketTotal();
      var items = lines.map(function (l) { return { service_id: l.service.id, qty: l.qty }; });
      var linesText = lines.map(function (l) { return l.service.name + ' × ' + l.qty + ' — ' + money(l.lineTotal); }).join(', ');
      rpc('place_laundry_order', { p_slug: SLUG, p_items: items, p_name: name, p_phone: phone, p_email: email, p_fulfilment: fulfilment, p_date: date, p_payment: payment, p_note: note }).then(function (res) {
        var id = (res && typeof res === 'object') ? (res.id != null ? res.id : res.booking_id) : res;
        var ref = refOf(id);
        var payLine = fulfilment === 'pickup' ? 'Pay at pickup' : 'Pay on delivery';
        var h2 = '<div class="note"><p><b>✓ Order placed — ' + esc(ref) + '</b></p>' +
          '<p>' + esc(linesText) + '<br>Total: <b>' + money(total) + '</b></p>' +
          '<p>' + esc(name) + ' · ' + esc(phone) + '</p>' +
          '<p>' + (fulfilment === 'pickup' ? 'Pickup' : 'Delivery') + ' · ' + esc(date) + ' · ' + esc(payment) + '</p>' +
          '<p>' + payLine + ' — show your name and order number when the clothes are collected or delivered.</p></div>';
        out.innerHTML = h2;
        basket = {};
        renderOrderBasket();
        notifyEmail('Laundry order ' + ref + ': ' + name, 'laundry_order', { slug: SLUG, name: name, phone: phone, email: email, items: linesText, fulfilment: fulfilment, date: date, payment: payment, total: total, note: note });
      }).catch(function (e) {
        err.hidden = false;
        err.textContent = 'Error: ' + e.message;
      });
    });
  }

  /* ---------- Orders (employee password) ---------- */
  function empGate(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the employee password for this laundry to see orders.</p>' +
      '<label>Employee password</label><input id="emp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="emp-go">Unlock</button></div>' +
      '<p class="error" id="emp-err" hidden></p></div>';
    $('emp-go').addEventListener('click', function () {
      var pw = $('emp-pass').value;
      rpc('check_laundry_employee_pass', { p_slug: SLUG, p_password: pw }).then(function (ok) {
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
    return rpc('list_laundry_bookings', { p_slug: SLUG, p_epass: empPass }).then(function (d) {
      bookings = d || [];
      if (currentView === 'orders') renderOrdersList();
      return bookings;
    }).catch(function (e) { if (!quiet) throw e; });
  }
  function renderOrders() {
    var el = $('view-orders');
    if (!laundry) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Orders', renderOrders); return; }
    el.innerHTML = '<h2>Orders — ' + esc(laundry.name) + '</h2><p class="info">Orders refresh on their own every few seconds.</p><div id="orders-list"><p class="info">Loading…</p></div>';
    loadBookings().catch(function (e) {
      var l = $('orders-list');
      if (l) l.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  function orderItemsSummary(d) {
    var items = d.items || d.services || d.lines || [];
    if (typeof items === 'string') return esc(items);
    if (!Array.isArray(items) || !items.length) return '';
    var parts = items.map(function (it) {
      var nm = it.name || it.service_name || '';
      if (!nm) {
        var s = serviceById(it.service_id != null ? it.service_id : (it.service != null ? it.service : it.id));
        nm = s ? s.name : (it.service_id != null ? 'Service ' + it.service_id : 'Service');
      }
      return esc(nm) + ' × ' + esc(it.qty != null ? it.qty : 1);
    });
    return parts.join(', ');
  }
  function orderDetails(b) {
    var d = b.data || {};
    var lines = [];
    if (d.name) lines.push('<b>' + esc(d.name) + '</b>');
    if (d.phone) lines.push('Phone: ' + esc(d.phone));
    if (d.email) lines.push('Email: ' + esc(d.email));
    var items = orderItemsSummary(d);
    if (items) lines.push('Items: ' + items);
    if (d.total != null && d.total !== '') lines.push('Total: ' + money(d.total));
    if (d.fulfilment) lines.push((d.fulfilment === 'pickup' ? 'Pickup' : 'Delivery') + (d.date ? ' · ' + esc(d.date) : ''));
    if (d.payment) lines.push('Payment: ' + esc(d.payment));
    if (d.note) lines.push('Note: ' + esc(d.note));
    return lines.join('<br>');
  }
  function statusBadge(status) {
    var st = String(status || 'pending');
    return '<span class="status-badge st-' + esc(st) + '">' + esc(st) + '</span>';
  }
  function renderOrdersList() {
    var el = $('orders-list');
    if (!el) return;
    if (!bookings.length) { el.innerHTML = '<div class="card"><p class="info">No orders yet.</p></div>'; return; }
    var h = '';
    if (bookingsErr) h += '<p class="error">' + esc(bookingsErr) + '</p>';
    bookings.forEach(function (b) {
      var st = String(b.status || 'pending');
      h += '<div class="card"><h3>Order ' + esc(refOf(b.id)) + ' ' + statusBadge(st) + '</h3>' +
        '<p class="info">' + esc(fmtDT(b.created_at)) + '</p>' +
        '<p>' + orderDetails(b) + '</p>';
      if (st === 'pending') {
        h += '<div class="row"><button class="small" data-advance="' + b.id + '" data-to="washing">Start washing</button>' +
          '<button class="small danger" data-cancel="' + b.id + '">Cancel</button></div>';
      } else if (st === 'washing') {
        h += '<div class="row"><button class="small" data-advance="' + b.id + '" data-to="ready">Mark ready</button>' +
          '<button class="small danger" data-cancel="' + b.id + '">Cancel</button></div>';
      } else if (st === 'ready') {
        h += '<div class="row"><button class="small" data-advance="' + b.id + '" data-to="delivered">Mark delivered</button>' +
          '<button class="small danger" data-cancel="' + b.id + '">Cancel</button></div>';
      }
      if (cancelConfirmId === b.id) {
        h += '<p><b>Cancel this order?</b></p><div class="row"><button class="small danger" data-cancel-yes="' + b.id + '">Yes, cancel</button><button class="small secondary" data-cancel-no="' + b.id + '">Keep it</button></div>';
      }
      h += '</div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-advance]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-advance'));
        var to = btn.getAttribute('data-to');
        btn.disabled = true;
        rpc('update_laundry_booking', { p_slug: SLUG, p_epass: empPass, p_kind: 'order', p_id: id, p_status: to })
          .then(function () { bookingsErr = ''; return loadBookings(); })
          .catch(function (e) { bookingsErr = 'Error: ' + e.message; renderOrdersList(); });
      });
    });
    el.querySelectorAll('[data-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        cancelConfirmId = Number(btn.getAttribute('data-cancel'));
        bookingsErr = '';
        renderOrdersList();
      });
    });
    el.querySelectorAll('[data-cancel-no]').forEach(function (btn) {
      btn.addEventListener('click', function () { cancelConfirmId = null; renderOrdersList(); });
    });
    el.querySelectorAll('[data-cancel-yes]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-cancel-yes'));
        btn.disabled = true;
        rpc('update_laundry_booking', { p_slug: SLUG, p_epass: empPass, p_kind: 'order', p_id: id, p_status: 'cancelled' })
          .then(function () { cancelConfirmId = null; bookingsErr = ''; return loadBookings(); })
          .catch(function (e) { cancelConfirmId = null; bookingsErr = 'Error: ' + e.message; renderOrdersList(); });
      });
    });
  }

  /* ---------- Setup (owner) ---------- */
  function renderSetup() {
    stopShopChat(); // re-render destroys the inbox container; stop its poll first
    var el = $('view-setup');
    if (!laundry) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (!ownerCreds) {
      el.innerHTML = '<h2>Setup</h2><div class="card">' +
        '<p class="info">Enter the username and password Yently gave this laundry.</p>' +
        '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
        '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
        '<div class="row"><button id="st-go">Log in</button></div>' +
        '<p class="error" id="st-err" hidden></p></div>';
      $('st-go').addEventListener('click', function () {
        var u = $('st-user').value.trim();
        var p = $('st-pass').value;
        rpc('check_laundry_login', { p_slug: SLUG, p_u: u, p_p: p }).then(function (ok) {
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
    var h = '<h2>Setup — ' + esc(laundry.name) + '</h2>' +
      '<div class="card"><h3>Laundry details</h3>' +
      '<p class="info">Changes save as a draft. Upload for approval and the admin makes them live.</p>' +
      '<label>Laundry name</label><input id="d-name" type="text" value="' + esc(draft.name || '') + '">' +
      '<label>Icon picture</label>' +
      '<div class="icon-field">' +
      '<img id="setup-icon-preview" class="icon-preview" src="' + esc(draft.icon || '') + '" alt=""' + (draft.icon ? '' : ' hidden') + '>' +
      '<input id="setup-icon-file" type="file" accept="image/*">' +
      '<button type="button" id="setup-icon-remove" class="small secondary">Remove icon</button>' +
      '</div>' +
      '<p class="info" id="setup-icon-out">One small picture shown next to the laundry name. It is shrunk to 200px before uploading.</p>' +
      '<label>Address</label><input id="d-address" type="text" value="' + esc(draft.address || '') + '">' +
      '<label>Phone</label><input id="d-phone" type="tel" value="' + esc(draft.phone || '') + '">' +
      '<label>Hours</label><input id="d-hours" type="text" value="' + esc(draft.hours || '') + '">' +
      '<label>About</label><textarea id="d-about">' + esc(draft.about || '') + '</textarea>' +
      '<div class="row"><button id="d-save">Save draft</button>' +
      '<button id="d-upload" class="secondary">Upload for approval</button></div>' +
      '<p class="info" id="d-status">Draft status: ' + esc(draftStatus) + (draftStatus === 'pending' ? ' — waiting for Yently to approve it.' : draftStatus === 'approved' ? ' — approved, live now.' : ' — not sent yet.') + '</p>' +
      '<p class="error" id="d-err" hidden></p></div>' +
      '<div class="card"><h3>Services</h3>' +
      '<p class="info">Services go live right away — no approval needed.</p>' +
      '<div id="services-list"></div>' +
      '<h3 id="service-form-title">Add a service</h3>' +
      '<label>Name</label><input id="s-name" type="text" placeholder="e.g. Wash &amp; Fold">' +
      '<label>Category</label><input id="s-category" type="text" placeholder="e.g. Wash, Dry Cleaning, Ironing…">' +
      '<label>Price</label><input id="s-price" type="number" min="0" step="0.01" inputmode="decimal">' +
      '<label>Description</label><textarea id="s-desc"></textarea>' +
      '<label>Pictures (up to 7)</label>' +
      '<input id="s-pics" type="file" accept="image/*" multiple>' +
      '<div id="s-pics-list"></div>' +
      '<p class="error" id="s-pics-status" hidden></p>' +
      '<div class="row"><button id="s-save">Save service</button>' +
      '<button id="s-cancel" class="secondary" hidden>Cancel edit</button></div>' +
      '<p class="error" id="s-err" hidden></p></div>' +
      '<div class="card"><h3>Chats</h3>' +
      '<p class="info">Messages from visitors on this page. Visitors only see the chat bubble once Yently switches live chat on for this shop.</p>' +
      '<div class="row"><button type="button" id="setup-chats-toggle" class="secondary">Open chats</button></div>' +
      '<div id="setup-chats"></div></div>';
    el.innerHTML = h;
    wireShopChatInbox();
    renderServicesList();
    $('d-save').addEventListener('click', function () { saveDraft(false); });
    $('d-upload').addEventListener('click', function () { saveDraft(true); });
    $('s-save').addEventListener('click', saveService);
    $('s-cancel').addEventListener('click', function () { serviceEditId = null; renderSetup(); });
    if (!serviceEditId) servicePics = [];
    renderServicePics();
    $('s-pics').addEventListener('change', onServicePicsChosen);
    wireIconField();
  }
  function renderServicesList() {
    var el = $('services-list');
    if (!el) return;
    var services = sortedServices();
    if (!services.length) { el.innerHTML = '<p class="info">No services yet.</p>'; return; }
    var h = '';
    services.forEach(function (s) {
      h += '<div class="cart-line"><div><b>' + esc(s.name) + '</b><br><span class="info">' + money(s.price) + (s.category ? ' · ' + esc(s.category) : '') + '</span></div>' +
        '<div class="row"><button class="small secondary" data-edit="' + s.id + '">Edit</button>' +
        (delConfirmId === s.id
          ? '<span><b>Delete "' + esc(s.name) + '"?</b> <button class="small danger" data-del-yes="' + s.id + '">Yes, delete</button> <button class="small secondary" data-del-no="' + s.id + '">Keep it</button></span>'
          : '<button class="small danger" data-del="' + s.id + '">Delete</button>') + '</div></div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = serviceById(Number(b.getAttribute('data-edit')));
        if (!s) return;
        serviceEditId = s.id;
        $('s-name').value = s.name || '';
        $('s-category').value = s.category || '';
        $('s-price').value = s.price == null ? '' : s.price;
        $('s-desc').value = s.description || '';
        servicePics = (s.pics || []).slice();
        renderServicePics();
        $('service-form-title').textContent = 'Edit service — ' + s.name;
        $('s-cancel').hidden = false;
        window.scrollTo(0, document.getElementById('service-form-title').offsetTop - 80);
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        delConfirmId = Number(b.getAttribute('data-del'));
        renderServicesList();
      });
    });
    el.querySelectorAll('[data-del-no]').forEach(function (b) {
      b.addEventListener('click', function () { delConfirmId = null; renderServicesList(); });
    });
    el.querySelectorAll('[data-del-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = serviceById(Number(b.getAttribute('data-del-yes')));
        if (!s) return;
        b.disabled = true;
        rpc('delete_laundry_service', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_service_id: s.id })
          .then(function () { delConfirmId = null; return loadLaundry(); })
          .then(function () { renderSetup(); })
          .catch(function (e) { delConfirmId = null; renderServicesList(); var er = $('s-err'); if (er) { er.hidden = false; er.textContent = 'Error: ' + e.message; } });
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
    if (!d.name) { err.hidden = false; err.textContent = 'Laundry name is required.'; return; }
    err.hidden = true;
    rpc('save_laundry_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_draft: d })
      .then(function () {
        draft = d;
        draftStatus = 'editing';
        if (!upload) {
          $('d-status').textContent = 'Draft status: editing — saved, not sent yet.';
          return;
        }
        return rpc('submit_laundry_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p }).then(function () {
          draftStatus = 'pending';
          $('d-status').textContent = 'Draft status: pending — waiting for Yently to approve it.';
          notifyEmail('Laundry draft for approval: ' + d.name, 'laundry_draft', { slug: SLUG, name: d.name });
        });
      })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  /* ---------- Service pictures (Setup) ---------- */
  /* Shrink a picture in the browser before it is stored. Service
     pictures are shrunk to 800px on the long edge at JPEG quality 0.8
     — big enough to see the service, not high quality. PNGs stay PNG,
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
  /* Upload one picture to the product-images bucket, under store/laundry/,
     and return its public URL. Anon uploads are only allowed under
     store/ — this path qualifies, and the bucket is publicly readable. */
  function uploadServicePicture(file) {
    return shrinkImage(file, 800, 0.8).then(function (up) {
      var safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = 'store/laundry/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
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
  function renderServicePics() {
    var el = $('s-pics-list');
    if (!el) return;
    var h = '<p class="info">' + servicePics.length + ' of 7 pictures</p>';
    if (servicePics.length) {
      h += '<div class="pic-thumbs">';
      servicePics.forEach(function (url, i) {
        h += '<div class="pic-thumb"><img src="' + esc(url) + '" alt="Service picture ' + (i + 1) + '"><button class="small danger" data-pic-remove="' + i + '">Remove</button></div>';
      });
      h += '</div>';
    }
    el.innerHTML = h;
    el.querySelectorAll('[data-pic-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        servicePics.splice(Number(b.getAttribute('data-pic-remove')), 1);
        renderServicePics();
      });
    });
  }
  function onServicePicsChosen() {
    var input = $('s-pics');
    var status = $('s-pics-status');
    var files = (input && input.files) ? Array.prototype.slice.call(input.files) : [];
    if (!files.length) return;
    var room = 7 - servicePics.length;
    if (room <= 0) {
      if (status) { status.hidden = false; status.textContent = 'This service already has 7 pictures — remove one to add another.'; }
      input.value = '';
      return;
    }
    if (files.length > room) {
      if (status) { status.hidden = false; status.textContent = 'Only 7 pictures per service — the extra ' + (files.length - room) + ' picture(s) were not added.'; }
    } else if (status) { status.hidden = true; }
    input.value = '';
    var chain = Promise.resolve();
    files.slice(0, room).forEach(function (file) {
      chain = chain.then(function () { return uploadServicePicture(file); }).then(function (url) {
        servicePics.push(url);
        renderServicePics();
      }).catch(function (err) {
        if (status) { status.hidden = false; status.textContent = 'Upload failed: ' + err.message; }
      });
    });
  }
  function collectService() {
    var price = $('s-price').value.trim();
    return {
      name: $('s-name').value.trim(),
      category: $('s-category').value.trim(),
      price: price === '' ? 0 : Number(price),
      description: $('s-desc').value.trim(),
      pics: servicePics.slice()
    };
  }
  function saveService() {
    var err = $('s-err');
    var v = collectService();
    if (!v.name) { err.hidden = false; err.textContent = 'Service name is required.'; return; }
    if (!(v.price >= 0)) { err.hidden = false; err.textContent = 'Price must be 0 or more.'; return; }
    err.hidden = true;
    if (serviceEditId) v.id = serviceEditId;
    rpc('save_laundry_service', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_service: v })
      .then(function () { serviceEditId = null; return loadLaundry(); })
      .then(function () { renderSetup(); })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function loadDraft() {
    rpc('get_laundry_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p })
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
      $('site-name').textContent = 'Laundry';
      $('view-services').innerHTML = '<div class="card"><h2>Laundry not found</h2><p class="info">This laundry page needs your own laundry link — ask Yently for it.</p></div>';
      return;
    }
    loadLaundry().then(function (d) {
      if (!d) {
        $('site-name').textContent = 'Laundry';
        $('view-services').innerHTML = '<div class="card"><h2>Laundry not found</h2><p class="info">No laundry with this link yet. Ask Yently to set it up.</p></div>';
        return;
      }
      mountShopChatBubble(d.name, '');
      return rpc('laundry_pass_status', { p_slug: SLUG }).then(function (st) {
        passLocked = st === 'locked';
        empUnlocked = !passLocked;
        renderServices();
      });
    }).catch(function (e) {
      $('view-services').innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  resolveSlug().then(function () { init(); });
})();
