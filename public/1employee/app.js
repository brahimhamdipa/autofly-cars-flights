/* Employee template app — one folder per business.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Content lives in
   data.json; time records live in this browser only (one key per folder).
   A record is emailed to the business email in Setup (or to AutoFly's
   inbox when that is empty). Setup edits never change the live page by
   themselves: they download a new data.json, and the owner replaces the
   folder's file with it. This page records time entries only — it does
   not calculate pay, and no payroll is handled here. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'employee')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var REC_KEY = 'employee-records-' + SLUG;
  var SETUP_KEY = 'folder-pass-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the database rules allow, and the
     record email goes through AutoFly's notification service. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null;
  var records = loadRecords();
  var logEmployeeId = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function nowTime() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function loadRecords() {
    try { return JSON.parse(localStorage.getItem(REC_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveRecords() {
    try { localStorage.setItem(REC_KEY, JSON.stringify(records)); } catch (e) { /* private mode */ }
  }
  function employeeById(id) {
    return (data.employees || []).filter(function (e) { return String(e.id) === String(id); })[0] || null;
  }

  /* ---------- tabs ---------- */
  function showTab(name) {
    ['employees', 'log', 'records', 'setup'].forEach(function (t) {
      $('view-' + t).hidden = (t !== name);
    });
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.className = (b.getAttribute('data-tab') === name) ? 'active' : '';
    });
    if (name === 'employees') renderEmployees();
    if (name === 'log') renderLog();
    if (name === 'records') renderRecords();
    if (name === 'setup') openSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- header ---------- */
  function renderHeader() {
    var b = data.business || {};
    document.title = b.name || 'Employee';
    $('biz-name').textContent = b.name || 'Employee';
    $('biz-about').textContent = b.about || '';
    var parts = [];
    if (b.phone) parts.push('Phone: ' + esc(b.phone));
    if (b.email) parts.push('Email: <a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>');
    if (b.address) parts.push(esc(b.address));
    if (b.hours) parts.push(esc(b.hours));
    $('biz-meta').innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  /* ---------- employees ---------- */
  function renderEmployees() {
    var el = $('view-employees');
    var list = data.employees || [];
    if (!list.length) { el.innerHTML = '<div class="card"><p>No employees listed yet. The owner adds them in Setup.</p></div>'; return; }
    el.innerHTML = '<h2>Employees</h2>' + list.map(function (e) {
      return '<div class="card"><span class="badge">' + esc(e.code || '') + '</span>' +
        '<h3>' + esc(e.name) + '</h3>' +
        '<p>' + esc(e.job || '') + '</p>' +
        (e.note ? '<p>' + esc(e.note) + '</p>' : '') +
        '<button data-log="' + e.id + '">Log time</button></div>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('[data-log]'), function (btn) {
      btn.addEventListener('click', function () {
        logEmployeeId = btn.getAttribute('data-log');
        showTab('log');
      });
    });
  }

  /* ---------- log time ---------- */
  function renderLog() {
    var el = $('view-log');
    var empOpts = (data.employees || []).map(function (e) {
      return '<option value="' + e.id + '"' + (String(logEmployeeId) === String(e.id) ? ' selected' : '') + '>' +
        esc(e.name) + ' (' + esc(e.code || '') + ')</option>';
    }).join('');
    var jobOpts = (data.jobs || []).map(function (j) {
      return '<option value="' + esc(j) + '">' + esc(j) + '</option>';
    }).join('');
    el.innerHTML = '<h2>Log time</h2><div class="card">' +
      '<div class="note">Record a clock-in for an employee and a job. The record is saved on this device and a copy is emailed to the business.</div>' +
      '<label>Employee</label><select id="lg-emp">' + empOpts + '</select>' +
      '<label>Job</label><select id="lg-job">' + jobOpts + '</select>' +
      '<label>Date</label><input id="lg-date" type="date" value="' + todayStr() + '">' +
      '<label>Time</label><input id="lg-time" type="time" value="' + nowTime() + '">' +
      '<label>Note (optional)</label><textarea id="lg-note" rows="3"></textarea>' +
      '<div class="row"><button id="lg-submit">Save record</button></div>' +
      '<div id="lg-out" style="margin-top:12px"></div></div>';
    $('lg-submit').addEventListener('click', function () {
      var emp = employeeById($('lg-emp').value);
      var job = $('lg-job').value;
      var date = $('lg-date').value;
      var time = $('lg-time').value;
      var note = $('lg-note').value.trim();
      var out = $('lg-out');
      if (!emp || !job || !date || !time) {
        out.innerHTML = '<p class="error">Please pick an employee and a job, and fill in the date and time.</p>';
        return;
      }
      var rec = { id: Date.now(), employeeId: emp.id, employeeName: emp.name,
        employeeCode: emp.code, job: job, date: date, time: time, note: note,
        status: 'upcoming', createdAt: new Date().toISOString() };
      records.unshift(rec);
      saveRecords();
      var ref = 'TM-' + String(rec.id).slice(-6);
      var to = (data.business && data.business.email) || '';
      out.innerHTML = '<div class="receipt"><h3>Record saved</h3>' +
        '<p><strong>Reference:</strong> ' + ref + '<br>' +
        '<strong>Employee:</strong> ' + esc(emp.name) + ' (' + esc(emp.code || '') + ')<br>' +
        '<strong>Job:</strong> ' + esc(job) + '<br>' +
        '<strong>When:</strong> ' + esc(date) + ' at ' + esc(time) + '</p>' +
        '<p class="hint">Find this record any time in the Records tab.</p>' +
        '<p id="lg-mail" class="hint">Sending the business a copy…</p></div>';
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ to: to || undefined, subject: 'Employee time record: ' + emp.name,
          table: 'employee_time',
          record: { reference: ref, employee: emp.name, code: emp.code, job: job,
            date: date, time: time, note: note } })
      }).then(function (res) {
        if (!res.ok) throw new Error('send failed');
        var m = $('lg-mail');
        if (m) m.textContent = 'A copy was emailed to the business.';
      }).catch(function () {
        var m = $('lg-mail');
        if (m) m.textContent = 'The email copy did not go through — your record is still saved here. ' +
          (to ? 'You can also reach the business at ' + to + '.' : 'Please tell the business directly.');
      });
    });
  }

  /* ---------- records (this device) ---------- */
  function renderRecords() {
    var el = $('view-records');
    el.innerHTML = '<h2>Records</h2>' +
      '<div class="note">Records made on this device only. A record made on another phone does not appear here.</div>';
    if (!records.length) { el.innerHTML += '<div class="card"><p>No records yet.</p></div>'; return; }
    el.innerHTML += records.map(function (r) {
      var actions = r.status === 'upcoming'
        ? '<div class="row"><button class="secondary" data-done="' + r.id + '">Mark done</button>' +
          '<button class="danger" data-cancel="' + r.id + '">Cancel</button></div>' : '';
      return '<div class="card"><span class="badge">' + esc(r.status) + '</span>' +
        '<h3>' + esc(r.employeeName) + ' — ' + esc(r.job) + '</h3>' +
        '<p>' + esc(r.date) + ' at ' + esc(r.time) + ' &nbsp;·&nbsp; ' + esc(r.employeeCode || '') +
        (r.note ? '<br>Note: ' + esc(r.note) : '') + '</p>' + actions + '</div>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('[data-done]'), function (btn) {
      btn.addEventListener('click', function () {
        var rec = records.filter(function (r) { return String(r.id) === btn.getAttribute('data-done'); })[0];
        if (rec) rec.status = 'done';
        saveRecords(); renderRecords();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-cancel]'), function (btn) {
      btn.addEventListener('click', function () {
        records = records.filter(function (r) { return String(r.id) !== btn.getAttribute('data-cancel'); });
        saveRecords(); renderRecords();
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
    var jobOpts = function (sel) {
      return (data.jobs || []).map(function (j) {
        return '<option value="' + esc(j) + '"' + (j === sel ? ' selected' : '') + '>' + esc(j) + '</option>';
      }).join('');
    };
    var empHtml = (data.employees || []).map(function (e, i) {
      return '<div class="card" data-emp="' + i + '">' +
        '<label>Employee code</label><input class="em-code" value="' + esc(e.code || '') + '">' +
        '<label>Employee name</label><input class="em-name" value="' + esc(e.name) + '">' +
        '<label>Job</label><select class="em-job">' + jobOpts(e.job || '') + '</select>' +
        '<label>Note</label><textarea class="em-note" rows="2">' + esc(e.note || '') + '</textarea>' +
        '<div class="row"><button class="danger em-del">Delete employee</button></div></div>';
    }).join('');
    var jobHtml = (data.jobs || []).map(function (j, i) {
      return '<div class="card" data-job="' + i + '">' +
        '<label>Job title</label><input class="jb-title" value="' + esc(j) + '">' +
        '<div class="row"><button class="danger jb-del">Delete job</button></div></div>';
    }).join('');
    el.innerHTML = '<h2>Setup</h2>' +
      '<div class="note">Edit the business here, then press “Download data.json”. ' +
      'To put the changes live, replace the <strong>data.json</strong> file inside this folder with the downloaded file, then reload the page. ' +
      'Nothing on this tab changes the live page by itself — and that is on purpose, so visitors cannot change your team.</div>' +
      '<div class="card"><h3>Business details</h3>' +
      field('Business name', 'st-name', b.name) +
      field('About', 'st-about', b.about) +
      field('Phone', 'st-phone', b.phone, 'tel') +
      field('Email (record copies go here; empty = Yently inbox)', 'st-email', b.email, 'email') +
      field('Address', 'st-address', b.address) +
      field('Hours', 'st-hours', b.hours) + '</div>' +
      '<h3>Employees</h3>' + empHtml +
      '<div class="card"><h3>Add an employee</h3>' +
      '<label>Employee code</label><input id="em-new-code">' +
      '<label>Employee name</label><input id="em-new-name">' +
      '<label>Job</label><select id="em-new-job">' + jobOpts('') + '</select>' +
      '<label>Note</label><textarea id="em-new-note" rows="2"></textarea>' +
      '<div class="row"><button id="em-add">Add employee</button></div></div>' +
      '<h3>Jobs</h3>' + jobHtml +
      '<div class="card"><h3>Add a job</h3>' +
      '<label>Job title</label><input id="jb-new-title">' +
      '<div class="row"><button id="jb-add">Add job</button></div></div>' +
      '<div class="row"><button id="setup-download">Download data.json</button></div>';
    Array.prototype.forEach.call(el.querySelectorAll('.em-del'), function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('[data-emp]');
        data.employees.splice(Number(card.getAttribute('data-emp')), 1);
        renderSetup();
      });
    });
    Array.prototype.forEach.call(el.querySelectorAll('.jb-del'), function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('[data-job]');
        data.jobs.splice(Number(card.getAttribute('data-job')), 1);
        renderSetup();
      });
    });
    $('em-add').addEventListener('click', function () {
      var name = $('em-new-name').value.trim();
      if (!name) return;
      var maxId = (data.employees || []).reduce(function (m, e) { return Math.max(m, e.id || 0); }, 0);
      data.employees.push({ id: maxId + 1, code: $('em-new-code').value.trim(),
        name: name, job: $('em-new-job').value, note: $('em-new-note').value.trim() });
      renderSetup();
    });
    $('jb-add').addEventListener('click', function () {
      var title = $('jb-new-title').value.trim();
      if (!title) return;
      if ((data.jobs || []).indexOf(title) === -1) data.jobs.push(title);
      renderSetup();
    });
    $('setup-download').addEventListener('click', function () {
      var next = { business: { name: $('st-name').value.trim(), about: $('st-about').value.trim(),
          phone: $('st-phone').value.trim(), email: $('st-email').value.trim(),
          address: $('st-address').value.trim(), hours: $('st-hours').value.trim() },
        employees: [], jobs: [] };
      Array.prototype.forEach.call(el.querySelectorAll('[data-emp]'), function (card, i) {
        next.employees.push({ id: (data.employees[i] && data.employees[i].id) || (i + 1),
          code: card.querySelector('.em-code').value.trim(),
          name: card.querySelector('.em-name').value.trim(),
          job: card.querySelector('.em-job').value,
          note: card.querySelector('.em-note').value.trim() });
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-job]'), function (card) {
        var t = card.querySelector('.jb-title').value.trim();
        if (t) next.jobs.push(t);
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
    showTab('employees');
  });
  fetch(BASE + 'data.json')
    .then(function (res) { if (!res.ok) throw new Error('data.json not found'); return res.json(); })
    .then(function (json) {
      data = json;
      data.business = data.business || {};
      data.employees = data.employees || [];
      data.jobs = data.jobs || [];
      renderHeader();
      showTab('employees');
    })
    .catch(function () {
      $('view-employees').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one (see the README in this folder) and reload the page.</div>';
    });
})();
