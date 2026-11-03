/* Restaurant page app — one folder per restaurant.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Orders are kept in
   this browser only (one key per folder), like the desktop app's local file.
   Setup edits never change the live page by themselves: they download a new
   data.json, and the owner replaces the folder's file with it. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'restaurant')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var ORDER_KEY = 'rms-orders-' + SLUG;

  var data = null;
  var orders = loadOrders();
  var cart = {}; // menu index -> quantity
  var currentView = 'menu';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n || 0).toFixed(2); }
  function loadOrders() {
    try { return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveOrders() {
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(orders)); } catch (e) {}
    updateBadges();
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
    var kc = $('kitchen-count');
    var active = orders.filter(function (o) { return o.status === 'active'; }).length;
    kc.hidden = active === 0;
    kc.textContent = active;
  }

  function show(view) {
    currentView = view;
    ['menu', 'order', 'kitchen', 'receipt', 'setup'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
    });
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view);
    });
    if (view === 'menu') renderMenu();
    if (view === 'order') renderOrder();
    if (view === 'kitchen') renderKitchen();
    if (view === 'receipt') renderReceiptForm();
    if (view === 'setup') renderSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- Menu ---------- */
  function renderMenu() {
    var el = $('view-menu');
    if (!data) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var info = '<div class="card info">';
    if (data.address) info += '<p>📍 ' + esc(data.address) + '</p>';
    if (data.phone) info += '<p>📞 ' + esc(data.phone) + '</p>';
    if (data.email) info += '<p>✉️ ' + esc(data.email) + '</p>';
    if (data.hours) info += '<p>🕐 ' + esc(data.hours) + '</p>';
    info += '</div>';
    var cats = [];
    data.menu.forEach(function (item) {
      if (cats.indexOf(item.category || 'Menu') === -1) cats.push(item.category || 'Menu');
    });
    var html = info;
    cats.forEach(function (cat) {
      html += '<h2>' + esc(cat) + '</h2><div class="menu-grid">';
      data.menu.forEach(function (item, i) {
        if ((item.category || 'Menu') !== cat) return;
        html += '<div class="menu-item">';
        if (item.image) html += '<img src="' + esc(BASE + item.image) + '" alt="">';
        html += '<h3>' + esc(item.name) + '</h3>';
        if (item.description) html += '<div class="desc">' + esc(item.description) + '</div>';
        html += '<div class="row"><span class="price">' + money(item.price) + '</span>' +
          '<span style="flex:1"></span>' +
          '<button data-add="' + i + '">Add</button></div></div>';
      });
      html += '</div>';
    });
    el.innerHTML = html;
    el.querySelectorAll('[data-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = btn.getAttribute('data-add');
        cart[i] = (cart[i] || 0) + 1;
        updateBadges();
        btn.textContent = 'Added ✓';
        setTimeout(function () { btn.textContent = 'Add'; }, 900);
      });
    });
  }

  /* ---------- Order ---------- */
  function renderOrder() {
    var el = $('view-order');
    var keys = Object.keys(cart);
    if (keys.length === 0) {
      el.innerHTML = '<h2>My Order</h2><p class="info">Nothing here yet — add something tasty from the Menu tab.</p>';
      return;
    }
    var total = 0;
    var html = '<h2>My Order</h2><label>Table number</label><select id="order-table">';
    for (var t = 1; t <= (data.tables || 10); t++) html += '<option value="' + t + '">Table ' + t + '</option>';
    html += '</select><div class="card">';
    keys.forEach(function (k) {
      var item = data.menu[Number(k)];
      var qty = cart[k];
      total += item.price * qty;
      html += '<div class="order-line"><div><strong>' + esc(item.name) + '</strong><br>' +
        '<span class="info">' + money(item.price) + ' each</span></div>' +
        '<div class="qty"><button class="small secondary" data-dec="' + k + '">−</button>' +
        '<span>' + qty + '</span>' +
        '<button class="small secondary" data-inc="' + k + '">+</button>' +
        '<button class="small danger" data-del="' + k + '">Remove</button></div></div>';
    });
    html += '<div class="total">Total: ' + money(total) + '</div></div>' +
      '<button id="send-kitchen">Send to kitchen</button>';
    el.innerHTML = html;
    el.querySelectorAll('[data-inc]').forEach(function (b) {
      b.addEventListener('click', function () { cart[b.getAttribute('data-inc')]++; renderOrder(); updateBadges(); });
    });
    el.querySelectorAll('[data-dec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-dec');
        cart[k]--;
        if (cart[k] <= 0) delete cart[k];
        renderOrder(); updateBadges();
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { delete cart[b.getAttribute('data-del')]; renderOrder(); updateBadges(); });
    });
    $('send-kitchen').addEventListener('click', function () {
      var table = Number($('order-table').value);
      var items = Object.keys(cart).map(function (k) {
        var item = data.menu[Number(k)];
        return { name: item.name, price: item.price, qty: cart[k], cooked: false };
      });
      orders.push({ id: Date.now(), table: table, items: items, status: 'active',
        createdAt: new Date().toISOString() });
      cart = {};
      saveOrders();
      show('kitchen');
    });
  }

  /* ---------- Kitchen ---------- */
  function renderKitchen() {
    var el = $('view-kitchen');
    var active = orders.filter(function (o) { return o.status === 'active'; });
    if (active.length === 0) {
      el.innerHTML = '<h2>Kitchen</h2><p class="info">No active orders right now. New orders sent from the Order tab will appear here.</p>';
      return;
    }
    var html = '<h2>Kitchen</h2>';
    active.forEach(function (order) {
      var allCooked = order.items.every(function (it) { return it.cooked; });
      html += '<div class="card"><h3>Table ' + order.table + '</h3>' +
        '<p class="info">' + new Date(order.createdAt).toLocaleString() + '</p>';
      order.items.forEach(function (it, i) {
        html += '<div class="kitchen-item"><input type="checkbox" data-cook="' + order.id + ':' + i + '"' +
          (it.cooked ? ' checked' : '') + '><span class="' + (it.cooked ? 'done' : '') + '">' +
          esc(it.qty) + ' × ' + esc(it.name) + '</span></div>';
      });
      html += '<div class="row" style="margin-top:10px">' +
        '<button data-fulfil="' + order.id + '"' + (allCooked ? '' : ' disabled') + '>Fulfil order</button>' +
        '<button class="secondary" data-delorder="' + order.id + '">Delete</button></div></div>';
    });
    el.innerHTML = html;
    el.querySelectorAll('[data-cook]').forEach(function (box) {
      box.addEventListener('change', function () {
        var parts = box.getAttribute('data-cook').split(':');
        var order = orders.filter(function (o) { return String(o.id) === parts[0]; })[0];
        if (order) order.items[Number(parts[1])].cooked = box.checked;
        saveOrders();
        renderKitchen();
      });
    });
    el.querySelectorAll('[data-fulfil]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var order = orders.filter(function (o) { return String(o.id) === btn.getAttribute('data-fulfil'); })[0];
        if (order) order.status = 'done';
        saveOrders();
        renderKitchen();
      });
    });
    el.querySelectorAll('[data-delorder]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!window.confirm('Delete this order?')) return;
        orders = orders.filter(function (o) { return String(o.id) !== btn.getAttribute('data-delorder'); });
        saveOrders();
        renderKitchen();
      });
    });
  }

  /* ---------- Receipt ---------- */
  function renderReceiptForm() {
    var el = $('view-receipt');
    var done = orders.filter(function (o) { return o.status === 'done'; });
    var html = '<h2>Receipt</h2><div class="note">Pick a table to load its latest finished order, then print the receipt.</div>' +
      '<label>Table number</label><select id="receipt-table">';
    for (var t = 1; t <= (data.tables || 10); t++) html += '<option value="' + t + '">Table ' + t + '</option>';
    html += '</select><button id="load-receipt">Load receipt</button><div id="receipt-out" style="margin-top:14px"></div>';
    el.innerHTML = html;
    $('load-receipt').addEventListener('click', function () {
      var table = Number($('receipt-table').value);
      var found = null;
      done.forEach(function (o) { if (o.table === table) found = o; });
      var out = $('receipt-out');
      if (!found) {
        out.innerHTML = '<p class="info">No finished order for Table ' + table + ' yet.</p>';
        return;
      }
      var total = 0;
      var rows = '';
      found.items.forEach(function (it) {
        total += it.price * it.qty;
        rows += '<div class="order-line"><span>' + it.qty + ' × ' + esc(it.name) + '</span><span>' + money(it.price * it.qty) + '</span></div>';
      });
      var receiptHtml = '<div class="card"><h3>' + esc(data.name) + '</h3>' +
        (data.address ? '<p class="info">' + esc(data.address) + '</p>' : '') +
        '<p class="info">Table ' + found.table + ' — ' + new Date(found.createdAt).toLocaleString() + '</p>' +
        rows + '<div class="total">Total: ' + money(total) + '</div>' +
        '<p class="info" style="text-align:center;margin-top:14px">Thank you — please come again!</p></div>';
      out.innerHTML = receiptHtml + '<button id="print-receipt" style="margin-top:10px">Print receipt</button>';
      $('print-receipt').addEventListener('click', function () {
        $('print-area').innerHTML = receiptHtml;
        window.print();
      });
    });
  }

  /* ---------- Setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    function field(label, id, value, type) {
      return '<label>' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '">';
    }
    var html = '<h2>Setup</h2>' +
      '<div class="note">Edit the restaurant here, then press “Download data.json”. ' +
      'To put the changes live, replace the <strong>data.json</strong> file inside this folder with the downloaded file, then reload the page. ' +
      'Nothing on this tab changes the live page by itself — and that is on purpose, so visitors cannot change your menu.</div>' +
      '<div class="card">' +
      field('Restaurant name', 'setup-name', data.name) +
      field('About text', 'setup-about', data.about) +
      field('Phone', 'setup-phone', data.phone) +
      field('Email', 'setup-email', data.email, 'email') +
      field('Address', 'setup-address', data.address) +
      field('Hours', 'setup-hours', data.hours) +
      field('Number of tables', 'setup-tables', data.tables, 'number') +
      field('Number of seats', 'setup-seats', data.seats, 'number') +
      '</div><h2>Menu</h2><div id="setup-menu"></div>' +
      '<button id="setup-add" class="secondary">+ Add menu item</button>' +
      '<div style="margin-top:16px"><button id="setup-download">Download data.json</button></div>';
    el.innerHTML = html;
    var menuEl = $('setup-menu');
    function menuRow(item, i) {
      var row = document.createElement('div');
      row.className = 'card';
      row.innerHTML =
        '<label>Item name</label><input data-f="name" value="' + esc(item.name) + '">' +
        '<label>Price</label><input data-f="price" type="number" step="0.01" min="0" value="' + esc(item.price) + '">' +
        '<label>Category (e.g. Starters, Main courses, Desserts, Drinks)</label><input data-f="category" value="' + esc(item.category || '') + '">' +
        '<label>Description</label><input data-f="description" value="' + esc(item.description || '') + '">' +
        '<button class="small danger" data-remove="' + i + '">Remove item</button>';
      row.querySelectorAll('[data-f]').forEach(function (input) {
        input.addEventListener('input', function () {
          var f = input.getAttribute('data-f');
          item[f] = f === 'price' ? Number(input.value) : input.value;
        });
      });
      row.querySelector('[data-remove]').addEventListener('click', function () {
        data.menu.splice(i, 1);
        renderSetup();
      });
      return row;
    }
    function drawMenu() {
      menuEl.innerHTML = '';
      data.menu.forEach(function (item, i) { menuEl.appendChild(menuRow(item, i)); });
    }
    drawMenu();
    $('setup-add').addEventListener('click', function () {
      data.menu.push({ name: 'New item', price: 0, category: 'Menu', description: '' });
      drawMenu();
    });
    $('setup-download').addEventListener('click', function () {
      var out = {
        name: $('setup-name').value.trim() || data.name,
        about: $('setup-about').value,
        phone: $('setup-phone').value,
        email: $('setup-email').value,
        address: $('setup-address').value,
        hours: $('setup-hours').value,
        tables: Number($('setup-tables').value) || data.tables,
        seats: Number($('setup-seats').value) || data.seats,
        logo: data.logo || '',
        menu: data.menu.filter(function (it) { return it.name.trim() !== ''; })
      };
      var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  /* ---------- Start ---------- */
  document.querySelectorAll('#tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () { show(btn.getAttribute('data-view')); });
  });
  fetch(BASE + 'data.json')
    .then(function (res) {
      if (!res.ok) throw new Error('data.json not found');
      return res.json();
    })
    .then(function (json) {
      data = json;
      data.menu = data.menu || [];
      document.title = data.name || 'Restaurant';
      var logo = $('site-logo');
      if (data.logo) { logo.src = BASE + data.logo; logo.hidden = false; }
      $('site-name').textContent = data.name || 'Restaurant';
      $('site-about').textContent = data.about || '';
      var foot = [];
      if (data.address) foot.push(esc(data.address));
      if (data.phone) foot.push(esc(data.phone));
      if (data.hours) foot.push(esc(data.hours));
      $('site-footer').innerHTML = foot.join(' · ');
      updateBadges();
      renderMenu();
    })
    .catch(function () {
      $('site-name').textContent = 'Restaurant page not ready';
      $('view-menu').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one next to this page (copy the example from another restaurant folder), then reload.</div>';
    });
})();
