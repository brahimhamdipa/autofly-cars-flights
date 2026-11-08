/* Bodyshop template app — job management for a car body repair shop.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Content lives in
   data.json. Jobs, estimates, customers, and loan cars edited here are
   saved in this browser only; Setup's Download data.json exports the
   current state, and the owner replaces the folder's file with it to make
   changes permanent for everyone. This page is a business tool, so the
   whole page — not just Setup — asks for the folder's sign-in once the
   admin has set one for this folder. The password itself is never sent
   to the page: the database only answers yes/no. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'bodyshop')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var DATA_KEY = 'bodyshop-data-v2-' + SLUG;
  var SETUP_KEY = 'folder-pass-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the database rules allow. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null;
  var jobs = [], estimates = [], customers = [], loancars = [];
  var jobsSearch = '', jobsStatus = 'All';
  var editCustomerId = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n).toFixed(2).replace(/\.00$/, ''); }
  function loadStored() {
    try {
      var s = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
      if (s && Array.isArray(s.jobs) && Array.isArray(s.estimates) && Array.isArray(s.customers) && Array.isArray(s.loancars)) return s;
    } catch (e) {}
    return null;
  }
  function save() {
    try { localStorage.setItem(DATA_KEY, JSON.stringify({ jobs: jobs, estimates: estimates, customers: customers, loancars: loancars })); } catch (e) {}
  }
  function nextId(list) {
    return list.reduce(function (m, x) { return Math.max(m, x.id || 0); }, 0) + 1;
  }
  function nextNumber(list, prefix) {
    var max = 0;
    list.forEach(function (x) {
      var m = String(x.number || '').match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return prefix + '-' + (max + 1);
  }
  function jobStatusOptions(selected) {
    return ['In progress', 'Completed', 'Invoiced'].map(function (s) {
      return '<option' + (s === selected ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
  }
  function customerByName(name) {
    return customers.filter(function (c) { return c.name === name; })[0] || null;
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    ['jobs', 'estimates', 'customers', 'loancars', 'setup'].forEach(function (t) {
      $('view-' + t).hidden = (t !== name);
    });
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.className = (b.getAttribute('data-tab') === name) ? 'active' : '';
    });
    if (name === 'jobs') renderJobs();
    if (name === 'estimates') renderEstimates();
    if (name === 'customers') renderCustomers();
    if (name === 'loancars') renderLoanCars();
    if (name === 'setup') renderSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var b = data.business || {};
    document.title = b.name || 'Bodyshop';
    $('biz-name').textContent = b.name || 'Bodyshop';
    $('biz-about').textContent = b.about || '';
    var parts = [];
    if (b.phone) parts.push('Phone: ' + esc(b.phone));
    if (b.email) parts.push('Email: <a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>');
    if (b.address) parts.push(esc(b.address));
    if (b.hours) parts.push(esc(b.hours));
    $('biz-meta').innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  /* ---------- jobs ---------- */
  function jobsRowsHTML() {
    var list = jobs.filter(function (j) {
      if (jobsStatus !== 'All' && j.status !== jobsStatus) return false;
      var q = jobsSearch.trim().toLowerCase();
      if (q && (String(j.number).toLowerCase().indexOf(q) === -1 &&
        String(j.customer).toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    return list.map(function (j) {
      return '<tr><td>' + esc(j.number) + '</td><td>' + esc(j.customer) + '</td><td>' + esc(j.vehicle) + '</td>' +
        '<td>' + esc(j.insurer) + '</td><td>' + esc(j.estimateNumber) + '</td><td>' + money(j.total) + '</td>' +
        '<td><select data-status-job="' + j.id + '">' + jobStatusOptions(j.status) + '</select></td>' +
        '<td><button class="danger" data-del-job="' + j.id + '">Delete</button></td></tr>';
    }).join('') || '<tr><td colspan="8">No jobs match.</td></tr>';
  }
  function renderJobs() {
    var el = $('view-jobs');
    var custOpts = customers.map(function (c) {
      return '<option>' + esc(c.name) + '</option>';
    }).join('');
    el.innerHTML = '<h2>Jobs</h2>' +
      '<div class="note">The workflow is estimate, then job, then invoice: an accepted estimate becomes a job here, and a finished job is marked Invoiced. Edits here are saved in this browser — export them from Setup to make them permanent.</div>' +
      '<label>Search jobs</label><input id="jobs-search" type="text" value="' + esc(jobsSearch) + '" placeholder="Job number or customer…">' +
      '<label>Status</label><select id="jobs-status"><option' + (jobsStatus === 'All' ? ' selected' : '') + '>All</option>' + jobStatusOptions(jobsStatus) + '</select>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Job no.</th><th>Customer</th><th>Vehicle</th><th>Insurer</th><th>Estimate no.</th><th>Total</th><th>Status</th><th></th></tr></thead>' +
      '<tbody id="jobs-rows">' + jobsRowsHTML() + '</tbody></table></div>' +
      '<div class="card"><h3>Add a job</h3>' +
      '<label>Customer</label><select id="job-customer">' + custOpts + '</select>' +
      '<label>Vehicle</label><input id="job-vehicle">' +
      '<label>Insurer</label><input id="job-insurer">' +
      '<label>Estimate no. (optional)</label><input id="job-estimate" placeholder="EST-101">' +
      '<label>Total ($)</label><input id="job-total" type="number" min="0" step="0.01">' +
      '<label>Status</label><select id="job-status">' + jobStatusOptions('In progress') + '</select>' +
      '<div class="row"><button id="job-add">Add job</button></div></div>';
    $('jobs-search').addEventListener('input', function (e) { jobsSearch = e.target.value; $('jobs-rows').innerHTML = jobsRowsHTML(); });
    $('jobs-status').addEventListener('change', function (e) { jobsStatus = e.target.value; $('jobs-rows').innerHTML = jobsRowsHTML(); });
    $('job-add').addEventListener('click', function () {
      var customer = $('job-customer').value;
      if (!customer) return;
      jobs.unshift({ id: nextId(jobs), number: nextNumber(jobs, 'JOB'), customer: customer,
        vehicle: $('job-vehicle').value.trim(), insurer: $('job-insurer').value.trim(),
        estimateNumber: $('job-estimate').value.trim(),
        total: parseFloat($('job-total').value) || 0, status: $('job-status').value });
      save();
      renderJobs();
    });
  }

  /* ---------- estimates ---------- */
  function renderEstimates() {
    var el = $('view-estimates');
    var custOpts = customers.map(function (c) {
      return '<option>' + esc(c.name) + '</option>';
    }).join('');
    var rows = estimates.map(function (e) {
      var total = (Number(e.parts) || 0) + (Number(e.labour) || 0);
      var actions = e.status === 'Pending'
        ? '<button data-accept="' + e.id + '">Accept</button><button data-decline="' + e.id + '">Decline</button>' : '';
      return '<tr><td>' + esc(e.number) + '</td><td>' + esc(e.customer) + '</td><td>' + esc(e.vehicle) + '</td>' +
        '<td>' + money(e.parts) + '</td><td>' + money(e.labour) + '</td><td>' + money(total) + '</td>' +
        '<td>' + esc(e.status) + '</td><td>' + esc(e.note) + '</td>' +
        '<td>' + actions + '<button class="danger" data-del-est="' + e.id + '">Delete</button></td></tr>';
    }).join('');
    el.innerHTML = '<h2>Estimates</h2>' +
      '<div class="note">Accepting an estimate marks it Accepted and raises a job for it on the Jobs tab. Declining closes it without a job.</div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Estimate no.</th><th>Customer</th><th>Vehicle</th><th>Parts</th><th>Labour</th><th>Total</th><th>Status</th><th>Note</th><th></th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="9">No estimates yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h3>Add an estimate</h3>' +
      '<label>Customer</label><select id="est-customer">' + custOpts + '</select>' +
      '<label>Vehicle</label><input id="est-vehicle">' +
      '<label>Parts ($)</label><input id="est-parts" type="number" min="0" step="0.01">' +
      '<label>Labour ($)</label><input id="est-labour" type="number" min="0" step="0.01">' +
      '<label>Note</label><input id="est-note">' +
      '<div class="row"><button id="est-add">Add estimate</button></div></div>';
    $('est-add').addEventListener('click', function () {
      var customer = $('est-customer').value;
      if (!customer) return;
      estimates.unshift({ id: nextId(estimates), number: nextNumber(estimates, 'EST'), customer: customer,
        vehicle: $('est-vehicle').value.trim(), parts: parseFloat($('est-parts').value) || 0,
        labour: parseFloat($('est-labour').value) || 0, status: 'Pending', note: $('est-note').value.trim() });
      save();
      renderEstimates();
    });
  }
  function acceptEstimate(e) {
    e.status = 'Accepted';
    var already = jobs.some(function (j) { return j.estimateNumber === e.number; });
    if (!already) {
      var cust = customerByName(e.customer);
      jobs.unshift({ id: nextId(jobs), number: nextNumber(jobs, 'JOB'), customer: e.customer,
        vehicle: e.vehicle, insurer: cust ? cust.insurer : '', estimateNumber: e.number,
        total: (Number(e.parts) || 0) + (Number(e.labour) || 0), status: 'In progress' });
    }
    save();
    renderEstimates();
  }

  /* ---------- customers ---------- */
  function renderCustomers() {
    var el = $('view-customers');
    var editing = customers.filter(function (c) { return c.id === editCustomerId; })[0];
    var rows = customers.map(function (c, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(c.name) + '</td><td>' + esc(c.phone) + '</td>' +
        '<td>' + esc(c.email) + '</td><td>' + esc(c.vehicle) + '</td><td>' + esc(c.insurer) + '</td>' +
        '<td><button data-edit-cust="' + c.id + '">Edit</button></td>' +
        '<td><button class="danger" data-del-cust="' + c.id + '">Delete</button></td></tr>';
    }).join('');
    el.innerHTML = '<h2>Customers</h2>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>No.</th><th>Name</th><th>Phone</th><th>Email</th><th>Vehicle</th><th>Insurer</th><th></th><th></th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="8">No customers yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h3>' + (editing ? 'Edit customer' : 'Add a customer') + '</h3>' +
      '<label>Name</label><input id="cust-name" value="' + esc(editing ? editing.name : '') + '">' +
      '<label>Phone</label><input id="cust-phone" type="tel" value="' + esc(editing ? editing.phone : '') + '">' +
      '<label>Email</label><input id="cust-email" type="email" value="' + esc(editing ? editing.email : '') + '">' +
      '<label>Vehicle</label><input id="cust-vehicle" value="' + esc(editing ? editing.vehicle : '') + '">' +
      '<label>Insurer</label><input id="cust-insurer" value="' + esc(editing ? editing.insurer : '') + '">' +
      '<div class="row"><button id="cust-save">' + (editing ? 'Save changes' : 'Add customer') + '</button>' +
      (editing ? '<button id="cust-cancel">Cancel</button>' : '') + '</div></div>';
    $('cust-save').addEventListener('click', function () {
      var name = $('cust-name').value.trim();
      if (!name) return;
      var rec = { name: name, phone: $('cust-phone').value.trim(), email: $('cust-email').value.trim(),
        vehicle: $('cust-vehicle').value.trim(), insurer: $('cust-insurer').value.trim() };
      if (editing) {
        Object.keys(rec).forEach(function (k) { editing[k] = rec[k]; });
      } else {
        rec.id = nextId(customers);
        customers.push(rec);
      }
      editCustomerId = null;
      save();
      renderCustomers();
    });
    if (editing) $('cust-cancel').addEventListener('click', function () { editCustomerId = null; renderCustomers(); });
  }

  /* ---------- loan cars ---------- */
  function renderLoanCars() {
    var el = $('view-loancars');
    var rows = loancars.map(function (c) {
      return '<tr><td>' + esc(c.number) + '</td><td>' + esc(c.vehicle) + '</td>' +
        '<td>' + esc(c.status) + '</td><td>' + esc(c.jobNumber) + '</td>' +
        '<td>' + (c.status === 'On loan' ? '<button data-return-car="' + c.id + '">Return</button>' : '') +
        '<button class="danger" data-del-car="' + c.id + '">Delete</button></td></tr>';
    }).join('');
    var availOpts = loancars.filter(function (c) { return c.status === 'Available'; }).map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.number) + ' — ' + esc(c.vehicle) + '</option>';
    }).join('');
    var jobOpts = jobs.filter(function (j) { return j.status === 'In progress'; }).map(function (j) {
      return '<option value="' + j.number + '">' + esc(j.number) + ' — ' + esc(j.customer) + '</option>';
    }).join('');
    el.innerHTML = '<h2>Loan Cars</h2>' +
      '<div class="note">Cars lent to customers while their own car is in the shop. Book one out against an in-progress job, and return it when the job is done.</div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Car number</th><th>Vehicle</th><th>Status</th><th>Job</th><th></th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="5">No loan cars yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h3>Book out a loan car</h3>' +
      '<label>Car</label><select id="loan-car">' + availOpts + '</select>' +
      '<label>Job</label><select id="loan-job">' + jobOpts + '</select>' +
      '<div class="row"><button id="loan-book">Book out</button></div></div>' +
      '<div class="card"><h3>Add a loan car</h3>' +
      '<label>Car number</label><input id="loan-new-number">' +
      '<label>Vehicle</label><input id="loan-new-vehicle">' +
      '<div class="row"><button id="loan-add">Add loan car</button></div></div>';
    $('loan-book').addEventListener('click', function () {
      var car = loancars.filter(function (c) { return String(c.id) === $('loan-car').value; })[0];
      var jobNumber = $('loan-job').value;
      if (!car || !jobNumber) return;
      car.status = 'On loan';
      car.jobNumber = jobNumber;
      save();
      renderLoanCars();
    });
    $('loan-add').addEventListener('click', function () {
      var number = $('loan-new-number').value.trim();
      if (!number) return;
      loancars.push({ id: nextId(loancars), number: number, vehicle: $('loan-new-vehicle').value.trim(),
        status: 'Available', jobNumber: '' });
      save();
      renderLoanCars();
    });
  }

  /* ---------- setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    var b = data.business || {};
    function field(label, id, value, type) {
      return '<label>' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '">';
    }
    el.innerHTML = '<h2>Setup</h2>' +
      '<div class="note">Jobs, estimates, customers, and loan cars edited on their tabs are saved in this browser only. ' +
      'Press “Download data.json” to export everything — business details plus the current jobs, estimates, customers, and loan cars — ' +
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
        jobs: jobs, estimates: estimates, customers: customers, loancars: loancars };
      var blob = new Blob([JSON.stringify(next, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'data.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
  }

  /* ---------- page sign-in ---------- */
  /* This page is a business tool, so the folder pass guards the whole page,
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
    showTab('jobs');
  }
  function checkGate() {
    if (setupUnlocked()) { openApp(); return; }
    var el = $('view-gate');
    el.innerHTML = '<div class="card"><p class="hint">Checking…</p></div>';
    rpc('folder_pass_status', { p_folder: SLUG }).then(function (status) {
      if (status === 'open') { openApp(); return; }
      el.innerHTML = '<h2>Sign in</h2><div class="card">' +
        '<p>This bodyshop panel is protected. Enter the username and password set by the admin for this folder.</p>' +
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
    showTab('jobs');
  });
  $('view-jobs').addEventListener('click', function (e) {
    var del = e.target.getAttribute && e.target.getAttribute('data-del-job');
    if (del) {
      if (!window.confirm('Delete this job?')) return;
      jobs = jobs.filter(function (j) { return String(j.id) !== del; });
      save();
      renderJobs();
    }
  });
  $('view-jobs').addEventListener('change', function (e) {
    var sid = e.target.getAttribute && e.target.getAttribute('data-status-job');
    if (sid) {
      var j = jobs.filter(function (x) { return String(x.id) === sid; })[0];
      if (j) { j.status = e.target.value; save(); $('jobs-rows').innerHTML = jobsRowsHTML(); }
    }
  });
  $('view-estimates').addEventListener('click', function (e) {
    var acc = e.target.getAttribute && e.target.getAttribute('data-accept');
    var dec = e.target.getAttribute && e.target.getAttribute('data-decline');
    var del = e.target.getAttribute && e.target.getAttribute('data-del-est');
    if (acc) {
      var ae = estimates.filter(function (x) { return String(x.id) === acc; })[0];
      if (ae) acceptEstimate(ae);
    } else if (dec) {
      var de = estimates.filter(function (x) { return String(x.id) === dec; })[0];
      if (de) { de.status = 'Declined'; save(); renderEstimates(); }
    } else if (del) {
      if (!window.confirm('Delete this estimate?')) return;
      estimates = estimates.filter(function (x) { return String(x.id) !== del; });
      save();
      renderEstimates();
    }
  });
  $('view-customers').addEventListener('click', function (e) {
    var edit = e.target.getAttribute && e.target.getAttribute('data-edit-cust');
    var del = e.target.getAttribute && e.target.getAttribute('data-del-cust');
    if (edit) { editCustomerId = Number(edit); renderCustomers(); }
    else if (del) {
      if (!window.confirm('Delete this customer?')) return;
      customers = customers.filter(function (c) { return String(c.id) !== del; });
      editCustomerId = null;
      save();
      renderCustomers();
    }
  });
  $('view-loancars').addEventListener('click', function (e) {
    var ret = e.target.getAttribute && e.target.getAttribute('data-return-car');
    var del = e.target.getAttribute && e.target.getAttribute('data-del-car');
    if (ret) {
      var car = loancars.filter(function (c) { return String(c.id) === ret; })[0];
      if (car) { car.status = 'Available'; car.jobNumber = ''; save(); renderLoanCars(); }
    } else if (del) {
      if (!window.confirm('Delete this loan car?')) return;
      loancars = loancars.filter(function (c) { return String(c.id) !== del; });
      save();
      renderLoanCars();
    }
  });
  fetch(BASE + 'data.json')
    .then(function (res) { if (!res.ok) throw new Error('data.json not found'); return res.json(); })
    .then(function (json) {
      data = json;
      data.business = data.business || {};
      var stored = loadStored();
      if (stored) {
        jobs = stored.jobs; estimates = stored.estimates; customers = stored.customers; loancars = stored.loancars;
      } else {
        jobs = (data.jobs || []).slice();
        estimates = (data.estimates || []).slice();
        customers = (data.customers || []).slice();
        loancars = (data.loancars || []).slice();
      }
      renderHeader();
      checkGate();
    })
    .catch(function () {
      $('view-gate').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one (see the README in this folder) and reload the page.</div>';
    });
})();
