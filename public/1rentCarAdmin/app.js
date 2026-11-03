/* RentCarAdmin template app — an admin panel for a rental business.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Content lives in
   data.json. Rides, cars, and drivers edited here are saved in this
   browser only; Setup's Download data.json exports the current state,
   and the owner replaces the folder's file with it to make changes
   permanent for everyone. This page is an admin tool, so the whole page —
   not just Setup — asks for the folder's sign-in once the admin has set
   one for this folder. The password itself is never sent to the page:
   the database only answers yes/no. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'rentCarAdmin')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var DATA_KEY = 'rentcaradmin-data-' + SLUG;
  var SETUP_KEY = 'folder-pass-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the database rules allow. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null;
  var rides = [], cars = [], drivers = [];
  var dashSearch = '', dashStatus = 'All';
  var editCarId = null, editDriverId = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dateStr(d) {
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function loadStored() {
    try {
      var s = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
      if (s && Array.isArray(s.rides) && Array.isArray(s.cars) && Array.isArray(s.drivers)) return s;
    } catch (e) {}
    return null;
  }
  function save() {
    try { localStorage.setItem(DATA_KEY, JSON.stringify({ rides: rides, cars: cars, drivers: drivers })); } catch (e) {}
  }
  function nextId(list) {
    return list.reduce(function (m, x) { return Math.max(m, x.id || 0); }, 0) + 1;
  }
  function statusOptions(selected) {
    return ['Active', 'Completed', 'Cancelled'].map(function (s) {
      return '<option' + (s === selected ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    ['dashboard', 'cars', 'drivers', 'setup'].forEach(function (t) {
      $('view-' + t).hidden = (t !== name);
    });
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.className = (b.getAttribute('data-tab') === name) ? 'active' : '';
    });
    if (name === 'dashboard') renderDashboard();
    if (name === 'cars') renderCars();
    if (name === 'drivers') renderDrivers();
    if (name === 'setup') renderSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var b = data.business || {};
    document.title = b.name || 'RentCarAdmin';
    $('biz-name').textContent = b.name || 'RentCarAdmin';
    $('biz-about').textContent = b.about || '';
    var parts = [];
    if (b.phone) parts.push('Phone: ' + esc(b.phone));
    if (b.email) parts.push('Email: <a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>');
    if (b.address) parts.push(esc(b.address));
    if (b.hours) parts.push(esc(b.hours));
    $('biz-meta').innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  /* ---------- dashboard (rides) ---------- */
  function dashRowsHTML() {
    var list = rides.filter(function (r) {
      if (dashStatus !== 'All' && r.status !== dashStatus) return false;
      var q = dashSearch.trim().toLowerCase();
      if (q && (String(r.carNumber).toLowerCase().indexOf(q) === -1 &&
        String(r.driverName).toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    return list.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.rideDate) + '</td><td>' + esc(r.carNumber) + '</td>' +
        '<td>' + esc(r.driverName) + '</td><td>' + esc(r.rideTiming) + '</td><td>' + esc(r.totalHours) + '</td>' +
        '<td>' + esc(r.extraHours) + '</td>' +
        '<td><select data-status-ride="' + r.id + '">' + statusOptions(r.status) + '</select></td>' +
        '<td>' + esc(r.start) + '</td><td>' + esc(r.end) + '</td>' +
        '<td><button class="danger" data-del-ride="' + r.id + '">Delete</button></td></tr>';
    }).join('') || '<tr><td colspan="11">No rides match.</td></tr>';
  }
  function renderDashboard() {
    var el = $('view-dashboard');
    var carOpts = cars.map(function (c) {
      return '<option value="' + esc(c.number) + '">' + esc(c.number) + ' — ' + esc(c.company) + '</option>';
    }).join('');
    var driverOpts = drivers.map(function (d) {
      return '<option>' + esc(d.name) + '</option>';
    }).join('');
    el.innerHTML = '<h2>Dashboard</h2>' +
      '<div class="note">Rides for this business. Edits here are saved in this browser — export them from Setup to make them permanent.</div>' +
      '<label>Search rides</label><input id="dash-search" type="text" value="' + esc(dashSearch) + '" placeholder="Car number or driver…">' +
      '<label>Status</label><select id="dash-status"><option' + (dashStatus === 'All' ? ' selected' : '') + '>All</option>' + statusOptions(dashStatus) + '</select>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>No.</th><th>Ride Date</th><th>Car Number</th><th>Driver Name</th><th>Ride Timing</th><th>Total Hours</th><th>Extra Hours</th><th>Status</th><th>Start</th><th>End</th><th></th></tr></thead>' +
      '<tbody id="dash-rows">' + dashRowsHTML() + '</tbody></table></div>' +
      '<div class="card"><h3>Add a ride</h3>' +
      '<label>Ride date</label><input id="ride-date" type="date" value="' + dateStr(new Date()) + '">' +
      '<label>Car</label><select id="ride-car">' + carOpts + '</select>' +
      '<label>Driver</label><select id="ride-driver">' + driverOpts + '</select>' +
      '<label>Ride timing</label><input id="ride-timing" placeholder="09:00 – 13:00">' +
      '<label>Total hours</label><input id="ride-total" type="number" min="0" step="1">' +
      '<label>Extra hours</label><input id="ride-extra" type="number" min="0" step="1" value="0">' +
      '<label>Status</label><select id="ride-status">' + statusOptions('Active') + '</select>' +
      '<label>Start (odometer)</label><input id="ride-start" placeholder="41,200 km">' +
      '<label>End (odometer)</label><input id="ride-end" placeholder="41,380 km">' +
      '<div class="row"><button id="ride-add">Add ride</button></div></div>';
    $('dash-search').addEventListener('input', function (e) { dashSearch = e.target.value; $('dash-rows').innerHTML = dashRowsHTML(); });
    $('dash-status').addEventListener('change', function (e) { dashStatus = e.target.value; $('dash-rows').innerHTML = dashRowsHTML(); });
    $('ride-add').addEventListener('click', function () {
      var car = $('ride-car').value, driver = $('ride-driver').value;
      if (!car || !driver) return;
      rides.unshift({ id: nextId(rides), rideDate: $('ride-date').value, carNumber: car, driverName: driver,
        rideTiming: $('ride-timing').value.trim(), totalHours: parseInt($('ride-total').value, 10) || 0,
        extraHours: parseInt($('ride-extra').value, 10) || 0, status: $('ride-status').value,
        start: $('ride-start').value.trim(), end: $('ride-end').value.trim() });
      save();
      renderDashboard();
    });
  }
  function renderDashboardRowsOnly() {
    var rowsEl = $('dash-rows');
    if (rowsEl) rowsEl.innerHTML = dashRowsHTML();
  }

  /* ---------- cars ---------- */
  function renderCars() {
    var el = $('view-cars');
    var editing = cars.filter(function (c) { return c.id === editCarId; })[0];
    var rows = cars.map(function (c, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(c.number) + '</td><td>' + esc(c.insurance) + '</td>' +
        '<td>' + esc(c.puc) + '</td><td>' + esc(c.rc) + '</td><td>' + esc(c.company) + '</td>' +
        '<td><button data-edit-car="' + c.id + '">Edit</button></td>' +
        '<td><button class="danger" data-del-car="' + c.id + '">Delete</button></td></tr>';
    }).join('');
    el.innerHTML = '<h2>Cars</h2>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>No.</th><th>Car number</th><th>Insurance</th><th>PUC</th><th>RC Book</th><th>Car company name</th><th></th><th></th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="8">No cars yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h3>' + (editing ? 'Edit car' : 'Add a car') + '</h3>' +
      '<label>Car number</label><input id="car-number" value="' + esc(editing ? editing.number : '') + '">' +
      '<label>Car company name</label><input id="car-company" value="' + esc(editing ? editing.company : '') + '">' +
      '<label>Insurance (reference)</label><input id="car-insurance" value="' + esc(editing ? editing.insurance : '') + '">' +
      '<label>PUC (reference)</label><input id="car-puc" value="' + esc(editing ? editing.puc : '') + '">' +
      '<label>RC Book (reference)</label><input id="car-rc" value="' + esc(editing ? editing.rc : '') + '">' +
      '<div class="row"><button id="car-save">' + (editing ? 'Save changes' : 'Add car') + '</button>' +
      (editing ? '<button id="car-cancel">Cancel</button>' : '') + '</div></div>';
    $('car-save').addEventListener('click', function () {
      var number = $('car-number').value.trim();
      if (!number) return;
      var rec = { number: number, company: $('car-company').value.trim(),
        insurance: $('car-insurance').value.trim(), puc: $('car-puc').value.trim(), rc: $('car-rc').value.trim() };
      if (editing) {
        Object.keys(rec).forEach(function (k) { editing[k] = rec[k]; });
      } else {
        rec.id = nextId(cars);
        cars.push(rec);
      }
      editCarId = null;
      save();
      renderCars();
    });
    if (editing) $('car-cancel').addEventListener('click', function () { editCarId = null; renderCars(); });
  }

  /* ---------- drivers ---------- */
  function renderDrivers() {
    var el = $('view-drivers');
    var editing = drivers.filter(function (d) { return d.id === editDriverId; })[0];
    var rows = drivers.map(function (d, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(d.name) + '</td><td>' + esc(d.phone) + '</td>' +
        '<td>' + esc(d.email) + '</td><td>' + esc(d.dob) + '</td><td>' + esc(d.licence) + '</td>' +
        '<td>' + esc(d.address) + '</td><td>' + esc(d.photo) + '</td>' +
        '<td><button data-edit-driver="' + d.id + '">Edit</button></td>' +
        '<td><button class="danger" data-del-driver="' + d.id + '">Delete</button></td></tr>';
    }).join('');
    el.innerHTML = '<h2>Drivers</h2>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>No.</th><th>Driver name</th><th>Phone number</th><th>Email id</th><th>DOB</th><th>Licence number</th><th>Address</th><th>Photo</th><th></th><th></th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="10">No drivers yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h3>' + (editing ? 'Edit driver' : 'Add a driver') + '</h3>' +
      '<label>Driver name</label><input id="drv-name" value="' + esc(editing ? editing.name : '') + '">' +
      '<label>Phone number</label><input id="drv-phone" type="tel" value="' + esc(editing ? editing.phone : '') + '">' +
      '<label>Email id</label><input id="drv-email" type="email" value="' + esc(editing ? editing.email : '') + '">' +
      '<label>DOB</label><input id="drv-dob" type="date" value="' + esc(editing ? editing.dob : '') + '">' +
      '<label>Licence number</label><input id="drv-licence" value="' + esc(editing ? editing.licence : '') + '">' +
      '<label>Address</label><input id="drv-address" value="' + esc(editing ? editing.address : '') + '">' +
      '<label>Photo (note or link)</label><input id="drv-photo" value="' + esc(editing ? editing.photo : '') + '">' +
      '<div class="row"><button id="drv-save">' + (editing ? 'Save changes' : 'Add driver') + '</button>' +
      (editing ? '<button id="drv-cancel">Cancel</button>' : '') + '</div></div>';
    $('drv-save').addEventListener('click', function () {
      var name = $('drv-name').value.trim();
      if (!name) return;
      var rec = { name: name, phone: $('drv-phone').value.trim(), email: $('drv-email').value.trim(),
        dob: $('drv-dob').value, licence: $('drv-licence').value.trim(),
        address: $('drv-address').value.trim(), photo: $('drv-photo').value.trim() };
      if (editing) {
        Object.keys(rec).forEach(function (k) { editing[k] = rec[k]; });
      } else {
        rec.id = nextId(drivers);
        drivers.push(rec);
      }
      editDriverId = null;
      save();
      renderDrivers();
    });
    if (editing) $('drv-cancel').addEventListener('click', function () { editDriverId = null; renderDrivers(); });
  }

  /* ---------- setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    var b = data.business || {};
    function field(label, id, value, type) {
      return '<label>' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '">';
    }
    el.innerHTML = '<h2>Setup</h2>' +
      '<div class="note">Rides, cars, and drivers edited on their tabs are saved in this browser only. ' +
      'Press “Download data.json” to export everything — business details plus the current rides, cars, and drivers — ' +
      'then replace the folder’s <strong>data.json</strong> with the downloaded file to make it permanent for everyone.</div>' +
      '<div class="card"><h3>Business details</h3>' +
      field('Business name', 'st-name', b.name) +
      field('About', 'st-about', b.about) +
      field('Phone', 'st-phone', b.phone, 'tel') +
      field('Email', 'st-email', b.email, 'email') +
      field('Address', 'st-address', b.address) +
      field('Hours', 'st-hours', b.hours) + '</div>' +
      '<div class="row"><button id="setup-download">Download data.json</button></div>';
    $('setup-download').addEventListener('click', function () {
      var next = { business: { name: $('st-name').value.trim(), about: $('st-about').value.trim(),
          phone: $('st-phone').value.trim(), email: $('st-email').value.trim(),
          address: $('st-address').value.trim(), hours: $('st-hours').value.trim() },
        rides: rides, cars: cars, drivers: drivers };
      var blob = new Blob([JSON.stringify(next, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'data.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
  }

  /* ---------- page sign-in ---------- */
  /* This page is an admin tool, so the folder pass guards the whole page,
     not just Setup: with no pass set it opens freely; with a pass set it
     asks for that folder's username + password (set in Admin) and unlocks
     for this browser session only. The password itself is never sent to
     the page: the database only answers yes/no. */
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
  function openApp() {
    $('tabs').hidden = false;
    $('view-gate').hidden = true;
    showTab('dashboard');
  }
  function checkGate() {
    if (setupUnlocked()) { openApp(); return; }
    var el = $('view-gate');
    el.innerHTML = '<div class="card"><p class="hint">Checking…</p></div>';
    rpc('folder_pass_status', { p_folder: SLUG }).then(function (status) {
      if (status === 'open') { openApp(); return; }
      el.innerHTML = '<h2>Sign in</h2><div class="card">' +
        '<p>This admin panel is protected. Enter the username and password set by the admin for this folder.</p>' +
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
            openApp();
          } else {
            out.innerHTML = '<p class="error">Wrong username or password.</p>';
          }
        }).catch(function () {
          out.innerHTML = '<p class="error">Could not reach the sign-in check. Please try again in a moment.</p>';
        });
      });
    }).catch(function () {
      el.innerHTML = '<div class="card"><p class="error">Could not reach the sign-in check. Please try again in a moment.</p></div>';
    });
  }

  /* ---------- init ---------- */
  Array.prototype.forEach.call($('tabs').children, function (btn) {
    btn.addEventListener('click', function () { showTab(btn.getAttribute('data-tab')); });
  });
  $('back-link').addEventListener('click', function (e) {
    e.preventDefault();
    showTab('dashboard');
  });
  $('view-dashboard').addEventListener('click', function (e) {
    var del = e.target.getAttribute && e.target.getAttribute('data-del-ride');
    if (del) {
      if (!window.confirm('Delete this ride?')) return;
      rides = rides.filter(function (r) { return String(r.id) !== del; });
      save();
      renderDashboardRowsOnly();
    }
  });
  $('view-dashboard').addEventListener('change', function (e) {
    var sid = e.target.getAttribute && e.target.getAttribute('data-status-ride');
    if (sid) {
      var r = rides.filter(function (x) { return String(x.id) === sid; })[0];
      if (r) { r.status = e.target.value; save(); renderDashboardRowsOnly(); }
    }
  });
  $('view-cars').addEventListener('click', function (e) {
    var edit = e.target.getAttribute && e.target.getAttribute('data-edit-car');
    var del = e.target.getAttribute && e.target.getAttribute('data-del-car');
    if (edit) { editCarId = Number(edit); renderCars(); }
    else if (del) {
      if (!window.confirm('Delete this car?')) return;
      cars = cars.filter(function (c) { return String(c.id) !== del; });
      editCarId = null;
      save();
      renderCars();
    }
  });
  $('view-drivers').addEventListener('click', function (e) {
    var edit = e.target.getAttribute && e.target.getAttribute('data-edit-driver');
    var del = e.target.getAttribute && e.target.getAttribute('data-del-driver');
    if (edit) { editDriverId = Number(edit); renderDrivers(); }
    else if (del) {
      if (!window.confirm('Delete this driver?')) return;
      drivers = drivers.filter(function (d) { return String(d.id) !== del; });
      editDriverId = null;
      save();
      renderDrivers();
    }
  });
  fetch(BASE + 'data.json')
    .then(function (res) { if (!res.ok) throw new Error('data.json not found'); return res.json(); })
    .then(function (json) {
      data = json;
      data.business = data.business || {};
      var stored = loadStored();
      if (stored) {
        rides = stored.rides; cars = stored.cars; drivers = stored.drivers;
      } else {
        rides = (data.rides || []).slice();
        cars = (data.cars || []).slice();
        drivers = (data.drivers || []).slice();
      }
      renderHeader();
      checkGate();
    })
    .catch(function () {
      $('view-gate').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one (see the README in this folder) and reload the page.</div>';
    });
})();
