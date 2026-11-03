/* Barber intake form — one page a barber fills in so AutoFly can build
   their barber page. Submitting emails the answers to AutoFly's inbox
   through the send-notification service (table label 'barber_intake').
   No database row is written and no payment is taken here. Anyone with
   the link can fill it in, by design — this is an intake form, not a
   customer template, so it has no Setup tab and no folder pass. */
(function () {
  'use strict';

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the service allows, and the
     intake email goes through AutoFly's notification service. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function val(id) { var el = $(id); return el ? el.value.trim() : ''; }

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
    fetch(SUPABASE_URL + '/functions/v1/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify({ subject: 'Barber intake: ' + shop, table: 'barber_intake', record: record })
    }).then(function (res) {
      if (!res.ok) throw new Error('send failed');
      setStatus('Thanks! Your details were sent to AutoFly. We will confirm your page once it is built.', true);
      $('intake-form').reset();
      document.querySelectorAll('#services-rows .service-row').forEach(function (r, i) { if (i > 0) r.remove(); });
      DAYS.forEach(function (day, i) {
        $('h-open-' + i).disabled = false;
        $('h-close-' + i).disabled = false;
      });
    }).catch(function () {
      setStatus('Sending failed — please check your connection and try again.', false);
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
    $('intake-form').addEventListener('submit', onSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
