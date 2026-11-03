/* Houses template app — one folder per business.
   The folder's own address is worked out from the URL, never written here,
   so copying this folder under a new name just works. Content lives in
   data.json; favorites live in this browser only (one key per folder).
   Inquiries are emailed to the listing's contact email, or to the business
   email in Setup when the listing has none. Setup edits never change the
   live page by themselves: they download a new data.json, and the owner
   replaces the folder's file with it. */
(function () {
  'use strict';

  function folderBase() {
    var p = location.pathname;
    var last = p.split('/').pop();
    if (last.indexOf('.') !== -1) return p.replace(/\/[^\/]*$/, '/');
    return p.charAt(p.length - 1) === '/' ? p : p + '/';
  }
  var BASE = window.RMS_BASE || folderBase();
  var SLUG = (BASE.replace(/^\/|\/$/g, '').split('/').pop() || 'houses')
    .replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  var FAV_KEY = 'houses-fav-' + SLUG;
  var SETUP_KEY = 'folder-pass-' + SLUG;

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. It only allows what the database rules allow, and the
     inquiry email goes through AutoFly's notification service. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var FEATURES = ['Central Air', 'Fireplace', 'Swimming Pool', 'Basement',
    'Cul-de-sac', 'Waterfront', 'Fenced Yard', 'Golf Course', 'Patio',
    'Tennis Court', 'Deck', 'Porch', 'Water View'];

  var data = null;
  var favorites = loadFavorites();
  var currentDetailId = null;
  var currentPhoto = 0;
  var searchState = { text: '', city: '', minPrice: '', maxPrice: '', minBeds: '', favOnly: false };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-US'); }
  function loadFavorites() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveFavorites() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch (e) {}
  }
  function isFav(id) { return favorites.indexOf(id) !== -1; }
  function toggleFav(id) {
    var i = favorites.indexOf(id);
    if (i === -1) favorites.push(id); else favorites.splice(i, 1);
    saveFavorites();
  }
  function listingById(id) {
    var found = null;
    (data.listings || []).forEach(function (l) { if (String(l.id) === String(id)) found = l; });
    return found;
  }
  function photoSrc(l, i) {
    var pics = l.photos || [];
    if (!pics.length) return '';
    return BASE + pics[i % pics.length];
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
    el.innerHTML = '<h2>Setup</h2><div class="card"><p class="info">Checking…</p></div>';
    rpc('folder_pass_status', { p_folder: SLUG }).then(function (status) {
      if (status === 'open') { renderSetup(); return; }
      renderSetupLogin(el);
    }).catch(function () {
      el.innerHTML = '<h2>Setup</h2><div class="card"><p class="error">Could not reach the sign-in check. Please try again in a moment.</p></div>';
    });
  }
  function renderSetupLogin(el) {
    el.innerHTML = '<h2>Setup sign-in</h2><div class="card">' +
      '<p class="info">This setup page is protected. Enter the username and password set by the admin for this folder.</p>' +
      '<label>Username</label><input id="fp-user" type="text" autocomplete="username">' +
      '<label>Password</label><input id="fp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="fp-go">Sign in</button></div>' +
      '<div id="fp-out" style="margin-top:12px"></div></div>';
    $('fp-go').addEventListener('click', function () {
      var out = $('fp-out');
      out.innerHTML = '<p class="info">Checking…</p>';
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

  function show(view) {
    ['listings', 'detail', 'mortgage', 'contact', 'setup'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
    });
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view);
    });
    if (view === 'listings') renderListings();
    if (view === 'mortgage') renderMortgage();
    if (view === 'contact') renderContact();
    if (view === 'setup') openSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- Listings ---------- */
  function cities() {
    var out = [];
    (data.listings || []).forEach(function (l) {
      if (l.city && out.indexOf(l.city) === -1) out.push(l.city);
    });
    return out.sort();
  }
  function filteredListings() {
    return (data.listings || []).filter(function (l) {
      if (searchState.favOnly && !isFav(l.id)) return false;
      if (searchState.city && l.city !== searchState.city) return false;
      if (searchState.minPrice !== '' && Number(l.price) < Number(searchState.minPrice)) return false;
      if (searchState.maxPrice !== '' && Number(l.price) > Number(searchState.maxPrice)) return false;
      if (searchState.minBeds !== '' && Number(l.bedrooms) < Number(searchState.minBeds)) return false;
      if (searchState.text) {
        var hay = ((l.address || '') + ' ' + (l.city || '') + ' ' + (l.zip || '') + ' ' +
          (l.description || '')).toLowerCase();
        if (hay.indexOf(searchState.text.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }
  function cardHtml(l) {
    var src = photoSrc(l, 0);
    var img = src
      ? '<img src="' + esc(src) + '" alt="" onerror="this.style.display=\'none\'">'
      : '<div class="no-photo">No photo yet</div>';
    return '<div class="card listing-card">' + img +
      '<div class="card-body"><div class="price">' + money(l.price) + '</div>' +
      '<h3>' + esc(l.address) + '</h3>' +
      '<p class="info">' + esc(l.city) + (l.zip ? ', ' + esc(l.zip) : '') + '</p>' +
      '<p class="specs">' + esc(l.bedrooms) + ' beds · ' + esc(l.bathrooms) + ' baths · ' +
      esc(l.sqft) + ' sq ft</p>' +
      '<div class="row"><button data-view-detail="' + l.id + '">View home</button>' +
      '<button class="secondary" data-fav="' + l.id + '">' + (isFav(l.id) ? '♥ Saved' : '♡ Save') + '</button></div>' +
      '</div></div>';
  }
  function renderListings() {
    var el = $('view-listings');
    var cityOpts = '<option value="">All cities</option>' +
      cities().map(function (c) {
        return '<option value="' + esc(c) + '"' + (searchState.city === c ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('');
    var html = '<div class="card search-bar">' +
      '<input id="search-text" type="text" placeholder="Search address or keyword…" value="' + esc(searchState.text) + '">' +
      '<div class="row wrap">' +
      '<select id="search-city">' + cityOpts + '</select>' +
      '<input id="search-minprice" type="number" placeholder="Min price" value="' + esc(searchState.minPrice) + '">' +
      '<input id="search-maxprice" type="number" placeholder="Max price" value="' + esc(searchState.maxPrice) + '">' +
      '<input id="search-minbeds" type="number" placeholder="Min beds" value="' + esc(searchState.minBeds) + '">' +
      '<label class="check"><input id="search-favonly" type="checkbox"' + (searchState.favOnly ? ' checked' : '') + '> Saved only</label>' +
      '</div></div>';
    var list = filteredListings();
    if (!list.length) {
      html += '<p class="info">No homes match that search yet. Try widening the price or clearing the filters.</p>';
    } else {
      html += '<div class="grid">' + list.map(cardHtml).join('') + '</div>';
    }
    el.innerHTML = html;
    $('search-text').addEventListener('input', function (e) { searchState.text = e.target.value; renderListingsKeepFocus('search-text'); });
    $('search-city').addEventListener('change', function (e) { searchState.city = e.target.value; renderListings(); });
    $('search-minprice').addEventListener('input', function (e) { searchState.minPrice = e.target.value; renderListingsKeepFocus('search-minprice'); });
    $('search-maxprice').addEventListener('input', function (e) { searchState.maxPrice = e.target.value; renderListingsKeepFocus('search-maxprice'); });
    $('search-minbeds').addEventListener('input', function (e) { searchState.minBeds = e.target.value; renderListingsKeepFocus('search-minbeds'); });
    $('search-favonly').addEventListener('change', function (e) { searchState.favOnly = e.target.checked; renderListings(); });
    el.querySelectorAll('[data-view-detail]').forEach(function (b) {
      b.addEventListener('click', function () { openDetail(b.getAttribute('data-view-detail')); });
    });
    el.querySelectorAll('[data-fav]').forEach(function (b) {
      b.addEventListener('click', function () {
        toggleFav(Number(b.getAttribute('data-fav')) || b.getAttribute('data-fav'));
        renderListings();
      });
    });
  }
  /* Re-render without stealing the cursor from the field being typed in. */
  function renderListingsKeepFocus(id) {
    var pos = null;
    var active = document.getElementById(id);
    if (active) pos = active.selectionStart;
    renderListings();
    var again = document.getElementById(id);
    if (again) {
      again.focus();
      if (pos !== null) { try { again.setSelectionRange(pos, pos); } catch (e) {} }
    }
  }

  /* ---------- Detail ---------- */
  function openDetail(id) {
    currentDetailId = id;
    currentPhoto = 0;
    ['listings', 'detail', 'mortgage', 'contact', 'setup'].forEach(function (v) {
      $('view-' + v).hidden = v !== 'detail';
    });
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.remove('active'); });
    renderDetail();
    window.scrollTo(0, 0);
  }
  function renderDetail() {
    var l = listingById(currentDetailId);
    var el = $('view-detail');
    if (!l) { el.innerHTML = '<p class="info">That home is no longer listed.</p>'; return; }
    var pics = l.photos || [];
    var main = pics.length
      ? '<img id="detail-main" src="' + esc(photoSrc(l, currentPhoto)) + '" alt="" onerror="this.style.display=\'none\'">'
      : '<div class="no-photo big">No photo yet</div>';
    var thumbs = pics.map(function (p, i) {
      return '<img class="thumb' + (i === currentPhoto ? ' active' : '') + '" data-thumb="' + i +
        '" src="' + esc(BASE + p) + '" alt="" onerror="this.style.display=\'none\'">';
    }).join('');
    var feats = (l.features || []).map(function (f) {
      return '<span class="chip">' + esc(f) + '</span>';
    }).join(' ');
    var contactEmail = l.email || data.email || '';
    el.innerHTML = '<button class="secondary" id="detail-back">← Back to houses</button>' +
      '<div class="card"><div class="gallery">' + main + '<div class="thumbs">' + thumbs + '</div></div>' +
      '<div class="price big">' + money(l.price) + '</div>' +
      '<h2>' + esc(l.address) + '</h2>' +
      '<p class="info">' + esc(l.city) + (l.zip ? ', ' + esc(l.zip) : '') + '</p>' +
      '<p>' + esc(l.description || '') + '</p>' +
      '<h3>Home info</h3><table class="info-table">' +
      '<tr><td>Bedrooms</td><td>' + esc(l.bedrooms) + '</td></tr>' +
      '<tr><td>Bathrooms</td><td>' + esc(l.bathrooms) + '</td></tr>' +
      '<tr><td>Square feet</td><td>' + esc(l.sqft) + '</td></tr>' +
      '<tr><td>Home age</td><td>' + esc(l.age) + ' years</td></tr>' +
      '<tr><td>Stories</td><td>' + esc(l.stories) + '</td></tr></table>' +
      (feats ? '<h3>Features</h3><p>' + feats + '</p>' : '') +
      '<h3>Contact</h3>' +
      (l.phone || data.phone ? '<p>📞 ' + esc(l.phone || data.phone) + '</p>' : '') +
      (contactEmail ? '<p>✉️ <a href="mailto:' + esc(contactEmail) + '">' + esc(contactEmail) + '</a></p>' : '') +
      '<div class="row wrap"><button id="detail-ask">Ask about this home</button>' +
      '<button class="secondary" id="detail-mortgage">Mortgage for this home</button>' +
      '<button class="secondary" id="detail-fav">' + (isFav(l.id) ? '♥ Saved' : '♡ Save this home') + '</button></div>' +
      '</div>';
    $('detail-back').addEventListener('click', function () { show('listings'); });
    el.querySelectorAll('[data-thumb]').forEach(function (t) {
      t.addEventListener('click', function () {
        currentPhoto = Number(t.getAttribute('data-thumb'));
        renderDetail();
      });
    });
    $('detail-ask').addEventListener('click', function () {
      renderContact(l.id);
      ['listings', 'detail', 'mortgage', 'contact', 'setup'].forEach(function (v) {
        $('view-' + v).hidden = v !== 'contact';
      });
      window.scrollTo(0, 0);
    });
    $('detail-mortgage').addEventListener('click', function () {
      renderMortgage(l.price);
      ['listings', 'detail', 'mortgage', 'contact', 'setup'].forEach(function (v) {
        $('view-' + v).hidden = v !== 'mortgage';
      });
      window.scrollTo(0, 0);
    });
    $('detail-fav').addEventListener('click', function () {
      toggleFav(l.id);
      renderDetail();
    });
  }

  /* ---------- Mortgage ---------- */
  function renderMortgage(prefillPrice) {
    var el = $('view-mortgage');
    var priceVal = prefillPrice != null ? prefillPrice : '';
    el.innerHTML = '<h2>Mortgage calculator</h2><div class="card">' +
      '<label>Price of home</label><input id="mort-price" type="number" min="0" value="' + esc(priceVal) + '">' +
      '<label>Down payment</label><input id="mort-down" type="number" min="0" value="0">' +
      '<label>Years</label><input id="mort-years" type="number" min="1" max="50" value="30">' +
      '<label>Annual interest rate (%)</label><input id="mort-rate" type="number" step="0.01" min="0" value="7.5">' +
      '<button id="mort-calc">Calculate</button><div id="mort-out" style="margin-top:14px"></div></div>' +
      '<p class="info">Estimate only — taxes, insurance, and fees are not included.</p>';
    $('mort-calc').addEventListener('click', function () {
      var price = Number($('mort-price').value) || 0;
      var down = Number($('mort-down').value) || 0;
      var years = Number($('mort-years').value) || 0;
      var rate = Number($('mort-rate').value) || 0;
      var out = $('mort-out');
      if (price <= 0 || years <= 0 || years > 50 || down < 0 || down >= price) {
        out.innerHTML = '<p class="error">Check the numbers: price above zero, down payment below the price, years between 1 and 50.</p>';
        return;
      }
      var principal = price - down;
      var n = years * 12;
      var j = rate / 1200;
      var m = j === 0 ? principal / n : principal * (j / (1 - Math.pow(1 + j, -n)));
      var paymentsTotal = m * n;
      var total = paymentsTotal + down;
      var interest = total - down - principal;
      out.innerHTML = '<div class="total">Monthly payment: ' + money(Math.round(m * 100) / 100) + '</div>' +
        '<p>Total of ' + n + ' payments: ' + money(Math.round(paymentsTotal)) +
        '<br>Total cost including down payment: ' + money(Math.round(total)) +
        '<br>Total interest: ' + money(Math.round(interest)) + '</p>' +
        '<button class="secondary" id="mort-schedule">Show full schedule</button><div id="mort-schedule-out"></div>';
      $('mort-schedule').addEventListener('click', function () {
        var bal = principal;
        var rows = '<table class="info-table"><tr><th>Month</th><th>Interest</th><th>Principal</th><th>Balance</th></tr>';
        for (var k = 1; k <= n; k++) {
          var intr = bal * j;
          var prin = m - intr;
          bal = bal - prin;
          if (bal < 0) bal = 0;
          rows += '<tr><td>' + k + '</td><td>' + money(Math.round(intr * 100) / 100) +
            '</td><td>' + money(Math.round(prin * 100) / 100) +
            '</td><td>' + money(Math.round(bal * 100) / 100) + '</td></tr>';
        }
        rows += '</table>';
        $('mort-schedule-out').innerHTML = rows;
      });
    });
  }

  /* ---------- Contact ---------- */
  function renderContact(prefillId) {
    var el = $('view-contact');
    var opts = '<option value="">General question</option>' +
      (data.listings || []).map(function (l) {
        return '<option value="' + l.id + '"' + (String(prefillId) === String(l.id) ? ' selected' : '') + '>' +
          esc(l.address) + ' — ' + money(l.price) + '</option>';
      }).join('');
    el.innerHTML = '<h2>Contact</h2><div class="card">' +
      '<label>About this home (optional)</label><select id="contact-listing">' + opts + '</select>' +
      '<label>Your name</label><input id="contact-name" type="text">' +
      '<label>Your email</label><input id="contact-email" type="email">' +
      '<label>Your phone (optional)</label><input id="contact-phone" type="text">' +
      '<label>Your message</label><textarea id="contact-message" rows="4"></textarea>' +
      '<button id="contact-send">Send</button><div id="contact-out" style="margin-top:12px"></div></div>';
    $('contact-send').addEventListener('click', function () {
      var name = $('contact-name').value.trim();
      var email = $('contact-email').value.trim();
      var phone = $('contact-phone').value.trim();
      var message = $('contact-message').value.trim();
      var listingId = $('contact-listing').value;
      var out = $('contact-out');
      if (!name || !email || !message) {
        out.innerHTML = '<p class="error">Please fill in your name, your email, and a message.</p>';
        return;
      }
      var listing = listingId ? listingById(listingId) : null;
      var to = (listing && listing.email) || data.email || '';
      var subject = 'Houses inquiry' + (listing ? ': ' + listing.address : '');
      out.innerHTML = '<p class="info">Sending…</p>';
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ to: to || undefined, subject: subject, table: 'houses_inquiry',
          record: { name: name, email: email, phone: phone, message: message,
            listing: listing ? (listing.address + ', ' + listing.city) : 'General question' } })
      }).then(function (res) {
        if (!res.ok) throw new Error('send failed');
        out.innerHTML = '<p class="note">Thank you! Your message has been sent.</p>';
        $('contact-name').value = '';
        $('contact-email').value = '';
        $('contact-phone').value = '';
        $('contact-message').value = '';
      }).catch(function () {
        var mailto = to ? ('<a href="mailto:' + esc(to) + '?subject=' + encodeURIComponent(subject) + '&body=' +
          encodeURIComponent(message + '\n\nFrom: ' + name + ' (' + email + (phone ? ', ' + phone : '') + ')') + '">' + esc(to) + '</a>') : '';
        out.innerHTML = '<p class="error">The message did not go through. ' +
          (mailto ? 'Please email directly: ' + mailto : 'Please try again in a moment.') + '</p>';
      });
    });
  }

  /* ---------- Setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    function field(label, id, value, type) {
      return '<label>' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '">';
    }
    var html = '<h2>Setup</h2>' +
      '<div class="note">Edit the business here, then press “Download data.json”. ' +
      'To put the changes live, replace the <strong>data.json</strong> file inside this folder with the downloaded file, then reload the page. ' +
      'Nothing on this tab changes the live page by itself — and that is on purpose, so visitors cannot change your listings. ' +
      'Photos are separate files: add an image file into this folder, then list its filename in the listing’s Photos field.</div>' +
      '<div class="card">' +
      field('Business name', 'setup-name', data.name) +
      field('About text', 'setup-about', data.about) +
      field('Phone', 'setup-phone', data.phone) +
      field('Email (inquiries come here)', 'setup-email', data.email, 'email') +
      field('Address', 'setup-address', data.address) +
      '</div><h2>Listings</h2><div id="setup-listings"></div>' +
      '<button id="setup-add" class="secondary">+ Add listing</button>' +
      '<div style="margin-top:16px"><button id="setup-download">Download data.json</button></div>';
    el.innerHTML = html;
    var listEl = $('setup-listings');
    function listingCard(l, i) {
      var row = document.createElement('div');
      row.className = 'card';
      var featChecks = FEATURES.map(function (f) {
        var checked = (l.features || []).indexOf(f) !== -1 ? ' checked' : '';
        return '<label class="check"><input type="checkbox" data-feat="' + esc(f) + '"' + checked + '> ' + esc(f) + '</label>';
      }).join(' ');
      row.innerHTML =
        '<label>Street address</label><input data-f="address" value="' + esc(l.address) + '">' +
        '<label>City</label><input data-f="city" value="' + esc(l.city || '') + '">' +
        '<label>ZIP</label><input data-f="zip" value="' + esc(l.zip || '') + '">' +
        '<label>Price</label><input data-f="price" type="number" min="0" value="' + esc(l.price) + '">' +
        '<label>Bedrooms</label><input data-f="bedrooms" type="number" min="0" value="' + esc(l.bedrooms) + '">' +
        '<label>Bathrooms</label><input data-f="bathrooms" type="number" min="0" value="' + esc(l.bathrooms) + '">' +
        '<label>Square feet</label><input data-f="sqft" type="number" min="0" value="' + esc(l.sqft) + '">' +
        '<label>Home age (years)</label><input data-f="age" type="number" min="0" value="' + esc(l.age) + '">' +
        '<label>Stories</label><input data-f="stories" type="number" min="0" value="' + esc(l.stories) + '">' +
        '<label>Description</label><textarea data-f="description" rows="3">' + esc(l.description || '') + '</textarea>' +
        '<label>Contact phone (optional — otherwise the business phone is shown)</label><input data-f="phone" value="' + esc(l.phone || '') + '">' +
        '<label>Contact email (optional — otherwise the business email is used)</label><input data-f="email" value="' + esc(l.email || '') + '">' +
        '<label>Photos (one filename per line — the file must be inside this folder)</label><textarea data-f="photos" rows="2">' + esc((l.photos || []).join('\n')) + '</textarea>' +
        '<label>Features</label><div class="row wrap">' + featChecks + '</div>' +
        '<button class="small danger" data-remove="' + i + '">Remove listing</button>';
      row.querySelectorAll('[data-f]').forEach(function (input) {
        input.addEventListener('input', function () {
          var f = input.getAttribute('data-f');
          if (f === 'photos') {
            l.photos = input.value.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
          } else if (['price', 'bedrooms', 'bathrooms', 'sqft', 'age', 'stories'].indexOf(f) !== -1) {
            l[f] = Number(input.value) || 0;
          } else {
            l[f] = input.value;
          }
        });
      });
      row.querySelectorAll('[data-feat]').forEach(function (box) {
        box.addEventListener('change', function () {
          var f = box.getAttribute('data-feat');
          l.features = l.features || [];
          var at = l.features.indexOf(f);
          if (box.checked && at === -1) l.features.push(f);
          if (!box.checked && at !== -1) l.features.splice(at, 1);
        });
      });
      row.querySelector('[data-remove]').addEventListener('click', function () {
        data.listings.splice(i, 1);
        renderSetup();
      });
      return row;
    }
    function drawListings() {
      listEl.innerHTML = '';
      (data.listings || []).forEach(function (l, i) { listEl.appendChild(listingCard(l, i)); });
    }
    drawListings();
    $('setup-add').addEventListener('click', function () {
      data.listings.push({ id: Date.now(), address: 'New listing', city: '', zip: '',
        price: 0, bedrooms: 0, bathrooms: 0, sqft: 0, age: 0, stories: 1,
        description: '', phone: '', email: '', photos: [], features: [] });
      drawListings();
    });
    $('setup-download').addEventListener('click', function () {
      var out = {
        name: $('setup-name').value.trim() || data.name,
        about: $('setup-about').value,
        phone: $('setup-phone').value,
        email: $('setup-email').value,
        address: $('setup-address').value,
        listings: (data.listings || []).filter(function (l) { return (l.address || '').trim() !== ''; })
      };
      var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  /* ---------- Start ---------- */
  document.querySelectorAll('#tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () { show(btn.getAttribute('data-view')); });
  });
  fetch(BASE + 'data.json')
    .then(function (res) {
      if (!res.ok) throw new Error('data.json not found');
      return res.json();
    })
    .then(function (json) {
      data = json;
      data.listings = data.listings || [];
      document.title = data.name || 'Houses';
      $('site-name').textContent = data.name || 'Houses';
      $('site-about').textContent = data.about || '';
      var foot = [];
      if (data.address) foot.push(esc(data.address));
      if (data.phone) foot.push(esc(data.phone));
      if (data.email) foot.push(esc(data.email));
      $('site-footer').innerHTML = foot.join(' · ');
      renderListings();
    })
    .catch(function () {
      $('site-name').textContent = 'Houses page not ready';
      $('view-listings').innerHTML = '<div class="error">This folder has no <strong>data.json</strong> file yet. ' +
        'Add one next to this page (copy the example from another houses folder), then reload.</div>';
    });
})();
