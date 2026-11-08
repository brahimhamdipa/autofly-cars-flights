/* Employee time-tracking page app — ONE folder for every business.
   The business comes from the link (?e=<slug>), and its info, staff,
   jobs, and time logs live in the database — there is no data.json file
   here. Every business has its own staff and time logs, but they all
   use this same page. Visitors see the public staff list (Employees
   tab). Logging time and viewing the records need the business's
   shared employee password (one password for all staff, set by the
   admin; businesses with none set stay fully open). Setup needs the
   owner's own username + password. Setup edits save as a draft, and
   the Upload button sends the draft to the admin for approval —
   approval makes it live instantly. Staff are different: the owner
   adds, edits, and deletes staff live in Setup, no approval needed.
   All credentials live in memory only: a reload asks again, exactly
   like the diner, barbershop, and POS pages.
   This page records time entries only — it does not calculate pay,
   and no payroll is handled here. */
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
  var SLUG = String(params.e || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var biz = null; // live business info + staff (visitors)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var ownerCreds = null; // {u, p} in memory only, never stored
  var empPass = null; // employee password in memory only, never stored
  var empUnlocked = false; // true once the employee password is entered, or when the business has none set
  var passLocked = false;
  var records = [];
  var currentView = 'employees';
  var recordsTimer = null;
  var logEmployeeCode = null; // staff code preselected in Log Time, from an Employees card
  var delConfirmId = null; // record id awaiting an in-page delete confirmation
  var delErr = ''; // last records delete error, shown inline above the list
  var staffEditId = null; // staff id being edited in Setup, null = adding
  var staffDelConfirmId = null; // staff id awaiting an in-page delete confirmation

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
  function parseHM(t) {
    var p = String(t || '').split(':');
    if (p.length < 2) return null;
    var h = Number(p[0]), m = Number(p[1]);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }
  function hoursBetween(cin, cout) {
    var a = parseHM(cin), b = parseHM(cout);
    if (a == null || b == null) return null;
    var diff = b - a;
    if (diff < 0) diff += 1440; // a clock-out earlier than clock-in wraps past midnight
    return diff / 60;
  }
  function fmtHours(n) { return Number(n).toFixed(1); }
  function fmtDT(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function rpc(name, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (res) {
      /* Some calls (save/upload/delete) return no body at all — read text
         first and only parse when there is something to parse, so an empty
         success reply is not mistaken for a failure. */
      return res.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!res.ok) throw new Error((j && j.message) || 'request failed');
        return j;
      });
    });
  }
  function notifyEmail(subject, table, record) {
    try {
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ subject: subject, table: table, record: record })
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
  function staffByCode(code) {
    return (biz.staff || []).filter(function (s) { return String(s.code) === String(code); })[0] || null;
  }
  function staffById(id) {
    return (biz.staff || []).filter(function (s) { return String(s.id) === String(id); })[0] || null;
  }
  function loadBiz() {
    return rpc('get_employee_live', { p_slug: SLUG }).then(function (d) {
      biz = d;
      setHeader();
      return d;
    });
  }

  /* ---------- views ---------- */
  function show(view) {
    currentView = view;
    ['employees', 'log', 'records', 'setup'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.hidden = v !== view;
    });
    var tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    if (recordsTimer) { clearInterval(recordsTimer); recordsTimer = null; }
    if (view === 'employees') renderEmployees();
    if (view === 'log') renderLog();
    if (view === 'records') { renderRecords(); recordsTimer = setInterval(function () { if (currentView === 'records' && empUnlocked) loadRecords(true); }, 5000); }
    if (view === 'setup') renderSetup();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
  });
  $('to-top').addEventListener('click', function () { window.scrollTo(0, 0); });

  function setHeader() {
    $('site-name').textContent = biz ? biz.name : 'Employee';
    renderHeaderIcon(biz && biz.icon ? biz.icon : '');
    $('site-about').textContent = biz ? (biz.about || '') : '';
    $('site-footer').innerHTML = biz
      ? esc([biz.address, biz.phone].filter(Boolean).join(' · ')) + '<br>Powered by AutoFly'
      : 'Powered by AutoFly';
    document.title = (biz ? biz.name : 'Employee') + ' — Employee Time';
  }

  /* ---------- Employees (public staff list) ---------- */
  function renderEmployees() {
    var el = $('view-employees');
    if (!biz) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var list = biz.staff || [];
    var h = '<h2>Employees — ' + esc(biz.name) + '</h2>';
    if (biz.hours) h += '<p class="info">' + esc(biz.hours) + '</p>';
    if (!list.length) {
      h += '<div class="card"><p class="info">No employees yet — the owner adds staff in Setup.</p></div>';
      el.innerHTML = h;
      return;
    }
    list.forEach(function (s) {
      h += '<div class="card"><span class="code">' + esc(s.code || '') + '</span>' +
        '<h3>' + esc(s.name) + '</h3>' +
        '<p>' + esc(s.job || '') + '</p>' +
        (s.note ? '<p class="info">' + esc(s.note) + '</p>' : '') +
        '<div class="row"><button class="small" data-log="' + esc(s.code || '') + '">Log time</button></div></div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-log]').forEach(function (b) {
      b.addEventListener('click', function () {
        logEmployeeCode = b.getAttribute('data-log');
        show('log');
      });
    });
  }

  /* ---------- Employee password gate (Log Time + Records) ---------- */
  function empGate(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the employee password for this business to continue.</p>' +
      '<label>Employee password</label><input id="emp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="emp-go">Unlock</button></div>' +
      '<p class="error" id="emp-err" hidden></p></div>';
    $('emp-go').addEventListener('click', function () {
      var pw = $('emp-pass').value;
      rpc('check_employee_employee_pass', { p_slug: SLUG, p_password: pw }).then(function (ok) {
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

  /* ---------- Log Time (employee password) ---------- */
  function renderLog() {
    var el = $('view-log');
    if (!biz) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Log Time', renderLog); return; }
    var list = biz.staff || [];
    if (!list.length) {
      el.innerHTML = '<h2>Log Time</h2><div class="card"><p class="info">No employees yet — the owner adds staff in Setup.</p></div>';
      return;
    }
    var opts = list.map(function (s) {
      return '<option value="' + esc(s.code || '') + '"' + (String(logEmployeeCode) === String(s.code) ? ' selected' : '') + '>' +
        esc(s.name) + ' (' + esc(s.code || '') + ')</option>';
    }).join('');
    el.innerHTML = '<h2>Log Time — ' + esc(biz.name) + '</h2><div class="card">' +
      '<p class="info">Record a clock-in (and a clock-out, when the shift ends). The record is shared with the business, and a copy is emailed to AutoFly.</p>' +
      '<label>Employee</label><select id="lg-emp">' + opts + '</select>' +
      '<label>Date</label><input id="lg-date" type="date" value="' + todayStr() + '">' +
      '<label>Clock in</label><input id="lg-in" type="time" value="' + nowTime() + '">' +
      '<label>Clock out (optional)</label><input id="lg-out" type="time">' +
      '<label>Note (optional)</label><textarea id="lg-note" rows="3"></textarea>' +
      '<div class="row"><button id="lg-submit">Log time</button></div>' +
      '<p class="error" id="lg-err" hidden></p>' +
      '<div id="lg-done" style="margin-top:12px"></div></div>';
    $('lg-submit').addEventListener('click', submitLog);
  }
  function submitLog() {
    var err = $('lg-err');
    var code = $('lg-emp').value;
    var emp = staffByCode(code);
    var date = $('lg-date').value;
    var cin = $('lg-in').value;
    var cout = $('lg-out').value;
    var note = $('lg-note').value.trim();
    if (!emp || !date || !cin) {
      err.hidden = false;
      err.textContent = 'Please pick an employee and fill in the date and clock-in time.';
      return;
    }
    err.hidden = true;
    var btn = $('lg-submit');
    btn.disabled = true;
    rpc('place_employee_timelog', { p_slug: SLUG, p_employee_code: code, p_date: date, p_clock_in: cin, p_clock_out: cout || '', p_note: note })
      .then(function (id) {
        btn.disabled = false;
        var hours = cout ? hoursBetween(cin, cout) : null;
        var msg = '✓ Logged — time #TM-' + id + ': ' + emp.name + ' on ' + date + ', ' + cin;
        if (cout) msg += '–' + cout + ' (' + fmtHours(hours) + 'h)';
        msg += '.';
        var done = $('lg-done');
        if (done) done.innerHTML = '<div class="note">' + esc(msg) + '</div>';
        notifyEmail('Employee time: ' + emp.name + ' (' + code + ')', 'employee_time',
          { reference: 'TM-' + id, employee: emp.name, code: code, job: emp.job || '', date: date, clock_in: cin, clock_out: cout || '', hours: hours == null ? null : Number(fmtHours(hours)), note: note });
        $('lg-out').value = '';
        $('lg-note').value = '';
      })
      .catch(function (e) {
        btn.disabled = false;
        err.hidden = false;
        err.textContent = 'Error: ' + e.message;
      });
  }

  /* ---------- Records (employee password, polls every 5s) ---------- */
  function loadRecords(quiet) {
    return rpc('list_employee_records', { p_slug: SLUG, p_epass: empPass }).then(function (d) {
      records = d || [];
      if (currentView === 'records' && delConfirmId === null) renderRecordsList();
      return records;
    }).catch(function (e) { if (!quiet) throw e; });
  }
  function renderRecords() {
    var el = $('view-records');
    if (!biz) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Records', renderRecords); return; }
    el.innerHTML = '<h2>Records — ' + esc(biz.name) + '</h2><div id="records-list"><p class="info">Loading…</p></div>';
    loadRecords().catch(function (e) {
      var l = $('records-list');
      if (l) l.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  function recordHours(r) {
    var d = r.data || {};
    if (d.hours != null && d.hours !== '') return fmtHours(d.hours);
    if (d.clock_out) {
      var h = hoursBetween(d.clock_in, d.clock_out);
      return h == null ? null : fmtHours(h);
    }
    return null;
  }
  function renderRecordsList() {
    var el = $('records-list');
    if (!el) return;
    if (!records.length) { el.innerHTML = '<div class="card"><p class="info">No records yet.</p></div>'; return; }
    var h = '';
    if (delErr) h += '<p class="error">' + esc(delErr) + '</p>';
    records.forEach(function (r) {
      var d = r.data || {};
      var hrs = recordHours(r);
      var when = esc(d.date || '');
      if (d.clock_in) when += (when ? ' · ' : '') + esc(d.clock_in) + (d.clock_out ? '–' + esc(d.clock_out) : '');
      if (hrs != null) when += ' (' + hrs + 'h)';
      h += '<div class="card"><span class="code">' + esc(d.employee_code || '') + '</span>' +
        '<h3>' + esc(d.employee_name || '') + (d.job ? ' — ' + esc(d.job) : '') + '</h3>' +
        '<p class="info">' + when + '</p>' +
        (d.note ? '<p>' + esc(d.note) + '</p>' : '') +
        '<p class="info">' + (r.created_at ? esc(fmtDT(r.created_at)) : '') + (r.status && r.status !== 'active' ? ' · ' + esc(r.status) : '') + '</p>' +
        (delConfirmId === r.id
          ? '<p><b>Delete this record?</b></p><div class="row"><button class="small danger" data-del-yes="' + r.id + '">Yes, delete</button><button class="small secondary" data-del-no="' + r.id + '">Keep it</button></div>'
          : '<button class="small danger" data-del="' + r.id + '">Delete</button>') +
        '</div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        delConfirmId = Number(b.getAttribute('data-del'));
        delErr = '';
        renderRecordsList();
      });
    });
    el.querySelectorAll('[data-del-no]').forEach(function (b) {
      b.addEventListener('click', function () { delConfirmId = null; renderRecordsList(); });
    });
    el.querySelectorAll('[data-del-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.getAttribute('data-del-yes'));
        b.disabled = true;
        rpc('delete_employee_record', { p_slug: SLUG, p_epass: empPass, p_id: id })
          .then(function () { delConfirmId = null; delErr = ''; return loadRecords(); })
          .catch(function (e) { delConfirmId = null; delErr = 'Error: ' + e.message; renderRecordsList(); });
      });
    });
  }

  /* ---------- Setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    if (!biz) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (!ownerCreds) {
      el.innerHTML = '<h2>Setup</h2><div class="card">' +
        '<p class="info">Enter the username and password AutoFly gave this business.</p>' +
        '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
        '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
        '<div class="row"><button id="st-go">Log in</button></div>' +
        '<p class="error" id="st-err" hidden></p></div>';
      $('st-go').addEventListener('click', function () {
        var u = $('st-user').value.trim();
        var p = $('st-pass').value;
        rpc('check_employee_login', { p_slug: SLUG, p_u: u, p_p: p }).then(function (ok) {
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
    var h = '<h2>Setup — ' + esc(biz.name) + '</h2>' +
      '<div class="card"><h3>Business details</h3>' +
      '<p class="info">Changes save as a draft. Upload for approval and the admin makes them live.</p>' +
      '<label>Business name</label><input id="d-name" type="text" value="' + esc(draft.name || '') + '">' +
      '<label>Icon picture</label>' +
      '<div class="icon-field">' +
      '<img id="setup-icon-preview" class="icon-preview" src="' + esc(draft.icon || '') + '" alt=""' + (draft.icon ? '' : ' hidden') + '>' +
      '<input id="setup-icon-file" type="file" accept="image/*">' +
      '<button type="button" id="setup-icon-remove" class="small secondary">Remove icon</button>' +
      '</div>' +
      '<input id="setup-icon-url" type="hidden" value="' + esc(draft.icon || '') + '">' +
      '<p class="info" id="setup-icon-out">One small picture shown next to the business name. It is shrunk to 200px before uploading.</p>' +
      '<label>Address</label><input id="d-address" type="text" value="' + esc(draft.address || '') + '">' +
      '<label>Phone</label><input id="d-phone" type="tel" value="' + esc(draft.phone || '') + '">' +
      '<label>Hours</label><input id="d-hours" type="text" value="' + esc(draft.hours || '') + '">' +
      '<label>About</label><input id="d-about" type="text" value="' + esc(draft.about || '') + '">' +
      '<h3>Jobs</h3><div id="jobs-list"></div>' +
      '<label>New job</label><input id="job-new" type="text" placeholder="Job title">' +
      '<div class="row"><button id="job-add" class="secondary">Add job</button></div>' +
      '<div class="row" style="margin-top:12px"><button id="d-save">Save draft</button>' +
      '<button id="d-upload" class="secondary">Upload for approval</button></div>' +
      '<p class="info" id="d-status">' + esc(draftStatusText()) + '</p>' +
      '<p class="error" id="d-err" hidden></p></div>' +
      '<div class="card"><h3>Staff</h3>' +
      '<p class="info">Staff go live right away — no approval needed.</p>' +
      '<div id="staff-list"></div>' +
      '<h3 id="staff-form-title">Add a staff member</h3>' +
      '<label>Employee code</label><input id="s-code" type="text">' +
      '<label>Name</label><input id="s-name" type="text">' +
      '<label>Job</label><select id="s-job"></select>' +
      '<label>Note</label><textarea id="s-note" rows="2"></textarea>' +
      '<div class="row"><button id="s-save">Save staff member</button>' +
      '<button id="s-cancel" class="secondary" hidden>Cancel edit</button></div>' +
      '<p class="error" id="s-err" hidden></p></div>';
    el.innerHTML = h;
    renderJobsList();
    renderStaffList();
    fillStaffForm();
    $('d-save').addEventListener('click', function () { saveDraft(false); });
    $('d-upload').addEventListener('click', function () { saveDraft(true); });
    $('job-add').addEventListener('click', function () {
      var t = $('job-new').value.trim();
      if (!t) return;
      syncDraftFields();
      draft.jobs = draft.jobs || [];
      if (draft.jobs.indexOf(t) === -1) draft.jobs.push(t);
      renderSetup();
    });
    $('s-save').addEventListener('click', saveStaff);
    $('s-cancel').addEventListener('click', function () { staffEditId = null; renderSetup(); });
    wireIconField();
  }
  function renderJobsList() {
    var el = $('jobs-list');
    if (!el) return;
    var jobs = (draft && draft.jobs) || [];
    if (!jobs.length) { el.innerHTML = '<p class="info">No jobs yet — add one below.</p>'; return; }
    var h = '';
    jobs.forEach(function (j, i) {
      h += '<div class="cart-line"><div><b>' + esc(j) + '</b></div>' +
        '<div class="row"><button class="small danger" data-job-del="' + i + '">Remove</button></div></div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-job-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        syncDraftFields();
        draft.jobs.splice(Number(b.getAttribute('data-job-del')), 1);
        renderSetup();
      });
    });
  }
  function jobOptions(selected) {
    var jobs = (draft && draft.jobs) || [];
    var opts = ['<option value="">—</option>'];
    var seen = {};
    var all = jobs.slice();
    if (selected && all.indexOf(selected) === -1) all.unshift(selected);
    all.forEach(function (j) {
      if (!j || seen[j]) return;
      seen[j] = true;
      opts.push('<option value="' + esc(j) + '"' + (j === selected ? ' selected' : '') + '>' + esc(j) + '</option>');
    });
    return opts.join('');
  }
  function fillStaffForm() {
    var sel = $('s-job');
    if (!sel) return;
    var editing = staffEditId != null ? staffById(staffEditId) : null;
    sel.innerHTML = jobOptions(editing ? editing.job : '');
    if (editing) {
      $('s-code').value = editing.code || '';
      $('s-name').value = editing.name || '';
      sel.value = editing.job || '';
      $('s-note').value = editing.note || '';
      $('staff-form-title').textContent = 'Edit staff member — ' + editing.name;
      $('s-cancel').hidden = false;
    }
  }
  function renderStaffList() {
    var el = $('staff-list');
    if (!el) return;
    var list = (biz && biz.staff) || [];
    if (!list.length) { el.innerHTML = '<p class="info">No staff yet.</p>'; return; }
    var h = '';
    list.forEach(function (s) {
      h += '<div class="cart-line"><div><b>' + esc(s.name) + '</b><br><span class="info">' + esc(s.code || '') + (s.job ? ' · ' + esc(s.job) : '') + (s.note ? ' · ' + esc(s.note) : '') + '</span></div>' +
        '<div class="row"><button class="small secondary" data-edit="' + s.id + '">Edit</button>' +
        (staffDelConfirmId === s.id
          ? '<span><b>Delete "' + esc(s.name) + '"?</b> <button class="small danger" data-sdel-yes="' + s.id + '">Yes, delete</button> <button class="small secondary" data-sdel-no="' + s.id + '">Keep it</button></span>'
          : '<button class="small danger" data-sdel="' + s.id + '">Delete</button>') + '</div></div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        staffEditId = Number(b.getAttribute('data-edit'));
        renderSetup();
        window.scrollTo(0, document.getElementById('staff-form-title').offsetTop - 80);
      });
    });
    el.querySelectorAll('[data-sdel]').forEach(function (b) {
      b.addEventListener('click', function () {
        staffDelConfirmId = Number(b.getAttribute('data-sdel'));
        renderStaffList();
      });
    });
    el.querySelectorAll('[data-sdel-no]').forEach(function (b) {
      b.addEventListener('click', function () { staffDelConfirmId = null; renderStaffList(); });
    });
    el.querySelectorAll('[data-sdel-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = Number(b.getAttribute('data-sdel-yes'));
        b.disabled = true;
        syncDraftFields();
        rpc('delete_employee_staff', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_staff_id: id })
          .then(function () { staffDelConfirmId = null; return loadBiz(); })
          .then(function () { renderSetup(); })
          .catch(function (e) { staffDelConfirmId = null; renderStaffList(); var er = $('s-err'); if (er) { er.hidden = false; er.textContent = 'Error: ' + e.message; } });
      });
    });
  }
  function saveStaff() {
    var err = $('s-err');
    var code = $('s-code').value.trim();
    var name = $('s-name').value.trim();
    var job = $('s-job').value;
    var note = $('s-note').value.trim();
    if (!code) { err.hidden = false; err.textContent = 'Employee code is required.'; return; }
    if (!name) { err.hidden = false; err.textContent = 'Employee name is required.'; return; }
    err.hidden = true;
    var staff = { code: code, name: name, job: job, note: note, is_active: true };
    if (staffEditId != null) staff.id = staffEditId;
    syncDraftFields();
    rpc('save_employee_staff', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_staff: staff })
      .then(function () { staffEditId = null; return loadBiz(); })
      .then(function () { renderSetup(); })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function syncDraftFields() {
    if (!draft || !$('d-name')) return;
    draft.name = $('d-name').value.trim();
    draft.address = $('d-address').value.trim();
    draft.phone = $('d-phone').value.trim();
    draft.hours = $('d-hours').value.trim();
    draft.about = $('d-about').value.trim();
    /* The icon URL lives in a hidden field (set by the upload / Remove
       handlers), read back here like every other Setup field, so the
       icon survives any re-render that syncs the draft. */
    var iconUrl = $('setup-icon-url');
    if (iconUrl) draft.icon = iconUrl.value;
  }
  function collectDraft() {
    syncDraftFields();
    return {
      name: draft.name || '',
      address: draft.address || '',
      phone: draft.phone || '',
      hours: draft.hours || '',
      about: draft.about || '',
      icon: draft.icon || '',
      jobs: (draft.jobs || []).slice()
    };
  }
  function draftStatusText() {
    if (draftStatus === 'pending') return 'Draft status: pending — waiting for AutoFly to approve it.';
    if (draftStatus === 'approved') return 'Draft status: approved — approved, live now.';
    return 'Draft status: editing — saved, not sent yet.';
  }
  function saveDraft(upload) {
    var d = collectDraft();
    var err = $('d-err');
    if (!d.name) { err.hidden = false; err.textContent = 'Business name is required.'; return; }
    err.hidden = true;
    rpc('save_employee_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_draft: d })
      .then(function () {
        draft = d;
        draftStatus = 'editing';
        if (!upload) {
          $('d-status').textContent = draftStatusText();
          return;
        }
        return rpc('submit_employee_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p }).then(function () {
          draftStatus = 'pending';
          $('d-status').textContent = draftStatusText();
          notifyEmail('Employee draft for approval: ' + d.name, 'employee_draft', { slug: SLUG, name: d.name });
        });
      })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function loadDraft() {
    rpc('get_employee_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p })
      .then(function (res) {
        var r = res || {};
        /* The draft reply carries {draft, live, status}; fall back to a
           bare draft object so either shape works. */
        draft = r.draft || r.data || r;
        draftStatus = (r.draft || r.data) ? (r.status || 'editing') : 'editing';
        if (!draft || typeof draft !== 'object') draft = {};
        draft.jobs = draft.jobs || [];
        renderSetup();
      })
      .catch(function (e) {
        var el = $('view-setup');
        el.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
      });
  }

  /* ---------- start ---------- */
  function notFound() {
    $('site-name').textContent = 'Employee';
    $('site-footer').textContent = 'Powered by AutoFly';
    $('view-employees').innerHTML = '<div class="card"><h2>Business not found</h2><p class="info">This page needs a business link like ?e=your-business. Ask AutoFly to set it up.</p></div>';
  }
  if (!SLUG) {
    notFound();
  } else {
    loadBiz().then(function (d) {
      if (!d || !d.name) { notFound(); return; }
      return rpc('employee_pass_status', { p_slug: SLUG }).then(function (st) {
        passLocked = st === 'locked';
        empUnlocked = !passLocked;
        renderEmployees();
      }).catch(function () {
        /* If the status check itself is unreachable, stay open rather
           than locking everyone out of a working business. */
        empUnlocked = true;
        renderEmployees();
      });
    }).catch(function (e) {
      $('view-employees').innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
})();
