/* Barbershop template app — one folder per shop.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Content lives in
   data.json; bookings live in this browser only (one key per folder).
   A booking is emailed to the shop's email in Setup (or to AutoFly's inbox
   when that is empty). Setup edits never change the live page by
   themselves: they download a new data.json, and the owner replaces the
   folder's file with it. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'barbershop')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var BOOK_KEY = 'barbershop-bookings-' + SLUG;
  var SETUP_KEY = 'folder-pass-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the database rules allow, and the
     booking email goes through AutoFly's notification service. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var CATEGORIES = ['Women', 'Men & Boys', 'Styling', 'Other'];

  var data = null;
  var bookings = loadBookings();
  var bookServiceId = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n).toFixed(2).replace(/\.00$/, ''); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function loadBookings() {
    try { return JSON.parse(localStorage.getItem(BOOK_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveBookings() {
    try { localStorage.setItem(BOOK_KEY, JSON.stringify(bookings)); } catch (e) { /* private mode */ }
  }
  function serviceById(id) {
    return (data.services || []).filter(function (s) { return String(s.id) === String(id); })[0] || null;
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    ['services', 'book', 'bookings', 'setup'].forEach(function (t) {
      $('view-' + t).hidden = (t !== name);
    });
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.className = (b.getAttribute('data-tab') === name) ? 'active' : '';
    });
    if (name === 'services') renderServices();
    if (name === 'book') renderBook();
    if (name === 'bookings') renderBookings();
    if (name === 'setup') openSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var b = data.business || {};
    document.title = b.name || 'Barbershop';
    $('biz-name').textContent = b.name || 'Barbershop';
    $('biz-about').textContent = b.about || '';
    var parts = [];
    if (b.phone) parts.push('Phone: ' + esc(b.phone));
    if (b.email) parts.push('Email: <a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>');
    if (b.address) parts.push(esc(b.address));
    if (b.hours) parts.push(esc(b.hours));
    $('biz-meta').innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  /* ---------- services ---------- */
  function renderServices() {
    var el = $('view-services');
    var list = data.services || [];
    if (!list.length) { el.innerHTML = '<div class="card"><p>No services listed yet. The owner adds them in Setup.</p></div>'; return; }
    el.innerHTML = '<h2>Services</h2>' + list.map(function (s) {
      return '<div class="card"><span class="badge">' + esc(s.category || 'Other') + '</span>' +
        '<h3>' + esc(s.name) + '</h3>' +
        '<p>' + esc(s.description || '') + '</p>' +
        '<p><span class="price">' + money(s.price) + '</span> &nbsp;·&nbsp; about ' + esc(s.duration) + ' min</p>' +
        '<button data-book="' + s.id + '">Book this</button></div>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('[data-book]'), function (btn) {
      btn.addEventListener('click', function () {
        bookServiceId = btn.getAttribute('data-book');
        showTab('book');
      });
    });
  }

  /* ---------- book ---------- */
  function renderBook() {
    var el = $('view-book');
    var opts = (data.services || []).map(function (s) {
      return '<option value="' + s.id + '"' + (String(bookServiceId) === String(s.id) ? ' selected' : '') + '>' +
        esc(s.name) + ' — ' + money(s.price) + '</option>';
    }).join('');
    el.innerHTML = '<h2>Book an appointment</h2><div class="card">' +
      '<div class="note">Pay at the shop. Booking here reserves your chair — no payment is taken online.</div>' +
      '<label>Service</label><select id="bk-service">' + opts + '</select>' +
      '<label>Your name</label><input id="bk-name" type="text">' +
      '<label>Your phone</label><input id="bk-phone" type="tel">' +
      '<label>Your email (optional)</label><input id="bk-email" type="email">' +
      '<label>Date</label><input id="bk-date" type="date" value="' + todayStr() + '">' +
      '<label>Time</label><input id="bk-time" type="time" value="10:00">' +
      '<label>Note (optional)</label><textarea id="bk-note" rows="3"></textarea>' +
      '<div class="row"><button id="bk-submit">Confirm booking</button></div>' +
      '<div id="bk-out" style="margin-top:12px"></div></div>';
    $('bk-submit').addEventListener('click', function () {
      var service = serviceById($('bk-service').value);
      var name = $('bk-name').value.trim();
      var phone = $('bk-phone').value.trim();
      var email = $('bk-email').value.trim();
      var date = $('bk-date').value;
      var time = $('bk-time').value;
      var note = $('bk-note').value.trim();
      var out = $('bk-out');
      if (!service || !name || !phone || !date || !time) {
        out.innerHTML = '<p class="error">Please pick a service and fill in your name, phone, date, and time.</p>';
        return;
      }
      var bk = { id: Date.now(), serviceId: service.id, serviceName: service.name,
        price: service.price, duration: service.duration, name: name, phone: phone,
        email: email, date: date, time: time, note: note, status: 'upcoming',
        createdAt: new Date().toISOString() };
      bookings.unshift(bk);
      saveBookings();
      var ref = 'BK-' + String(bk.id).slice(-6);
      var to = (data.business && data.business.email) || '';
      out.innerHTML = '<div class="receipt"><h3>Booking confirmed</h3>' +
        '<p><strong>Reference:</strong> ' + ref + '<br>' +
        '<strong>Service:</strong> ' + esc(service.name) + ' — ' + money(service.price) + ' (about ' + esc(service.duration) + ' min)<br>' +
        '<strong>When:</strong> ' + esc(date) + ' at ' + esc(time) + '<br>' +
        '<strong>Name:</strong> ' + esc(name) + '<br>' +
        '<strong>Phone:</strong> ' + esc(phone) + '</p>' +
        '<p class="hint">Pay at the shop. Find this booking any time in the Bookings tab.</p>' +
        '<p id="bk-mail" class="hint">Sending the shop a copy…</p></div>';
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ to: to || undefined, subject: 'Barbershop booking: ' + service.name,
          table: 'barbershop_booking',
          record: { reference: ref, service: service.name, price: service.price, date: date, time: time,
            name: name, phone: phone, email: email, note: note } })
      }).then(function (res) {
        if (!res.ok) throw new Error('send failed');
        var m = $('bk-mail');
        if (m) m.textContent = 'A copy was emailed to the shop.';
      }).catch(function () {
        var m = $('bk-mail');
        if (m) m.textContent = 'The email copy did not go through — your booking is still saved here. ' +
          (to ? 'You can also reach the shop at ' + to + '.' : 'Please call the shop to confirm.');
      });
    });
  }

  /* ---------- bookings (this device) ---------- */
  function renderBookings() {
    var el = $('view-bookings');
    el.innerHTML = '<h2>Bookings</h2>' +
      '<div class="note">Bookings made on this device only. A booking made on another phone does not appear here.</div>';
    if (!bookings.length) { el.innerHTML += '<div class="card"><p>No bookings yet.</p></div>'; return; }
    el.innerHTML += bookings.map(function (bk) {
      var actions = bk.status === 'upcoming'
        ? '<div class="row"><button class="secondary" data-done="' + bk.id + '">Mark done</button>' +
          '<button class="danger" data-cancel="' + bk.id + '">Cancel</button></div>' : '';
      return '<div class="card"><span class="badge">' + esc(bk.status) + '</span>' +
        '<h3>' + esc(bk.serviceName) + ' — ' + money(bk.price) + '</h3>' +
        '<p>' + esc(bk.date) + ' at ' + esc(bk.time) + ' &nbsp;·&nbsp; ' + esc(bk.name) + ' (' + esc(bk.phone) + ')' +
        (bk.note ? '<br>Note: ' + esc(bk.note) : '') + '</p>' + actions + '</div>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('[data-done]'), function (btn) {
      btn.addEventListener('click', function () {
        var bk = bookings.filter(function (b) { return String(b.id) === btn.getAttribute('data-done'); })[0];
        if (bk) bk.status = 'done';
        saveBookings(); renderBookings();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-cancel]'), function (btn) {
      btn.addEventListener('click', function () {
        bookings = bookings.filter(function (b) { return String(b.id) !== btn.getAttribute('data-cancel'); });
        saveBookings(); renderBookings();
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
    var catOpts = function (sel) {
      return CATEGORIES.map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === sel ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('');
    };
    var svcHtml = (data.services || []).map(function (s, i) {
      return '<div class="card" data-svc="' + i + '">' +
        '<label>Service name</label><input class="sv-name" value="' + esc(s.name) + '">' +
        '<label>Category</label><select class="sv-cat">' + catOpts(s.category || 'Other') + '</select>' +
        '<label>Description</label><textarea class="sv-desc" rows="2">' + esc(s.description || '') + '</textarea>' +
        '<label>Price ($)</label><input class="sv-price" type="number" min="0" step="0.01" value="' + esc(s.price) + '">' +
        '<label>Duration (minutes)</label><input class="sv-dur" type="number" min="1" step="1" value="' + esc(s.duration) + '">' +
        '<div class="row"><button class="danger sv-del">Delete service</button></div></div>';
    }).join('');
    el.innerHTML = '<h2>Setup</h2>' +
      '<div class="note">Edit the shop here, then press “Download data.json”. ' +
      'To put the changes live, replace the <strong>data.json</strong> file inside this folder with the downloaded file, then reload the page. ' +
      'Nothing on this tab changes the live page by itself — and that is on purpose, so visitors cannot change your services.</div>' +
      '<div class="card"><h3>Shop details</h3>' +
      field('Shop name', 'st-name', b.name) +
      field('About', 'st-about', b.about) +
      field('Phone', 'st-phone', b.phone, 'tel') +
      field('Email (booking copies go here; empty = Yently inbox)', 'st-email', b.email, 'email') +
      field('Address', 'st-address', b.address) +
      field('Hours', 'st-hours', b.hours) + '</div>' +
      '<h3>Services</h3>' + svcHtml +
      '<div class="card"><h3>Add a service</h3>' +
      '<label>Service name</label><input id="sv-new-name">' +
      '<label>Category</label><select id="sv-new-cat">' + catOpts('Other') + '</select>' +
      '<label>Description</label><textarea id="sv-new-desc" rows="2"></textarea>' +
      '<label>Price ($)</label><input id="sv-new-price" type="number" min="0" step="0.01">' +
      '<label>Duration (minutes)</label><input id="sv-new-dur" type="number" min="1" step="1">' +
      '<div class="row"><button id="sv-add">Add service</button></div></div>' +
      '<div class="row"><button id="setup-download">Download data.json</button></div>';
    Array.prototype.forEach.call(el.querySelectorAll('.sv-del'), function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('[data-svc]');
        data.services.splice(Number(card.getAttribute('data-svc')), 1);
        renderSetup();
      });
    });
    $('sv-add').addEventListener('click', function () {
      var name = $('sv-new-name').value.trim();
      var price = parseFloat($('sv-new-price').value);
      var dur = parseInt($('sv-new-dur').value, 10);
      if (!name || isNaN(price)) return;
      var maxId = (data.services || []).reduce(function (m, s) { return Math.max(m, s.id || 0); }, 0);
      data.services.push({ id: maxId + 1, name: name, category: $('sv-new-cat').value,
        description: $('sv-new-desc').value.trim(), price: price, duration: isNaN(dur) ? 30 : dur });
      renderSetup();
    });
    $('setup-download').addEventListener('click', function () {
      var next = { business: { name: $('st-name').value.trim(), about: $('st-about').value.trim(),
          phone: $('st-phone').value.trim(), email: $('st-email').value.trim(),
          address: $('st-address').value.trim(), hours: $('st-hours').value.trim() }, services: [] };
      Array.prototype.forEach.call(el.querySelectorAll('[data-svc]'), function (card, i) {
        next.services.push({ id: (data.services[i] && data.services[i].id) || (i + 1),
          name: card.querySelector('.sv-name').value.trim(),
          category: card.querySelector('.sv-cat').value,
          description: card.querySelector('.sv-desc').value.trim(),
          price: parseFloat(card.querySelector('.sv-price').value) || 0,
          duration: parseInt(card.querySelector('.sv-dur').value, 10) || 30 });
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
    showTab('services');
  });
  fetch(BASE + 'data.json')
    .then(function (res) { if (!res.ok) throw new Error('data.json not found'); return res.json(); })
    .then(function (json) {
      data = json;
      data.business = data.business || {};
      data.services = data.services || [];
      renderHeader();
      showTab('services');
    })
    .catch(function () {
      $('view-services').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one (see the README in this folder) and reload the page.</div>';
    });
})();
