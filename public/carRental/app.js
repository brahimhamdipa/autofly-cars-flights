/* CarRental template app — one folder per rental business.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Content lives in
   data.json; rentals live in this browser only (one key per folder).
   A rental is emailed to the business email in Setup (or to AutoFly's
   inbox when that is empty). Setup edits never change the live page by
   themselves: they download a new data.json, and the owner replaces the
   folder's file with it. No payment is taken online: the total is the
   rental price, paid at pickup. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'carRental')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var RENT_KEY = 'carrental-rentals-' + SLUG;
  var SETUP_KEY = 'folder-pass-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the database rules allow, and the
     rental email goes through AutoFly's notification service. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null;
  var rentals = loadRentals();
  var carsSearch = '';
  var carsType = 'All';
  var rentCarId = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n).toFixed(2).replace(/\.00$/, ''); }
  function dateStr(d) {
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function todayStr() { return dateStr(new Date()); }
  function tomorrowStr() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    return dateStr(d);
  }
  function daysBetween(a, b) {
    var ms = Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z');
    if (isNaN(ms)) return 0;
    return Math.round(ms / 86400000);
  }
  function loadRentals() {
    try { return JSON.parse(localStorage.getItem(RENT_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveRentals() {
    try { localStorage.setItem(RENT_KEY, JSON.stringify(rentals)); } catch (e) { /* private mode */ }
  }
  function carById(id) {
    return (data.cars || []).filter(function (c) { return String(c.id) === String(id); })[0] || null;
  }
  function isRented(carId) {
    return rentals.some(function (r) { return String(r.carId) === String(carId) && r.status === 'active'; });
  }
  function types() {
    var seen = [];
    (data.cars || []).forEach(function (c) {
      if (c.type && seen.indexOf(c.type) === -1) seen.push(c.type);
    });
    return seen;
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    ['cars', 'rent', 'rentals', 'setup'].forEach(function (t) {
      $('view-' + t).hidden = (t !== name);
    });
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.className = (b.getAttribute('data-tab') === name) ? 'active' : '';
    });
    if (name === 'cars') renderCars();
    if (name === 'rent') renderRent();
    if (name === 'rentals') renderRentals();
    if (name === 'setup') openSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var b = data.business || {};
    document.title = b.name || 'CarRental';
    $('biz-name').textContent = b.name || 'CarRental';
    $('biz-about').textContent = b.about || '';
    var parts = [];
    if (b.phone) parts.push('Phone: ' + esc(b.phone));
    if (b.email) parts.push('Email: <a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>');
    if (b.address) parts.push(esc(b.address));
    if (b.hours) parts.push(esc(b.hours));
    $('biz-meta').innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  /* ---------- cars (fleet browse) ---------- */
  function renderCars() {
    var el = $('view-cars');
    el.innerHTML = '<h2>Cars</h2>' +
      '<div class="note">A car with an active rental shows as rented out until it is returned in the My Rentals tab.</div>' +
      '<label>Search cars</label><input id="cr-search" type="text" value="' + esc(carsSearch) + '" placeholder="Name or type…">' +
      '<div class="chips" id="cr-chips"></div>' +
      '<div class="grid" id="cr-grid"></div>';
    renderCarsChips();
    renderCarsGrid();
    $('cr-search').addEventListener('input', function (e) { carsSearch = e.target.value; renderCarsGrid(); });
  }
  function renderCarsChips() {
    var cats = ['All'].concat(types());
    $('cr-chips').innerHTML = cats.map(function (c) {
      return '<button class="' + (c === carsType ? 'active' : '') + '" data-cchip="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }
  function renderCarsGrid() {
    var q = carsSearch.trim().toLowerCase();
    var list = (data.cars || []).filter(function (c) {
      if (carsType !== 'All' && c.type !== carsType) return false;
      if (q && (String(c.name).toLowerCase().indexOf(q) === -1 &&
        String(c.type || '').toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    var el = $('cr-grid');
    if (!list.length) { el.innerHTML = '<div class="card"><p>No cars match. The owner adds cars in Setup.</p></div>'; return; }
    el.innerHTML = list.map(function (c) {
      var rented = isRented(c.id);
      return '<div class="card"><span class="badge">' + esc(c.type || '') + '</span>' +
        '<h3>' + esc(c.name) + '</h3>' +
        '<p>' + esc(c.seats) + ' seats &nbsp;·&nbsp; ' + esc(c.transmission || '') + '</p>' +
        (c.description ? '<p>' + esc(c.description) + '</p>' : '') +
        '<p><span class="price">' + money(c.pricePerDay) + '</span> / day</p>' +
        '<p>' + (rented ? 'Rented out' : 'Available') + '</p>' +
        '<button data-rent="' + c.id + '"' + (rented ? ' disabled' : '') + '>Rent this car</button></div>';
    }).join('');
  }

  /* ---------- rent ---------- */
  function availableCars() {
    return (data.cars || []).filter(function (c) { return !isRented(c.id); });
  }
  function updatePreview() {
    var car = carById($('rt-car').value);
    var pickup = $('rt-pickup').value;
    var ret = $('rt-return').value;
    var out = $('rt-preview');
    if (!car || !pickup || !ret) { out.innerHTML = ''; return; }
    var days = daysBetween(pickup, ret);
    if (!(days > 0)) { out.innerHTML = '<p class="error">Return date must be after the pickup date.</p>'; return; }
    out.innerHTML = '<p><strong>Total: ' + money(days * Number(car.pricePerDay)) + '</strong> (' + days + (days === 1 ? ' day' : ' days') + ' × ' + money(car.pricePerDay) + ' / day)</p>';
  }
  function renderRent() {
    var el = $('view-rent');
    var avail = availableCars();
    var selected = rentCarId != null ? rentCarId : (avail[0] && avail[0].id);
    var opts = avail.map(function (c) {
      return '<option value="' + c.id + '"' + (String(c.id) === String(selected) ? ' selected' : '') + '>' +
        esc(c.name) + ' — ' + money(c.pricePerDay) + ' / day</option>';
    }).join('');
    el.innerHTML = '<h2>Rent</h2>' +
      '<div class="note">Pay at pickup: nothing is charged online. The total is the number of days times the daily rate.</div>' +
      (avail.length ? '' : '<div class="card"><p>Every car is rented out right now. Check back after a return in the My Rentals tab.</p></div>') +
      '<div class="card"><h3>Book a rental</h3>' +
      '<label>Car</label><select id="rt-car">' + opts + '</select>' +
      '<label>Your name</label><input id="rt-name" type="text">' +
      '<label>Phone</label><input id="rt-phone" type="tel">' +
      '<label>Email (optional)</label><input id="rt-email" type="email">' +
      '<label>Pickup date</label><input id="rt-pickup" type="date" value="' + todayStr() + '">' +
      '<label>Return date</label><input id="rt-return" type="date" value="' + tomorrowStr() + '">' +
      '<label>Note (optional)</label><input id="rt-note" type="text">' +
      '<div id="rt-preview" style="margin-top:12px"></div>' +
      '<div class="row"><button id="rt-book">Book this rental</button></div>' +
      '<div id="rt-out" style="margin-top:12px"></div></div>';
    if (avail.length) {
      $('rt-car').addEventListener('change', updatePreview);
      $('rt-pickup').addEventListener('change', updatePreview);
      $('rt-return').addEventListener('change', updatePreview);
      updatePreview();
    }
    $('rt-book').addEventListener('click', function () {
      var out = $('rt-out');
      var car = carById($('rt-car').value);
      var name = $('rt-name').value.trim();
      var phone = $('rt-phone').value.trim();
      var pickup = $('rt-pickup').value;
      var ret = $('rt-return').value;
      if (!car || isRented(car.id)) { out.innerHTML = '<p class="error">That car is no longer available. Pick another car.</p>'; return; }
      if (!name || !phone) { out.innerHTML = '<p class="error">Please enter your name and phone number.</p>'; return; }
      var days = daysBetween(pickup, ret);
      if (!(days > 0)) { out.innerHTML = '<p class="error">Return date must be after the pickup date.</p>'; return; }
      var total = days * Number(car.pricePerDay);
      var rental = { id: Date.now(), carId: car.id, carName: car.name, pricePerDay: Number(car.pricePerDay),
        pickup: pickup, return: ret, days: days, total: total, name: name, phone: phone,
        email: $('rt-email').value.trim(), note: $('rt-note').value.trim(),
        status: 'active', createdAt: new Date().toISOString() };
      rentals.unshift(rental);
      saveRentals();
      rentCarId = null;
      var ref = 'RT-' + String(rental.id).slice(-6);
      var to = (data.business && data.business.email) || '';
      out.innerHTML = '<div class="receipt"><h3>Rental confirmed</h3>' +
        '<p><strong>Reference:</strong> ' + ref + '<br>' +
        '<strong>Car:</strong> ' + esc(car.name) + ' — ' + money(car.pricePerDay) + ' / day<br>' +
        '<strong>Pickup:</strong> ' + esc(pickup) + '<br>' +
        '<strong>Return:</strong> ' + esc(ret) + ' (' + days + (days === 1 ? ' day' : ' days') + ')<br>' +
        '<strong>Total:</strong> ' + money(total) + '<br>' +
        '<strong>Name:</strong> ' + esc(name) + '<br>' +
        '<strong>Phone:</strong> ' + esc(phone) + '</p>' +
        '<p>Pay at pickup.</p>' +
        '<p class="hint">Find this rental any time in the My Rentals tab.</p>' +
        '<p id="rt-mail" class="hint">Sending the business a copy…</p></div>';
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ to: to || undefined, subject: 'Car rental: ' + ref,
          table: 'carrental_booking',
          record: { reference: ref, car: car.name, pickup: pickup, return: ret,
            days: days, total: total, name: name, phone: phone } })
      }).then(function (res) {
        if (!res.ok) throw new Error('send failed');
        var m = $('rt-mail');
        if (m) m.textContent = 'A copy was emailed to the business.';
      }).catch(function () {
        var m = $('rt-mail');
        if (m) m.textContent = 'The email copy did not go through — your rental is still saved here. ' +
          (to ? 'You can also reach the business at ' + to + '.' : 'Please tell the business about this rental.');
      });
    });
  }

  /* ---------- my rentals ---------- */
  function renderRentals() {
    var el = $('view-rentals');
    el.innerHTML = '<h2>My Rentals</h2>' +
      '<div class="note">Rentals made on this device only. Returning a car here marks it available again.</div>';
    if (!rentals.length) { el.innerHTML += '<div class="card"><p>No rentals yet.</p></div>'; return; }
    el.innerHTML += rentals.map(function (r) {
      var actions = r.status === 'active'
        ? '<div class="row"><button data-return="' + r.id + '">Return this car</button></div>' : '';
      return '<div class="card"><span class="badge">' + esc(r.status) + '</span>' +
        '<h3>' + esc(r.carName) + ' — ' + money(r.total) + '</h3>' +
        '<p>Pickup: ' + esc(r.pickup) + '<br>Return: ' + esc(r.return) +
        ' (' + r.days + (r.days === 1 ? ' day' : ' days') + ' × ' + money(r.pricePerDay) + ' / day)<br>' +
        esc(r.name) + ' &nbsp;·&nbsp; ' + esc(r.phone) + '</p>' + actions + '</div>';
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
      '<p>Setup for this business is protected. Enter the username and password set by the admin for this folder.</p>' +
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
    var carHtml = (data.cars || []).map(function (c, i) {
      return '<div class="card" data-car="' + i + '">' +
        '<label>Car name</label><input class="cr-name" value="' + esc(c.name) + '">' +
        '<label>Type</label><input class="cr-type" value="' + esc(c.type || '') + '">' +
        '<label>Seats</label><input class="cr-seats" type="number" min="1" step="1" value="' + esc(c.seats) + '">' +
        '<label>Transmission</label><select class="cr-trans"><option' + (c.transmission === 'Automatic' ? ' selected' : '') + '>Automatic</option><option' + (c.transmission === 'Manual' ? ' selected' : '') + '>Manual</option><option' + ((c.transmission !== 'Automatic' && c.transmission !== 'Manual') ? ' selected' : '') + '>Other</option></select>' +
        '<label>Price per day ($)</label><input class="cr-price" type="number" min="0" step="0.01" value="' + esc(c.pricePerDay) + '">' +
        '<label>Description</label><input class="cr-desc" value="' + esc(c.description || '') + '">' +
        '<div class="row"><button class="danger cr-del">Delete car</button></div></div>';
    }).join('');
    el.innerHTML = '<h2>Setup</h2>' +
      '<div class="note">Edit the business here, then press “Download data.json”. ' +
      'To put the changes live, replace the <strong>data.json</strong> file inside this folder with the downloaded file, then reload the page. ' +
      'Nothing on this tab changes the live page by itself — and that is on purpose, so visitors cannot change your cars.</div>' +
      '<div class="card"><h3>Business details</h3>' +
      field('Business name', 'st-name', b.name) +
      field('About', 'st-about', b.about) +
      field('Phone', 'st-phone', b.phone, 'tel') +
      field('Email (rental copies go here; empty = Yently inbox)', 'st-email', b.email, 'email') +
      field('Address', 'st-address', b.address) +
      field('Hours', 'st-hours', b.hours) + '</div>' +
      '<h3>Cars</h3>' + carHtml +
      '<div class="card"><h3>Add a car</h3>' +
      '<label>Car name</label><input id="cr-new-name">' +
      '<label>Type</label><input id="cr-new-type">' +
      '<label>Seats</label><input id="cr-new-seats" type="number" min="1" step="1">' +
      '<label>Transmission</label><select id="cr-new-trans"><option>Automatic</option><option>Manual</option><option>Other</option></select>' +
      '<label>Price per day ($)</label><input id="cr-new-price" type="number" min="0" step="0.01">' +
      '<label>Description</label><input id="cr-new-desc">' +
      '<div class="row"><button id="cr-add">Add car</button></div></div>' +
      '<div class="row"><button id="setup-download">Download data.json</button></div>';
    Array.prototype.forEach.call(el.querySelectorAll('.cr-del'), function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('[data-car]');
        data.cars.splice(Number(card.getAttribute('data-car')), 1);
        renderSetup();
      });
    });
    $('cr-add').addEventListener('click', function () {
      var name = $('cr-new-name').value.trim();
      var price = parseFloat($('cr-new-price').value);
      if (!name || isNaN(price)) return;
      var maxId = (data.cars || []).reduce(function (m, c) { return Math.max(m, c.id || 0); }, 0);
      var seats = parseInt($('cr-new-seats').value, 10);
      data.cars.push({ id: maxId + 1, name: name, type: $('cr-new-type').value.trim(),
        seats: isNaN(seats) ? 5 : seats, transmission: $('cr-new-trans').value,
        pricePerDay: price, description: $('cr-new-desc').value.trim() });
      renderSetup();
    });
    $('setup-download').addEventListener('click', function () {
      var next = { business: { name: $('st-name').value.trim(), about: $('st-about').value.trim(),
          phone: $('st-phone').value.trim(), email: $('st-email').value.trim(),
          address: $('st-address').value.trim(), hours: $('st-hours').value.trim() },
        cars: [] };
      Array.prototype.forEach.call(el.querySelectorAll('[data-car]'), function (card, i) {
        next.cars.push({ id: (data.cars[i] && data.cars[i].id) || (i + 1),
          name: card.querySelector('.cr-name').value.trim(),
          type: card.querySelector('.cr-type').value.trim(),
          seats: parseInt(card.querySelector('.cr-seats').value, 10) || 5,
          transmission: card.querySelector('.cr-trans').value,
          pricePerDay: parseFloat(card.querySelector('.cr-price').value) || 0,
          description: card.querySelector('.cr-desc').value.trim() });
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
    showTab('cars');
  });
  $('view-cars').addEventListener('click', function (e) {
    var chip = e.target.getAttribute && e.target.getAttribute('data-cchip');
    var rent = e.target.getAttribute && e.target.getAttribute('data-rent');
    if (chip) {
      carsType = chip;
      renderCarsChips(); renderCarsGrid();
    } else if (rent) {
      rentCarId = Number(rent);
      showTab('rent');
    }
  });
  $('view-rentals').addEventListener('click', function (e) {
    var ret = e.target.getAttribute && e.target.getAttribute('data-return');
    if (ret) {
      var r = rentals.filter(function (x) { return String(x.id) === ret; })[0];
      if (r) r.status = 'returned';
      saveRentals();
      renderRentals();
    }
  });
  fetch(BASE + 'data.json')
    .then(function (res) { if (!res.ok) throw new Error('data.json not found'); return res.json(); })
    .then(function (json) {
      data = json;
      data.business = data.business || {};
      data.cars = data.cars || [];
      renderHeader();
      showTab('cars');
    })
    .catch(function () {
      $('view-cars').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one (see the README in this folder) and reload the page.</div>';
    });
})();
