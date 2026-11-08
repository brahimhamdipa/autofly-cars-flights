/* Barber intake form — provider-form pattern for barber shops.
   The barber logs in with a form name + username + password that
   AutoFly's admin created (Admin → Manage → Barber Intake Forms),
   fills the intake form, and submits. The submission waits with
   status 'pending' until the admin taps Approve, which builds the
   whole shop in one transaction (store, location, hours, styles,
   website domain, header, body, footer).
   Login credentials live in memory only — they are never stored in
   this browser — so logging in again is needed after a reload.
   Submitting also emails AutoFly a copy (best effort): if the email
   fails, the submission itself still stands, and the admin sees it
   in the pending list. */
(function () {
  'use strict';

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the service allows. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  /* Login credentials, memory only. */
  var creds = null;

  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? el.value.trim() : ''; }

  function rpc(name, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.message) || 'request failed');
        return data;
      });
    });
  }

  /* ---------- login ---------- */
  function setLoginStatus(msg, ok) {
    var s = $('login-status');
    s.textContent = msg;
    s.className = 'status ' + (ok ? 'ok' : 'err');
  }

  function onLogin(e) {
    e.preventDefault();
    var form = val('f-login-form');
    var user = val('f-login-user');
    var pass = $('f-login-pass').value;
    var btn = $('login-btn');
    btn.disabled = true;
    setLoginStatus('Checking…', true);
    rpc('check_barber_intake_form', { p_form: form, p_username: user, p_password: pass }).then(function (ok) {
      if (!ok) {
        setLoginStatus('Wrong form name, username or password.', false);
        return;
      }
      creds = { form: form, username: user, password: pass };
      $('login-card').hidden = true;
      $('page-hint').hidden = true;
      $('intake-wrap').hidden = false;
    }).catch(function () {
      setLoginStatus('Could not reach the server — check your connection and try again.', false);
    }).finally(function () { btn.disabled = false; });
  }

  /* ---------- hours rows ---------- */
  function renderHours() {
    var box = $('hours-rows');
    var html = '';
    DAYS.forEach(function (day, i) {
      html += '<div class="day-row"><span class="day-name">' + day + '</span>' +
        '<label>Open <input type="time" id="h-open-' + i + '"></label>' +
        '<label>Close <input type="time" id="h-close-' + i + '"></label>' +
        '<label class="check"><input type="checkbox" id="h-closed-' + i + '"> Closed</label></div>';
    });
    box.innerHTML = html;
    DAYS.forEach(function (day, i) {
      $('h-closed-' + i).addEventListener('change', function () {
        var closed = this.checked;
        $('h-open-' + i).disabled = closed;
        $('h-close-' + i).disabled = closed;
      });
    });
  }

  /* ---------- service rows ---------- */
  function serviceRowHTML(n) {
    return '<div class="service-row" data-n="' + n + '">' +
      '<label>Service name * <input class="s-name" required placeholder="e.g. Haircut"></label>' +
      '<label>Price * <input class="s-price" required placeholder="e.g. 25"></label>' +
      '<label>How long it takes (minutes) * <input class="s-mins" required placeholder="e.g. 30"></label>' +
      '<label>Description <textarea class="s-desc" rows="2"></textarea></label>' +
      '<label>Picture link (if you have one) <input class="s-pic"></label>' +
      '<button type="button" class="btn-remove">Remove this service</button></div>';
  }
  function addService() {
    var box = $('services-rows');
    var n = box.querySelectorAll('.service-row').length;
    var div = document.createElement('div');
    div.innerHTML = serviceRowHTML(n);
    var row = div.firstChild;
    row.querySelector('.btn-remove').addEventListener('click', function () {
      if (box.querySelectorAll('.service-row').length > 1) row.remove();
    });
    box.appendChild(row);
  }
  function readServices() {
    var out = [];
    var rows = document.querySelectorAll('#services-rows .service-row');
    rows.forEach(function (row) {
      out.push({
        name: row.querySelector('.s-name').value.trim(),
        price: row.querySelector('.s-price').value.trim(),
        duration_minutes: row.querySelector('.s-mins').value.trim(),
        description: row.querySelector('.s-desc').value.trim(),
        picture: row.querySelector('.s-pic').value.trim()
      });
    });
    return out;
  }

  /* ---------- submit ---------- */
  function setStatus(msg, ok) {
    var s = $('form-status');
    s.textContent = msg;
    s.className = 'status ' + (ok ? 'ok' : 'err');
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!creds) {
      setStatus('Please log in first.', false);
      return;
    }
    var services = readServices().filter(function (s) { return s.name !== ''; });
    if (services.length === 0) {
      setStatus('Please add at least one service with a name, price and time.', false);
      return;
    }
    var bad = services.filter(function (s) { return s.price === '' || s.duration_minutes === ''; });
    if (bad.length > 0) {
      setStatus('Every service needs a price and a time in minutes.', false);
      return;
    }
    var hours = {};
    DAYS.forEach(function (day, i) {
      hours[day] = $('h-closed-' + i).checked
        ? { closed: true }
        : { open: $('h-open-' + i).value, close: $('h-close-' + i).value };
    });
    var shop = val('f-shop');
    var record = {
      shop_name: shop,
      owner_name: val('f-owner'),
      phone: val('f-phone'),
      email: val('f-email'),
      website: val('f-website'),
      about: val('f-about'),
      pictures: val('f-pictures'),
      address: val('f-address'),
      city: val('f-city'),
      zip: val('f-zip'),
      state: val('f-state'),
      country: val('f-country'),
      county: val('f-county'),
      township: val('f-township'),
      location_note: val('f-locnote'),
      hours: hours,
      holiday_hours_note: val('f-holiday'),
      services: services,
      page_word: val('f-slug'),
      header_slogan: val('f-hslogan'),
      header_description: val('f-hdesc'),
      body_texts: val('f-body'),
      footer_slogan: val('f-fslogan'),
      footer_description: val('f-fdesc'),
      text_message_preference: $('f-textmsg').checked
    };
    var btn = $('submit-btn');
    btn.disabled = true;
    setStatus('Sending…', true);
    rpc('submit_barber_intake', {
      p_form: creds.form, p_username: creds.username, p_password: creds.password, p_payload: record
    }).then(function () {
      /* Best-effort inbox copy; the pending submission itself stands
         even if this email fails. */
      return fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ subject: 'Barber intake: ' + shop + ' (pending approval)', table: 'barber_intake', record: record })
      }).catch(function () { /* inbox copy failed; submission still saved */ });
    }).then(function () {
      setStatus('Thanks! Your details were sent to Yently and are waiting for approval. We will confirm your page once it is built.', true);
      $('intake-form').reset();
      document.querySelectorAll('#services-rows .service-row').forEach(function (r, i) { if (i > 0) r.remove(); });
      DAYS.forEach(function (day, i) {
        $('h-open-' + i).disabled = false;
        $('h-close-' + i).disabled = false;
      });
    }).catch(function (err) {
      if (err && err.message === 'Invalid form login') {
        setStatus('Your login is no longer valid — please reload the page and log in again.', false);
      } else {
        setStatus('Sending failed — please check your connection and try again.', false);
      }
    }).finally(function () { btn.disabled = false; });
  }

  function init() {
    renderHours();
    addService();
    addService();
    addService();
    $('add-service').addEventListener('click', addService);
    $('f-slug').addEventListener('input', function () {
      $('slug-preview').textContent = this.value.trim() || 'your-word';
    });
    $('login-form').addEventListener('submit', onLogin);
    $('intake-form').addEventListener('submit', onSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
