/* Dealer template app — one folder per dealership.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Content lives in
   data.json; test-drive bookings and trade-in requests live in this
   browser only (one key per folder). A booking or request is emailed to
   the business email in Setup (or to AutoFly's inbox when that is
   empty). Setup edits never change the live page by themselves: they
   download a new data.json, and the owner replaces the folder's file
   with it. No payment is taken here: the Finance tab only estimates a
   monthly payment — financing itself is arranged with the dealership. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'dealer')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var DRIVE_KEY = 'dealer-drives-' + SLUG;
  var TRADE_KEY = 'dealer-trades-' + SLUG;
  var SETUP_KEY = 'folder-pass-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the database rules allow, and
     booking emails go through AutoFly's notification service. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null;
  var drives = loadList(DRIVE_KEY);
  var trades = loadList(TRADE_KEY);
  var vehSearch = '';
  var vehMake = 'All';
  var detailId = null;
  var finVehicleId = null;
  var driveVehicleId = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    var v = Math.round(Number(n) * 100) / 100;
    var s = v.toFixed(2).split('.');
    var int = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '$' + int + (s[1] === '00' ? '' : '.' + s[1]);
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function fmtDT(iso) {
    var d = new Date(iso);
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function todayStr() {
    var d = new Date();
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function loadList(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  }
  function saveList(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }
  function vehicleById(id) {
    return (data.vehicles || []).filter(function (v) { return String(v.id) === String(id); })[0] || null;
  }
  function title(v) { return v.year + ' ' + v.make + ' ' + v.model; }
  function sendEmail(subject, table, record) {
    var to = (data.business && data.business.email) || '';
    return fetch(SUPABASE_URL + '/functions/v1/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify({ to: to || undefined, subject: subject, table: table, record: record })
    });
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    ['vehicles', 'finance', 'testdrive', 'sell', 'setup'].forEach(function (t) {
      $('view-' + t).hidden = (t !== name);
    });
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.className = (b.getAttribute('data-tab') === name) ? 'active' : '';
    });
    if (name === 'vehicles') renderVehicles();
    if (name === 'finance') renderFinance();
    if (name === 'testdrive') renderTestDrive();
    if (name === 'sell') renderSell();
    if (name === 'setup') openSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var b = data.business || {};
    document.title = b.name || 'Dealer';
    $('biz-name').textContent = b.name || 'Dealer';
    $('biz-about').textContent = b.about || '';
    var parts = [];
    if (b.phone) parts.push('Phone: ' + esc(b.phone));
    if (b.email) parts.push('Email: <a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>');
    if (b.address) parts.push(esc(b.address));
    if (b.hours) parts.push(esc(b.hours));
    $('biz-meta').innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  /* ---------- vehicles ---------- */
  function makes() {
    var seen = [];
    (data.vehicles || []).forEach(function (v) {
      if (v.make && seen.indexOf(v.make) === -1) seen.push(v.make);
    });
    return seen;
  }
  function specRows(v) {
    return [['Body style', v.bodyStyle], ['Drivetrain', v.drivetrain], ['Transmission', v.transmission],
      ['Mileage', v.mileage != null ? Number(v.mileage).toLocaleString('en-US') + ' mi' : ''],
      ['Exterior', v.exterior], ['Interior', v.interior], ['Doors', v.doors],
      ['Fuel type', v.fuel], ['Condition', v.condition], ['Stock no.', v.stockNo]];
  }
  function renderVehicles() {
    var el = $('view-vehicles');
    if (detailId != null) {
      var v = vehicleById(detailId);
      if (!v) { detailId = null; }
      else {
        el.innerHTML = '<div class="row"><button class="secondary" data-back>← All vehicles</button></div>' +
          '<div class="card"><span class="badge">' + esc(v.bodyStyle || '') + ' · ' + esc(v.condition || '') + '</span>' +
          '<h2>' + esc(title(v)) + '</h2>' +
          '<p><span class="price">' + money(v.price) + '</span></p>' +
          '<p>' + esc(v.description || '') + '</p>' +
          '<p>' + specRows(v).filter(function (r) { return r[1] != null && r[1] !== ''; })
            .map(function (r) { return '<strong>' + esc(r[0]) + ':</strong> ' + esc(r[1]); }).join('<br>') + '</p>' +
          '<div class="row"><button data-drive="' + v.id + '">Book a test drive</button>' +
          '<button class="secondary" data-finance="' + v.id + '">Calculate financing</button></div></div>';
        return;
      }
    }
    var q = vehSearch.trim().toLowerCase();
    var list = (data.vehicles || []).filter(function (v) {
      if (vehMake !== 'All' && v.make !== vehMake) return false;
      if (q && (title(v).toLowerCase().indexOf(q) === -1 && String(v.bodyStyle || '').toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    var chips = ['All'].concat(makes()).map(function (m) {
      return '<button class="' + (m === vehMake ? 'active' : '') + '" data-chip="' + esc(m) + '">' + esc(m) + '</button>';
    }).join('');
    el.innerHTML = '<h2>Vehicles</h2>' +
      '<label>Search vehicles</label><input id="veh-search" type="text" value="' + esc(vehSearch) + '" placeholder="Make, model, or body style…">' +
      '<div class="chips">' + chips + '</div>' +
      '<div class="grid">' + (list.length ? list.map(function (v) {
        return '<div class="card"><span class="badge">' + esc(v.bodyStyle || '') + ' · ' + esc(v.condition || '') + '</span>' +
          '<h3>' + esc(title(v)) + '</h3>' +
          '<p><span class="price">' + money(v.price) + '</span></p>' +
          '<p>' + esc(v.transmission || '') + ' · ' +
          (v.mileage != null ? Number(v.mileage).toLocaleString('en-US') + ' mi' : '') + ' · ' + esc(v.exterior || '') + '</p>' +
          '<div class="row"><button data-detail="' + v.id + '">View details</button>' +
          '<button class="secondary" data-drive="' + v.id + '">Test drive</button></div></div>';
      }).join('') : '<div class="card"><p>No vehicles match. The owner adds vehicles in Setup.</p></div>') + '</div>';
    $('veh-search').addEventListener('input', function (e) { vehSearch = e.target.value; renderVehicles(); });
  }

  /* ---------- finance ---------- */
  function monthlyPayment(price, down, ratePct, months) {
    var principal = Number(price) - Number(down);
    if (!(principal > 0) || !(months > 0)) return 0;
    if (!ratePct) return round2(principal / months);
    var r = Number(ratePct) / 100 / 12;
    return round2(principal * r / (1 - Math.pow(1 + r, -months)));
  }
  function renderFinance() {
    var el = $('view-finance');
    var sel = finVehicleId != null ? finVehicleId : ((data.vehicles || [])[0] && (data.vehicles || [])[0].id);
    var v = sel != null ? vehicleById(sel) : null;
    var opts = (data.vehicles || []).map(function (x) {
      return '<option value="' + x.id + '"' + (v && String(x.id) === String(v.id) ? ' selected' : '') + '>' + esc(title(x)) + ' — ' + money(x.price) + '</option>';
    }).join('');
    el.innerHTML = '<h2>Finance</h2>' +
      '<div class="note">Estimate only: this calculator shows what a monthly payment could look like. No credit check happens here and no financing is arranged online — talk to the dealership for the real offer.</div>' +
      '<div class="card"><label>Vehicle</label><select id="fin-vehicle">' + opts + '</select>' +
      '<label>Vehicle price ($)</label><input id="fin-price" type="number" min="0" step="1" value="' + esc(v ? v.price : '') + '">' +
      '<label>Down payment ($)</label><input id="fin-down" type="number" min="0" step="1" value="1000">' +
      '<label>Annual interest rate (%)</label><input id="fin-rate" type="number" min="0" step="0.1" value="6">' +
      '<label>Term (months)</label><input id="fin-term" type="number" min="1" step="1" value="48">' +
      '<div class="row"><button data-calc>Calculate my payment</button></div>' +
      '<div id="fin-out" style="margin-top:12px"></div></div>';
    $('fin-vehicle').addEventListener('change', function (e) {
      var nv = vehicleById(e.target.value);
      if (nv) { finVehicleId = nv.id; $('fin-price').value = nv.price; }
    });
  }

  /* ---------- test drive ---------- */
  function vehicleOptions(selectedId) {
    return (data.vehicles || []).map(function (x) {
      return '<option value="' + x.id + '"' + (selectedId != null && String(x.id) === String(selectedId) ? ' selected' : '') + '>' + esc(title(x)) + ' — ' + money(x.price) + '</option>';
    }).join('');
  }
  function renderTestDrive() {
    var el = $('view-testdrive');
    var sel = driveVehicleId != null ? driveVehicleId : ((data.vehicles || [])[0] && (data.vehicles || [])[0].id);
    el.innerHTML = '<h2>Test Drive</h2>' +
      '<div class="card"><label>Vehicle</label><select id="td-vehicle">' + vehicleOptions(sel) + '</select>' +
      '<label>Your name</label><input id="td-name" type="text">' +
      '<label>Phone</label><input id="td-phone" type="tel">' +
      '<label>Email (optional)</label><input id="td-email" type="email">' +
      '<label>Date</label><input id="td-date" type="date" value="' + todayStr() + '">' +
      '<label>Time</label><input id="td-time" type="time" value="10:00">' +
      '<label>Note (optional)</label><textarea id="td-note"></textarea>' +
      '<div class="row"><button data-book>Book test drive</button></div>' +
      '<div id="td-out" style="margin-top:12px"></div></div>' +
      '<h3>My test drives</h3>' +
      (drives.length ? drives.map(function (d) {
        var v = vehicleById(d.vehicleId);
        return '<div class="card"><span class="badge">' + esc(d.status) + '</span>' +
          '<h3>' + esc(v ? title(v) : 'Vehicle') + '</h3>' +
          '<p>' + esc(d.date) + ' at ' + esc(d.time) + ' · ' + esc(d.name) + ' · ' + esc(d.phone) + '</p>' +
          (d.status === 'upcoming' ? '<div class="row"><button class="secondary" data-drive-done="' + d.id + '">Mark done</button>' +
          '<button class="danger" data-drive-cancel="' + d.id + '">Cancel</button></div>' : '') + '</div>';
      }).join('') : '<div class="card"><p>No test drives booked yet on this device.</p></div>');
    Array.prototype.forEach.call(el.querySelectorAll('[data-drive-done]'), function (btn) {
      btn.addEventListener('click', function () {
        var d = drives.filter(function (x) { return String(x.id) === btn.getAttribute('data-drive-done'); })[0];
        if (d) d.status = 'done';
        saveList(DRIVE_KEY, drives); renderTestDrive();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-drive-cancel]'), function (btn) {
      btn.addEventListener('click', function () {
        drives = drives.filter(function (x) { return String(x.id) !== btn.getAttribute('data-drive-cancel'); });
        saveList(DRIVE_KEY, drives); renderTestDrive();
      });
    });
  }
  function bookTestDrive() {
    var out = $('td-out');
    var v = vehicleById($('td-vehicle').value);
    var name = $('td-name').value.trim();
    var phone = $('td-phone').value.trim();
    var date = $('td-date').value;
    var time = $('td-time').value;
    if (!v || !name || !phone || !date || !time) {
      out.innerHTML = '<p class="error">Please choose a vehicle and fill in your name, phone, date, and time.</p>';
      return;
    }
    var rec = { id: Date.now(), vehicleId: v.id, name: name, phone: phone,
      email: $('td-email').value.trim(), date: date, time: time,
      note: $('td-note').value.trim(), status: 'upcoming', createdAt: new Date().toISOString() };
    drives.unshift(rec);
    saveList(DRIVE_KEY, drives);
    var ref = 'TD-' + String(rec.id).slice(-6);
    out.innerHTML = '<div class="receipt"><h3>Test drive booked</h3>' +
      '<p><strong>Reference:</strong> ' + ref + '<br>' +
      '<strong>Vehicle:</strong> ' + esc(title(v)) + ' — ' + money(v.price) + '<br>' +
      '<strong>When:</strong> ' + esc(date) + ' at ' + esc(time) + '<br>' +
      '<strong>Name:</strong> ' + esc(name) + '<br>' +
      '<strong>Phone:</strong> ' + esc(phone) + '</p>' +
      '<p class="hint">Find this booking any time in the list below.</p>' +
      '<p id="td-mail" class="hint">Sending the business a copy…</p></div>';
    renderTestDriveListOnly(out);
    sendEmail('Dealer test drive: ' + title(v), 'dealer_testdrive',
      { reference: ref, vehicle: title(v), price: v.price, date: date, time: time, name: name, phone: phone })
      .then(function (res) {
        if (!res.ok) throw new Error('send failed');
        var m = $('td-mail');
        if (m) m.textContent = 'A copy was emailed to the business.';
      }).catch(function () {
        var m = $('td-mail');
        if (m) m.textContent = 'The email copy did not go through — your booking is still saved here.';
      });
  }
  function renderTestDriveListOnly(outKept) {
    /* Re-render the bookings list without losing the receipt just shown:
       simplest correct approach is a full re-render, then restore the
       receipt block on top of the form. */
    var receipt = outKept ? outKept.innerHTML : '';
    renderTestDrive();
    if (receipt) { var o = $('td-out'); if (o) o.innerHTML = receipt; }
  }

  /* ---------- sell your car ---------- */
  function renderSell() {
    var el = $('view-sell');
    el.innerHTML = '<h2>Sell Your Car</h2>' +
      '<div class="note">Tell us about your car and we will contact you about its value. This is a valuation request, not a purchase offer.</div>' +
      '<div class="card"><label>Year</label><input id="tr-year" type="number" min="1950" max="2099" step="1">' +
      '<label>Make</label><input id="tr-make" type="text">' +
      '<label>Model</label><input id="tr-model" type="text">' +
      '<label>Mileage</label><input id="tr-mileage" type="number" min="0" step="1">' +
      '<label>Condition</label><select id="tr-condition"><option>Excellent</option><option selected>Good</option><option>Fair</option></select>' +
      '<label>Asking price ($) (optional)</label><input id="tr-price" type="number" min="0" step="1">' +
      '<label>Your name</label><input id="tr-name" type="text">' +
      '<label>Phone</label><input id="tr-phone" type="tel">' +
      '<label>Email (optional)</label><input id="tr-email" type="email">' +
      '<div class="row"><button data-trade>Request valuation</button></div>' +
      '<div id="tr-out" style="margin-top:12px"></div></div>' +
      '<h3>My trade-in requests</h3>' +
      (trades.length ? trades.map(function (t) {
        return '<div class="card"><span class="badge">' + esc(t.status) + '</span>' +
          '<h3>' + esc(t.year + ' ' + t.make + ' ' + t.model) + '</h3>' +
          '<p>' + (t.mileage != null ? Number(t.mileage).toLocaleString('en-US') + ' mi' : '') + ' · ' + esc(t.condition) +
          (t.price ? ' · Asking ' + money(t.price) : '') + ' · ' + esc(t.name) + ' · ' + esc(t.phone) + '</p>' +
          (t.status === 'received' ? '<div class="row"><button class="secondary" data-trade-done="' + t.id + '">Mark done</button>' +
          '<button class="danger" data-trade-cancel="' + t.id + '">Cancel</button></div>' : '') + '</div>';
      }).join('') : '<div class="card"><p>No trade-in requests yet on this device.</p></div>');
    Array.prototype.forEach.call(el.querySelectorAll('[data-trade-done]'), function (btn) {
      btn.addEventListener('click', function () {
        var t = trades.filter(function (x) { return String(x.id) === btn.getAttribute('data-trade-done'); })[0];
        if (t) t.status = 'done';
        saveList(TRADE_KEY, trades); renderSell();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-trade-cancel]'), function (btn) {
      btn.addEventListener('click', function () {
        trades = trades.filter(function (x) { return String(x.id) !== btn.getAttribute('data-trade-cancel'); });
        saveList(TRADE_KEY, trades); renderSell();
      });
    });
  }
  function requestTrade() {
    var out = $('tr-out');
    var year = $('tr-year').value.trim();
    var make = $('tr-make').value.trim();
    var model = $('tr-model').value.trim();
    var name = $('tr-name').value.trim();
    var phone = $('tr-phone').value.trim();
    if (!year || !make || !model || !name || !phone) {
      out.innerHTML = '<p class="error">Please fill in your car (year, make, model) and your name and phone.</p>';
      return;
    }
    var rec = { id: Date.now(), year: year, make: make, model: model,
      mileage: parseInt($('tr-mileage').value, 10) || null,
      condition: $('tr-condition').value, price: parseFloat($('tr-price').value) || null,
      name: name, phone: phone, email: $('tr-email').value.trim(),
      status: 'received', createdAt: new Date().toISOString() };
    trades.unshift(rec);
    saveList(TRADE_KEY, trades);
    var ref = 'TR-' + String(rec.id).slice(-6);
    var receipt = '<div class="receipt"><h3>Trade-in request received</h3>' +
      '<p><strong>Reference:</strong> ' + ref + '<br>' +
      '<strong>Your car:</strong> ' + esc(year + ' ' + make + ' ' + model) + '<br>' +
      '<strong>Mileage:</strong> ' + (rec.mileage != null ? esc(Number(rec.mileage).toLocaleString('en-US')) + ' mi' : '—') + '<br>' +
      '<strong>Condition:</strong> ' + esc(rec.condition) + '<br>' +
      '<strong>Name:</strong> ' + esc(name) + '<br>' +
      '<strong>Phone:</strong> ' + esc(phone) + '</p>' +
      '<p class="hint">We will contact you about your car\u2019s value. This is a valuation request, not a purchase offer.</p>' +
      '<p id="tr-mail" class="hint">Sending the business a copy…</p></div>';
    renderSell();
    var o = $('tr-out');
    if (o) o.innerHTML = receipt;
    sendEmail('Dealer trade-in: ' + year + ' ' + make + ' ' + model, 'dealer_tradein',
      { reference: ref, car: year + ' ' + make + ' ' + model, mileage: rec.mileage,
        condition: rec.condition, askingPrice: rec.price, name: name, phone: phone })
      .then(function (res) {
        if (!res.ok) throw new Error('send failed');
        var m = $('tr-mail');
        if (m) m.textContent = 'A copy was emailed to the business.';
      }).catch(function () {
        var m = $('tr-mail');
        if (m) m.textContent = 'The email copy did not go through — your request is still saved here.';
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
      '<p>Setup for this dealership is protected. Enter the username and password set by the admin for this folder.</p>' +
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
    function vfield(cls, label, value, type) {
      return '<label>' + label + '</label><input class="' + cls + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '">';
    }
    var vehHtml = (data.vehicles || []).map(function (v, i) {
      return '<div class="card" data-veh="' + i + '">' +
        vfield('v-year', 'Year', v.year, 'number') +
        vfield('v-make', 'Make', v.make) +
        vfield('v-model', 'Model', v.model) +
        vfield('v-body', 'Body style', v.bodyStyle) +
        vfield('v-trans', 'Transmission', v.transmission) +
        vfield('v-mileage', 'Mileage', v.mileage, 'number') +
        vfield('v-ext', 'Exterior color', v.exterior) +
        vfield('v-int', 'Interior color', v.interior) +
        vfield('v-drive', 'Drivetrain', v.drivetrain) +
        vfield('v-fuel', 'Fuel type', v.fuel) +
        vfield('v-doors', 'Doors', v.doors, 'number') +
        vfield('v-cond', 'Condition', v.condition) +
        vfield('v-price', 'Price ($)', v.price, 'number') +
        vfield('v-stock', 'Stock no.', v.stockNo) +
        '<label>Description</label><textarea class="v-desc">' + esc(v.description || '') + '</textarea>' +
        '<div class="row"><button class="danger v-del">Delete vehicle</button></div></div>';
    }).join('');
    el.innerHTML = '<h2>Setup</h2>' +
      '<div class="note">Edit the dealership here, then press “Download data.json”. ' +
      'To put the changes live, replace the <strong>data.json</strong> file inside this folder with the downloaded file, then reload the page. ' +
      'Nothing on this tab changes the live page by itself — and that is on purpose, so visitors cannot change your vehicles.</div>' +
      '<div class="card"><h3>Business details</h3>' +
      field('Business name', 'st-name', b.name) +
      field('About', 'st-about', b.about) +
      field('Phone', 'st-phone', b.phone, 'tel') +
      field('Email (booking copies go here; empty = AutoFly inbox)', 'st-email', b.email, 'email') +
      field('Address', 'st-address', b.address) +
      field('Hours', 'st-hours', b.hours) + '</div>' +
      '<h3>Vehicles</h3>' + vehHtml +
      '<div class="card"><h3>Add a vehicle</h3>' +
      '<label>Year</label><input id="v-new-year" type="number">' +
      '<label>Make</label><input id="v-new-make" type="text">' +
      '<label>Model</label><input id="v-new-model" type="text">' +
      '<label>Price ($)</label><input id="v-new-price" type="number">' +
      '<div class="row"><button id="v-add">Add vehicle</button></div></div>' +
      '<div class="row"><button id="setup-download">Download data.json</button></div>';
    Array.prototype.forEach.call(el.querySelectorAll('.v-del'), function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('[data-veh]');
        data.vehicles.splice(Number(card.getAttribute('data-veh')), 1);
        renderSetup();
      });
    });
    $('v-add').addEventListener('click', function () {
      var year = parseInt($('v-new-year').value, 10);
      var make = $('v-new-make').value.trim();
      var model = $('v-new-model').value.trim();
      var price = parseFloat($('v-new-price').value);
      if (!year || !make || !model || isNaN(price)) return;
      var maxId = (data.vehicles || []).reduce(function (m, v) { return Math.max(m, v.id || 0); }, 0);
      data.vehicles.push({ id: maxId + 1, year: year, make: make, model: model, price: price,
        bodyStyle: '', transmission: '', mileage: null, exterior: '', interior: '',
        drivetrain: '', fuel: '', doors: null, condition: 'Used', stockNo: '', description: '' });
      renderSetup();
    });
    $('setup-download').addEventListener('click', function () {
      var next = { business: { name: $('st-name').value.trim(), about: $('st-about').value.trim(),
          phone: $('st-phone').value.trim(), email: $('st-email').value.trim(),
          address: $('st-address').value.trim(), hours: $('st-hours').value.trim() },
        vehicles: [] };
      Array.prototype.forEach.call(el.querySelectorAll('[data-veh]'), function (card, i) {
        function val(cls, num) {
          var x = card.querySelector('.' + cls).value.trim();
          return num ? (x === '' ? null : parseFloat(x)) : x;
        }
        next.vehicles.push({ id: (data.vehicles[i] && data.vehicles[i].id) || (i + 1),
          year: val('v-year', true), make: val('v-make'), model: val('v-model'),
          bodyStyle: val('v-body'), transmission: val('v-trans'), mileage: val('v-mileage', true),
          exterior: val('v-ext'), interior: val('v-int'), drivetrain: val('v-drive'),
          fuel: val('v-fuel'), doors: val('v-doors', true), condition: val('v-cond'),
          price: val('v-price', true), stockNo: val('v-stock'),
          description: card.querySelector('.v-desc').value.trim() });
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
    detailId = null;
    showTab('vehicles');
  });
  $('view-vehicles').addEventListener('click', function (e) {
    var t = e.target;
    var detail = t.getAttribute && t.getAttribute('data-detail');
    var drive = t.getAttribute && t.getAttribute('data-drive');
    var fin = t.getAttribute && t.getAttribute('data-finance');
    var back = t.getAttribute && t.getAttribute('data-back') != null;
    var chip = t.getAttribute && t.getAttribute('data-chip');
    if (detail) { detailId = detail; renderVehicles(); }
    else if (drive) { driveVehicleId = drive; showTab('testdrive'); }
    else if (fin) { finVehicleId = fin; showTab('finance'); }
    else if (back) { detailId = null; renderVehicles(); }
    else if (chip) { vehMake = chip; renderVehicles(); }
  });
  $('view-finance').addEventListener('click', function (e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-calc') != null) {
      var v = vehicleById($('fin-vehicle').value);
      var price = parseFloat($('fin-price').value);
      var down = parseFloat($('fin-down').value) || 0;
      var rate = parseFloat($('fin-rate').value) || 0;
      var months = parseInt($('fin-term').value, 10);
      var out = $('fin-out');
      if (!v || isNaN(price) || !months) { out.innerHTML = '<p class="error">Please choose a vehicle and fill in the price and term.</p>'; return; }
      var pay = monthlyPayment(price, down, rate, months);
      var total = round2(pay * months);
      var interest = round2(total - (price - down));
      out.innerHTML = '<div class="card totals">Monthly payment: <strong>' + money(pay) + '</strong><br>' +
        'Number of payments: ' + months + '<br>' +
        'Total of payments: ' + money(total) + '<br>' +
        'Total interest: ' + money(interest) + '<br>' +
        '<p class="hint">Estimate only, for ' + esc(title(v)) + ' at ' + money(price) + ' with ' + money(down) + ' down.</p>' +
        '<div class="row"><button data-fin-drive>Book a test drive for this vehicle</button></div></div>';
    } else if (t.getAttribute && t.getAttribute('data-fin-drive') != null) {
      var vv = vehicleById($('fin-vehicle').value);
      if (vv) driveVehicleId = vv.id;
      showTab('testdrive');
    }
  });
  $('view-testdrive').addEventListener('click', function (e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-book') != null) bookTestDrive();
  });
  $('view-sell').addEventListener('click', function (e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-trade') != null) requestTrade();
  });
  fetch(BASE + 'data.json')
    .then(function (res) { if (!res.ok) throw new Error('data.json not found'); return res.json(); })
    .then(function (json) {
      data = json;
      data.business = data.business || {};
      data.vehicles = data.vehicles || [];
      renderHeader();
      showTab('vehicles');
    })
    .catch(function () {
      $('view-vehicles').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one (see the README in this folder) and reload the page.</div>';
    });
})();
