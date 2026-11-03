/* Diner page app — ONE folder for every restaurant.
   The restaurant comes from the link (?r=<slug>), and its menu, info,
   and orders live in the database — there is no data.json file here.
   Visitors see the last APPROVED menu. The customer logs in with the
   username + password the admin created for their restaurant (that
   login is what AutoFly sells); Setup edits save as a draft, and the
   Upload button sends the draft to the admin for approval. Approval
   makes the draft live instantly — no file swap, no redeploy wait.
   The Kitchen tab is staff-only (same login) and polls the shared
   order list every few seconds while open, so new orders appear with
   no manual refresh, from any phone. Login credentials live in memory
   only: a reload asks for login again, exactly like the barber
   intake form. */
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
  var SLUG = String(params.r || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
  var MYORDERS_KEY = 'diner-myorders-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null; // live menu/info (visitors)
  var draft = null; // staff draft (Setup)
  var draftStatus = 'editing';
  var staffCreds = null; // {u, p} in memory only, never stored
  var cart = {}; // menu index -> quantity
  var sentNote = '';
  var myOrders = loadMyOrders();
  var kitchenOrders = [];
  var kitchenTimer = null;
  var currentView = 'menu';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n || 0).toFixed(2); }
  function loadMyOrders() {
    try { return JSON.parse(localStorage.getItem(MYORDERS_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveMyOrders() {
    try { localStorage.setItem(MYORDERS_KEY, JSON.stringify(myOrders)); } catch (e) {}
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
    var active = kitchenOrders.filter(function (o) { return o.status === 'active'; }).length;
    kc.hidden = active === 0;
    kc.textContent = active;
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
        body: JSON.stringify({ subject: subject, table: 'diner_draft', record: record })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- Staff sign-in ---------- */
  /* Setup and Kitchen share one login: the restaurant's own username +
     password, checked against that restaurant only. Credentials stay in
     memory for this page only — a reload asks for login again. */
  function staffUnlocked() { return !!staffCreds; }
  function renderStaffLogin(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the username and password AutoFly gave this restaurant.</p>' +
      '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
      '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="st-go">Sign in</button></div>' +
      '<div id="st-out" style="margin-top:12px"></div></div>';
    $('st-go').addEventListener('click', function () {
      var out = $('st-out');
      var u = $('st-user').value.trim();
      var p = $('st-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_diner_login', { p_slug: SLUG, p_username: u, p_password: p }).then(function (ok) {
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

  function stopKitchenPoll() {
    if (kitchenTimer) { clearInterval(kitchenTimer); kitchenTimer = null; }
  }

  function show(view) {
    currentView = view;
    if (view !== 'kitchen') stopKitchenPoll();
    ['menu', 'order', 'kitchen', 'receipt', 'setup'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
    });
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view);
    });
    if (view === 'menu') renderMenu();
    if (view === 'order') renderOrder();
    if (view === 'kitchen') openKitchen();
    if (view === 'receipt') renderReceipt();
    if (view === 'setup') openSetup();
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
        if (item.image) html += '<img src="' + esc(item.image) + '" alt="">';
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
        sentNote = '';
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
      el.innerHTML = '<h2>My Order</h2>' +
        (sentNote ? '<div class="note">' + esc(sentNote) + '</div>' : '') +
        '<p class="info">Nothing here yet — add something tasty from the Menu tab.</p>';
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
      '<button id="send-kitchen">Send to kitchen</button><div id="order-out" style="margin-top:12px"></div>';
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
      var out = $('order-out');
      out.innerHTML = '<p class="info">Sending…</p>';
      var table = Number($('order-table').value);
      var items = Object.keys(cart).map(function (k) {
        var item = data.menu[Number(k)];
        return { name: item.name, price: item.price, qty: cart[k], cooked: false };
      });
      var order = { table: table, items: items, createdAt: new Date().toISOString() };
      rpc('place_diner_order', { p_slug: SLUG, p_order: order }).then(function (id) {
        myOrders.push({ dbId: id, table: table, items: items, createdAt: order.createdAt });
        saveMyOrders();
        sentNote = 'Sent to the kitchen — Table ' + table + ', total ' + money(items.reduce(function (s, it) { return s + it.price * it.qty; }, 0)) + '.';
        cart = {};
        updateBadges();
        renderOrder();
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not send the order: ' + esc(err.message) + ' Please try again.</p>';
      });
    });
  }

  /* ---------- Kitchen (staff only, shared across devices) ---------- */
  function openKitchen() {
    if (!staffUnlocked()) {
      renderStaffLogin($('view-kitchen'), 'Kitchen sign-in', function () { openKitchen(); });
      return;
    }
    fetchKitchen();
    stopKitchenPoll();
    kitchenTimer = setInterval(fetchKitchen, 5000);
  }
  function fetchKitchen() {
    rpc('list_diner_orders', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p }).then(function (rows) {
      kitchenOrders = rows || [];
      updateBadges();
      if (currentView === 'kitchen') renderKitchen();
    }).catch(function () {
      if (currentView === 'kitchen') {
        var el = $('view-kitchen');
        if (!kitchenOrders.length) el.innerHTML = '<h2>Kitchen</h2><p class="error">Could not load orders. Please try again in a moment.</p>';
      }
    });
  }
  function renderKitchen() {
    var el = $('view-kitchen');
    var active = kitchenOrders.filter(function (o) { return o.status === 'active'; });
    if (active.length === 0) {
      el.innerHTML = '<h2>Kitchen</h2><p class="info">No active orders right now. New orders appear here by themselves — no need to refresh.</p>';
      return;
    }
    var html = '<h2>Kitchen</h2><p class="info">Orders refresh on their own every few seconds.</p>';
    active.forEach(function (order) {
      var d = order.data || {};
      var items = d.items || [];
      var allCooked = items.length > 0 && items.every(function (it) { return it.cooked; });
      html += '<div class="card"><h3>Table ' + d.table + '</h3>' +
        '<p class="info">' + new Date(d.createdAt || order.created_at).toLocaleString() + '</p>';
      items.forEach(function (it, i) {
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
        var order = kitchenOrders.filter(function (o) { return String(o.id) === parts[0]; })[0];
        if (!order) return;
        order.data.items[Number(parts[1])].cooked = box.checked;
        rpc('update_diner_order', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_order_id: order.id, p_data: order.data, p_status: 'active' }).then(fetchKitchen).catch(fetchKitchen);
      });
    });
    el.querySelectorAll('[data-fulfil]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var order = kitchenOrders.filter(function (o) { return String(o.id) === btn.getAttribute('data-fulfil'); })[0];
        if (!order) return;
        rpc('update_diner_order', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_order_id: order.id, p_data: order.data, p_status: 'done' }).then(fetchKitchen).catch(fetchKitchen);
      });
    });
    el.querySelectorAll('[data-delorder]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!window.confirm('Delete this order?')) return;
        var id = Number(btn.getAttribute('data-delorder'));
        rpc('delete_diner_order', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_order_id: id }).then(fetchKitchen).catch(fetchKitchen);
      });
    });
  }

  /* ---------- Receipt (visitor's own orders, printable) ---------- */
  function renderReceipt() {
    var el = $('view-receipt');
    if (myOrders.length === 0) {
      el.innerHTML = '<h2>Receipt</h2><p class="info">No orders from this browser yet. Orders you send from the Order tab will show here so you can print them.</p>';
      return;
    }
    var html = '<h2>Receipt</h2><div class="note">Your orders from this browser. Show one to your server or print it.</div>';
    myOrders.slice().reverse().forEach(function (o, idx) {
      var total = 0;
      var rows = '';
      (o.items || []).forEach(function (it) {
        total += it.price * it.qty;
        rows += '<div class="order-line"><span>' + it.qty + ' × ' + esc(it.name) + '</span><span>' + money(it.price * it.qty) + '</span></div>';
      });
      var card = '<div class="card"><h3>' + esc(data.name) + '</h3>' +
        '<p class="info">Table ' + o.table + ' — ' + new Date(o.createdAt).toLocaleString() + '</p>' +
        rows + '<div class="total">Total: ' + money(total) + '</div></div>';
      html += '<div data-receipt="' + idx + '">' + card +
        '<button class="secondary" data-print="' + idx + '" style="margin-bottom:16px">Print receipt</button></div>';
    });
    el.innerHTML = html;
    el.querySelectorAll('[data-print]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var wrap = el.querySelector('[data-receipt="' + btn.getAttribute('data-print') + '"] .card');
        if (wrap) { $('print-area').innerHTML = wrap.outerHTML; window.print(); }
      });
    });
  }

  /* ---------- Setup (staff only: draft + Upload for approval) ---------- */
  function openSetup() {
    if (!staffUnlocked()) {
      renderStaffLogin($('view-setup'), 'Setup sign-in', function () { openSetup(); });
      return;
    }
    var el = $('view-setup');
    el.innerHTML = '<h2>Setup</h2><div class="card"><p class="info">Loading your draft…</p></div>';
    rpc('get_diner_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p }).then(function (res) {
      draft = res.data || {};
      draft.menu = draft.menu || [];
      draftStatus = res.status || 'editing';
      renderSetup();
    }).catch(function () {
      el.innerHTML = '<h2>Setup</h2><div class="card"><p class="error">Could not load your draft. Please try again in a moment.</p></div>';
    });
  }
  function statusLine() {
    if (draftStatus === 'pending') return 'Your changes were sent to AutoFly and are waiting for approval. Visitors still see the approved menu.';
    if (draftStatus === 'approved') return 'Your last upload was approved and is now live.';
    return 'Your changes are saved as a draft. Visitors still see the approved menu until you upload and AutoFly approves.';
  }
  function renderSetup() {
    var el = $('view-setup');
    function field(label, id, value, type) {
      return '<label>' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '">';
    }
    var html = '<h2>Setup</h2>' +
      '<div class="note">' + esc(statusLine()) + '</div>' +
      '<div class="card">' +
      field('Restaurant name', 'setup-name', draft.name) +
      field('About text', 'setup-about', draft.about) +
      field('Phone', 'setup-phone', draft.phone) +
      field('Email', 'setup-email', draft.email, 'email') +
      field('Address', 'setup-address', draft.address) +
      field('Hours', 'setup-hours', draft.hours) +
      field('Number of tables', 'setup-tables', draft.tables, 'number') +
      field('Number of seats', 'setup-seats', draft.seats, 'number') +
      '</div><h2>Menu</h2><div id="setup-menu"></div>' +
      '<button id="setup-add" class="secondary">+ Add menu item</button>' +
      '<div class="row" style="margin-top:16px"><button id="setup-save" class="secondary">Save draft</button>' +
      '<button id="setup-upload">Upload for approval</button></div>' +
      '<div id="setup-out" style="margin-top:12px"></div>';
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
        draft.menu.splice(i, 1);
        renderSetup();
      });
      return row;
    }
    function drawMenu() {
      menuEl.innerHTML = '';
      draft.menu.forEach(function (item, i) { menuEl.appendChild(menuRow(item, i)); });
    }
    drawMenu();
    $('setup-add').addEventListener('click', function () {
      draft.menu.push({ name: 'New item', price: 0, category: 'Menu', description: '' });
      drawMenu();
    });
    function collectDraft() {
      return {
        name: $('setup-name').value.trim() || draft.name,
        about: $('setup-about').value,
        phone: $('setup-phone').value,
        email: $('setup-email').value,
        address: $('setup-address').value,
        hours: $('setup-hours').value,
        tables: Number($('setup-tables').value) || draft.tables,
        seats: Number($('setup-seats').value) || draft.seats,
        logo: draft.logo || '',
        menu: draft.menu.filter(function (it) { return it.name.trim() !== ''; })
      };
    }
    $('setup-save').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Saving…</p>';
      var d = collectDraft();
      rpc('save_diner_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'editing';
        out.innerHTML = '<p class="info">Draft saved. Visitors still see the approved menu.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not save: ' + esc(err.message) + '</p>';
      });
    });
    $('setup-upload').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Uploading…</p>';
      var d = collectDraft();
      rpc('submit_diner_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'pending';
        notifyEmail('Diner draft for approval: ' + (d.name || SLUG), { restaurant: d.name || '', slug: SLUG });
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
    $('site-name').textContent = 'Restaurant not found';
    $('view-menu').innerHTML = '<div class="error">This link doesn\'t point to a restaurant. Check the link and try again — a restaurant link looks like autofly.us.com/diner?r=your-restaurant.</div>';
  } else {
    rpc('get_diner_live', { p_slug: SLUG }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.menu = data.menu || [];
      document.title = data.name || 'Restaurant';
      var logo = $('site-logo');
      if (data.logo) { logo.src = (/^https?:\/\//.test(data.logo) ? data.logo : BASE + data.logo); logo.hidden = false; }
      $('site-name').textContent = data.name || 'Restaurant';
      $('site-about').textContent = data.about || '';
      var foot = [];
      if (data.address) foot.push(esc(data.address));
      if (data.phone) foot.push(esc(data.phone));
      if (data.hours) foot.push(esc(data.hours));
      foot.push('Powered by AutoFly');
      $('site-footer').innerHTML = foot.join(' · ');
      updateBadges();
      renderMenu();
    }).catch(function () {
      $('site-name').textContent = 'Restaurant not found';
      $('view-menu').innerHTML = '<div class="error">This link doesn\'t point to a restaurant yet. Check the link and try again.</div>';
    });
  }
})();
