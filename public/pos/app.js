/* POS page app — ONE folder for every store.
   The store comes from the link (?s=<slug>), and its info, items, and
   sales live in the database — there is no data.json file here.
   Every store has its own items and sales, but they all use this same POS.
   Visitors see the public price list (Shop tab). The register (Sell) and
   the sales history (Receipts) need the store's shared employee password
   (one password for all staff, set by the admin; stores with none set
   stay fully open). Setup needs the owner's own username + password.
   Setup edits save as a draft, and the Upload button sends the draft to
   the admin for approval — approval makes it live instantly. Items are
   different: the owner adds, edits, and deletes items live in Setup, and
   every completed sale lowers the stock by itself. A voided sale puts
   the stock back. All credentials live in memory only: a reload asks
   again, exactly like the diner and barbershop pages.
   "Card" only records that the card was taken at the counter terminal —
   no card is charged online. */
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

  var store = null; // live store info + items (visitors)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var ownerCreds = null; // {u, p} in memory only, never stored
  var empPass = null; // employee password in memory only, never stored
  var empUnlocked = false; // true once the employee password is entered, or when the store has none set
  var passLocked = false;
  var cart = {}; // item id -> quantity
  var sales = [];
  var lastReceipt = null;
  var currentView = 'shop';
  var receiptsTimer = null;
  var itemEditId = null; // item being edited in Setup, null = adding
  var scanner = null; // running Html5Qrcode scanner, if any
  var scanTarget = null; // 'sell' (add to cart) or 'setup' (fill the barcode field)
  var lastScanCode = '';
  var lastScanAt = 0;
  var scanOverlay = null; // fixed overlay holding the camera view
  var voidConfirmId = null; // sale id awaiting an in-page void confirmation
  var voidErr = ''; // last void error, shown inline above the sales list
  var delConfirmId = null; // item id awaiting an in-page delete confirmation
  var shopQuery = ''; // current Shop search text, kept across re-renders
  var sellQuery = ''; // current Sell search/scan text, kept across re-renders
  var refocusSellSearch = false; // put the cursor back in the Sell search box after a scan/Enter add
  var itemPic = ''; // picture URL for the item being added/edited in Setup

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n || 0).toFixed(2); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function fmtDT(iso) {
    var d = new Date(iso);
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
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
        body: JSON.stringify({ subject: subject, table: 'pos_draft', record: record })
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
  /* ---------- Item pictures (one small picture per item) ---------- */
  /* Same rules as the icon: shrunk to 200px on the long edge, JPEG 0.8,
     PNGs stay PNG, small pictures untouched, failure falls back to the
     original file. Uploaded to store/pos-items/ so the anon upload
     policy (store/ only) allows it. The URL is stored on the item as
     `pic` and shown on Shop and Sell next to the item. */
  function shrinkItemPic(file) {
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
  function uploadItemPic(file) {
    return shrinkItemPic(file).then(function (up) {
      var safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = 'store/pos-items/' + SLUG + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
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
  /* Small thumbnail on the right of an item — 96x72, the same size as
     the dealer Setup thumbnails. Items without a picture show nothing. */
  function itemPicHtml(it) {
    return it && it.pic ? '<img class="item-thumb" src="' + esc(it.pic) + '" alt="">' : '';
  }
  /* Search matching: Shop filters by name/category; Sell also matches
     the barcode, so a scanner (or a typed code) finds its item. */
  function matchesShopQuery(it, q) {
    if (!q) return true;
    q = String(q).toLowerCase();
    return (it.name || '').toLowerCase().indexOf(q) !== -1 ||
      (it.category || '').toLowerCase().indexOf(q) !== -1;
  }
  function matchesSellQuery(it, q) {
    if (!q) return true;
    return matchesShopQuery(it, q) || String(it.barcode || '').toLowerCase().indexOf(String(q).toLowerCase()) !== -1;
  }
  function itemById(id) {
    return (store.items || []).filter(function (p) { return String(p.id) === String(id); })[0] || null;
  }
  function cartCount() {
    var n = 0;
    Object.keys(cart).forEach(function (k) { n += cart[k]; });
    return n;
  }
  function updateBadges() {
    var cc = $('cart-count');
    var c = cartCount();
    cc.hidden = c === 0;
    cc.textContent = c;
  }
  function taxRate() { return Number(store && store.taxRate != null ? store.taxRate : 0.08); }
  function cartTotals() {
    var sub = 0;
    Object.keys(cart).forEach(function (id) {
      var it = itemById(id);
      if (it) sub += Number(it.price) * cart[id];
    });
    sub = round2(sub);
    var tax = round2(sub * taxRate());
    return { sub: sub, tax: tax, total: round2(sub + tax) };
  }

  /* ---------- views ---------- */
  function show(view) {
    currentView = view;
    ['shop', 'sell', 'receipts', 'setup'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.hidden = v !== view;
    });
    var tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    if (receiptsTimer) { clearInterval(receiptsTimer); receiptsTimer = null; }
    if (view === 'shop') renderShop();
    if (view === 'sell') renderSell();
    if (view === 'receipts') { renderReceipts(); receiptsTimer = setInterval(function () { if (currentView === 'receipts' && empUnlocked) loadSales(true); }, 10000); }
    if (view === 'setup') renderSetup();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
  });
  $('to-top').addEventListener('click', function () { window.scrollTo(0, 0); });

  function setHeader() {
    $('site-name').textContent = store ? store.name : 'POS';
    renderHeaderIcon(store && store.icon ? store.icon : '');
    $('site-about').textContent = store
      ? [store.address, store.phone].filter(Boolean).join(' · ')
      : '';
    $('site-footer').innerHTML = store
      ? esc([store.address, store.phone].filter(Boolean).join(' · ')) + '<br>Powered by Yently'
      : 'Powered by Yently';
    document.title = (store ? store.name : 'POS') + ' — Point of Sale';
  }

  /* ---------- Shop (public price list) ---------- */
  function renderShop() {
    var el = $('view-shop');
    if (!store) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var h = '<h2>' + esc(store.name) + '</h2>';
    if (store.address || store.phone) h += '<p class="info">' + esc([store.address, store.phone].filter(Boolean).join(' · ')) + '</p>';
    /* The search box lives outside the results container, so typing
       never loses the cursor — only the list below is re-rendered. */
    h += '<input id="shop-search" type="text" placeholder="Search items…" value="' + esc(shopQuery) + '" autocomplete="off">';
    h += '<div id="shop-results"></div>';
    h += '<div class="card"><p class="info">Staff: open the <b>Sell</b> tab to ring up a sale. Tax ' + Math.round(taxRate() * 100) + '% is added at the till.</p></div>';
    el.innerHTML = h;
    $('shop-search').addEventListener('input', function () { shopQuery = this.value; renderShopResults(); });
    renderShopResults();
  }
  function renderShopResults() {
    var el = $('shop-results');
    if (!el) return;
    var items = (store.items || []).filter(function (it) { return matchesShopQuery(it, shopQuery); });
    if (!items.length) {
      el.innerHTML = (store.items || []).length
        ? '<div class="card"><p class="info">No items match your search.</p></div>'
        : '<div class="card"><p class="info">No items yet — the owner adds items in Setup.</p></div>';
      return;
    }
    var cats = [];
    items.forEach(function (it) {
      if (cats.indexOf(it.category || '') === -1) cats.push(it.category || '');
    });
    var h = '';
    cats.forEach(function (c) {
      h += '<h3>' + esc(c || 'Items') + '</h3><div class="item-grid">';
      items.filter(function (it) { return (it.category || '') === c; }).forEach(function (it) {
        h += '<div class="item-card"><div class="item-top"><div class="item-text"><h3>' + esc(it.name) + '</h3>' +
          '<span class="price">' + money(it.price) + '</span>' +
          (Number(it.stock) > 0
            ? '<span class="stock">' + Number(it.stock) + ' in stock</span>'
            : '<span class="out">Out of stock</span>') +
          '</div>' + itemPicHtml(it) + '</div></div>';
      });
      h += '</div>';
    });
    el.innerHTML = h;
  }

  /* ---------- Sell (cashier) ---------- */
  function empGate(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the employee password for this store to open the register.</p>' +
      '<label>Employee password</label><input id="emp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="emp-go">Unlock</button></div>' +
      '<p class="error" id="emp-err" hidden></p></div>';
    $('emp-go').addEventListener('click', function () {
      var pw = $('emp-pass').value;
      rpc('check_pos_employee_pass', { p_slug: SLUG, p_password: pw }).then(function (ok) {
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
  function renderSell() {
    var el = $('view-sell');
    if (!store) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Sell', renderSell); return; }
    var h = '<h2>Sell — ' + esc(store.name) + '</h2>';
    h += '<div class="card"><div class="row"><button id="sell-scan">📷 Scan barcode</button>' +
      '<span class="info">Point the phone camera at a product barcode to add it to the sale.</span></div>' +
      '<p class="info" id="scan-note" hidden></p></div>';
    if (lastReceipt) h += receiptHtml(lastReceipt);
    /* Search or scan: the box filters the list while typing, and a
       hardware barcode scanner (keyboard wedge: fast typing + Enter)
       works here too — Enter adds the scanned item. The box lives
       outside the results container so typing never loses the cursor. */
    h += '<input id="sell-search" type="text" placeholder="Search or scan barcode…" value="' + esc(sellQuery) + '" autocomplete="off" inputmode="search">';
    h += '<p class="error" id="sell-search-err" hidden></p>';
    h += '<div id="sell-results"></div>';
    h += '<div class="card"><h3>Current sale</h3><div id="cart-lines"></div>' +
      '<div id="cart-totals"></div>' +
      '<label>Customer name (optional)</label><input id="sale-name" type="text" placeholder="Name for the receipt">' +
      '<label>Customer phone (optional)</label><input id="sale-phone" type="tel" placeholder="Phone for the receipt">' +
      '<label>Payment</label><select id="sale-pay"><option value="cash">Cash</option><option value="card">Card</option></select>' +
      '<p class="info">Card only records that the card was taken at the counter terminal — no card is charged online.</p>' +
      '<label>Cash tendered</label><input id="sale-tendered" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00">' +
      '<div class="row"><button id="sale-complete">Complete sale</button>' +
      '<button id="sale-clear" class="secondary">Clear</button></div>' +
      '<p class="error" id="sale-err" hidden></p></div>';
    el.innerHTML = h;
    var pb = $('receipt-print');
    if (pb) pb.addEventListener('click', printReceipt);
    var scanBtn = $('sell-scan');
    if (scanBtn) scanBtn.addEventListener('click', function () { openScanner('sell'); });
    var sInput = $('sell-search');
    sInput.addEventListener('input', function () { sellQuery = this.value; hideSellSearchErr(); renderSellResults(); });
    sInput.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); sellSearchEnter(); } });
    $('sale-clear').addEventListener('click', function () { cart = {}; lastReceipt = null; updateBadges(); renderSell(); });
    $('sale-complete').addEventListener('click', completeSale);
    renderSellResults();
    renderCartLines();
    if (refocusSellSearch) {
      refocusSellSearch = false;
      if (sInput.focus) sInput.focus();
    }
  }
  function renderSellResults() {
    var el = $('sell-results');
    if (!el) return;
    var items = (store.items || []).filter(function (it) { return matchesSellQuery(it, sellQuery); });
    if (!items.length) {
      el.innerHTML = (store.items || []).length
        ? '<div class="card"><p class="info">No items match your search.</p></div>'
        : '<div class="card"><p class="info">No items to sell yet — add items in Setup first.</p></div>';
      return;
    }
    var cats = [];
    items.forEach(function (it) {
      if (cats.indexOf(it.category || '') === -1) cats.push(it.category || '');
    });
    var h = '';
    cats.forEach(function (c) {
      h += '<h3>' + esc(c || 'Items') + '</h3><div class="item-grid">';
      items.filter(function (it) { return (it.category || '') === c; }).forEach(function (it) {
        var inCart = cart[it.id] || 0;
        h += '<div class="item-card"><div class="item-top"><div class="item-text"><h3>' + esc(it.name) + '</h3>' +
          '<span class="price">' + money(it.price) + '</span>' +
          (Number(it.stock) > 0
            ? '<span class="stock">' + Number(it.stock) + ' in stock</span>'
            : '<span class="out">Out of stock</span>') +
          '</div>' + itemPicHtml(it) + '</div>' +
          (Number(it.stock) > 0
            ? '<button class="small" data-add="' + it.id + '">Add' + (inCart ? ' (' + inCart + ')' : '') + '</button>'
            : '<button class="small" disabled>Out of stock</button>') +
          '</div>';
      });
      h += '</div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () { addToCart(Number(b.getAttribute('data-add'))); });
    });
  }
  function showSellSearchErr(msg) {
    var e = $('sell-search-err');
    if (e) { e.hidden = false; e.textContent = msg; }
  }
  function hideSellSearchErr() {
    var e = $('sell-search-err');
    if (e) e.hidden = true;
  }
  function clearSellSearch() {
    sellQuery = '';
    var s = $('sell-search');
    if (s) s.value = '';
    hideSellSearchErr();
    renderSellResults();
  }
  /* Enter in the Sell search box. A hardware barcode scanner types the
     code and presses Enter, so this is the scanner path too — not only
     the phone camera. An exact barcode match adds that item; otherwise
     a single matching item is added; anything else stays on screen. */
  function sellSearchEnter() {
    var q = String(sellQuery || '').trim();
    if (!q) return;
    var items = store.items || [];
    var byBarcode = items.filter(function (it) { return String(it.barcode || '') !== '' && String(it.barcode) === q; })[0];
    if (byBarcode) {
      if (Number(byBarcode.stock) <= 0) { showSellSearchErr(byBarcode.name + ' is out of stock.'); return; }
      clearSellSearch();
      addToCart(byBarcode.id, true);
      return;
    }
    var matched = items.filter(function (it) { return matchesSellQuery(it, q); });
    if (matched.length === 1) {
      if (Number(matched[0].stock) <= 0) { showSellSearchErr(matched[0].name + ' is out of stock.'); return; }
      clearSellSearch();
      addToCart(matched[0].id, true);
      return;
    }
    if (matched.length === 0) {
      showSellSearchErr(/^\d+$/.test(q) ? 'No item with that barcode.' : 'No items match your search.');
      return;
    }
    /* Several matches: the filtered list below already shows them — the
       cashier picks one. */
  }
  function addToCart(id, fromSearch) {
    var it = itemById(id);
    if (!it || Number(it.stock) <= 0) return;
    var cur = cart[id] || 0;
    if (cur + 1 > Number(it.stock)) {
      var e = $('sale-err');
      if (e) { e.hidden = false; e.textContent = 'Only ' + Number(it.stock) + ' in stock for ' + it.name + '.'; }
      return;
    }
    cart[id] = cur + 1;
    updateBadges();
    if (fromSearch) refocusSellSearch = true;
    renderSell();
  }
  function renderCartLines() {
    var lines = $('cart-lines');
    var totals = $('cart-totals');
    if (!lines || !totals) return;
    var ids = Object.keys(cart);
    if (!ids.length) {
      lines.innerHTML = '<p class="info">Nothing in this sale yet — tap Add on an item.</p>';
      totals.innerHTML = '';
      return;
    }
    var h = '';
    ids.forEach(function (id) {
      var it = itemById(id);
      if (!it) return;
      h += '<div class="cart-line"><div><b>' + esc(it.name) + '</b><br><span class="info">' + money(it.price) + ' each</span></div>' +
        '<div class="qty"><button data-dec="' + id + '" aria-label="Less">−</button><span>' + cart[id] + '</span>' +
        '<button data-inc="' + id + '" aria-label="More">+</button></div>' +
        '<b>' + money(Number(it.price) * cart[id]) + '</b></div>';
    });
    lines.innerHTML = h;
    lines.querySelectorAll('[data-inc]').forEach(function (b) {
      b.addEventListener('click', function () { addToCart(Number(b.getAttribute('data-inc'))); });
    });
    lines.querySelectorAll('[data-dec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-dec');
        cart[id] -= 1;
        if (cart[id] <= 0) delete cart[id];
        updateBadges();
        renderSell();
      });
    });
    var t = cartTotals();
    totals.innerHTML = '<div class="total">Subtotal ' + money(t.sub) + '<br>Tax (' + Math.round(taxRate() * 100) + '%) ' + money(t.tax) +
      '<br><span class="big">Total ' + money(t.total) + '</span></div>';
  }
  function completeSale() {
    var ids = Object.keys(cart);
    var err = $('sale-err');
    if (!ids.length) { err.hidden = false; err.textContent = 'The sale is empty.'; return; }
    var t = cartTotals();
    var pay = $('sale-pay').value;
    var tendered = Number($('sale-tendered').value || 0);
    if (pay === 'cash' && tendered < t.total) {
      err.hidden = false;
      err.textContent = 'Cash tendered (' + money(tendered) + ') is less than the total (' + money(t.total) + ').';
      return;
    }
    err.hidden = true;
    var items = ids.map(function (id) { return { id: Number(id), qty: cart[id] }; });
    rpc('place_pos_sale', {
      p_slug: SLUG, p_epass: empPass, p_items: items,
      p_tendered: tendered, p_payment: pay,
      p_customer: { name: $('sale-name').value.trim(), phone: $('sale-phone').value.trim() }
    }).then(function (res) {
      cart = {};
      updateBadges();
      lastReceipt = {
        ref: res.ref, items: items.map(function (l) {
          var it = itemById(l.id);
          return { name: it ? it.name : 'Item', price: it ? Number(it.price) : 0, qty: l.qty };
        }),
        subtotal: res.subtotal, tax: res.tax, total: res.total, change: res.change,
        payment: pay, customer: $('sale-name').value.trim()
      };
      return loadStore();
    }).then(function () { renderSell(); })
    .catch(function (e2) {
      err.hidden = false;
      err.textContent = 'Error: ' + e2.message;
    });
  }
  function receiptHtml(r) {
    var h = '<div class="receipt"><h3>' + esc(store.name) + '</h3>' +
      '<p class="center">Receipt ' + esc(r.ref) + (r.customer ? ' · ' + esc(r.customer) : '') + '</p>';
    (r.items || []).forEach(function (l) {
      h += '<div class="line"><span>' + esc(l.name) + ' × ' + l.qty + '</span><span>' + money(Number(l.price) * l.qty) + '</span></div>';
    });
    h += '<div class="line"><span>Subtotal</span><span>' + money(r.subtotal) + '</span></div>' +
      '<div class="line"><span>Tax</span><span>' + money(r.tax) + '</span></div>' +
      '<div class="line"><b>Total</b><b>' + money(r.total) + '</b></div>' +
      '<div class="line"><span>Paid (' + esc(r.payment || 'cash') + ')</span><span>' + money(Number(r.total) + Number(r.change || 0)) + '</span></div>';
    if (Number(r.change || 0) > 0) h += '<div class="line"><span>Change</span><span>' + money(r.change) + '</span></div>';
    h += '<p class="center">' + esc(store.receiptMessage || 'Thank you!') + '</p>' +
      '<div class="row" style="justify-content:center"><button class="small" id="receipt-print">Print receipt</button></div></div>';
    return h;
  }
  function loadStore() {
    return rpc('get_pos_live', { p_slug: SLUG }).then(function (d) {
      store = d;
      setHeader();
      return d;
    });
  }

  /* ---------- Receipts (cashier) ---------- */
  function loadSales(quiet) {
    return rpc('list_pos_sales', { p_slug: SLUG, p_epass: empPass, p_limit: 50 }).then(function (d) {
      sales = d || [];
      if (currentView === 'receipts') renderReceiptsList();
      return sales;
    }).catch(function (e) { if (!quiet) throw e; });
  }
  function renderReceipts() {
    var el = $('view-receipts');
    if (!store) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Receipts', renderReceipts); return; }
    el.innerHTML = '<h2>Receipts — ' + esc(store.name) + '</h2><div id="sales-list"><p class="info">Loading…</p></div>';
    loadSales().catch(function (e) {
      var l = $('sales-list');
      if (l) l.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  function renderReceiptsList() {
    var el = $('sales-list');
    if (!el) return;
    if (!sales.length) { el.innerHTML = '<div class="card"><p class="info">No sales yet.</p></div>'; return; }
    var h = '';
    if (voidErr) h += '<p class="error">' + esc(voidErr) + '</p>';
    sales.forEach(function (s) {
      var items = s.items || [];
      var names = items.map(function (l) { return esc(l.name) + ' × ' + l.qty; }).join(', ');
      h += '<div class="card"><h3>' + esc(s.ref) + ' — ' + money(s.total) +
        (s.status === 'voided' ? ' <span class="voided">(voided)</span>' : '') + '</h3>' +
        '<p class="info">' + esc(fmtDT(s.created_at)) + ' · ' + esc(s.payment || 'cash') +
        (s.customer_name ? ' · ' + esc(s.customer_name) : '') + '</p>' +
        '<p>' + names + '</p>' +
        (s.status !== 'voided'
          ? (voidConfirmId === s.id
            ? '<p><b>Void this sale? The stock goes back.</b></p><div class="row"><button class="small danger" data-void-yes="' + s.id + '">Yes, void it</button><button class="small secondary" data-void-no="' + s.id + '">Keep it</button></div>'
            : '<button class="small danger" data-void="' + s.id + '">Void sale</button>')
          : '') +
        '</div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-void]').forEach(function (b) {
      b.addEventListener('click', function () {
        voidConfirmId = Number(b.getAttribute('data-void'));
        voidErr = '';
        renderReceiptsList();
      });
    });
    el.querySelectorAll('[data-void-no]').forEach(function (b) {
      b.addEventListener('click', function () { voidConfirmId = null; renderReceiptsList(); });
    });
    el.querySelectorAll('[data-void-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.getAttribute('data-void-yes'));
        b.disabled = true;
        rpc('void_pos_sale', { p_slug: SLUG, p_epass: empPass, p_sale_id: id })
          .then(function () { voidConfirmId = null; voidErr = ''; return loadStore(); })
          .then(function () { return loadSales(); })
          .catch(function (e) { voidConfirmId = null; voidErr = 'Error: ' + e.message; renderReceiptsList(); });
      });
    });
  }
  function printReceipt() {
    if (!lastReceipt) return;
    var r = lastReceipt;
    var h = '<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto">' +
      '<h3 style="text-align:center">' + esc(store.name) + '</h3>' +
      '<p style="text-align:center">Receipt ' + esc(r.ref) + '</p>';
    (r.items || []).forEach(function (l) {
      h += '<div style="display:flex;justify-content:space-between"><span>' + esc(l.name) + ' × ' + l.qty + '</span><span>' + money(Number(l.price) * l.qty) + '</span></div>';
    });
    h += '<div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>' + money(r.subtotal) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between"><span>Tax</span><span>' + money(r.tax) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between"><b>Total</b><b>' + money(r.total) + '</b></div>';
    if (Number(r.change || 0) > 0) h += '<div style="display:flex;justify-content:space-between"><span>Change</span><span>' + money(r.change) + '</span></div>';
    h += '<p style="text-align:center">' + esc(store.receiptMessage || 'Thank you!') + '</p></div>';
    $('print-area').innerHTML = h;
    window.print();
  }

  /* ---------- Barcode scanner (phone camera) ---------- */
  /* The camera reads the barcode with the phone itself — no extra
     hardware. The code is matched against this store's items, which
     are already loaded. In Sell it adds the item to the sale; in
     Setup it fills the barcode field of the item being added. The
     same code stays on screen while scanning, so one scan must not
     add the same item ten times — repeats within 2 seconds are
     ignored. */
  function openScanner(target) {
    scanTarget = target;
    if (typeof window.Html5Qrcode === 'undefined') {
      var msg = 'Scanner could not load — check your connection and try again.';
      var note0 = $('scan-note');
      if (note0) { note0.hidden = false; note0.textContent = msg; return; }
      var ierr = $('i-err');
      if (ierr) { ierr.hidden = false; ierr.textContent = msg; return; }
      return;
    }
    if (!scanOverlay) {
      scanOverlay = document.createElement('div');
      scanOverlay.id = 'scan-overlay';
      document.body.appendChild(scanOverlay);
    }
    scanOverlay.innerHTML = '<div class="scan-overlay"><h3>Scan barcode</h3>' +
      '<div id="pos-scanner"></div>' +
      '<p class="scan-status" id="scan-status">Point the camera at a barcode…</p>' +
      '<button id="scan-close">Close scanner</button></div>';
    scanOverlay.querySelector('#scan-close').addEventListener('click', closeScanner);
    scanner = new window.Html5Qrcode('pos-scanner');
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      function (code) { onScan(String(code).trim()); },
      function () { /* scan errors (no code in frame) are normal — ignore */ }
    ).catch(function (e) {
      var st = scanOverlay.querySelector('#scan-status');
      if (st) st.textContent = 'Could not open the camera: ' + (e && e.message ? e.message : e) + ' — allow camera access and try again.';
    });
  }
  function closeScanner() {
    if (scanner) {
      var s = scanner;
      scanner = null;
      try { s.stop().then(function () { try { s.clear(); } catch (e) {} }).catch(function () {}); } catch (e) {}
    }
    if (scanOverlay) scanOverlay.innerHTML = '';
    scanTarget = null;
  }
  function onScan(code) {
    if (!code) return;
    var now = Date.now();
    if (code === lastScanCode && now - lastScanAt < 2000) return;
    lastScanCode = code;
    lastScanAt = now;
    var st = scanOverlay && scanOverlay.querySelector('#scan-status');
    if (scanTarget === 'setup') {
      var field = $('i-barcode');
      if (field) field.value = code;
      if (st) st.textContent = '✓ Barcode ' + code + ' — tap Close scanner to keep it.';
      return;
    }
    var it = (store.items || []).filter(function (p) { return String(p.barcode || '') !== '' && String(p.barcode) === code; })[0];
    if (!it) {
      if (st) st.textContent = 'No item with barcode ' + code + ' — add it in Setup first.';
      return;
    }
    if (Number(it.stock) <= 0) {
      if (st) st.textContent = it.name + ' is out of stock.';
      return;
    }
    var cur = cart[it.id] || 0;
    if (cur + 1 > Number(it.stock)) {
      if (st) st.textContent = 'Only ' + Number(it.stock) + ' in stock for ' + it.name + '.';
      return;
    }
    cart[it.id] = cur + 1;
    updateBadges();
    if (st) st.textContent = '✓ Added ' + it.name + ' — scan the next item.';
    renderSell();
  }

  /* ---------- Setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    if (!store) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (!ownerCreds) {
      el.innerHTML = '<h2>Setup</h2><div class="card">' +
        '<p class="info">Enter the username and password Yently gave this store.</p>' +
        '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
        '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
        '<div class="row"><button id="st-go">Log in</button></div>' +
        '<p class="error" id="st-err" hidden></p></div>';
      $('st-go').addEventListener('click', function () {
        var u = $('st-user').value.trim();
        var p = $('st-pass').value;
        rpc('check_pos_login', { p_slug: SLUG, p_u: u, p_p: p }).then(function (ok) {
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
    var h = '<h2>Setup — ' + esc(store.name) + '</h2>' +
      '<div class="card"><h3>Store details</h3>' +
      '<p class="info">Changes save as a draft. Upload for approval and the admin makes them live.</p>' +
      '<label>Store name</label><input id="d-name" type="text" value="' + esc(draft.name || '') + '">' +
      '<label>Icon picture</label>' +
      '<div class="icon-field">' +
      '<img id="setup-icon-preview" class="icon-preview" src="' + esc(draft.icon || '') + '" alt=""' + (draft.icon ? '' : ' hidden') + '>' +
      '<input id="setup-icon-file" type="file" accept="image/*">' +
      '<button type="button" id="setup-icon-remove" class="small secondary">Remove icon</button>' +
      '</div>' +
      '<p class="info" id="setup-icon-out">One small picture shown next to the store name. It is shrunk to 200px before uploading.</p>' +
      '<label>Address</label><input id="d-address" type="text" value="' + esc(draft.address || '') + '">' +
      '<label>Phone</label><input id="d-phone" type="tel" value="' + esc(draft.phone || '') + '">' +
      '<label>Tax rate (%)</label><input id="d-tax" type="number" min="0" max="30" step="0.1" value="' + (Number(draft.taxRate || 0.08) * 100) + '">' +
      '<label>Receipt message</label><input id="d-msg" type="text" value="' + esc(draft.receiptMessage || '') + '">' +
      '<div class="row"><button id="d-save">Save draft</button>' +
      '<button id="d-upload" class="secondary">Upload for approval</button></div>' +
      '<p class="info" id="d-status">Draft status: ' + esc(draftStatus) + (draftStatus === 'pending' ? ' — waiting for Yently to approve it.' : draftStatus === 'approved' ? ' — approved, live now.' : ' — not sent yet.') + '</p>' +
      '<p class="error" id="d-err" hidden></p></div>' +
      '<div class="card"><h3>Items</h3>' +
      '<p class="info">Items go live right away — no approval needed. Stock drops by itself with every sale.</p>' +
      '<div id="items-list"></div>' +
      '<h3 id="item-form-title">Add an item</h3>' +
      '<label>Name</label><input id="i-name" type="text">' +
      '<label>Price</label><input id="i-price" type="number" min="0" step="0.01" inputmode="decimal">' +
      '<label>Stock</label><input id="i-stock" type="number" min="0" step="1" inputmode="numeric" value="0">' +
      '<label>Category</label><input id="i-cat" type="text" placeholder="Drinks, Food, Other…">' +
      '<label>Barcode (optional)</label><input id="i-barcode" type="text" inputmode="numeric" placeholder="The number under the product barcode">' +
      '<label>Picture (optional)</label>' +
      '<div class="icon-field">' +
      '<img id="i-pic-preview" class="item-thumb" src="' + esc(itemPic) + '" alt=""' + (itemPic ? '' : ' hidden') + '>' +
      '<input id="i-pic-file" type="file" accept="image/*">' +
      '<button type="button" id="i-pic-remove" class="small secondary">Remove picture</button>' +
      '</div>' +
      '<p class="info" id="i-pic-out">One small picture shown next to the item on Shop and Sell. It is shrunk to 200px before uploading.</p>' +
      '<div class="row"><button type="button" class="secondary" id="i-scan">📷 Scan barcode</button></div>' +
      '<div class="row"><button id="i-save">Save item</button>' +
      '<button id="i-cancel" class="secondary" hidden>Cancel edit</button></div>' +
      '<p class="error" id="i-err" hidden></p></div>';
    el.innerHTML = h;
    renderItemsList();
    $('d-save').addEventListener('click', function () { saveDraft(false); });
    $('d-upload').addEventListener('click', function () { saveDraft(true); });
    $('i-save').addEventListener('click', saveItem);
    var scanItemBtn = $('i-scan');
    if (scanItemBtn) scanItemBtn.addEventListener('click', function () { openScanner('setup'); });
    $('i-cancel').addEventListener('click', function () { itemEditId = null; itemPic = ''; renderSetup(); });
    wireIconField();
    wireItemPicField();
  }
  /* Wire the item picture field in Setup: picking a picture uploads it
     at once and stores the URL on the item being added/edited; Remove
     clears it. The URL is only persisted when the item is saved. */
  function wireItemPicField() {
    var file = $('i-pic-file');
    if (file) file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var out = $('i-pic-out');
      if (out) out.textContent = 'Uploading picture…';
      uploadItemPic(f).then(function (url) {
        itemPic = url;
        var prev = $('i-pic-preview');
        if (prev) { prev.src = url; prev.hidden = false; }
        if (out) out.textContent = 'Picture uploaded — save the item to keep it.';
        file.value = '';
      }).catch(function (err) {
        if (out) out.textContent = 'Could not upload the picture: ' + (err && err.message ? err.message : 'please try again.');
        file.value = '';
      });
    });
    var rem = $('i-pic-remove');
    if (rem) rem.addEventListener('click', function () {
      itemPic = '';
      var prev = $('i-pic-preview');
      if (prev) { prev.src = ''; prev.hidden = true; }
      var out = $('i-pic-out');
      if (out) out.textContent = 'Picture removed — save the item to keep it removed.';
      var file = $('i-pic-file');
      if (file) file.value = '';
    });
  }
  function renderItemsList() {
    var el = $('items-list');
    if (!el) return;
    var items = store.items || [];
    if (!items.length) { el.innerHTML = '<p class="info">No items yet.</p>'; return; }
    var h = '';
    items.forEach(function (it) {
      h += '<div class="cart-line"><div><b>' + esc(it.name) + '</b><br><span class="info">' + esc(it.category || '') + ' · ' + money(it.price) + ' · stock ' + Number(it.stock) + (it.barcode ? ' · #' + esc(it.barcode) : '') + '</span></div>' +
        itemPicHtml(it) +
        '<div class="row"><button class="small secondary" data-edit="' + it.id + '">Edit</button>' +
        (delConfirmId === it.id
          ? '<span><b>Delete "' + esc(it.name) + '"?</b> <button class="small danger" data-del-yes="' + it.id + '">Yes, delete</button> <button class="small secondary" data-del-no="' + it.id + '">Keep it</button></span>'
          : '<button class="small danger" data-del="' + it.id + '">Delete</button>') + '</div></div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = itemById(Number(b.getAttribute('data-edit')));
        if (!it) return;
        itemEditId = it.id;
        $('i-name').value = it.name;
        $('i-price').value = it.price;
        $('i-stock').value = it.stock;
        $('i-cat').value = it.category || '';
        $('i-barcode').value = it.barcode || '';
        itemPic = it.pic || '';
        var prev = $('i-pic-preview');
        if (prev) { if (itemPic) { prev.src = itemPic; prev.hidden = false; } else { prev.src = ''; prev.hidden = true; } }
        var out = $('i-pic-out');
        if (out) out.textContent = itemPic ? 'Picture uploaded — save the item to keep it.' : 'One small picture shown next to the item on Shop and Sell. It is shrunk to 200px before uploading.';
        $('item-form-title').textContent = 'Edit item — ' + it.name;
        $('i-cancel').hidden = false;
        window.scrollTo(0, document.getElementById('item-form-title').offsetTop - 80);
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        delConfirmId = Number(b.getAttribute('data-del'));
        renderItemsList();
      });
    });
    el.querySelectorAll('[data-del-no]').forEach(function (b) {
      b.addEventListener('click', function () { delConfirmId = null; renderItemsList(); });
    });
    el.querySelectorAll('[data-del-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = itemById(Number(b.getAttribute('data-del-yes')));
        if (!it) return;
        b.disabled = true;
        rpc('delete_pos_item', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_item_id: it.id })
          .then(function () { delConfirmId = null; return loadStore(); })
          .then(function () { renderSetup(); })
          .catch(function (e) { delConfirmId = null; renderItemsList(); var er = $('i-err'); if (er) { er.hidden = false; er.textContent = 'Error: ' + e.message; } });
      });
    });
  }
  function collectDraft() {
    return {
      name: $('d-name').value.trim(),
      address: $('d-address').value.trim(),
      phone: $('d-phone').value.trim(),
      taxRate: round2(Number($('d-tax').value || 0) / 100),
      receiptMessage: $('d-msg').value.trim(),
      icon: draft.icon || ''
    };
  }
  function saveDraft(upload) {
    var d = collectDraft();
    var err = $('d-err');
    if (!d.name) { err.hidden = false; err.textContent = 'Store name is required.'; return; }
    err.hidden = true;
    rpc('save_pos_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_draft: d })
      .then(function () {
        draft = d;
        draftStatus = 'editing';
        if (!upload) {
          $('d-status').textContent = 'Draft status: editing — saved, not sent yet.';
          return;
        }
        return rpc('submit_pos_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p }).then(function () {
          draftStatus = 'pending';
          $('d-status').textContent = 'Draft status: pending — waiting for Yently to approve it.';
          notifyEmail('POS draft for approval: ' + d.name, { slug: SLUG, name: d.name });
        });
      })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function saveItem() {
    var err = $('i-err');
    var name = $('i-name').value.trim();
    var price = Number($('i-price').value);
    var stock = Math.max(0, Math.floor(Number($('i-stock').value || 0)));
    var cat = $('i-cat').value.trim();
    var barcode = $('i-barcode').value.trim();
    if (!name) { err.hidden = false; err.textContent = 'Item name is required.'; return; }
    if (!(price >= 0)) { err.hidden = false; err.textContent = 'Price must be 0 or more.'; return; }
    err.hidden = true;
    var item = { name: name, price: price, stock: stock, category: cat, barcode: barcode, pic: itemPic, is_active: true };
    if (itemEditId) item.id = itemEditId;
    rpc('save_pos_item', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_item: item })
      .then(function () { itemEditId = null; itemPic = ''; return loadStore(); })
      .then(function () { renderSetup(); })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function loadDraft() {
    rpc('get_pos_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p })
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
      $('site-name').textContent = 'POS';
      $('view-shop').innerHTML = '<div class="card"><h2>Store not found</h2><p class="info">This POS page needs a store link. Ask Yently for your store link.</p></div>';
      return;
    }
    loadStore().then(function (d) {
      if (!d) {
        $('site-name').textContent = 'POS';
        $('view-shop').innerHTML = '<div class="card"><h2>Store not found</h2><p class="info">No store with this link yet. Ask Yently to set it up.</p></div>';
        return;
      }
      return rpc('pos_pass_status', { p_slug: SLUG }).then(function (st) {
        passLocked = st === 'locked';
        empUnlocked = !passLocked;
        renderShop();
      });
    }).catch(function (e) {
      $('view-shop').innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  init();
})();
