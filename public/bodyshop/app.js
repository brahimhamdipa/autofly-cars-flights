/* Bodyshop page app — ONE folder for every bodyshop.
   The shop comes from the link (?b=<slug>), and its info, jobs,
   estimates, customers, and loan cars live in the database — there is
   no data.json file here.
   Visitors see the public Request Estimate form: anyone with the link
   can ask for an estimate, and the shop sees it in Estimates. The
   working tabs (Jobs, Estimates, Customers, Loan Cars) need the
   shop's shared employee password (one password for all staff, set
   by the admin; shops with none set stay fully open). Setup needs
   the owner's own username + password. Setup edits save as a draft,
   and the Upload button sends the draft to the admin for approval —
   approval makes it live instantly. All credentials live in memory
   only: a reload asks again, exactly like the diner, barbershop,
   and POS pages. The workflow is estimate, then job, then invoice:
   an accepted estimate raises a job here, and a finished job is
   marked Invoiced. No payment is taken online: a job marked
   Invoiced is a record, not a payment. Deletes never use the
   native confirm() popup (it silently does nothing in some
   browsers) — clicking Delete asks in the page itself, exactly
   like the POS void/delete flow. */
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
  var SLUG = String(params.b || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var shop = null; // live shop info (visitors)
  var shopData = null; // { jobs, estimates, customers, loancars } (staff)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var ownerCreds = null; // {u, p} in memory only, never stored
  var empPass = null; // employee password in memory only, never stored
  var empUnlocked = false; // true once the employee password is entered, or when the shop has none set
  var passLocked = false;
  var currentView = 'request';
  var jobsTimer = null;
  var jobsSearch = '';
  var jobsStatus = 'All';
  var jobsErr = ''; // last jobs error, shown inline above the jobs table
  var editCustomerId = null; // customer being edited, null = adding
  var delJobId = null; // job id awaiting an in-page delete confirmation
  var delEstId = null; // estimate id awaiting an in-page delete confirmation
  var delCustId = null; // customer id awaiting an in-page delete confirmation
  var delCarId = null; // loan car id awaiting an in-page delete confirmation
  var estStatus = ''; // last estimate action, shown above the estimates table

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* Thousands separators, no trailing .00: $1,800 / $1,800.50. */
  function money(n) {
    var v = Number(n || 0);
    var neg = v < 0;
    var s = Math.abs(v).toFixed(2).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-$' : '$') + s[0] + (s[1] === '00' ? '' : '.' + s[1]);
  }
  function rpc(name, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (res) {
      /* Some calls (save/upload/delete) return no body at all — read text
         first and only parse when there is something to parse, so an
         empty success reply is not mistaken for a failure. */
      return res.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!res.ok) throw new Error((j && j.message) || 'request failed');
        return j;
      });
    });
  }
  /* Best-effort owner email via the shared send-notification function.
     A failed email never fails the action it belongs to. */
  function notifyEmail(subject, table, record) {
    try {
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ subject: subject, table: table, record: record })
      }).catch(function () {});
    } catch (e) {}
  }
  /* Rows come back snake_case from the database — accept camelCase too,
     so a future shape change does not break the page. */
  function normJob(j) {
    return { id: j.id, number: j.number || '', customer: j.customer || '', vehicle: j.vehicle || '',
      insurer: j.insurer || '', estimateNumber: j.estimate_number || j.estimateNumber || '',
      total: Number(j.total) || 0, status: j.status || 'In progress' };
  }
  function normEstimate(e) {
    return { id: e.id, number: e.number || '', customer: e.customer || '', vehicle: e.vehicle || '',
      parts: Number(e.parts) || 0, labour: Number(e.labour) || 0,
      status: e.status || 'Pending', note: e.note || '' };
  }
  function normCustomer(c) {
    return { id: c.id, name: c.name || '', phone: c.phone || '', email: c.email || '',
      vehicle: c.vehicle || '', insurer: c.insurer || '' };
  }
  function normLoanCar(c) {
    return { id: c.id, number: c.number || '', vehicle: c.vehicle || '',
      status: c.status || 'Available', jobNumber: c.job_number || c.jobNumber || '' };
  }
  function loadData(quiet) {
    return rpc('list_bodyshop_data', { p_slug: SLUG, p_epass: empPass }).then(function (d) {
      d = d || {};
      shopData = {
        jobs: (d.jobs || []).map(normJob),
        estimates: (d.estimates || []).map(normEstimate),
        customers: (d.customers || []).map(normCustomer),
        loancars: (d.loancars || []).map(normLoanCar)
      };
      return shopData;
    }).catch(function (e) { if (!quiet) throw e; });
  }

  /* ---------- views ---------- */
  function show(view) {
    currentView = view;
    if (jobsTimer) { clearInterval(jobsTimer); jobsTimer = null; }
    ['request', 'jobs', 'estimates', 'customers', 'loancars', 'setup'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.hidden = v !== view;
    });
    var tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    if (view === 'request') renderRequest();
    if (view === 'jobs') {
      renderJobs();
      jobsTimer = setInterval(function () {
        if (currentView === 'jobs' && empUnlocked) {
          loadData(true).then(function () { if (currentView === 'jobs') renderJobsRows(); });
        }
      }, 5000);
    }
    if (view === 'estimates') renderEstimates();
    if (view === 'customers') renderCustomers();
    if (view === 'loancars') renderLoanCars();
    if (view === 'setup') renderSetup();
    window.scrollTo(0, 0);
  }

  function setHeader() {
    $('site-name').textContent = shop ? shop.name : 'Bodyshop';
    $('site-about').textContent = shop ? (shop.about || '') : '';
    $('site-footer').innerHTML = shop
      ? esc([shop.address, shop.phone].filter(Boolean).join(' · ')) + '<br>Powered by AutoFly'
      : 'Powered by AutoFly';
    document.title = (shop ? shop.name : 'Bodyshop') + ' — Bodyshop';
  }

  /* ---------- employee gate (working tabs) ---------- */
  function empGate(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the employee password for this shop to open the working tabs.</p>' +
      '<label>Employee password</label><input id="emp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="emp-go">Unlock</button></div>' +
      '<p class="error" id="emp-err" hidden></p></div>';
    $('emp-go').addEventListener('click', function () {
      var pw = $('emp-pass').value;
      rpc('check_bodyshop_employee_pass', { p_slug: SLUG, p_password: pw }).then(function (ok) {
        if (!ok) {
          var e = $('emp-err');
          e.hidden = false;
          e.textContent = 'Wrong employee password.';
          return;
        }
        empPass = pw;
        empUnlocked = true;
        after();
      }).catch(function (err) {
        var e = $('emp-err');
        e.hidden = false;
        e.textContent = 'Error: ' + err.message;
      });
    });
  }

  /* ---------- Request Estimate (public) ---------- */
  function renderRequest() {
    var el = $('view-request');
    if (!shop) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var h = '<h2>Request an estimate — ' + esc(shop.name) + '</h2>';
    var bits = [];
    if (shop.address) bits.push(esc(shop.address));
    if (shop.phone) bits.push(esc(shop.phone));
    if (shop.hours) bits.push(esc(shop.hours));
    if (bits.length) h += '<div class="card info">' + bits.join('<br>') + '</div>';
    h += '<div class="card"><p class="info">Tell us about the damage and we will come back with an estimate. No account needed.</p>' +
      '<label>Name</label><input id="req-name" type="text">' +
      '<label>Phone</label><input id="req-phone" type="tel">' +
      '<label>Email (optional)</label><input id="req-email" type="email">' +
      '<label>Vehicle</label><input id="req-vehicle" type="text" placeholder="Toyota Corolla 2021">' +
      '<label>Insurer (optional)</label><input id="req-insurer" type="text">' +
      '<label>Damage / notes (optional)</label><textarea id="req-note"></textarea>' +
      '<div class="row"><button id="req-send">Request estimate</button></div>' +
      '<p class="error" id="req-err" hidden></p>' +
      '<div id="req-out" style="margin-top:12px"></div></div>';
    el.innerHTML = h;
    $('req-send').addEventListener('click', submitEstimate);
  }
  function submitEstimate() {
    var err = $('req-err');
    var name = $('req-name').value.trim();
    var phone = $('req-phone').value.trim();
    var vehicle = $('req-vehicle').value.trim();
    if (!name || !phone || !vehicle) {
      err.hidden = false;
      err.textContent = 'Name, phone, and vehicle are required.';
      return;
    }
    err.hidden = true;
    var email = $('req-email').value.trim();
    var insurer = $('req-insurer').value.trim();
    var note = $('req-note').value.trim();
    rpc('place_bodyshop_estimate', {
      p_slug: SLUG, p_name: name, p_phone: phone, p_vehicle: vehicle,
      p_email: email, p_insurer: insurer, p_note: note
    }).then(function (res) {
      /* The call returns the new estimate's id; its number is EST-<id>. */
      var id = res;
      if (res && typeof res === 'object') id = res.id || res.estimate_id || res.number || '';
      var num = 'EST-' + String(id == null ? '' : id).replace(/^EST-/i, '');
      $('req-out').innerHTML = '<p class="note">✓ Requested — estimate #' + esc(num) + ': ' + esc(vehicle) + ' for ' + esc(name) + '. The shop will be in touch.</p>';
      notifyEmail('Bodyshop estimate: ' + vehicle + ' (' + name + ')', 'bodyshop_estimate',
        { slug: SLUG, name: name, phone: phone, email: email, vehicle: vehicle, insurer: insurer, note: note });
      ['req-name', 'req-phone', 'req-email', 'req-vehicle', 'req-insurer', 'req-note'].forEach(function (id2) { $(id2).value = ''; });
    }).catch(function (e) {
      err.hidden = false;
      err.textContent = 'Error: ' + e.message;
    });
  }

  /* ---------- Jobs (employee password, polls every 5s) ---------- */
  function jobStatusOptions(selected) {
    return ['In progress', 'Completed', 'Invoiced'].map(function (s) {
      return '<option' + (s === selected ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
  }
  function filteredJobs() {
    return (shopData.jobs || []).filter(function (j) {
      if (jobsStatus !== 'All' && j.status !== jobsStatus) return false;
      var q = jobsSearch.trim().toLowerCase();
      if (q && String(j.number).toLowerCase().indexOf(q) === -1 &&
        String(j.customer).toLowerCase().indexOf(q) === -1 &&
        String(j.vehicle).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }
  function renderJobs() {
    var el = $('view-jobs');
    if (!shop) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Jobs', renderJobs); return; }
    if (!shopData) {
      el.innerHTML = '<h2>Jobs — ' + esc(shop.name) + '</h2><p class="info">Loading…</p>';
      loadData().then(function () { if (currentView === 'jobs') renderJobs(); })
        .catch(function (e) { el.innerHTML = '<h2>Jobs</h2><p class="error">Error: ' + esc(e.message) + '</p>'; });
      return;
    }
    el.innerHTML = '<h2>Jobs — ' + esc(shop.name) + '</h2>' +
      '<div class="note">The workflow is estimate, then job, then invoice: an accepted estimate becomes a job here, and a finished job is marked Invoiced. The list refreshes on its own every few seconds.</div>' +
      '<div id="jobs-msg"></div>' +
      '<label>Search jobs</label><input id="jobs-search" type="text" value="' + esc(jobsSearch) + '" placeholder="Job number, customer, or vehicle…">' +
      '<label>Status</label><select id="jobs-status"><option' + (jobsStatus === 'All' ? ' selected' : '') + '>All</option>' + jobStatusOptions(jobsStatus) + '</select>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Job no.</th><th>Customer</th><th>Vehicle</th><th>Insurer</th><th>Estimate no.</th><th>Total</th><th>Status</th><th></th></tr></thead>' +
      '<tbody id="jobs-rows"></tbody></table></div>' +
      '<div class="card"><h3>Add a job</h3>' +
      '<label>Customer</label><input id="job-customer" type="text">' +
      '<label>Vehicle</label><input id="job-vehicle" type="text">' +
      '<label>Insurer</label><input id="job-insurer" type="text">' +
      '<label>Estimate no. (optional)</label><input id="job-estimate" type="text" placeholder="EST-101">' +
      '<label>Total ($)</label><input id="job-total" type="number" min="0" step="0.01" inputmode="decimal">' +
      '<label>Status</label><select id="job-status">' + jobStatusOptions('In progress') + '</select>' +
      '<div class="row"><button id="job-add">Add job</button></div>' +
      '<p class="error" id="job-err" hidden></p></div>';
    renderJobsRows();
    $('jobs-search').addEventListener('input', function (e) { jobsSearch = e.target.value; renderJobsRows(); });
    $('jobs-status').addEventListener('change', function (e) { jobsStatus = e.target.value; renderJobsRows(); });
    $('job-add').addEventListener('click', addJob);
  }
  function renderJobsRows() {
    var tb = $('jobs-rows');
    if (!tb) return;
    var msg = $('jobs-msg');
    if (msg) msg.innerHTML = jobsErr ? '<p class="error">' + esc(jobsErr) + '</p>' : '';
    var rows = filteredJobs().map(function (j) {
      return '<tr><td>' + esc(j.number) + '</td><td>' + esc(j.customer) + '</td><td>' + esc(j.vehicle) + '</td>' +
        '<td>' + esc(j.insurer) + '</td><td>' + esc(j.estimateNumber) + '</td><td>' + money(j.total) + '</td>' +
        '<td><select data-status-job="' + j.id + '">' + jobStatusOptions(j.status) + '</select></td>' +
        '<td>' + (delJobId === j.id
          ? '<span><b>Delete "' + esc(j.number) + '"?</b> <button class="small danger" data-del-job-yes="' + j.id + '">Yes, delete</button> <button class="small secondary" data-del-job-no="' + j.id + '">Keep it</button></span>'
          : '<button class="small danger" data-del-job="' + j.id + '">Delete</button>') + '</td></tr>';
    }).join('');
    tb.innerHTML = rows || '<tr><td colspan="8">No jobs match.</td></tr>';
    tb.querySelectorAll('[data-status-job]').forEach(function (sel) {
      sel.addEventListener('change', function (e) {
        var s = e.target;
        var id = Number(s.getAttribute('data-status-job'));
        rpc('update_bodyshop_job_status', { p_slug: SLUG, p_epass: empPass, p_job_id: id, p_status: s.value })
          .then(function () { jobsErr = ''; return loadData(true); })
          .then(function () { renderJobsRows(); })
          .catch(function (err) { jobsErr = 'Error: ' + err.message; renderJobsRows(); });
      });
    });
    tb.querySelectorAll('[data-del-job]').forEach(function (b) {
      b.addEventListener('click', function () {
        delJobId = Number(b.getAttribute('data-del-job'));
        jobsErr = '';
        renderJobsRows();
      });
    });
    tb.querySelectorAll('[data-del-job-no]').forEach(function (b) {
      b.addEventListener('click', function () { delJobId = null; renderJobsRows(); });
    });
    tb.querySelectorAll('[data-del-job-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.getAttribute('data-del-job-yes'));
        b.disabled = true;
        rpc('delete_bodyshop_job', { p_slug: SLUG, p_epass: empPass, p_job_id: id })
          .then(function () { delJobId = null; return loadData(true); })
          .then(function () { renderJobs(); })
          .catch(function (e) { delJobId = null; jobsErr = 'Error: ' + e.message; renderJobsRows(); });
      });
    });
  }
  function addJob() {
    var err = $('job-err');
    var customer = $('job-customer').value.trim();
    var vehicle = $('job-vehicle').value.trim();
    if (!customer || !vehicle) {
      err.hidden = false;
      err.textContent = 'Customer and vehicle are required.';
      return;
    }
    err.hidden = true;
    var job = { customer: customer, vehicle: vehicle, insurer: $('job-insurer').value.trim(),
      estimate_number: $('job-estimate').value.trim(),
      total: parseFloat($('job-total').value) || 0, status: $('job-status').value };
    rpc('save_bodyshop_job', { p_slug: SLUG, p_epass: empPass, p_job: job })
      .then(function () { return loadData(true); })
      .then(function () { renderJobs(); })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }

  /* ---------- Estimates (employee password) ---------- */
  function renderEstimates() {
    var el = $('view-estimates');
    if (!shop) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Estimates', renderEstimates); return; }
    if (!shopData) {
      el.innerHTML = '<h2>Estimates — ' + esc(shop.name) + '</h2><p class="info">Loading…</p>';
      loadData().then(function () { if (currentView === 'estimates') renderEstimates(); })
        .catch(function (e) { el.innerHTML = '<h2>Estimates</h2><p class="error">Error: ' + esc(e.message) + '</p>'; });
      return;
    }
    var rows = (shopData.estimates || []).map(function (e) {
      var total = (Number(e.parts) || 0) + (Number(e.labour) || 0);
      var actions = e.status === 'Pending'
        ? '<button class="small" data-accept="' + e.id + '">Accept</button> <button class="small secondary" data-decline="' + e.id + '">Decline</button> ' : '';
      return '<tr><td>' + esc(e.number) + '</td><td>' + esc(e.customer) + '</td><td>' + esc(e.vehicle) + '</td>' +
        '<td>' + money(e.parts) + '</td><td>' + money(e.labour) + '</td><td>' + money(total) + '</td>' +
        '<td>' + esc(e.status) + '</td><td>' + esc(e.note) + '</td>' +
        '<td>' + actions + (delEstId === e.id
          ? '<span><b>Delete "' + esc(e.number) + '"?</b> <button class="small danger" data-del-est-yes="' + e.id + '">Yes, delete</button> <button class="small secondary" data-del-est-no="' + e.id + '">Keep it</button></span>'
          : '<button class="small danger" data-del-est="' + e.id + '">Delete</button>') + '</td></tr>';
    }).join('');
    el.innerHTML = '<h2>Estimates — ' + esc(shop.name) + '</h2>' +
      '<div class="note">Accepting a pending estimate marks it Accepted and raises a job for it on the Jobs tab. Declining closes it without a job. Staff can also add an estimate below — a customer asking in person, or one that came in by phone.</div>' +
      (estStatus ? '<p class="info" id="est-status">' + esc(estStatus) + '</p>' : '') +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Estimate no.</th><th>Customer</th><th>Vehicle</th><th>Parts</th><th>Labour</th><th>Total</th><th>Status</th><th>Note</th><th></th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="9">No estimates yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h3>Add an estimate</h3>' +
      '<label>Customer</label><input id="est-customer" type="text">' +
      '<label>Vehicle</label><input id="est-vehicle" type="text">' +
      '<label>Parts ($)</label><input id="est-parts" type="number" min="0" step="0.01" inputmode="decimal">' +
      '<label>Labour ($)</label><input id="est-labour" type="number" min="0" step="0.01" inputmode="decimal">' +
      '<label>Note</label><input id="est-note" type="text">' +
      '<div class="row"><button id="est-add">Add estimate</button></div>' +
      '<p class="error" id="est-err" hidden></p></div>';
    el.querySelectorAll('[data-accept]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.getAttribute('data-accept'));
        b.disabled = true;
        rpc('accept_bodyshop_estimate', { p_slug: SLUG, p_epass: empPass, p_estimate_id: id })
          .then(function (res) {
            /* The call returns the new job's id; its number is JOB-<id>. */
            var jobNo = null;
            if (typeof res === 'number') jobNo = 'JOB-' + res;
            else if (typeof res === 'string') jobNo = /^JOB-/i.test(res) ? res : 'JOB-' + res;
            else if (res && typeof res === 'object') jobNo = res.job_number || res.number || (res.id != null ? 'JOB-' + res.id : null);
            estStatus = jobNo ? 'Accepted — raised job ' + jobNo + '.' : 'Accepted — the job is on the Jobs tab.';
            return loadData(true);
          })
          .then(function () { renderEstimates(); })
          .catch(function (e) { estStatus = 'Error: ' + e.message; renderEstimates(); });
      });
    });
    el.querySelectorAll('[data-decline]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.getAttribute('data-decline'));
        b.disabled = true;
        rpc('update_bodyshop_estimate_status', { p_slug: SLUG, p_epass: empPass, p_estimate_id: id, p_status: 'Declined' })
          .then(function () { estStatus = 'Declined — no job raised.'; return loadData(true); })
          .then(function () { renderEstimates(); })
          .catch(function (e) { estStatus = 'Error: ' + e.message; renderEstimates(); });
      });
    });
    el.querySelectorAll('[data-del-est]').forEach(function (b) {
      b.addEventListener('click', function () {
        delEstId = Number(b.getAttribute('data-del-est'));
        renderEstimates();
      });
    });
    el.querySelectorAll('[data-del-est-no]').forEach(function (b) {
      b.addEventListener('click', function () { delEstId = null; renderEstimates(); });
    });
    el.querySelectorAll('[data-del-est-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.getAttribute('data-del-est-yes'));
        b.disabled = true;
        rpc('delete_bodyshop_estimate', { p_slug: SLUG, p_epass: empPass, p_estimate_id: id })
          .then(function () { delEstId = null; estStatus = ''; return loadData(true); })
          .then(function () { renderEstimates(); })
          .catch(function (e) { delEstId = null; estStatus = 'Error: ' + e.message; renderEstimates(); });
      });
    });
    $('est-add').addEventListener('click', function () {
      var err = $('est-err');
      var customer = $('est-customer').value.trim();
      var vehicle = $('est-vehicle').value.trim();
      if (!customer || !vehicle) {
        err.hidden = false;
        err.textContent = 'Customer and vehicle are required.';
        return;
      }
      err.hidden = true;
      var rec = { customer: customer, vehicle: vehicle,
        parts: parseFloat($('est-parts').value) || 0,
        labour: parseFloat($('est-labour').value) || 0,
        status: 'Pending', note: $('est-note').value.trim() };
      rpc('save_bodyshop_estimate', { p_slug: SLUG, p_epass: empPass, p_estimate: rec })
        .then(function () { estStatus = ''; return loadData(true); })
        .then(function () { renderEstimates(); })
        .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
    });
  }

  /* ---------- Customers (employee password) ---------- */
  function renderCustomers() {
    var el = $('view-customers');
    if (!shop) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Customers', renderCustomers); return; }
    if (!shopData) {
      el.innerHTML = '<h2>Customers — ' + esc(shop.name) + '</h2><p class="info">Loading…</p>';
      loadData().then(function () { if (currentView === 'customers') renderCustomers(); })
        .catch(function (e) { el.innerHTML = '<h2>Customers</h2><p class="error">Error: ' + esc(e.message) + '</p>'; });
      return;
    }
    var editing = (shopData.customers || []).filter(function (c) { return c.id === editCustomerId; })[0];
    var rows = (shopData.customers || []).map(function (c, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(c.name) + '</td><td>' + esc(c.phone) + '</td>' +
        '<td>' + esc(c.email) + '</td><td>' + esc(c.vehicle) + '</td><td>' + esc(c.insurer) + '</td>' +
        '<td><button class="small secondary" data-edit-cust="' + c.id + '">Edit</button></td>' +
        '<td>' + (delCustId === c.id
          ? '<span><b>Delete "' + esc(c.name) + '"?</b> <button class="small danger" data-del-cust-yes="' + c.id + '">Yes, delete</button> <button class="small secondary" data-del-cust-no="' + c.id + '">Keep it</button></span>'
          : '<button class="small danger" data-del-cust="' + c.id + '">Delete</button>') + '</td></tr>';
    }).join('');
    el.innerHTML = '<h2>Customers — ' + esc(shop.name) + '</h2>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>No.</th><th>Name</th><th>Phone</th><th>Email</th><th>Vehicle</th><th>Insurer</th><th></th><th></th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="8">No customers yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h3>' + (editing ? 'Edit customer' : 'Add a customer') + '</h3>' +
      '<label>Name</label><input id="cust-name" type="text" value="' + esc(editing ? editing.name : '') + '">' +
      '<label>Phone</label><input id="cust-phone" type="tel" value="' + esc(editing ? editing.phone : '') + '">' +
      '<label>Email</label><input id="cust-email" type="email" value="' + esc(editing ? editing.email : '') + '">' +
      '<label>Vehicle</label><input id="cust-vehicle" type="text" value="' + esc(editing ? editing.vehicle : '') + '">' +
      '<label>Insurer</label><input id="cust-insurer" type="text" value="' + esc(editing ? editing.insurer : '') + '">' +
      '<div class="row"><button id="cust-save">' + (editing ? 'Save changes' : 'Add customer') + '</button>' +
      (editing ? '<button id="cust-cancel" class="secondary">Cancel</button>' : '') + '</div>' +
      '<p class="error" id="cust-err" hidden></p></div>';
    el.querySelectorAll('[data-edit-cust]').forEach(function (b) {
      b.addEventListener('click', function () {
        editCustomerId = Number(b.getAttribute('data-edit-cust'));
        renderCustomers();
      });
    });
    el.querySelectorAll('[data-del-cust]').forEach(function (b) {
      b.addEventListener('click', function () {
        delCustId = Number(b.getAttribute('data-del-cust'));
        renderCustomers();
      });
    });
    el.querySelectorAll('[data-del-cust-no]').forEach(function (b) {
      b.addEventListener('click', function () { delCustId = null; renderCustomers(); });
    });
    el.querySelectorAll('[data-del-cust-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.getAttribute('data-del-cust-yes'));
        b.disabled = true;
        rpc('delete_bodyshop_customer', { p_slug: SLUG, p_epass: empPass, p_customer_id: id })
          .then(function () {
            delCustId = null;
            if (editCustomerId === id) editCustomerId = null;
            return loadData(true);
          })
          .then(function () { renderCustomers(); })
          .catch(function (e) {
            delCustId = null;
            var er = $('cust-err');
            if (er) { er.hidden = false; er.textContent = 'Error: ' + e.message; }
            renderCustomers();
          });
      });
    });
    $('cust-save').addEventListener('click', function () {
      var err = $('cust-err');
      var name = $('cust-name').value.trim();
      if (!name) {
        err.hidden = false;
        err.textContent = 'Customer name is required.';
        return;
      }
      err.hidden = true;
      var rec = { name: name, phone: $('cust-phone').value.trim(), email: $('cust-email').value.trim(),
        vehicle: $('cust-vehicle').value.trim(), insurer: $('cust-insurer').value.trim() };
      if (editCustomerId) rec.id = editCustomerId;
      rpc('save_bodyshop_customer', { p_slug: SLUG, p_epass: empPass, p_customer: rec })
        .then(function () { editCustomerId = null; return loadData(true); })
        .then(function () { renderCustomers(); })
        .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
    });
    if (editing) $('cust-cancel').addEventListener('click', function () { editCustomerId = null; renderCustomers(); });
  }

  /* ---------- Loan Cars (employee password) ---------- */
  function loanStatusOptions(selected) {
    return ['Available', 'On loan'].map(function (s) {
      return '<option' + (s === selected ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
  }
  function renderLoanCars() {
    var el = $('view-loancars');
    if (!shop) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Loan Cars', renderLoanCars); return; }
    if (!shopData) {
      el.innerHTML = '<h2>Loan Cars — ' + esc(shop.name) + '</h2><p class="info">Loading…</p>';
      loadData().then(function () { if (currentView === 'loancars') renderLoanCars(); })
        .catch(function (e) { el.innerHTML = '<h2>Loan Cars</h2><p class="error">Error: ' + esc(e.message) + '</p>'; });
      return;
    }
    var rows = (shopData.loancars || []).map(function (c) {
      return '<tr><td>' + esc(c.number) + '</td><td>' + esc(c.vehicle) + '</td>' +
        '<td><select data-loan-status="' + c.id + '">' + loanStatusOptions(c.status) + '</select></td>' +
        '<td><input type="text" data-loan-job="' + c.id + '" value="' + esc(c.jobNumber) + '" placeholder="JOB-201"></td>' +
        '<td><button class="small" data-loan-update="' + c.id + '">Update</button> ' +
        (delCarId === c.id
          ? '<span><b>Delete "' + esc(c.number) + '"?</b> <button class="small danger" data-del-car-yes="' + c.id + '">Yes, delete</button> <button class="small secondary" data-del-car-no="' + c.id + '">Keep it</button></span>'
          : '<button class="small danger" data-del-car="' + c.id + '">Delete</button>') + '</td></tr>';
    }).join('');
    el.innerHTML = '<h2>Loan Cars — ' + esc(shop.name) + '</h2>' +
      '<div class="note">Cars lent to customers while their own car is in the shop. Change the status and job number in the row, then tap Update — setting a car back to Available clears its job.</div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Car number</th><th>Vehicle</th><th>Status</th><th>Job</th><th></th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="5">No loan cars yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h3>Add a loan car</h3>' +
      '<label>Car number</label><input id="loan-new-number" type="text">' +
      '<label>Vehicle</label><input id="loan-new-vehicle" type="text">' +
      '<div class="row"><button id="loan-add">Add loan car</button></div>' +
      '<p class="error" id="car-err" hidden></p></div>';
    el.querySelectorAll('[data-loan-update]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.getAttribute('data-loan-update'));
        var sel = el.querySelector('[data-loan-status="' + id + '"]');
        var inp = el.querySelector('[data-loan-job="' + id + '"]');
        var status = sel ? sel.value : 'Available';
        var jobNo = status === 'On loan' ? (inp ? inp.value.trim() : '') : '';
        b.disabled = true;
        rpc('update_bodyshop_loancar_status', { p_slug: SLUG, p_epass: empPass, p_car_id: id, p_status: status, p_job_number: jobNo })
          .then(function () { return loadData(true); })
          .then(function () { renderLoanCars(); })
          .catch(function (e) {
            b.disabled = false;
            var er = $('car-err');
            if (er) { er.hidden = false; er.textContent = 'Error: ' + e.message; }
          });
      });
    });
    el.querySelectorAll('[data-del-car]').forEach(function (b) {
      b.addEventListener('click', function () {
        delCarId = Number(b.getAttribute('data-del-car'));
        renderLoanCars();
      });
    });
    el.querySelectorAll('[data-del-car-no]').forEach(function (b) {
      b.addEventListener('click', function () { delCarId = null; renderLoanCars(); });
    });
    el.querySelectorAll('[data-del-car-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.getAttribute('data-del-car-yes'));
        b.disabled = true;
        rpc('delete_bodyshop_loancar', { p_slug: SLUG, p_epass: empPass, p_car_id: id })
          .then(function () { delCarId = null; return loadData(true); })
          .then(function () { renderLoanCars(); })
          .catch(function (e) {
            delCarId = null;
            var er = $('car-err');
            if (er) { er.hidden = false; er.textContent = 'Error: ' + e.message; }
            renderLoanCars();
          });
      });
    });
    $('loan-add').addEventListener('click', function () {
      var err = $('car-err');
      var number = $('loan-new-number').value.trim();
      var vehicle = $('loan-new-vehicle').value.trim();
      if (!number || !vehicle) {
        err.hidden = false;
        err.textContent = 'Car number and vehicle are required.';
        return;
      }
      err.hidden = true;
      rpc('save_bodyshop_loancar', { p_slug: SLUG, p_epass: empPass, p_car: { number: number, vehicle: vehicle } })
        .then(function () { return loadData(true); })
        .then(function () { renderLoanCars(); })
        .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
    });
  }

  /* ---------- Setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    if (!shop) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (!ownerCreds) {
      el.innerHTML = '<h2>Setup</h2><div class="card">' +
        '<p class="info">Enter the username and password AutoFly gave this shop.</p>' +
        '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
        '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
        '<div class="row"><button id="st-go">Log in</button></div>' +
        '<p class="error" id="st-err" hidden></p></div>';
      $('st-go').addEventListener('click', function () {
        var u = $('st-user').value.trim();
        var p = $('st-pass').value;
        rpc('check_bodyshop_login', { p_slug: SLUG, p_u: u, p_p: p }).then(function (ok) {
          if (!ok) {
            var e = $('st-err');
            e.hidden = false;
            e.textContent = 'Wrong username or password.';
            return;
          }
          ownerCreds = { u: u, p: p };
          loadDraft();
        }).catch(function (err) {
          var e = $('st-err');
          e.hidden = false;
          e.textContent = 'Error: ' + err.message;
        });
      });
      return;
    }
    if (!draft) {
      el.innerHTML = '<p class="info">Loading your setup…</p>';
      loadDraft();
      return;
    }
    el.innerHTML = '<h2>Setup — ' + esc(shop.name) + '</h2>' +
      '<div class="card"><h3>Business details</h3>' +
      '<p class="info">Changes save as a draft. Upload for approval and the admin makes them live.</p>' +
      '<label>Business name</label><input id="d-name" type="text" value="' + esc(draft.name || '') + '">' +
      '<label>About</label><textarea id="d-about">' + esc(draft.about || '') + '</textarea>' +
      '<label>Address</label><input id="d-address" type="text" value="' + esc(draft.address || '') + '">' +
      '<label>Phone</label><input id="d-phone" type="tel" value="' + esc(draft.phone || '') + '">' +
      '<label>Hours</label><input id="d-hours" type="text" value="' + esc(draft.hours || '') + '">' +
      '<div class="row"><button id="d-save">Save draft</button>' +
      '<button id="d-upload" class="secondary">Upload for approval</button></div>' +
      '<p class="info" id="d-status">Draft status: ' + esc(draftStatus) + (draftStatus === 'pending' ? ' — waiting for AutoFly to approve it.' : draftStatus === 'approved' ? ' — approved, live now.' : ' — not sent yet.') + '</p>' +
      '<p class="error" id="d-err" hidden></p></div>';
    $('d-save').addEventListener('click', function () { saveDraft(false); });
    $('d-upload').addEventListener('click', function () { saveDraft(true); });
  }
  function collectDraft() {
    return {
      name: $('d-name').value.trim(),
      about: $('d-about').value,
      address: $('d-address').value.trim(),
      phone: $('d-phone').value.trim(),
      hours: $('d-hours').value.trim()
    };
  }
  function saveDraft(upload) {
    var d = collectDraft();
    var err = $('d-err');
    if (!d.name) {
      err.hidden = false;
      err.textContent = 'Business name is required.';
      return;
    }
    err.hidden = true;
    rpc('save_bodyshop_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_draft: d })
      .then(function () {
        draft = d;
        draftStatus = 'editing';
        if (!upload) {
          $('d-status').textContent = 'Draft status: editing — saved, not sent yet.';
          return;
        }
        return rpc('submit_bodyshop_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p }).then(function () {
          draftStatus = 'pending';
          $('d-status').textContent = 'Draft status: pending — waiting for AutoFly to approve it.';
          notifyEmail('Bodyshop draft for approval: ' + d.name, 'bodyshop_draft', { slug: SLUG, name: d.name });
        });
      })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function loadDraft() {
    rpc('get_bodyshop_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p })
      .then(function (d) {
        /* The call returns { draft, live, status }; the draft falls back
           to the live details so Setup always has something to edit. */
        if (d && d.draft) {
          draft = d.draft || {};
          draftStatus = d.status || 'editing';
        } else {
          draft = d || {};
          draftStatus = 'editing';
        }
        renderSetup();
      })
      .catch(function (e) {
        var el = $('view-setup');
        el.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
      });
  }

  /* ---------- start ---------- */
  document.querySelectorAll('#tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () { show(btn.getAttribute('data-view')); });
  });
  /* Black ↑ Top pill at the bottom-left, exactly like the shop pages:
     always visible, tap it to jump back to the top. */
  var toTop = $('to-top');
  if (toTop) {
    toTop.addEventListener('click', function () { window.scrollTo(0, 0); });
  }
  function init() {
    if (!SLUG) {
      $('site-name').textContent = 'Bodyshop';
      $('view-request').innerHTML = '<div class="card"><h2>Shop not found</h2><p class="info">This bodyshop page needs a shop link like autofly.us.com/bodyshop?b=your-shop.</p></div>';
      return;
    }
    rpc('get_bodyshop_live', { p_slug: SLUG }).then(function (d) {
      if (!d || !d.name) {
        $('site-name').textContent = 'Bodyshop';
        $('view-request').innerHTML = '<div class="card"><h2>Shop not found</h2><p class="info">No bodyshop with this link yet. Ask AutoFly to set it up.</p></div>';
        return;
      }
      shop = d;
      setHeader();
      return rpc('bodyshop_pass_status', { p_slug: SLUG }).then(function (st) {
        passLocked = st === 'locked';
        empUnlocked = !passLocked;
        renderRequest();
      }).catch(function () {
        /* If the status check itself is unreachable, stay open rather
           than locking everyone out of a working shop. */
        empUnlocked = true;
        renderRequest();
      });
    }).catch(function (e) {
      $('view-request').innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  init();
})();
