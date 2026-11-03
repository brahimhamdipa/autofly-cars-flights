/* POS template app — one folder per shop.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Content lives in
   data.json; sales live in this browser only (one key per folder).
   A completed sale is emailed to the business email in Setup (or to
   AutoFly's inbox when that is empty). Setup edits never change the live
   page by themselves: they download a new data.json, and the owner
   replaces the folder's file with it. Card payments are NOT processed
   online: "Card" only records that the card was taken at the counter
   terminal, the same way "Cash" records a cash payment. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'pos')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var SALE_KEY = 'pos-sales-' + SLUG;
  var SETUP_KEY = 'folder-pass-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the database rules allow, and the
     sale email goes through AutoFly's notification service. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null;
  var sales = loadSales();
  var cart = {};
  var saleFilter = 'All';
  var saleSearch = '';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n).toFixed(2).replace(/\.00$/, ''); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function fmtDT(iso) {
    var d = new Date(iso);
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function loadSales() {
    try { return JSON.parse(localStorage.getItem(SALE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveSales() {
    try { localStorage.setItem(SALE_KEY, JSON.stringify(sales)); } catch (e) { /* private mode */ }
  }
  function itemById(id) {
    return (data.items || []).filter(function (p) { return String(p.id) === String(id); })[0] || null;
  }
  function soldQty(itemId) {
    var n = 0;
    sales.forEach(function (s) {
      if (s.status === 'voided') return;
      (s.items || []).forEach(function (l) { if (String(l.id) === String(itemId)) n += l.qty; });
    });
    return n;
  }
  function effStock(item) {
    if (item.stock == null || item.stock === '') return null;
    return Number(item.stock) - soldQty(item.id);
  }
  function cartQty(itemId) { return cart[String(itemId)] || 0; }
  function totals() {
    var sub = 0;
    Object.keys(cart).forEach(function (id) {
      var it = itemById(id);
      if (it) sub += Number(it.price) * cart[id];
    });
    sub = round2(sub);
    var discPct = parseFloat(($('ps-discount') && $('ps-discount').value) || 0) || 0;
    if (discPct < 0) discPct = 0;
    if (discPct > 100) discPct = 100;
    var discAmt = round2(sub * discPct / 100);
    var taxRate = Number(data.taxRate) || 0;
    var taxAmt = round2((sub - discAmt) * taxRate / 100);
    return { sub: sub, discPct: discPct, discAmt: discAmt, taxRate: taxRate, taxAmt: taxAmt, total: round2(sub - discAmt + taxAmt) };
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    ['sale', 'receipts', 'setup'].forEach(function (t) {
      $('view-' + t).hidden = (t !== name);
    });
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.className = (b.getAttribute('data-tab') === name) ? 'active' : '';
    });
    if (name === 'sale') renderSale();
    if (name === 'receipts') renderReceipts();
    if (name === 'setup') openSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var b = data.business || {};
    document.title = b.name || 'POS';
    $('biz-name').textContent = b.name || 'POS';
    $('biz-about').textContent = b.about || '';
    var parts = [];
    if (b.phone) parts.push('Phone: ' + esc(b.phone));
    if (b.email) parts.push('Email: <a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>');
    if (b.address) parts.push(esc(b.address));
    if (b.hours) parts.push(esc(b.hours));
    $('biz-meta').innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  /* ---------- sale (register) ---------- */
  function categories() {
    var seen = [];
    (data.items || []).forEach(function (p) {
      if (p.category && seen.indexOf(p.category) === -1) seen.push(p.category);
    });
    return seen;
  }
  function renderChips() {
    var cats = ['All'].concat(categories());
    $('ps-chips').innerHTML = cats.map(function (c) {
      return '<button class="' + (c === saleFilter ? 'active' : '') + '" data-chip="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }
  function renderGrid() {
    var q = saleSearch.trim().toLowerCase();
    var list = (data.items || []).filter(function (p) {
      if (saleFilter !== 'All' && p.category !== saleFilter) return false;
      if (q && (String(p.name).toLowerCase().indexOf(q) === -1 && String(p.category || '').toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    var el = $('ps-grid');
    if (!list.length) { el.innerHTML = '<div class="card"><p>No items match. The owner adds items in Setup.</p></div>'; return; }
    el.innerHTML = list.map(function (p) {
      var st = effStock(p);
      var cq = cartQty(p.id);
      var out = st != null && st - cq <= 0;
      var stockLine = st == null ? '' : (out ? '<p>Out of stock</p>' : '<p>Stock: ' + esc(st - cq) + ' left</p>');
      return '<div class="card"><span class="badge">' + esc(p.category || '') + '</span>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p><span class="price">' + money(p.price) + '</span></p>' + stockLine +
        '<button data-add="' + p.id + '"' + (out ? ' disabled' : '') + '>' + (cq ? 'Add more (' + cq + ' in cart)' : 'Add') + '</button></div>';
    }).join('');
  }
  function renderCart() {
    var ids = Object.keys(cart).filter(function (id) { return cart[id] > 0; });
    var el = $('ps-cart');
    if (!ids.length) {
      el.innerHTML = '<div class="card"><p>Cart is empty. Tap Add on an item to ring it up.</p></div>';
      $('ps-totals').innerHTML = '';
      return;
    }
    el.innerHTML = '<div class="card">' + ids.map(function (id) {
      var it = itemById(id);
      if (!it) return '';
      var st = effStock(it);
      var atCap = st != null && cart[id] >= st;
      return '<div class="cartline"><div><strong>' + esc(it.name) + '</strong><br>' +
        money(it.price) + ' each</div>' +
        '<div><button class="qtybtn secondary" data-dec="' + id + '">−</button> ' + cart[id] + ' ' +
        '<button class="qtybtn secondary" data-inc="' + id + '"' + (atCap ? ' disabled' : '') + '>+</button> ' +
        money(Number(it.price) * cart[id]) +
        ' <button class="qtybtn danger" data-del="' + id + '">×</button></div></div>';
    }).join('') + '</div>';
    var t = totals();
    $('ps-totals').innerHTML = '<div class="card totals">' +
      'Subtotal: ' + money(t.sub) + '<br>' +
      (t.discAmt ? 'Discount (' + t.discPct + '%): −' + money(t.discAmt) + '<br>' : '') +
      'Tax (' + t.taxRate + '%): ' + money(t.taxAmt) + '<br>' +
      '<strong>Total: ' + money(t.total) + '</strong></div>';
  }
  function renderSale() {
    var el = $('view-sale');
    el.innerHTML = '<h2>Sale</h2>' +
      '<div class="note">Ring up items, then tap Cash or Card. Card is only recorded as taken at the counter — no card is charged online.</div>' +
      '<label>Search items</label><input id="ps-search" type="text" value="' + esc(saleSearch) + '" placeholder="Name or category…">' +
      '<div class="chips" id="ps-chips"></div>' +
      '<div class="grid" id="ps-grid"></div>' +
      '<h3>Cart</h3><div id="ps-cart"></div><div id="ps-totals"></div>' +
      '<div class="card"><h3>Checkout</h3>' +
      '<label>Customer name (optional)</label><input id="ps-customer" type="text">' +
      '<label>Discount % (optional)</label><input id="ps-discount" type="number" min="0" max="100" step="1" value="0">' +
      '<div class="row"><button id="ps-cash">Cash</button><button id="ps-card">Card</button></div>' +
      '<div id="sale-out" style="margin-top:12px"></div></div>';
    renderChips();
    renderGrid();
    renderCart();
    $('ps-search').addEventListener('input', function (e) { saleSearch = e.target.value; renderGrid(); });
    $('ps-cash').addEventListener('click', function () { checkout('Cash'); });
    $('ps-card').addEventListener('click', function () { checkout('Card'); });
  }
  function checkout(payment) {
    var ids = Object.keys(cart).filter(function (id) { return cart[id] > 0; });
    var out = $('sale-out');
    if (!ids.length) { out.innerHTML = '<p class="error">The cart is empty. Add an item first.</p>'; return; }
    var t = totals();
    var customer = $('ps-customer').value.trim();
    var lines = ids.map(function (id) {
      var it = itemById(id);
      return { id: it.id, name: it.name, price: Number(it.price), qty: cart[id] };
    });
    var sale = { id: Date.now(), items: lines, subtotal: t.sub, discountPct: t.discPct,
      discountAmt: t.discAmt, taxRate: t.taxRate, taxAmt: t.taxAmt, total: t.total,
      payment: payment, customer: customer, status: 'completed', createdAt: new Date().toISOString() };
    sales.unshift(sale);
    saveSales();
    cart = {};
    var ref = 'PS-' + String(sale.id).slice(-6);
    var to = (data.business && data.business.email) || '';
    var itemLines = lines.map(function (l) { return esc(l.name) + ' × ' + l.qty + ' — ' + money(l.price * l.qty); }).join('<br>');
    out.innerHTML = '<div class="receipt"><h3>Sale complete</h3>' +
      '<p><strong>Reference:</strong> ' + ref + '<br>' +
      '<strong>When:</strong> ' + esc(fmtDT(sale.createdAt)) + '<br>' +
      (customer ? '<strong>Customer:</strong> ' + esc(customer) + '<br>' : '') +
      '<strong>Payment:</strong> ' + esc(payment) + '</p>' +
      '<p>' + itemLines + '</p>' +
      '<p>Subtotal: ' + money(t.sub) + '<br>' +
      (t.discAmt ? 'Discount (' + t.discPct + '%): −' + money(t.discAmt) + '<br>' : '') +
      'Tax (' + t.taxRate + '%): ' + money(t.taxAmt) + '<br>' +
      '<strong>Total: ' + money(t.total) + '</strong></p>' +
      '<p class="hint">Find this sale any time in the Receipts tab.</p>' +
      '<p id="sale-mail" class="hint">Sending the business a copy…</p></div>';
    renderGrid();
    renderCart();
    fetch(SUPABASE_URL + '/functions/v1/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify({ to: to || undefined, subject: 'POS sale: ' + ref,
        table: 'pos_sale',
        record: { reference: ref, items: lines.map(function (l) { return l.name + ' x' + l.qty; }).join(', '),
          subtotal: t.sub, discount: t.discAmt, tax: t.taxAmt, total: t.total,
          payment: payment, customer: customer, date: fmtDT(sale.createdAt) } })
    }).then(function (res) {
      if (!res.ok) throw new Error('send failed');
      var m = $('sale-mail');
      if (m) m.textContent = 'A copy was emailed to the business.';
    }).catch(function () {
      var m = $('sale-mail');
      if (m) m.textContent = 'The email copy did not go through — your sale is still saved here. ' +
        (to ? 'You can also reach the business at ' + to + '.' : 'Please tell the business about this sale.');
    });
  }

  /* ---------- receipts (this device) ---------- */
  function renderReceipts() {
    var el = $('view-receipts');
    el.innerHTML = '<h2>Receipts</h2>' +
      '<div class="note">Sales made on this device only. A sale made on another phone does not appear here. Voiding a sale puts its items back in stock.</div>';
    if (!sales.length) { el.innerHTML += '<div class="card"><p>No sales yet.</p></div>'; return; }
    el.innerHTML += sales.map(function (s) {
      var ref = 'PS-' + String(s.id).slice(-6);
      var itemLines = (s.items || []).map(function (l) { return esc(l.name) + ' × ' + l.qty + ' — ' + money(l.price * l.qty); }).join('<br>');
      var actions = s.status === 'completed'
        ? '<div class="row"><button class="danger" data-void="' + s.id + '">Void sale</button></div>' : '';
      return '<div class="card"><span class="badge">' + esc(s.status) + '</span>' +
        '<h3>' + ref + ' — ' + money(s.total) + '</h3>' +
        '<p>' + esc(fmtDT(s.createdAt)) + ' &nbsp;·&nbsp; ' + esc(s.payment) +
        (s.customer ? ' &nbsp;·&nbsp; ' + esc(s.customer) : '') + '</p>' +
        '<p>' + itemLines + '</p>' +
        '<p>Subtotal: ' + money(s.subtotal) +
        (s.discountAmt ? ' &nbsp;·&nbsp; Discount: −' + money(s.discountAmt) : '') +
        ' &nbsp;·&nbsp; Tax: ' + money(s.taxAmt) + '</p>' + actions + '</div>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('[data-void]'), function (btn) {
      btn.addEventListener('click', function () {
        var s = sales.filter(function (x) { return String(x.id) === btn.getAttribute('data-void'); })[0];
        if (s) s.status = 'voided';
        saveSales(); renderReceipts();
      });
    });
  }

  /* ---------- Setup sign-in ---------- */
  /* Setup opens freely when the admin has set no pass for this folder.
     Once a pass exists, Setup asks for that folder's username + password
     (set in Admin) and unlocks for this browser session only. The password
     itself is never sent to the page: the database only answers yes/no. */
  function setupUnlocked() {
    try { return sessionStorage.getItem(SETUP_KEY) === '1'; } catch (e) { return false; }
  }
  function rpc(name, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (res) { if (!res.ok) throw new Error('rpc failed'); return res.json(); });
  }
  function openSetup() {
    if (setupUnlocked()) { renderSetup(); return; }
    var el = $('view-setup');
    el.innerHTML = '<h2>Setup</h2><div class="card"><p class="hint">Checking…</p></div>';
    rpc('folder_pass_status', { p_folder: SLUG }).then(function (status) {
      if (status === 'open') { renderSetup(); return; }
      renderSetupLogin(el);
    }).catch(function () {
      el.innerHTML = '<h2>Setup</h2><div class="card"><p class="error">Could not reach the sign-in check. Please try again in a moment.</p></div>';
    });
  }
  function renderSetupLogin(el) {
    el.innerHTML = '<h2>Setup sign-in</h2><div class="card">' +
      '<p>Setup for this shop is protected. Enter the username and password set by the admin for this folder.</p>' +
      '<label>Username</label><input id="fp-user" type="text" autocomplete="username">' +
      '<label>Password</label><input id="fp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="fp-go">Sign in</button></div>' +
      '<div id="fp-out" style="margin-top:12px"></div></div>';
    $('fp-go').addEventListener('click', function () {
      var out = $('fp-out');
      out.innerHTML = '<p class="hint">Checking…</p>';
      rpc('check_folder_pass', { p_folder: SLUG, p_username: $('fp-user').value.trim(), p_password: $('fp-pass').value }).then(function (ok) {
        if (ok === true) {
          try { sessionStorage.setItem(SETUP_KEY, '1'); } catch (e) {}
          renderSetup();
        } else {
          out.innerHTML = '<p class="error">Wrong username or password.</p>';
        }
      }).catch(function () {
        out.innerHTML = '<p class="error">Could not reach the sign-in check. Please try again in a moment.</p>';
      });
    });
  }

  /* ---------- setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    var b = data.business || {};
    function field(label, id, value, type) {
      return '<label>' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '">';
    }
    var itemHtml = (data.items || []).map(function (p, i) {
      return '<div class="card" data-item="' + i + '">' +
        '<label>Item name</label><input class="it-name" value="' + esc(p.name) + '">' +
        '<label>Category</label><input class="it-cat" value="' + esc(p.category || '') + '">' +
        '<label>Price ($)</label><input class="it-price" type="number" min="0" step="0.01" value="' + esc(p.price) + '">' +
        '<label>Stock (empty = unlimited)</label><input class="it-stock" type="number" min="0" step="1" value="' + esc(p.stock == null ? '' : p.stock) + '">' +
        '<div class="row"><button class="danger it-del">Delete item</button></div></div>';
    }).join('');
    el.innerHTML = '<h2>Setup</h2>' +
      '<div class="note">Edit the shop here, then press “Download data.json”. ' +
      'To put the changes live, replace the <strong>data.json</strong> file inside this folder with the downloaded file, then reload the page. ' +
      'Nothing on this tab changes the live page by itself — and that is on purpose, so visitors cannot change your items.</div>' +
      '<div class="card"><h3>Business details</h3>' +
      field('Business name', 'st-name', b.name) +
      field('About', 'st-about', b.about) +
      field('Phone', 'st-phone', b.phone, 'tel') +
      field('Email (sale copies go here; empty = AutoFly inbox)', 'st-email', b.email, 'email') +
      field('Address', 'st-address', b.address) +
      field('Hours', 'st-hours', b.hours) +
      '<label>Tax rate (%)</label><input id="st-tax" type="number" min="0" step="0.01" value="' + esc(data.taxRate == null ? 0 : data.taxRate) + '"></div>' +
      '<h3>Items</h3>' + itemHtml +
      '<div class="card"><h3>Add an item</h3>' +
      '<label>Item name</label><input id="it-new-name">' +
      '<label>Category</label><input id="it-new-cat">' +
      '<label>Price ($)</label><input id="it-new-price" type="number" min="0" step="0.01">' +
      '<label>Stock (empty = unlimited)</label><input id="it-new-stock" type="number" min="0" step="1">' +
      '<div class="row"><button id="it-add">Add item</button></div></div>' +
      '<div class="row"><button id="setup-download">Download data.json</button></div>';
    Array.prototype.forEach.call(el.querySelectorAll('.it-del'), function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('[data-item]');
        data.items.splice(Number(card.getAttribute('data-item')), 1);
        renderSetup();
      });
    });
    $('it-add').addEventListener('click', function () {
      var name = $('it-new-name').value.trim();
      var price = parseFloat($('it-new-price').value);
      if (!name || isNaN(price)) return;
      var maxId = (data.items || []).reduce(function (m, p) { return Math.max(m, p.id || 0); }, 0);
      var stock = parseInt($('it-new-stock').value, 10);
      data.items.push({ id: maxId + 1, name: name, category: $('it-new-cat').value.trim(),
        price: price, stock: isNaN(stock) ? null : stock });
      renderSetup();
    });
    $('setup-download').addEventListener('click', function () {
      var next = { business: { name: $('st-name').value.trim(), about: $('st-about').value.trim(),
          phone: $('st-phone').value.trim(), email: $('st-email').value.trim(),
          address: $('st-address').value.trim(), hours: $('st-hours').value.trim() },
        taxRate: parseFloat($('st-tax').value) || 0, items: [] };
      Array.prototype.forEach.call(el.querySelectorAll('[data-item]'), function (card, i) {
        var stock = parseInt(card.querySelector('.it-stock').value, 10);
        next.items.push({ id: (data.items[i] && data.items[i].id) || (i + 1),
          name: card.querySelector('.it-name').value.trim(),
          category: card.querySelector('.it-cat').value.trim(),
          price: parseFloat(card.querySelector('.it-price').value) || 0,
          stock: isNaN(stock) ? null : stock });
      });
      var blob = new Blob([JSON.stringify(next, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'data.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
  }

  /* ---------- init ---------- */
  Array.prototype.forEach.call($('tabs').children, function (btn) {
    btn.addEventListener('click', function () { showTab(btn.getAttribute('data-tab')); });
  });
  $('back-link').addEventListener('click', function (e) {
    e.preventDefault();
    showTab('sale');
  });
  $('view-sale').addEventListener('click', function (e) {
    var t = e.target;
    var add = t.getAttribute && t.getAttribute('data-add');
    var inc = t.getAttribute && t.getAttribute('data-inc');
    var dec = t.getAttribute && t.getAttribute('data-dec');
    var del = t.getAttribute && t.getAttribute('data-del');
    var chip = t.getAttribute && t.getAttribute('data-chip');
    if (add) {
      var it = itemById(add);
      var st = effStock(it);
      if (st == null || cartQty(add) < st) cart[String(add)] = cartQty(add) + 1;
      renderGrid(); renderCart();
    } else if (inc) {
      var it2 = itemById(inc);
      var st2 = effStock(it2);
      if (st2 == null || cartQty(inc) < st2) cart[String(inc)] = cartQty(inc) + 1;
      renderGrid(); renderCart();
    } else if (dec) {
      cart[String(dec)] = cartQty(dec) - 1;
      if (cart[String(dec)] <= 0) delete cart[String(dec)];
      renderGrid(); renderCart();
    } else if (del) {
      delete cart[String(del)];
      renderGrid(); renderCart();
    } else if (chip) {
      saleFilter = chip;
      renderChips(); renderGrid();
    }
  });
  fetch(BASE + 'data.json')
    .then(function (res) { if (!res.ok) throw new Error('data.json not found'); return res.json(); })
    .then(function (json) {
      data = json;
      data.business = data.business || {};
      data.items = data.items || [];
      if (data.taxRate == null) data.taxRate = 0;
      renderHeader();
      showTab('sale');
    })
    .catch(function () {
      $('view-sale').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one (see the README in this folder) and reload the page.</div>';
    });
})();
