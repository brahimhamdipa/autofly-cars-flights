/* CarRentalSystem template app — one folder per rental business.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Content lives in
   data.json; rentals live in this browser only (one key per folder).
   Starting a rental and returning a car are both emailed to the business
   email in Setup (or to AutoFly's inbox when that is empty). Setup edits
   never change the live page by themselves: they download a new
   data.json, and the owner replaces the folder's file with it. No payment
   is taken online: the bill is paid when the car comes back. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'carRentalSystem')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var RENT_KEY = 'carrentalsystem-rentals-' + SLUG;
  var SETUP_KEY = 'folder-pass-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the database rules allow, and the
     rental emails go through AutoFly's notification service. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null;
  var rentals = loadRentals();
  var carsSearch = '';
  var rentCarId = null;
  var DAMAGE_FINE = 50;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n).toFixed(2).replace(/\.00$/, ''); }
  function fmtDT(iso) {
    var d = new Date(iso);
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function hms(totalSeconds) {
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;
    var p = function (n) { return ('0' + n).slice(-2); };
    return h + ':' + p(m) + ':' + p(s);
  }
  function loadRentals() {
    try { return JSON.parse(localStorage.getItem(RENT_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveRentals() {
    try { localStorage.setItem(RENT_KEY, JSON.stringify(rentals)); } catch (e) { /* private mode */ }
  }
  function carById(id) {
    return (data.fleet || []).filter(function (c) { return String(c.id) === String(id); })[0] || null;
  }
  function isRented(carId) {
    return rentals.some(function (r) { return String(r.carId) === String(carId) && r.status === 'active'; });
  }
  /* Bill, counted by the whole hour: the first 24 hours at the car's hourly
     rate, extra hours at double the rate, plus a flat damage fine when the
     car comes back damaged. */
  function billFor(rental, nowMs, damaged) {
    var seconds = Math.max(0, Math.floor((nowMs - Date.parse(rental.start)) / 1000));
    var hours = Math.floor(seconds / 3600);
    var baseHours = Math.min(hours, 24);
    var lateHours = Math.max(0, hours - 24);
    var rate = Number(rental.ratePerHour) || 0;
    var baseAmt = baseHours * rate;
    var lateAmt = lateHours * rate * 2;
    var damageAmt = damaged ? DAMAGE_FINE : 0;
    return { seconds: seconds, hours: hours, baseHours: baseHours, lateHours: lateHours,
      baseAmt: baseAmt, lateAmt: lateAmt, damageAmt: damageAmt, total: baseAmt + lateAmt + damageAmt };
  }
  function notify(subject, table, record, mailElId) {
    var to = (data.business && data.business.email) || '';
    fetch(SUPABASE_URL + '/functions/v1/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify({ to: to || undefined, subject: subject, table: table, record: record })
    }).then(function (res) {
      if (!res.ok) throw new Error('send failed');
      var m = $(mailElId);
      if (m) m.textContent = 'A copy was emailed to the business.';
    }).catch(function () {
      var m = $(mailElId);
      if (m) m.textContent = 'The email copy did not go through — the record is still saved here. ' +
        (to ? 'You can also reach the business at ' + to + '.' : 'Please tell the business about this rental.');
    });
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    ['cars', 'rent', 'returns', 'setup'].forEach(function (t) {
      $('view-' + t).hidden = (t !== name);
    });
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.className = (b.getAttribute('data-tab') === name) ? 'active' : '';
    });
    if (name === 'cars') renderCars();
    if (name === 'rent') renderRent();
    if (name === 'returns') renderReturns();
    if (name === 'setup') openSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var b = data.business || {};
    document.title = b.name || 'CarRentalSystem';
    $('biz-name').textContent = b.name || 'CarRentalSystem';
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
      '<div class="note">Each car is listed by its plate number. A car with an active rental shows as rented out until it is returned.</div>' +
      '<label>Search cars</label><input id="cs-search" type="text" value="' + esc(carsSearch) + '" placeholder="Name or plate…">' +
      '<div class="grid" id="cs-grid"></div>';
    renderCarsGrid();
    $('cs-search').addEventListener('input', function (e) { carsSearch = e.target.value; renderCarsGrid(); });
  }
  function renderCarsGrid() {
    var q = carsSearch.trim().toLowerCase();
    var list = (data.fleet || []).filter(function (c) {
      if (q && (String(c.name).toLowerCase().indexOf(q) === -1 &&
        String(c.plate || '').toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    var el = $('cs-grid');
    if (!list.length) { el.innerHTML = '<div class="card"><p>No cars match. The owner adds cars in Setup.</p></div>'; return; }
    el.innerHTML = list.map(function (c) {
      var rented = isRented(c.id);
      return '<div class="card"><span class="badge">' + esc(c.plate || '') + '</span>' +
        '<h3>' + esc(c.name) + '</h3>' +
        (c.description ? '<p>' + esc(c.description) + '</p>' : '') +
        '<p><span class="price">' + money(c.ratePerHour) + '</span> / hour</p>' +
        '<p>' + (rented ? 'Rented out' : 'Available') + '</p>' +
        '<button data-rent="' + c.id + '"' + (rented ? ' disabled' : '') + '>Rent now</button></div>';
    }).join('');
  }

  /* ---------- rent ---------- */
  function renderRent() {
    var el = $('view-rent');
    var avail = (data.fleet || []).filter(function (c) { return !isRented(c.id); });
    var selected = rentCarId != null ? rentCarId : (avail[0] && avail[0].id);
    var opts = avail.map(function (c) {
      return '<option value="' + c.id + '"' + (String(c.id) === String(selected) ? ' selected' : '') + '>' +
        esc(c.name) + ' (' + esc(c.plate) + ') — ' + money(c.ratePerHour) + ' / hour</option>';
    }).join('');
    el.innerHTML = '<h2>Rent</h2>' +
      '<div class="note">Renting starts right now: the clock runs from the moment you tap Rent, and the bill is counted when the car comes back.</div>' +
      (avail.length ? '' : '<div class="card"><p>Every car is rented out right now. Check back after a return in the Returns tab.</p></div>') +
      '<div class="card"><h3>Rent a car now</h3>' +
      '<label>Car</label><select id="rn-car">' + opts + '</select>' +
      '<label>Your name</label><input id="rn-name" type="text">' +
      '<label>Phone</label><input id="rn-phone" type="tel">' +
      '<div class="row"><button id="rn-go">Rent this car</button></div>' +
      '<div id="rn-out" style="margin-top:12px"></div></div>';
    $('rn-go').addEventListener('click', function () {
      var out = $('rn-out');
      var car = carById($('rn-car').value);
      var name = $('rn-name').value.trim();
      var phone = $('rn-phone').value.trim();
      if (!car || isRented(car.id)) { out.innerHTML = '<p class="error">That car is no longer available. Pick another car.</p>'; return; }
      if (!name || !phone) { out.innerHTML = '<p class="error">Please enter your name and phone number.</p>'; return; }
      var rental = { id: Date.now(), carId: car.id, carName: car.name, plate: car.plate,
        ratePerHour: Number(car.ratePerHour), start: new Date().toISOString(),
        name: name, phone: phone, status: 'active' };
      rentals.unshift(rental);
      saveRentals();
      rentCarId = null;
      var ref = 'CR-' + String(rental.id).slice(-6);
      out.innerHTML = '<div class="receipt"><h3>Rental started</h3>' +
        '<p><strong>Reference:</strong> ' + ref + '<br>' +
        '<strong>Car:</strong> ' + esc(car.name) + ' (' + esc(car.plate) + ') — ' + money(car.ratePerHour) + ' / hour<br>' +
        '<strong>Started:</strong> ' + esc(fmtDT(rental.start)) + '<br>' +
        '<strong>Name:</strong> ' + esc(name) + '<br>' +
        '<strong>Phone:</strong> ' + esc(phone) + '</p>' +
        '<p>Return it in the Returns tab — the bill is counted by the hour.</p>' +
        '<p id="rn-mail" class="hint">Sending the business a copy…</p></div>';
      notify('Car rental started: ' + ref, 'carrentalsystem_rental',
        { reference: ref, car: car.name, plate: car.plate, started: fmtDT(rental.start), name: name, phone: phone }, 'rn-mail');
    });
  }

  /* ---------- returns ---------- */
  function renderReturns() {
    var el = $('view-returns');
    var active = rentals.filter(function (r) { return r.status === 'active'; });
    var past = rentals.filter(function (r) { return r.status === 'returned'; });
    el.innerHTML = '<h2>Returns</h2>' +
      '<div class="note">Billed by the whole hour: the first 24 hours at the car\u2019s hourly rate, extra hours at double the rate, plus a $50 fine when the car comes back damaged. Pay when the car comes back — nothing is charged online.</div>' +
      '<div id="return-out"></div>' +
      '<h3>Out now</h3>' +
      (active.length ? active.map(function (r) {
        return '<div class="card"><span class="badge">out</span>' +
          '<h3>' + esc(r.carName) + ' (' + esc(r.plate) + ')</h3>' +
          '<p>Out since: ' + esc(fmtDT(r.start)) + '<br>' +
          esc(r.name) + ' &nbsp;·&nbsp; ' + esc(r.phone) + ' &nbsp;·&nbsp; ' + money(r.ratePerHour) + ' / hour</p>' +
          '<div class="row"><button data-bill="' + r.id + '">Return &amp; bill</button></div></div>';
      }).join('') : '<div class="card"><p>No cars are out right now.</p></div>') +
      '<div id="bill-area"></div>' +
      '<h3>Past returns</h3>' +
      (past.length ? past.map(function (r) {
        return '<div class="card"><h3>' + esc(r.carName) + ' (' + esc(r.plate) + ') — ' + money(r.total) + '</h3>' +
          '<p>Out: ' + esc(fmtDT(r.start)) + '<br>Back: ' + esc(fmtDT(r.end)) +
          ' (' + r.hours + (r.hours === 1 ? ' hour' : ' hours') + ')' +
          (r.damageAmt ? ' &nbsp;·&nbsp; Damage fine: ' + money(r.damageAmt) : '') + '<br>' +
          esc(r.name) + ' &nbsp;·&nbsp; ' + esc(r.phone) + '</p></div>';
      }).join('') : '<div class="card"><p>No returns yet.</p></div>');
  }
  function renderBill(rental) {
    var b = billFor(rental, Date.now(), false);
    var el = $('bill-area');
    el.innerHTML = '<div class="card"><h3>Bill for ' + esc(rental.carName) + ' (' + esc(rental.plate) + ')</h3>' +
      '<p>Out since: ' + esc(fmtDT(rental.start)) + '<br>' +
      'Duration: ' + hms(b.seconds) + ' (' + b.hours + (b.hours === 1 ? ' hour' : ' hours') + ' billed)<br>' +
      'First 24 hours: ' + b.baseHours + ' × ' + money(rental.ratePerHour) + ' = ' + money(b.baseAmt) + '<br>' +
      (b.lateHours ? 'Extra hours: ' + b.lateHours + ' × ' + money(Number(rental.ratePerHour) * 2) + ' = ' + money(b.lateAmt) + '<br>' : '') +
      'Damage fine: <label style="display:inline"><input id="bill-damage" type="checkbox"> Car came back damaged (+' + money(DAMAGE_FINE) + ')</label></p>' +
      '<p><strong>Total: <span id="bill-total">' + money(b.total) + '</span></strong></p>' +
      '<div class="row"><button id="bill-confirm">Confirm return</button></div></div>';
    $('bill-damage').addEventListener('change', function () {
      var nb = billFor(rental, Date.now(), $('bill-damage').checked);
      $('bill-total').textContent = money(nb.total);
    });
    $('bill-confirm').addEventListener('click', function () {
      var damaged = $('bill-damage').checked;
      var fb = billFor(rental, Date.now(), damaged);
      rental.status = 'returned';
      rental.end = new Date().toISOString();
      rental.hours = fb.hours;
      rental.baseAmt = fb.baseAmt;
      rental.lateAmt = fb.lateAmt;
      rental.damageAmt = fb.damageAmt;
      rental.total = fb.total;
      saveRentals();
      var ref = 'CR-' + String(rental.id).slice(-6);
      renderReturns();
      $('return-out').innerHTML = '<div class="receipt"><h3>Car returned</h3>' +
        '<p><strong>Reference:</strong> ' + ref + '<br>' +
        '<strong>Car:</strong> ' + esc(rental.carName) + ' (' + esc(rental.plate) + ')<br>' +
        '<strong>Out:</strong> ' + esc(fmtDT(rental.start)) + '<br>' +
        '<strong>Back:</strong> ' + esc(fmtDT(rental.end)) + ' (' + fb.hours + (fb.hours === 1 ? ' hour' : ' hours') + ')<br>' +
        'First 24 hours: ' + money(fb.baseAmt) +
        (fb.lateHours ? '<br>Extra hours: ' + money(fb.lateAmt) : '') +
        (fb.damageAmt ? '<br>Damage fine: ' + money(fb.damageAmt) : '') + '<br>' +
        '<strong>Total: ' + money(fb.total) + '</strong></p>' +
        '<p>Pay when the car comes back.</p>' +
        '<p id="ret-mail" class="hint">Sending the business a copy…</p></div>';
      notify('Car returned: ' + ref, 'carrentalsystem_return',
        { reference: ref, car: rental.carName, plate: rental.plate, hours: fb.hours, total: fb.total,
          name: rental.name, phone: rental.phone }, 'ret-mail');
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
    var fleetHtml = (data.fleet || []).map(function (c, i) {
      return '<div class="card" data-car="' + i + '">' +
        '<label>Car name</label><input class="fl-name" value="' + esc(c.name) + '">' +
        '<label>Plate number</label><input class="fl-plate" value="' + esc(c.plate || '') + '">' +
        '<label>Hourly rate ($)</label><input class="fl-rate" type="number" min="0" step="0.01" value="' + esc(c.ratePerHour) + '">' +
        '<label>Description</label><input class="fl-desc" value="' + esc(c.description || '') + '">' +
        '<div class="row"><button class="danger fl-del">Delete car</button></div></div>';
    }).join('');
    el.innerHTML = '<h2>Setup</h2>' +
      '<div class="note">Edit the business here, then press “Download data.json”. ' +
      'To put the changes live, replace the <strong>data.json</strong> file inside this folder with the downloaded file, then reload the page. ' +
      'Nothing on this tab changes the live page by itself — and that is on purpose, so visitors cannot change your fleet.</div>' +
      '<div class="card"><h3>Business details</h3>' +
      field('Business name', 'st-name', b.name) +
      field('About', 'st-about', b.about) +
      field('Phone', 'st-phone', b.phone, 'tel') +
      field('Email (rental copies go here; empty = Yently inbox)', 'st-email', b.email, 'email') +
      field('Address', 'st-address', b.address) +
      field('Hours', 'st-hours', b.hours) + '</div>' +
      '<h3>Fleet</h3>' + fleetHtml +
      '<div class="card"><h3>Add a car</h3>' +
      '<label>Car name</label><input id="fl-new-name">' +
      '<label>Plate number</label><input id="fl-new-plate">' +
      '<label>Hourly rate ($)</label><input id="fl-new-rate" type="number" min="0" step="0.01">' +
      '<label>Description</label><input id="fl-new-desc">' +
      '<div class="row"><button id="fl-add">Add car</button></div></div>' +
      '<div class="row"><button id="setup-download">Download data.json</button></div>';
    Array.prototype.forEach.call(el.querySelectorAll('.fl-del'), function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('[data-car]');
        data.fleet.splice(Number(card.getAttribute('data-car')), 1);
        renderSetup();
      });
    });
    $('fl-add').addEventListener('click', function () {
      var name = $('fl-new-name').value.trim();
      var rate = parseFloat($('fl-new-rate').value);
      if (!name || isNaN(rate)) return;
      var maxId = (data.fleet || []).reduce(function (m, c) { return Math.max(m, c.id || 0); }, 0);
      data.fleet.push({ id: maxId + 1, name: name, plate: $('fl-new-plate').value.trim(),
        ratePerHour: rate, description: $('fl-new-desc').value.trim() });
      renderSetup();
    });
    $('setup-download').addEventListener('click', function () {
      var next = { business: { name: $('st-name').value.trim(), about: $('st-about').value.trim(),
          phone: $('st-phone').value.trim(), email: $('st-email').value.trim(),
          address: $('st-address').value.trim(), hours: $('st-hours').value.trim() },
        fleet: [] };
      Array.prototype.forEach.call(el.querySelectorAll('[data-car]'), function (card, i) {
        next.fleet.push({ id: (data.fleet[i] && data.fleet[i].id) || (i + 1),
          name: card.querySelector('.fl-name').value.trim(),
          plate: card.querySelector('.fl-plate').value.trim(),
          ratePerHour: parseFloat(card.querySelector('.fl-rate').value) || 0,
          description: card.querySelector('.fl-desc').value.trim() });
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
    var rent = e.target.getAttribute && e.target.getAttribute('data-rent');
    if (rent) {
      rentCarId = Number(rent);
      showTab('rent');
    }
  });
  $('view-returns').addEventListener('click', function (e) {
    var bill = e.target.getAttribute && e.target.getAttribute('data-bill');
    if (bill) {
      var r = rentals.filter(function (x) { return String(x.id) === bill; })[0];
      if (r) renderBill(r);
    }
  });
  fetch(BASE + 'data.json')
    .then(function (res) { if (!res.ok) throw new Error('data.json not found'); return res.json(); })
    .then(function (json) {
      data = json;
      data.business = data.business || {};
      data.fleet = data.fleet || [];
      renderHeader();
      showTab('cars');
    })
    .catch(function () {
      $('view-cars').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one (see the README in this folder) and reload the page.</div>';
    });
})();
