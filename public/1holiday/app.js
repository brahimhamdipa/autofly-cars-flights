/* Holiday template app — one folder per holiday rental business.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Content lives in
   data.json; bookings live in this browser only (one key per folder).
   A booking is emailed to the business email in Setup (or to AutoFly's
   inbox when that is empty). Setup edits never change the live page by
   themselves: they download a new data.json, and the owner replaces the
   folder's file with it. This page books stays only — no payment is taken
   online, and no bank or card details are ever asked for or stored. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'holiday')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var BOOK_KEY = 'holiday-bookings-' + SLUG;
  var SETUP_KEY = 'folder-pass-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the database rules allow, and the
     booking email goes through AutoFly's notification service. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null;
  var bookings = loadBookings();
  var bookPropertyId = null;

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
  function addDays(dateStr, n) {
    var parts = dateStr.split('-');
    var d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    d.setUTCDate(d.getUTCDate() + n);
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }
  function loadBookings() {
    try { return JSON.parse(localStorage.getItem(BOOK_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveBookings() {
    try { localStorage.setItem(BOOK_KEY, JSON.stringify(bookings)); } catch (e) { /* private mode */ }
  }
  function propertyById(id) {
    return (data.properties || []).filter(function (p) { return String(p.id) === String(id); })[0] || null;
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    ['properties', 'book', 'bookings', 'setup'].forEach(function (t) {
      $('view-' + t).hidden = (t !== name);
    });
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.className = (b.getAttribute('data-tab') === name) ? 'active' : '';
    });
    if (name === 'properties') renderProperties();
    if (name === 'book') renderBook();
    if (name === 'bookings') renderBookings();
    if (name === 'setup') openSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var b = data.business || {};
    document.title = b.name || 'Holiday';
    $('biz-name').textContent = b.name || 'Holiday';
    $('biz-about').textContent = b.about || '';
    var parts = [];
    if (b.phone) parts.push('Phone: ' + esc(b.phone));
    if (b.email) parts.push('Email: <a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>');
    if (b.address) parts.push(esc(b.address));
    if (b.hours) parts.push(esc(b.hours));
    $('biz-meta').innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  /* ---------- properties ---------- */
  function renderProperties() {
    var el = $('view-properties');
    var list = data.properties || [];
    if (!list.length) { el.innerHTML = '<div class="card"><p>No properties listed yet. The owner adds them in Setup.</p></div>'; return; }
    el.innerHTML = '<h2>Properties</h2>' + list.map(function (p) {
      var peak = (p.peakPrice != null && p.peakPrice !== '') ? ' &nbsp;·&nbsp; peak ' + money(p.peakPrice) + ' / night' : '';
      return '<div class="card"><span class="badge">' + esc(p.location || '') + '</span>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p>' + esc(p.description || '') + '</p>' +
        '<p>Ref: ' + esc(p.reference || '') + ' &nbsp;·&nbsp; ' + esc(p.rooms) + (p.rooms === 1 ? ' room' : ' rooms') + '</p>' +
        '<p><span class="price">' + money(p.price) + ' / night</span>' + peak + '</p>' +
        '<button data-book="' + p.id + '">Book this property</button></div>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('[data-book]'), function (btn) {
      btn.addEventListener('click', function () {
        bookPropertyId = btn.getAttribute('data-book');
        showTab('book');
      });
    });
  }

  /* ---------- book ---------- */
  function renderBook() {
    var el = $('view-book');
    var opts = (data.properties || []).map(function (p) {
      return '<option value="' + p.id + '"' + (String(bookPropertyId) === String(p.id) ? ' selected' : '') + '>' +
        esc(p.name) + ' — ' + esc(p.location || '') + ' — ' + money(p.price) + ' / night</option>';
    }).join('');
    el.innerHTML = '<h2>Book your stay</h2><div class="card">' +
      '<div class="note">Pay at the property. Booking here reserves your stay — no payment is taken online. The standard nightly rate applies; the peak rate shown on the property is for high season.</div>' +
      '<label>Property</label><select id="bk-property">' + opts + '</select>' +
      '<label>Your name</label><input id="bk-name" type="text">' +
      '<label>Your phone</label><input id="bk-phone" type="tel">' +
      '<label>Your email (optional)</label><input id="bk-email" type="email">' +
      '<label>Arrival date</label><input id="bk-arrival" type="date" value="' + todayStr() + '">' +
      '<label>Nights</label><input id="bk-nights" type="number" min="1" step="1" value="2">' +
      '<label>Guests</label><input id="bk-guests" type="number" min="1" step="1" value="2">' +
      '<label>Note (optional)</label><textarea id="bk-note" rows="3"></textarea>' +
      '<div class="row"><button id="bk-submit">Confirm booking</button></div>' +
      '<div id="bk-out" style="margin-top:12px"></div></div>';
    $('bk-submit').addEventListener('click', function () {
      var property = propertyById($('bk-property').value);
      var name = $('bk-name').value.trim();
      var phone = $('bk-phone').value.trim();
      var email = $('bk-email').value.trim();
      var arrival = $('bk-arrival').value;
      var nights = parseInt($('bk-nights').value, 10);
      var guests = parseInt($('bk-guests').value, 10);
      var note = $('bk-note').value.trim();
      var out = $('bk-out');
      if (!property || !name || !phone || !arrival || isNaN(nights) || nights < 1 || isNaN(guests) || guests < 1) {
        out.innerHTML = '<p class="error">Please pick a property and fill in your name, phone, arrival date, nights, and guests.</p>';
        return;
      }
      var departure = addDays(arrival, nights);
      var total = nights * Number(property.price);
      var bk = { id: Date.now(), propertyId: property.id, propertyName: property.name,
        location: property.location, price: property.price, reference: property.reference,
        name: name, phone: phone, email: email, arrival: arrival, departure: departure,
        nights: nights, guests: guests, total: total, note: note,
        status: 'upcoming', createdAt: new Date().toISOString() };
      bookings.unshift(bk);
      saveBookings();
      var ref = 'HO-' + String(bk.id).slice(-6);
      var to = (data.business && data.business.email) || '';
      out.innerHTML = '<div class="receipt"><h3>Booking confirmed</h3>' +
        '<p><strong>Reference:</strong> ' + ref + '<br>' +
        '<strong>Property:</strong> ' + esc(property.name) + ' (' + esc(property.reference || '') + ') — ' + money(property.price) + ' / night<br>' +
        '<strong>Stay:</strong> ' + esc(arrival) + ' to ' + esc(departure) + ' (' + esc(nights) + ' nights, ' + esc(guests) + ' guests)<br>' +
        '<strong>Total:</strong> ' + money(total) + '<br>' +
        '<strong>Name:</strong> ' + esc(name) + '<br>' +
        '<strong>Phone:</strong> ' + esc(phone) + '</p>' +
        '<p class="hint">Pay at the property. Find this booking any time in the Bookings tab.</p>' +
        '<p id="bk-mail" class="hint">Sending the business a copy…</p></div>';
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ to: to || undefined, subject: 'Holiday booking: ' + property.name,
          table: 'holiday_booking',
          record: { reference: ref, property: property.name, location: property.location,
            price: property.price, arrival: arrival, departure: departure,
            nights: nights, guests: guests, total: total,
            name: name, phone: phone, email: email, note: note } })
      }).then(function (res) {
        if (!res.ok) throw new Error('send failed');
        var m = $('bk-mail');
        if (m) m.textContent = 'A copy was emailed to the business.';
      }).catch(function () {
        var m = $('bk-mail');
        if (m) m.textContent = 'The email copy did not go through — your booking is still saved here. ' +
          (to ? 'You can also reach the business at ' + to + '.' : 'Please call the business to confirm.');
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
        '<h3>' + esc(bk.propertyName) + ' — ' + money(bk.total) + '</h3>' +
        '<p>' + esc(bk.arrival) + ' to ' + esc(bk.departure) + ' (' + esc(bk.nights) + ' nights, ' + esc(bk.guests) + ' guests)' +
        ' &nbsp;·&nbsp; ' + esc(bk.name) + ' (' + esc(bk.phone) + ')' +
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
      '<p>Setup for this rental business is protected. Enter the username and password set by the admin for this folder.</p>' +
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
    var propHtml = (data.properties || []).map(function (p, i) {
      return '<div class="card" data-prop="' + i + '">' +
        '<label>Property name</label><input class="pr-name" value="' + esc(p.name) + '">' +
        '<label>Reference</label><input class="pr-ref" value="' + esc(p.reference || '') + '">' +
        '<label>Location</label><input class="pr-loc" value="' + esc(p.location || '') + '">' +
        '<label>Description</label><textarea class="pr-desc" rows="2">' + esc(p.description || '') + '</textarea>' +
        '<label>Rooms</label><input class="pr-rooms" type="number" min="1" step="1" value="' + esc(p.rooms) + '">' +
        '<label>Nightly rate ($)</label><input class="pr-price" type="number" min="0" step="0.01" value="' + esc(p.price) + '">' +
        '<label>Peak nightly rate ($, optional)</label><input class="pr-peak" type="number" min="0" step="0.01" value="' + esc(p.peakPrice == null ? '' : p.peakPrice) + '">' +
        '<div class="row"><button class="danger pr-del">Delete property</button></div></div>';
    }).join('');
    el.innerHTML = '<h2>Setup</h2>' +
      '<div class="note">Edit the business here, then press “Download data.json”. ' +
      'To put the changes live, replace the <strong>data.json</strong> file inside this folder with the downloaded file, then reload the page. ' +
      'Nothing on this tab changes the live page by itself — and that is on purpose, so visitors cannot change your properties.</div>' +
      '<div class="card"><h3>Business details</h3>' +
      field('Business name', 'st-name', b.name) +
      field('About', 'st-about', b.about) +
      field('Phone', 'st-phone', b.phone, 'tel') +
      field('Email (booking copies go here; empty = Yently inbox)', 'st-email', b.email, 'email') +
      field('Address', 'st-address', b.address) +
      field('Hours', 'st-hours', b.hours) + '</div>' +
      '<h3>Properties</h3>' + propHtml +
      '<div class="card"><h3>Add a property</h3>' +
      '<label>Property name</label><input id="pr-new-name">' +
      '<label>Reference</label><input id="pr-new-ref">' +
      '<label>Location</label><input id="pr-new-loc">' +
      '<label>Description</label><textarea id="pr-new-desc" rows="2"></textarea>' +
      '<label>Rooms</label><input id="pr-new-rooms" type="number" min="1" step="1">' +
      '<label>Nightly rate ($)</label><input id="pr-new-price" type="number" min="0" step="0.01">' +
      '<label>Peak nightly rate ($, optional)</label><input id="pr-new-peak" type="number" min="0" step="0.01">' +
      '<div class="row"><button id="pr-add">Add property</button></div></div>' +
      '<div class="row"><button id="setup-download">Download data.json</button></div>';
    Array.prototype.forEach.call(el.querySelectorAll('.pr-del'), function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('[data-prop]');
        data.properties.splice(Number(card.getAttribute('data-prop')), 1);
        renderSetup();
      });
    });
    $('pr-add').addEventListener('click', function () {
      var name = $('pr-new-name').value.trim();
      var price = parseFloat($('pr-new-price').value);
      var rooms = parseInt($('pr-new-rooms').value, 10);
      if (!name || isNaN(price)) return;
      var maxId = (data.properties || []).reduce(function (m, p) { return Math.max(m, p.id || 0); }, 0);
      var peak = parseFloat($('pr-new-peak').value);
      data.properties.push({ id: maxId + 1, name: name, reference: $('pr-new-ref').value.trim(),
        location: $('pr-new-loc').value.trim(), description: $('pr-new-desc').value.trim(),
        rooms: isNaN(rooms) ? 1 : rooms, price: price, peakPrice: isNaN(peak) ? null : peak });
      renderSetup();
    });
    $('setup-download').addEventListener('click', function () {
      var next = { business: { name: $('st-name').value.trim(), about: $('st-about').value.trim(),
          phone: $('st-phone').value.trim(), email: $('st-email').value.trim(),
          address: $('st-address').value.trim(), hours: $('st-hours').value.trim() }, properties: [] };
      Array.prototype.forEach.call(el.querySelectorAll('[data-prop]'), function (card, i) {
        var peak = parseFloat(card.querySelector('.pr-peak').value);
        next.properties.push({ id: (data.properties[i] && data.properties[i].id) || (i + 1),
          name: card.querySelector('.pr-name').value.trim(),
          reference: card.querySelector('.pr-ref').value.trim(),
          location: card.querySelector('.pr-loc').value.trim(),
          description: card.querySelector('.pr-desc').value.trim(),
          rooms: parseInt(card.querySelector('.pr-rooms').value, 10) || 1,
          price: parseFloat(card.querySelector('.pr-price').value) || 0,
          peakPrice: isNaN(peak) ? null : peak });
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
    showTab('properties');
  });
  fetch(BASE + 'data.json')
    .then(function (res) { if (!res.ok) throw new Error('data.json not found'); return res.json(); })
    .then(function (json) {
      data = json;
      data.business = data.business || {};
      data.properties = data.properties || [];
      renderHeader();
      showTab('properties');
    })
    .catch(function () {
      $('view-properties').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one (see the README in this folder) and reload the page.</div>';
    });
})();
