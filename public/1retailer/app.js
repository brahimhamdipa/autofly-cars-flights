/* Retailer template app — one folder per shop.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Content lives in
   data.json; sales, shipments, and expenses live in this browser only
   (one key per folder per record type). A completed sale is emailed to
   the business email in Setup (or to AutoFly's inbox when that is
   empty). Setup edits never change the live page by themselves: they
   download a new data.json, and the owner replaces the folder's file
   with it. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'retailer')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var SALES_KEY = 'retailer-sales-' + SLUG;
  var SHIP_KEY = 'retailer-shipments-' + SLUG;
  var EXP_KEY = 'retailer-expenses-' + SLUG;
  var SETUP_KEY = 'folder-pass-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the database rules allow, and the
     sale email goes through AutoFly's notification service. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null;
  var sales = load(SALES_KEY);
  var shipments = load(SHIP_KEY);
  var expenses = load(EXP_KEY);
  var cart = {};
  var goodsSearch = '';
  var goodsBrand = 'All';
  var sellSearch = '';
  var sellBrand = 'All';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    var v = Number(n);
    return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2).replace(/\.00$/, '');
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function fmtDT(iso) {
    var d = new Date(iso);
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function todayStr() {
    var d = new Date();
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  }
  function save(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) { /* private mode */ }
  }
  function goodById(id) {
    return (data.goods || []).filter(function (g) { return String(g.id) === String(id); })[0] || null;
  }
  function soldQty(id) {
    var n = 0;
    sales.forEach(function (s) {
      if (s.status === 'voided') return;
      (s.items || []).forEach(function (l) { if (String(l.id) === String(id)) n += l.qty; });
    });
    return n;
  }
  function shippedQty(id) {
    var n = 0;
    shipments.forEach(function (s) { if (String(s.goodsId) === String(id)) n += s.qty; });
    return n;
  }
  /* Stock on hand = what Setup says, plus stock taken in, minus stock sold. */
  function stockOf(g) { return (Number(g.stock) || 0) + shippedQty(g.id) - soldQty(g.id); }
  function cartQty(id) { return cart[String(id)] || 0; }
  function brands() {
    var list = (data.brands || []).slice();
    (data.goods || []).forEach(function (g) {
      if (g.brand && list.indexOf(g.brand) === -1) list.push(g.brand);
    });
    return list;
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    ['goods', 'sell', 'shipments', 'expenses', 'reports', 'setup'].forEach(function (t) {
      $('view-' + t).hidden = (t !== name);
    });
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.className = (b.getAttribute('data-tab') === name) ? 'active' : '';
    });
    if (name === 'goods') renderGoods();
    if (name === 'sell') renderSell();
    if (name === 'shipments') renderShipments();
    if (name === 'expenses') renderExpenses();
    if (name === 'reports') renderReports();
    if (name === 'setup') openSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var b = data.business || {};
    document.title = b.name || 'Retailer';
    $('biz-name').textContent = b.name || 'Retailer';
    $('biz-about').textContent = b.about || '';
    var parts = [];
    if (b.phone) parts.push('Phone: ' + esc(b.phone));
    if (b.email) parts.push('Email: <a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>');
    if (b.address) parts.push(esc(b.address));
    if (b.hours) parts.push(esc(b.hours));
    $('biz-meta').innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  /* ---------- goods (inventory browse) ---------- */
  function renderGoods() {
    var el = $('view-goods');
    el.innerHTML = '<h2>Goods</h2>' +
      '<div class="note">Stock shown here is live: Setup stock, plus shipments received, minus sales made on this device.</div>' +
      '<label>Search goods</label><input id="gd-search" type="text" value="' + esc(goodsSearch) + '" placeholder="Name, article, or brand…">' +
      '<div class="chips" id="gd-chips"></div>' +
      '<div class="grid" id="gd-grid"></div>';
    renderGoodsChips();
    renderGoodsGrid();
    $('gd-search').addEventListener('input', function (e) { goodsSearch = e.target.value; renderGoodsGrid(); });
  }
  function renderGoodsChips() {
    var cats = ['All'].concat(brands());
    $('gd-chips').innerHTML = cats.map(function (c) {
      return '<button class="' + (c === goodsBrand ? 'active' : '') + '" data-gchip="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }
  function renderGoodsGrid() {
    var q = goodsSearch.trim().toLowerCase();
    var list = (data.goods || []).filter(function (g) {
      if (goodsBrand !== 'All' && g.brand !== goodsBrand) return false;
      if (q && (String(g.name).toLowerCase().indexOf(q) === -1 &&
        String(g.art || '').toLowerCase().indexOf(q) === -1 &&
        String(g.brand || '').toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    var el = $('gd-grid');
    if (!list.length) { el.innerHTML = '<div class="card"><p>No goods match. The owner adds goods in Setup.</p></div>'; return; }
    el.innerHTML = list.map(function (g) {
      var st = stockOf(g);
      return '<div class="card"><span class="badge">' + esc(g.brand || '') + '</span>' +
        '<h3>' + esc(g.name) + '</h3>' +
        (g.art ? '<p>Article: ' + esc(g.art) + '</p>' : '') +
        '<p><span class="price">' + money(g.price) + '</span></p>' +
        '<p>' + (st > 0 ? 'Stock: ' + esc(st) : 'Out of stock') + '</p></div>';
    }).join('');
  }

  /* ---------- sell (register) ---------- */
  function sellTotals() {
    var sub = 0;
    Object.keys(cart).forEach(function (id) {
      var g = goodById(id);
      if (g) sub += Number(g.price) * cart[id];
    });
    sub = round2(sub);
    var discPct = parseFloat(($('sl-discount') && $('sl-discount').value) || 0) || 0;
    if (discPct < 0) discPct = 0;
    if (discPct > 100) discPct = 100;
    var discAmt = round2(sub * discPct / 100);
    return { sub: sub, discPct: discPct, discAmt: discAmt, total: round2(sub - discAmt) };
  }
  function renderSell() {
    var el = $('view-sell');
    el.innerHTML = '<h2>Sell</h2>' +
      '<div class="note">Ring up goods and tap Sell. The sale is saved on this device, the stock drops at once, and a copy is emailed to the business.</div>' +
      '<label>Search goods</label><input id="sl-search" type="text" value="' + esc(sellSearch) + '" placeholder="Name, article, or brand…">' +
      '<div class="chips" id="sl-chips"></div>' +
      '<div class="grid" id="sl-grid"></div>' +
      '<h3>Cart</h3><div id="sl-cart"></div><div id="sl-totals"></div>' +
      '<div class="card"><h3>Checkout</h3>' +
      '<label>Discount % (optional)</label><input id="sl-discount" type="number" min="0" max="100" step="1" value="0">' +
      '<div class="row"><button id="sl-sell">Sell</button></div>' +
      '<div id="sell-out" style="margin-top:12px"></div></div>';
    renderSellChips();
    renderSellGrid();
    renderSellCart();
    $('sl-search').addEventListener('input', function (e) { sellSearch = e.target.value; renderSellGrid(); });
    $('sl-sell').addEventListener('click', checkout);
  }
  function renderSellChips() {
    var cats = ['All'].concat(brands());
    $('sl-chips').innerHTML = cats.map(function (c) {
      return '<button class="' + (c === sellBrand ? 'active' : '') + '" data-schip="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }
  function renderSellGrid() {
    var q = sellSearch.trim().toLowerCase();
    var list = (data.goods || []).filter(function (g) {
      if (sellBrand !== 'All' && g.brand !== sellBrand) return false;
      if (q && (String(g.name).toLowerCase().indexOf(q) === -1 &&
        String(g.art || '').toLowerCase().indexOf(q) === -1 &&
        String(g.brand || '').toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    var el = $('sl-grid');
    if (!list.length) { el.innerHTML = '<div class="card"><p>No goods match. The owner adds goods in Setup.</p></div>'; return; }
    el.innerHTML = list.map(function (g) {
      var st = stockOf(g);
      var cq = cartQty(g.id);
      var out = st - cq <= 0;
      return '<div class="card"><span class="badge">' + esc(g.brand || '') + '</span>' +
        '<h3>' + esc(g.name) + '</h3>' +
        '<p><span class="price">' + money(g.price) + '</span></p>' +
        '<p>' + (out ? 'Out of stock' : 'Stock: ' + esc(st - cq) + ' left') + '</p>' +
        '<button data-add="' + g.id + '"' + (out ? ' disabled' : '') + '>' + (cq ? 'Add more (' + cq + ' in cart)' : 'Add') + '</button></div>';
    }).join('');
  }
  function renderSellCart() {
    var ids = Object.keys(cart).filter(function (id) { return cart[id] > 0; });
    var el = $('sl-cart');
    if (!ids.length) {
      el.innerHTML = '<div class="card"><p>Cart is empty. Tap Add on a good to ring it up.</p></div>';
      $('sl-totals').innerHTML = '';
      return;
    }
    el.innerHTML = '<div class="card">' + ids.map(function (id) {
      var g = goodById(id);
      if (!g) return '';
      var st = stockOf(g);
      var atCap = cart[id] >= st;
      return '<div class="cartline"><div><strong>' + esc(g.name) + '</strong><br>' +
        money(g.price) + ' each</div>' +
        '<div><button class="qtybtn secondary" data-dec="' + id + '">−</button> ' + cart[id] + ' ' +
        '<button class="qtybtn secondary" data-inc="' + id + '"' + (atCap ? ' disabled' : '') + '>+</button> ' +
        money(Number(g.price) * cart[id]) +
        ' <button class="qtybtn danger" data-del="' + id + '">×</button></div></div>';
    }).join('') + '</div>';
    var t = sellTotals();
    $('sl-totals').innerHTML = '<div class="card totals">' +
      'Subtotal: ' + money(t.sub) + '<br>' +
      (t.discAmt ? 'Discount (' + t.discPct + '%): −' + money(t.discAmt) + '<br>' : '') +
      '<strong>Total: ' + money(t.total) + '</strong></div>';
  }
  function checkout() {
    var ids = Object.keys(cart).filter(function (id) { return cart[id] > 0; });
    var out = $('sell-out');
    if (!ids.length) { out.innerHTML = '<p class="error">The cart is empty. Add a good first.</p>'; return; }
    var t = sellTotals();
    var lines = ids.map(function (id) {
      var g = goodById(id);
      return { id: g.id, name: g.name, price: Number(g.price), qty: cart[id] };
    });
    var sale = { id: Date.now(), items: lines, subtotal: t.sub, discountPct: t.discPct,
      discountAmt: t.discAmt, total: t.total, status: 'completed', createdAt: new Date().toISOString() };
    sales.unshift(sale);
    save(SALES_KEY, sales);
    cart = {};
    var ref = 'RS-' + String(sale.id).slice(-6);
    var to = (data.business && data.business.email) || '';
    var itemLines = lines.map(function (l) { return esc(l.name) + ' × ' + l.qty + ' — ' + money(l.price * l.qty); }).join('<br>');
    out.innerHTML = '<div class="receipt"><h3>Sale complete</h3>' +
      '<p><strong>Reference:</strong> ' + ref + '<br>' +
      '<strong>When:</strong> ' + esc(fmtDT(sale.createdAt)) + '</p>' +
      '<p>' + itemLines + '</p>' +
      '<p>Subtotal: ' + money(t.sub) + '<br>' +
      (t.discAmt ? 'Discount (' + t.discPct + '%): −' + money(t.discAmt) + '<br>' : '') +
      '<strong>Total: ' + money(t.total) + '</strong></p>' +
      '<p class="hint">Find this sale any time in the Reports tab.</p>' +
      '<p id="sell-mail" class="hint">Sending the business a copy…</p></div>';
    renderSellGrid();
    renderSellCart();
    fetch(SUPABASE_URL + '/functions/v1/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify({ to: to || undefined, subject: 'Retailer sale: ' + ref,
        table: 'retailer_sale',
        record: { reference: ref, items: lines.map(function (l) { return l.name + ' x' + l.qty; }).join(', '),
          subtotal: t.sub, discount: t.discAmt, total: t.total, date: fmtDT(sale.createdAt) } })
    }).then(function (res) {
      if (!res.ok) throw new Error('send failed');
      var m = $('sell-mail');
      if (m) m.textContent = 'A copy was emailed to the business.';
    }).catch(function () {
      var m = $('sell-mail');
      if (m) m.textContent = 'The email copy did not go through — your sale is still saved here. ' +
        (to ? 'You can also reach the business at ' + to + '.' : 'Please tell the business about this sale.');
    });
  }

  /* ---------- shipments (stock in) ---------- */
  function renderShipments() {
    var el = $('view-shipments');
    var opts = (data.goods || []).map(function (g) {
      return '<option value="' + g.id + '">' + esc(g.name) + ' (stock: ' + esc(stockOf(g)) + ')</option>';
    }).join('');
    el.innerHTML = '<h2>Shipments</h2>' +
      '<div class="note">Record goods as they arrive. Stock rises at once, and the shipment stays listed below.</div>' +
      '<div class="card"><h3>Record a shipment</h3>' +
      '<label>Good</label><select id="sh-good">' + opts + '</select>' +
      '<label>Quantity received</label><input id="sh-qty" type="number" min="1" step="1" value="1">' +
      '<label>Cost per unit $ (optional, for the record)</label><input id="sh-cost" type="number" min="0" step="0.01">' +
      '<label>Date</label><input id="sh-date" type="date" value="' + todayStr() + '">' +
      '<label>Note (optional)</label><input id="sh-note" type="text">' +
      '<div class="row"><button id="sh-add">Record shipment</button></div>' +
      '<div id="sh-out" style="margin-top:12px"></div></div>' +
      '<h3>Past shipments</h3>' + shipmentListHtml();
    $('sh-add').addEventListener('click', function () {
      var qty = parseInt($('sh-qty').value, 10);
      var g = goodById($('sh-good').value);
      var out = $('sh-out');
      if (!g || isNaN(qty) || qty <= 0) { out.innerHTML = '<p class="error">Pick a good and a quantity of 1 or more.</p>'; return; }
      var cost = parseFloat($('sh-cost').value);
      shipments.unshift({ id: Date.now(), goodsId: g.id, goodsName: g.name, qty: qty,
        cost: isNaN(cost) ? null : cost, date: $('sh-date').value || todayStr(),
        note: $('sh-note').value.trim() });
      save(SHIP_KEY, shipments);
      renderShipments();
      $('sh-out').innerHTML = '<p>Shipment recorded: ' + esc(qty) + ' × ' + esc(g.name) + '. New stock: ' + esc(stockOf(g)) + '.</p>';
    });
  }
  function shipmentListHtml() {
    if (!shipments.length) return '<div class="card"><p>No shipments yet.</p></div>';
    return shipments.map(function (s) {
      return '<div class="card"><h3>' + esc(s.goodsName) + ' × ' + esc(s.qty) + '</h3>' +
        '<p>' + esc(s.date) +
        (s.cost != null ? ' &nbsp;·&nbsp; Cost: ' + money(s.cost) + ' each' : '') +
        (s.note ? ' &nbsp;·&nbsp; ' + esc(s.note) : '') + '</p></div>';
    }).join('');
  }

  /* ---------- expenses ---------- */
  function renderExpenses() {
    var el = $('view-expenses');
    var total = expenses.reduce(function (sum, e) { return sum + (Number(e.amount) || 0); }, 0);
    el.innerHTML = '<h2>Expenses</h2>' +
      '<div class="note">Day-to-day shop costs: rent, supplies, repairs. They count against sales in Reports.</div>' +
      '<div class="card"><h3>Record an expense</h3>' +
      '<label>Date</label><input id="ex-date" type="date" value="' + todayStr() + '">' +
      '<label>What for</label><input id="ex-comment" type="text" placeholder="e.g. Shop rent">' +
      '<label>Amount $</label><input id="ex-amount" type="number" min="0" step="0.01">' +
      '<div class="row"><button id="ex-add">Record expense</button></div>' +
      '<div id="ex-out" style="margin-top:12px"></div></div>' +
      '<div class="card totals"><strong>Total expenses: ' + money(total) + '</strong></div>' +
      '<h3>Past expenses</h3>' + expenseListHtml();
    $('ex-add').addEventListener('click', function () {
      var amount = parseFloat($('ex-amount').value);
      var comment = $('ex-comment').value.trim();
      var out = $('ex-out');
      if (!comment || isNaN(amount) || amount < 0) { out.innerHTML = '<p class="error">Enter what the expense was for and an amount.</p>'; return; }
      expenses.unshift({ id: Date.now(), date: $('ex-date').value || todayStr(), comment: comment, amount: amount });
      save(EXP_KEY, expenses);
      renderExpenses();
    });
  }
  function expenseListHtml() {
    if (!expenses.length) return '<div class="card"><p>No expenses yet.</p></div>';
    return expenses.map(function (e) {
      return '<div class="card"><h3>' + esc(e.comment) + ' — ' + money(e.amount) + '</h3>' +
        '<p>' + esc(e.date) + '</p></div>';
    }).join('');
  }

  /* ---------- reports ---------- */
  function renderReports() {
    var el = $('view-reports');
    var liveSales = sales.filter(function (s) { return s.status !== 'voided'; });
    var salesTotal = liveSales.reduce(function (sum, s) { return sum + (Number(s.total) || 0); }, 0);
    var expTotal = expenses.reduce(function (sum, e) { return sum + (Number(e.amount) || 0); }, 0);
    var stockCost = 0, stockPrice = 0;
    (data.goods || []).forEach(function (g) {
      var st = stockOf(g);
      if (st > 0) { stockCost += st * (Number(g.cost) || 0); stockPrice += st * (Number(g.price) || 0); }
    });
    var low = (data.goods || []).filter(function (g) { return stockOf(g) <= 5; });
    var byDay = {};
    liveSales.forEach(function (s) {
      var d = fmtDate(s.createdAt);
      byDay[d] = (byDay[d] || 0) + (Number(s.total) || 0);
    });
    var days = Object.keys(byDay).sort().reverse();
    el.innerHTML = '<h2>Reports</h2>' +
      '<div class="note">Figures include cost prices, so share this page only with staff. Sales and expenses here are from this device only.</div>' +
      '<div class="grid">' +
      '<div class="card"><h3>Goods</h3><p><span class="price">' + (data.goods || []).length + '</span></p></div>' +
      '<div class="card"><h3>Stock value (cost)</h3><p><span class="price">' + money(stockCost) + '</span></p></div>' +
      '<div class="card"><h3>Stock value (price)</h3><p><span class="price">' + money(stockPrice) + '</span></p></div>' +
      '<div class="card"><h3>Total sales</h3><p><span class="price">' + money(salesTotal) + '</span></p></div>' +
      '<div class="card"><h3>Total expenses</h3><p><span class="price">' + money(expTotal) + '</span></p></div>' +
      '<div class="card"><h3>Sales minus expenses</h3><p><span class="price">' + money(salesTotal - expTotal) + '</span></p></div>' +
      '</div>' +
      '<h3>Low stock (5 or fewer)</h3>' +
      (low.length ? low.map(function (g) {
        return '<div class="card"><h3>' + esc(g.name) + '</h3><p>Stock: ' + esc(stockOf(g)) + '</p></div>';
      }).join('') : '<div class="card"><p>Nothing is low on stock.</p></div>') +
      '<h3>Sales by day</h3>' +
      (days.length ? days.map(function (d) {
        return '<div class="card"><h3>' + esc(d) + ' — ' + money(byDay[d]) + '</h3></div>';
      }).join('') : '<div class="card"><p>No sales yet.</p></div>') +
      '<h3>Recent sales</h3>' + recentSalesHtml();
  }
  function recentSalesHtml() {
    if (!sales.length) return '<div class="card"><p>No sales yet.</p></div>';
    return sales.slice(0, 20).map(function (s) {
      var ref = 'RS-' + String(s.id).slice(-6);
      var itemLines = (s.items || []).map(function (l) { return esc(l.name) + ' × ' + l.qty + ' — ' + money(l.price * l.qty); }).join('<br>');
      var actions = s.status === 'completed'
        ? '<div class="row"><button class="danger" data-void="' + s.id + '">Void sale</button></div>' : '';
      return '<div class="card"><span class="badge">' + esc(s.status) + '</span>' +
        '<h3>' + ref + ' — ' + money(s.total) + '</h3>' +
        '<p>' + esc(fmtDT(s.createdAt)) + '</p>' +
        '<p>' + itemLines + '</p>' +
        '<p>Subtotal: ' + money(s.subtotal) +
        (s.discountAmt ? ' &nbsp;·&nbsp; Discount: −' + money(s.discountAmt) : '') + '</p>' + actions + '</div>';
    }).join('');
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
    var brandOpts = (data.brands || []).map(function (br) {
      return '<option>' + esc(br) + '</option>';
    }).join('');
    var goodHtml = (data.goods || []).map(function (g, i) {
      return '<div class="card" data-good="' + i + '">' +
        '<label>Good name</label><input class="gd-name" value="' + esc(g.name) + '">' +
        '<label>Article code</label><input class="gd-art" value="' + esc(g.art || '') + '">' +
        '<label>Brand</label><select class="gd-brand">' + brandOpts + '</select>' +
        '<label>Cost $ (what the shop paid)</label><input class="gd-cost" type="number" min="0" step="0.01" value="' + esc(g.cost) + '">' +
        '<label>Price $</label><input class="gd-price" type="number" min="0" step="0.01" value="' + esc(g.price) + '">' +
        '<label>Stock (before shipments and sales on each device)</label><input class="gd-stock" type="number" min="0" step="1" value="' + esc(g.stock) + '">' +
        '<div class="row"><button class="danger gd-del">Delete good</button></div></div>';
    }).join('');
    var brandHtml = (data.brands || []).map(function (br, i) {
      return '<div class="card" data-brand="' + i + '"><h3>' + esc(br) + '</h3>' +
        '<div class="row"><button class="danger br-del">Delete brand</button></div></div>';
    }).join('');
    el.innerHTML = '<h2>Setup</h2>' +
      '<div class="note">Edit the shop here, then press “Download data.json”. ' +
      'To put the changes live, replace the <strong>data.json</strong> file inside this folder with the downloaded file, then reload the page. ' +
      'Nothing on this tab changes the live page by itself — and that is on purpose, so visitors cannot change your goods.</div>' +
      '<div class="card"><h3>Business details</h3>' +
      field('Business name', 'st-name', b.name) +
      field('About', 'st-about', b.about) +
      field('Phone', 'st-phone', b.phone, 'tel') +
      field('Email (sale copies go here; empty = Yently inbox)', 'st-email', b.email, 'email') +
      field('Address', 'st-address', b.address) +
      field('Hours', 'st-hours', b.hours) + '</div>' +
      '<h3>Brands</h3>' + brandHtml +
      '<div class="card"><h3>Add a brand</h3>' +
      '<label>Brand name</label><input id="br-new">' +
      '<div class="row"><button id="br-add">Add brand</button></div></div>' +
      '<h3>Goods</h3>' + goodHtml +
      '<div class="card"><h3>Add a good</h3>' +
      '<label>Good name</label><input id="gd-new-name">' +
      '<label>Article code</label><input id="gd-new-art">' +
      '<label>Brand</label><select id="gd-new-brand">' + brandOpts + '</select>' +
      '<label>Cost $</label><input id="gd-new-cost" type="number" min="0" step="0.01">' +
      '<label>Price $</label><input id="gd-new-price" type="number" min="0" step="0.01">' +
      '<label>Stock</label><input id="gd-new-stock" type="number" min="0" step="1">' +
      '<div class="row"><button id="gd-add">Add good</button></div></div>' +
      '<div class="row"><button id="setup-download">Download data.json</button></div>';
    /* Set each good's brand select to its current brand. */
    Array.prototype.forEach.call(el.querySelectorAll('[data-good]'), function (card) {
      var g = data.goods[Number(card.getAttribute('data-good'))];
      if (g) card.querySelector('.gd-brand').value = g.brand || '';
    });
    Array.prototype.forEach.call(el.querySelectorAll('.gd-del'), function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('[data-good]');
        data.goods.splice(Number(card.getAttribute('data-good')), 1);
        renderSetup();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('.br-del'), function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('[data-brand]');
        data.brands.splice(Number(card.getAttribute('data-brand')), 1);
        renderSetup();
      });
    });
    $('br-add').addEventListener('click', function () {
      var name = $('br-new').value.trim();
      if (name && data.brands.indexOf(name) === -1) data.brands.push(name);
      renderSetup();
    });
    $('gd-add').addEventListener('click', function () {
      var name = $('gd-new-name').value.trim();
      var price = parseFloat($('gd-new-price').value);
      if (!name || isNaN(price)) return;
      var maxId = (data.goods || []).reduce(function (m, g) { return Math.max(m, g.id || 0); }, 0);
      var cost = parseFloat($('gd-new-cost').value);
      var stock = parseInt($('gd-new-stock').value, 10);
      data.goods.push({ id: maxId + 1, art: $('gd-new-art').value.trim(), name: name,
        brand: $('gd-new-brand').value, cost: isNaN(cost) ? 0 : cost, price: price,
        stock: isNaN(stock) ? 0 : stock });
      renderSetup();
    });
    $('setup-download').addEventListener('click', function () {
      var next = { business: { name: $('st-name').value.trim(), about: $('st-about').value.trim(),
          phone: $('st-phone').value.trim(), email: $('st-email').value.trim(),
          address: $('st-address').value.trim(), hours: $('st-hours').value.trim() },
        brands: data.brands.slice(), goods: [] };
      Array.prototype.forEach.call(el.querySelectorAll('[data-good]'), function (card, i) {
        next.goods.push({ id: (data.goods[i] && data.goods[i].id) || (i + 1),
          art: card.querySelector('.gd-art').value.trim(),
          name: card.querySelector('.gd-name').value.trim(),
          brand: card.querySelector('.gd-brand').value,
          cost: parseFloat(card.querySelector('.gd-cost').value) || 0,
          price: parseFloat(card.querySelector('.gd-price').value) || 0,
          stock: parseInt(card.querySelector('.gd-stock').value, 10) || 0 });
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
    showTab('goods');
  });
  $('view-goods').addEventListener('click', function (e) {
    var chip = e.target.getAttribute && e.target.getAttribute('data-gchip');
    if (chip) {
      goodsBrand = chip;
      renderGoodsChips();
      renderGoodsGrid();
    }
  });
  $('view-sell').addEventListener('click', function (e) {
    var t = e.target;
    var add = t.getAttribute && t.getAttribute('data-add');
    var inc = t.getAttribute && t.getAttribute('data-inc');
    var dec = t.getAttribute && t.getAttribute('data-dec');
    var del = t.getAttribute && t.getAttribute('data-del');
    if (add) {
      var g = goodById(add);
      if (g && cartQty(add) < stockOf(g)) cart[String(add)] = cartQty(add) + 1;
      renderSellGrid(); renderSellCart();
    } else if (inc) {
      var g2 = goodById(inc);
      if (g2 && cartQty(inc) < stockOf(g2)) cart[String(inc)] = cartQty(inc) + 1;
      renderSellGrid(); renderSellCart();
    } else if (dec) {
      cart[String(dec)] = cartQty(dec) - 1;
      if (cart[String(dec)] <= 0) delete cart[String(dec)];
      renderSellGrid(); renderSellCart();
    } else if (del) {
      delete cart[String(del)];
      renderSellGrid(); renderSellCart();
    }
  });
  $('view-sell').addEventListener('click', function (e) {
    /* Sell brand chips use data-schip. */
    var chip = e.target.getAttribute && e.target.getAttribute('data-schip');
    if (chip) {
      sellBrand = chip;
      renderSellChips(); renderSellGrid();
    }
  });
  $('view-reports').addEventListener('click', function (e) {
    var v = e.target.getAttribute && e.target.getAttribute('data-void');
    if (v) {
      var s = sales.filter(function (x) { return String(x.id) === v; })[0];
      if (s) s.status = 'voided';
      save(SALES_KEY, sales);
      renderReports();
    }
  });
  fetch(BASE + 'data.json')
    .then(function (res) { if (!res.ok) throw new Error('data.json not found'); return res.json(); })
    .then(function (json) {
      data = json;
      data.business = data.business || {};
      data.brands = data.brands || [];
      data.goods = data.goods || [];
      renderHeader();
      showTab('goods');
    })
    .catch(function () {
      $('view-goods').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one (see the README in this folder) and reload the page.</div>';
    });
})();
