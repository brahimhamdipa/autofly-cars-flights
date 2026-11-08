/* Diner page app — ONE folder for every restaurant.
   The restaurant comes from its own private link, and its menu, info,
   and orders live in the database — there is no data.json file here.
   Visitors see the last APPROVED menu. The customer logs in with the
   username + password the admin created for their restaurant (that
   login is what AutoFly sells); Setup edits save as a draft, and the
   Upload button sends the draft to the admin for approval. Approval
   makes the draft live instantly — no file swap, no redeploy wait.
   The menu itself is PUBLIC: anyone with the link sees it, but with
   no Add buttons. The Order button unlocks the working site with
   the restaurant's shared employee password (one password for all
   staff, set by the admin; restaurants with none set stay fully
   open). Ordering, My Order, Kitchen and Receipt all need that
   unlock; Setup still asks for the owner's own login. The Kitchen
   tab polls the shared order list every few seconds while open, so
   new orders appear with no manual refresh, from any phone. All
   credentials live in memory only: a reload asks again, exactly
   like the barber intake form. */
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
  var empPass = null; // employee password in memory only, never stored
  var empUnlocked = false; // true once the employee password is entered, or when the restaurant has none set
  var cart = {}; // menu index -> quantity
  var sentNote = '';
  var myOrders = loadMyOrders();
  var kitchenOrders = [];
  var delOrderId = null; // kitchen order id awaiting an in-page delete confirmation
  var kitchenTimer = null;
  var currentView = 'menu';
  var menuSearch = ''; // public menu search text, kept while typing

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
  /* One small picture per menu item, same shrink as the icon (200px,
     JPEG 0.8, PNGs stay PNG). Uploaded at once to store/diner-items/
     and stored on the draft item as `pic` — a public URL or ''. */
  function uploadItemPicture(file) {
    return shrinkIconImage(file).then(function (up) {
      var safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = 'store/diner-items/' + SLUG + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
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

  /* ---------- Staff sign-in ---------- */
  /* Setup only: the restaurant's own username + password, checked
     against that restaurant only. Credentials stay in memory for this
     page only — a reload asks for login again. */
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

  /* ---------- Employee unlock (ordering + kitchen) ---------- */
  /* The menu is public, but ordering, My Order, Kitchen and Receipt
     need the restaurant's shared employee password — one password
     for everybody, set by the admin. Nothing is stored: a reload
     asks again. Restaurants with no password set skip this entirely
     (empUnlocked starts true for them, see the start block). */
  function renderEmpPrompt(el, after) {
    el.innerHTML = '<h2>Order</h2><div class="card">' +
      '<p class="info">Enter the employee password for this restaurant to order and use the kitchen.</p>' +
      '<label>Employee password</label><input id="emp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="emp-go">Unlock</button></div>' +
      '<div id="emp-out" style="margin-top:12px"></div></div>';
    $('emp-go').addEventListener('click', function () {
      var out = $('emp-out');
      var p = $('emp-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_diner_employee_pass', { p_slug: SLUG, p_password: p }).then(function (ok) {
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
  function menuMatches(item, q) {
    if (!q) return true;
    var hay = [item.name, item.description].map(function (x) { return String(x == null ? '' : x).toLowerCase(); }).join(' ');
    return hay.indexOf(q) !== -1;
  }
  /* One menu item: text on the left, its small picture on the right
     (96×72, the same size as the dealer Setup thumbnails). Items
     without a picture show no thumbnail. A legacy `image` is shown
     the same way when there is no `pic`. */
  function menuItemHtml(item, i) {
    var pic = item.pic || item.image || '';
    var h = '<div class="menu-item"><div class="item-top"><div class="item-text"><h3>' + esc(item.name) + '</h3>';
    if (item.description) h += '<div class="desc">' + esc(item.description) + '</div>';
    h += '</div>';
    if (pic) h += '<img class="item-pic" src="' + esc(pic) + '" alt="">';
    h += '</div><div class="row"><span class="price">' + money(item.price) + '</span>' +
      '<span style="flex:1"></span>' +
      (empUnlocked ? '<button data-add="' + i + '">Add</button>' : '') + '</div></div>';
    return h;
  }
  /* The menu grid alone, re-rendered as the visitor types in the
     search box, so the search input never loses focus. */
  function renderMenuGrid() {
    var grid = $('menu-grid');
    if (!grid) return;
    var q = (menuSearch || '').toLowerCase();
    var cats = [];
    (data.menu || []).forEach(function (item) {
      if (!menuMatches(item, q)) return;
      var cat = item.category || 'Menu';
      if (cats.indexOf(cat) === -1) cats.push(cat);
    });
    var html = '';
    if (!cats.length) {
      html = '<div class="card"><p class="info">' + (menuSearch ? 'No items match your search.' : 'No menu items yet.') + '</p></div>';
    } else {
      cats.forEach(function (cat) {
        html += '<h2>' + esc(cat) + '</h2><div class="menu-grid">';
        data.menu.forEach(function (item, i) {
          if ((item.category || 'Menu') !== cat) return;
          if (!menuMatches(item, q)) return;
          html += menuItemHtml(item, i);
        });
        html += '</div>';
      });
    }
    grid.innerHTML = html;
    grid.querySelectorAll('[data-add]').forEach(function (btn) {
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
  function renderMenu() {
    var el = $('view-menu');
    if (!data) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var info = '<div class="card info">';
    if (data.address) info += '<p>📍 ' + esc(data.address) + '</p>';
    if (data.phone) info += '<p>📞 ' + esc(data.phone) + '</p>';
    if (data.email) info += '<p>✉️ ' + esc(data.email) + '</p>';
    if (data.hours) info += '<p>🕐 ' + esc(data.hours) + '</p>';
    info += '</div>';
    var html = info;
    if (!empUnlocked) {
      html += '<div class="card"><p class="info">This is the public menu — take a look around. To order, enter the employee password.</p>' +
        '<button id="menu-order">Order</button></div>';
    }
    html += '<input id="menu-search" type="text" placeholder="Search menu…" value="' + esc(menuSearch) + '">';
    html += '<div id="menu-grid"></div>';
    el.innerHTML = html;
    var orderBtn = $('menu-order');
    if (orderBtn) orderBtn.addEventListener('click', function () {
      renderEmpPrompt(el, function () { renderMenu(); });
    });
    var search = $('menu-search');
    if (search) search.addEventListener('input', function () {
      menuSearch = search.value;
      renderMenuGrid();
    });
    renderMenuGrid();
  }

  /* ---------- Order ---------- */
  function renderOrder() {
    var el = $('view-order');
    if (needEmp(el, 'order')) return;
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
      rpc('place_diner_order', { p_slug: SLUG, p_order: order, p_epass: empPass }).then(function (id) {
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

  /* ---------- Kitchen (employee password, shared across devices) ---------- */
  function openKitchen() {
    if (needEmp($('view-kitchen'), 'kitchen')) return;
    fetchKitchen();
    stopKitchenPoll();
    kitchenTimer = setInterval(fetchKitchen, 5000);
  }
  function fetchKitchen() {
    rpc('list_diner_orders_open', { p_slug: SLUG, p_epass: empPass }).then(function (rows) {
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
        (delOrderId === order.id
          ? '<span><b>Delete this order?</b> <button class="danger" data-delorder-yes="' + order.id + '">Yes, delete</button> <button class="secondary" data-delorder-no="' + order.id + '">Keep it</button></span>'
          : '<button class="secondary" data-delorder="' + order.id + '">Delete</button>') + '</div></div>';
    });
    el.innerHTML = html;
    el.querySelectorAll('[data-cook]').forEach(function (box) {
      box.addEventListener('change', function () {
        var parts = box.getAttribute('data-cook').split(':');
        var order = kitchenOrders.filter(function (o) { return String(o.id) === parts[0]; })[0];
        if (!order) return;
        order.data.items[Number(parts[1])].cooked = box.checked;
        rpc('update_diner_order_open', { p_slug: SLUG, p_order_id: order.id, p_data: order.data, p_status: 'active', p_epass: empPass }).then(fetchKitchen).catch(fetchKitchen);
      });
    });
    el.querySelectorAll('[data-fulfil]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var order = kitchenOrders.filter(function (o) { return String(o.id) === btn.getAttribute('data-fulfil'); })[0];
        if (!order) return;
        rpc('update_diner_order_open', { p_slug: SLUG, p_order_id: order.id, p_data: order.data, p_status: 'done', p_epass: empPass }).then(fetchKitchen).catch(fetchKitchen);
      });
    });
    el.querySelectorAll('[data-delorder]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        delOrderId = Number(btn.getAttribute('data-delorder'));
        renderKitchen();
      });
    });
    el.querySelectorAll('[data-delorder-no]').forEach(function (btn) {
      btn.addEventListener('click', function () { delOrderId = null; renderKitchen(); });
    });
    el.querySelectorAll('[data-delorder-yes]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-delorder-yes'));
        delOrderId = null;
        rpc('delete_diner_order_open', { p_slug: SLUG, p_order_id: id, p_epass: empPass }).then(fetchKitchen).catch(fetchKitchen);
      });
    });
  }

  /* ---------- Receipt (visitor's own orders, printable) ---------- */
  function renderReceipt() {
    var el = $('view-receipt');
    if (needEmp(el, 'receipt')) return;
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

  /* ---------- Setup (login only: draft + Upload for approval) ---------- */
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
      '<label>Icon picture</label>' +
      '<div class="icon-field">' +
      '<img id="setup-icon-preview" class="icon-preview" src="' + esc(draft.icon || '') + '" alt=""' + (draft.icon ? '' : ' hidden') + '>' +
      '<input id="setup-icon-file" type="file" accept="image/*">' +
      '<button type="button" id="setup-icon-remove" class="small secondary">Remove icon</button>' +
      '</div>' +
      '<p class="info" id="setup-icon-out">One small picture shown next to the restaurant name. It is shrunk to 200px before uploading.</p>' +
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
        '<label>Picture</label>' +
        '<div class="pic-thumbs">' +
        (item.pic ? '<div class="pic-thumb"><img src="' + esc(item.pic) + '" alt="Menu item picture"><button class="small danger" data-pic-remove="' + i + '">Remove</button></div>' : '') +
        '</div>' +
        '<input type="file" accept="image/*" data-pic-file="' + i + '">' +
        '<p class="info" data-pic-status="' + i + '" hidden></p>' +
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
      /* Picking a picture uploads it at once and stores the URL on the
         draft item; Remove clears it. The draft is only persisted when
         the owner saves it, like every other field. */
      var picFile = row.querySelector('[data-pic-file]');
      if (picFile) picFile.addEventListener('change', function () {
        var f = picFile.files && picFile.files[0];
        if (!f) return;
        var st = row.querySelector('[data-pic-status]');
        if (st) { st.hidden = false; st.textContent = 'Uploading picture…'; }
        uploadItemPicture(f).then(function (url) {
          item.pic = url;
          drawMenu();
        }).catch(function (err) {
          if (st) { st.hidden = false; st.textContent = 'Could not upload the picture: ' + (err && err.message ? err.message : 'please try again.'); }
          picFile.value = '';
        });
      });
      var picRemove = row.querySelector('[data-pic-remove]');
      if (picRemove) picRemove.addEventListener('click', function () {
        item.pic = '';
        drawMenu();
      });
      return row;
    }
    function drawMenu() {
      menuEl.innerHTML = '';
      draft.menu.forEach(function (item, i) { menuEl.appendChild(menuRow(item, i)); });
    }
    drawMenu();
    wireIconField();
    $('setup-add').addEventListener('click', function () {
      draft.menu.push({ name: 'New item', price: 0, category: 'Menu', description: '', pic: '' });
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
        icon: draft.icon || '',
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
    $('view-menu').innerHTML = '<div class="error">This link doesn\'t point to a restaurant. Check the link and try again — ask AutoFly for your restaurant link.</div>';
  } else {
    rpc('get_diner_live', { p_slug: SLUG }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.menu = data.menu || [];
      document.title = data.name || 'Restaurant';
      var logo = $('site-logo');
      if (data.logo) { logo.src = (/^https?:\/\//.test(data.logo) ? data.logo : BASE + data.logo); logo.hidden = false; }
      $('site-name').textContent = data.name || 'Restaurant';
      renderHeaderIcon(data.icon || '');
      $('site-about').textContent = data.about || '';
      var foot = [];
      if (data.address) foot.push(esc(data.address));
      if (data.phone) foot.push(esc(data.phone));
      if (data.hours) foot.push(esc(data.hours));
      var firstLine = foot.join(' · ');
      $('site-footer').innerHTML = (firstLine ? '<div>' + firstLine + '</div>' : '') +
        '<div>Powered by AutoFly</div>';
      updateBadges();
      rpc('diner_pass_status', { p_slug: SLUG }).then(function (s) {
        empUnlocked = (s !== 'locked');
        renderMenu();
      }).catch(function () {
        /* If the status check itself is unreachable, stay open rather
           than locking everyone out of a working restaurant. */
        empUnlocked = true;
        renderMenu();
      });
    }).catch(function () {
      $('site-name').textContent = 'Restaurant not found';
      $('view-menu').innerHTML = '<div class="error">This link doesn\'t point to a restaurant yet. Check the link and try again.</div>';
    });
  }
})();
