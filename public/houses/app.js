/* Houses page app — ONE folder for every agency.
   The agency comes from its own private link, and its info,
   listings, and inquiries live in the database — there is no data.json
   file here. Every agency has its own listings and inquiries, but
   they all use this same page.
   Visitors browse the homes, search by city and price, save
   favorites, work out a mortgage, or ask about a home. Inquiries are
   emailed to Yently. The Inquiries tab needs the agency's shared
   employee password (one password for all staff, set by the admin;
   agencies with none set stay fully open). Setup needs the owner's
   own username + password. Setup edits save as a draft, and the
   Upload button sends the draft to the admin for approval — approval
   makes it live instantly. Listings are different: the owner adds,
   edits, and deletes listings live in Setup, no approval needed. All
   credentials live in memory only: a reload asks again, exactly like
   the diner, barbershop, and POS pages. */
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
  var SLUG = String(params.h || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
  var SLUG_FROM_PATH = false;
  var slugResolved = false;
  if (!SLUG) {
    // Clean link (yently.com/<slug>): the middleware rewrites the
    // page server-side, so location.search is empty in the browser.
    // The shop slug is then the last path segment. Ignore this
    // system's own folder name, so a bare /houses visit still
    // shows "not found" by design.
    var segs = location.pathname.split('/').filter(function (s) { return s; });
    var lastSeg = (segs[segs.length - 1] || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    if (lastSeg && lastSeg !== 'houses') { SLUG = lastSeg; SLUG_FROM_PATH = true; }
  }
  // Clean link (yently.com/<slug>): the name in the link is the CLEAN
  // name, which usually differs from the shop's own slug (e.g.
  // yently.com/testlink opens the Demo POS shop, slug demo-pos).
  // The middleware rewrites the page, but the browser address stays
  // clean, so look the clean name up in clean_links (public read)
  // and use the real shop slug. Only runs when the slug came from
  // the path (no ?s=/?r=/... query). Fails open: any error keeps
  // the path slug, and the shop just shows "not found" as before.
  function resolveSlug() {
    if (!SLUG_FROM_PATH || slugResolved || !SLUG) return Promise.resolve();
    slugResolved = true;
    return fetch(SUPABASE_URL + '/rest/v1/clean_links?slug=eq.' + encodeURIComponent(SLUG) + '&select=shop_slug', {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }
    }).then(function (res) { return res.ok ? res.json() : []; }).then(function (rows) {
      if (rows && rows[0] && rows[0].shop_slug) SLUG = String(rows[0].shop_slug).toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    }).catch(function () {});
  }

  /* Public by design: the same publishable key the main AutoFly site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var FAV_KEY = 'houses-fav-' + SLUG;
  var FEATURES = ['Central Air', 'Fireplace', 'Swimming Pool', 'Basement',
    'Cul-de-sac', 'Waterfront', 'Fenced Yard', 'Golf Course', 'Patio',
    'Tennis Court', 'Deck', 'Porch', 'Water View'];

  var house = null; // live agency info + listings (visitors)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var ownerCreds = null; // {u, p} in memory only, never stored
  var empPass = null; // employee password in memory only, never stored
  var empUnlocked = false; // true once the employee password is entered, or when the agency has none set
  var passLocked = false;
  var bookings = [];
  var bookingsTimer = null;
  var currentView = 'homes';
  var listingEditId = null; // listing being edited in Setup, null = adding
  var cancelConfirmId = null; // inquiry id awaiting an in-page cancel confirmation
  var bookingsErr = ''; // last inquiries error, shown inline above the list
  var delConfirmId = null; // listing id awaiting an in-page delete confirmation
  var slideIdx = {}; // listing id -> current slideshow picture index
  var detailListingId = null; // listing id shown in the details popup
  var listingPics = []; // picture URLs for the listing being added/edited in Setup
  var favorites = loadFavorites();
  var searchState = { text: '', city: '', minPrice: '', maxPrice: '', minBeds: '', favOnly: false };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* Home prices use thousands separators: $289,000, not $289000.00.
     Whole amounts stay plain; amounts with cents show two decimals. */
  function money(n) {
    var v = Number(n || 0);
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  }
  function round2(n) { return Math.round(n * 100) / 100; }
  function fmtNum(n) { return Number(n || 0).toLocaleString('en-US'); }
  function fmtDT(iso) {
    var d = new Date(iso);
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function rpc(name, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (res) {
      /* Some calls (save/upload) return no body at all — read text first
         and only parse when there is something to parse, so an empty
         success reply is not mistaken for a failure. */
      return res.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!res.ok) throw new Error((j && j.message) || 'request failed');
        return j;
      });
    });
  }
  /* Best-effort owner email, same shape as the diner and POS pages: the
     table differs per call (inquiry, draft approval). */
  function notifyEmail(subject, table, record) {
    try {
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ subject: subject, table: table, record: record })
      }).catch(function () {});
    } catch (e) {}
  }
  /* ---------- "?" help popups (request forms) ----------
     Same pattern as the Direct Upload page: a "?" next to the field
     label, tap once to open the explanation, tap again — or tap
     anywhere else — to close it. Only one help is open at a time.
     The popup anchors to the field label (.direct-help CSS), so it
     can never run past the page edge and zoom the page on a phone. */
  function helpHtml(text) {
    return '<span class="help"><button type="button" class="help-btn" data-help-btn aria-label="Help">?</button>' +
      '<span class="help-pop" hidden>' + esc(text) + '</span></span>';
  }
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-help-btn]') : null;
    var pops = document.querySelectorAll('.help-pop');
    if (btn) {
      var pop = btn.parentNode ? btn.parentNode.querySelector('.help-pop') : null;
      var wasHidden = pop ? pop.hidden : true;
      pops.forEach(function (p) { p.hidden = true; });
      if (pop) pop.hidden = !wasHidden;
      e.stopPropagation();
      return;
    }
    var inside = e.target && e.target.closest ? e.target.closest('.help') : null;
    if (!inside) pops.forEach(function (p) { p.hidden = true; });
  });
  /* ---------- Icon picture (one small square image) ---------- */
  /* The icon lives in the draft/live data as `icon` — a public URL or ''.
     It is uploaded to the product-images bucket, shrunk to 200px on its
     long edge first (same rules as the shop picture uploads: JPEG 0.8,
     PNGs stay PNG, small pictures untouched, any failure falls back to
     the original file). Same pattern as the POS, diner, barbershop, and
     dealer pages. */
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
      var out = $('setup-icon-out');
      if (out) out.textContent = 'Icon removed — save the draft to keep it removed.';
      var file = $('setup-icon-file');
      if (file) file.value = '';
    });
  }
  function loadFavorites() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveFavorites() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); } catch (e) {}
  }
  function isFav(id) { return favorites.indexOf(Number(id)) !== -1; }
  function toggleFav(id) {
    var n = Number(id);
    var i = favorites.indexOf(n);
    if (i === -1) favorites.push(n); else favorites.splice(i, 1);
    saveFavorites();
  }
  function listingById(id) {
    return (house.listings || []).filter(function (l) { return String(l.id) === String(id); })[0] || null;
  }
  function listingLabel(l) {
    return [l.address, l.city].filter(function (x) { return x; }).join(', ');
  }
  /* Listing pictures are either full URLs (uploaded in Setup) or plain
     filenames in this folder (the demo listings use standard_house.jpg).
     Filenames resolve against this folder's own address, so they keep
     working under any domain or clean link. */
  function listingPicSrc(p) {
    if (!p) return '';
    if (/^(https?:)?\/\//i.test(p) || p.charAt(0) === '/') return p;
    return BASE + p;
  }
  function listingPicsOf(l) { return (l && Array.isArray(l.pics)) ? l.pics : []; }
  function loadHouse() {
    return rpc('get_houses_live', { p_slug: SLUG }).then(function (d) {
      house = d;
      setHeader();
      return d;
    });
  }

  /* ---------- views ---------- */
  function show(view) {
    currentView = view;
    ['homes', 'favorites', 'inquiries', 'setup', 'detail'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.hidden = v !== view;
    });
    var tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    if (bookingsTimer) { clearInterval(bookingsTimer); bookingsTimer = null; }
    if (view === 'homes') renderHomes();
    if (view === 'favorites') renderFavorites();
    if (view === 'inquiries') { renderInquiries(); bookingsTimer = setInterval(function () { if (currentView === 'inquiries' && empUnlocked) loadBookings(true); }, 5000); }
    if (view === 'setup') renderSetup();
    if (view === 'detail') renderDetail();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
  });
  $('to-top').addEventListener('click', function () { window.scrollTo(0, 0); });

  function setHeader() {
    $('site-name').textContent = house ? house.name : 'Houses';
    renderHeaderIcon(house && house.icon ? house.icon : '');
    $('site-about').textContent = house
      ? [house.address, house.phone].filter(Boolean).join(' · ')
      : '';
    $('site-footer').innerHTML = house
      ? esc([house.address, house.phone].filter(Boolean).join(' · ')) + '<br>Powered by Yently'
      : 'Powered by Yently';
    document.title = (house ? house.name : 'Houses') + ' — Houses for sale';
  }

  /* ---------- Homes (public listings + search) ---------- */
  function cities() {
    var out = [];
    (house.listings || []).forEach(function (l) {
      if (l.city && out.indexOf(l.city) === -1) out.push(l.city);
    });
    return out.sort();
  }
  function filteredListings() {
    return (house.listings || []).filter(function (l) {
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
  /* One picture shows static, 2+ get ‹ › arrows and a "1 of N" counter,
     none gets a plain grey placeholder block. The arrows keep their
     position per listing in slideIdx, so flipping through one home does
     not reset the others. */
  function listingSlideshowHtml(l) {
    var pics = listingPicsOf(l);
    if (!pics.length) return '<div class="slideshow"><div class="slide-empty">No picture yet</div></div>';
    var idx = slideIdx[l.id] || 0;
    if (idx >= pics.length) idx = 0;
    var h = '<div class="slideshow"><img class="slide-img" src="' + esc(listingPicSrc(pics[idx])) + '" alt="' + esc(listingLabel(l)) + '">';
    if (pics.length > 1) {
      h += '<button class="slide-btn prev" data-slide-prev="' + l.id + '" aria-label="Previous picture">‹</button>' +
        '<button class="slide-btn next" data-slide-next="' + l.id + '" aria-label="Next picture">›</button>' +
        '<span class="slide-count">' + (idx + 1) + ' of ' + pics.length + '</span>';
    }
    h += '</div>';
    return h;
  }
  function listingCardHtml(l) {
    var specs = [];
    if (l.bedrooms != null && l.bedrooms !== '') specs.push(l.bedrooms + ' beds');
    if (l.bathrooms != null && l.bathrooms !== '') specs.push(l.bathrooms + ' baths');
    if (l.sqft) specs.push(fmtNum(l.sqft) + ' sq ft');
    return '<div class="item-card">' + listingSlideshowHtml(l) +
      '<span class="price">' + money(l.price) + '</span>' +
      '<h3>' + esc(l.address) + '</h3>' +
      '<span class="stock">' + esc(l.city || '') + (l.zip ? ', ' + esc(l.zip) : '') + '</span>' +
      (specs.length ? '<span class="stock">' + esc(specs.join(' · ')) + '</span>' : '') +
      (l.description ? '<p class="info">' + esc(l.description) + '</p>' : '') +
      '<div class="row"><button data-view-detail="' + l.id + '">View home</button>' +
      '<button class="secondary" data-fav="' + l.id + '">' + (isFav(l.id) ? '♥ Saved' : '♡ Save') + '</button></div>' +
      '</div>';
  }
  function renderListingsGrid() {
    var grid = $('homes-grid');
    if (!grid) return;
    var list = filteredListings();
    if (!list.length) {
      grid.innerHTML = '<div class="card"><p class="info">No homes match that search yet. Try widening the price or clearing the filters.</p></div>';
      return;
    }
    var h = '<div class="item-grid">';
    list.forEach(function (l) { h += listingCardHtml(l); });
    h += '</div>';
    grid.innerHTML = h;
  }
  function attachListingCardListeners(root) {
    root.querySelectorAll('[data-slide-prev]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-slide-prev');
        var pics = listingPicsOf(listingById(id));
        if (!pics.length) return;
        slideIdx[id] = ((slideIdx[id] || 0) - 1 + pics.length) % pics.length;
        if (currentView === 'homes') renderHomesGridOnly();
        else if (currentView === 'favorites') renderFavorites();
        else if (currentView === 'detail') renderDetail();
      });
    });
    root.querySelectorAll('[data-slide-next]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-slide-next');
        var pics = listingPicsOf(listingById(id));
        if (!pics.length) return;
        slideIdx[id] = ((slideIdx[id] || 0) + 1) % pics.length;
        if (currentView === 'homes') renderHomesGridOnly();
        else if (currentView === 'favorites') renderFavorites();
        else if (currentView === 'detail') renderDetail();
      });
    });
    root.querySelectorAll('[data-view-detail]').forEach(function (b) {
      b.addEventListener('click', function () {
        detailListingId = Number(b.getAttribute('data-view-detail'));
        show('detail');
      });
    });
    root.querySelectorAll('[data-fav]').forEach(function (b) {
      b.addEventListener('click', function () {
        toggleFav(b.getAttribute('data-fav'));
        if (currentView === 'homes') renderHomes();
        else if (currentView === 'favorites') renderFavorites();
        else if (currentView === 'detail') renderDetail();
      });
    });
  }
  /* Re-render the homes grid without stealing the cursor from the
     search field being typed in. */
  function renderHomesGridOnly() {
    renderListingsGrid();
    attachListingCardListeners($('view-homes'));
  }
  function renderHomes() {
    var el = $('view-homes');
    if (!house) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var h = '<h2>' + esc(house.name) + '</h2>';
    if (house.about) h += '<p class="info">' + esc(house.about) + '</p>';
    if (house.address || house.phone || house.hours) {
      h += '<div class="card info">';
      if (house.address) h += '<p>📍 ' + esc(house.address) + '</p>';
      if (house.phone) h += '<p>📞 ' + esc(house.phone) + '</p>';
      if (house.hours) h += '<p>🕐 ' + esc(house.hours) + '</p>';
      h += '</div>';
    }
    if (!(house.listings || []).length) {
      h += '<div class="card"><p class="info">No homes yet — the owner adds homes in Setup.</p></div>';
      el.innerHTML = h;
      return;
    }
    var cityOpts = '<option value="">All cities</option>' +
      cities().map(function (c) {
        return '<option value="' + esc(c) + '"' + (searchState.city === c ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('');
    h += '<div class="card search-bar">' +
      '<input id="search-text" type="text" placeholder="Search address or keyword…" value="' + esc(searchState.text) + '">' +
      '<div class="row wrap">' +
      '<select id="search-city">' + cityOpts + '</select>' +
      '<input id="search-minprice" type="number" placeholder="Min price" value="' + esc(searchState.minPrice) + '">' +
      '<input id="search-maxprice" type="number" placeholder="Max price" value="' + esc(searchState.maxPrice) + '">' +
      '<input id="search-minbeds" type="number" placeholder="Min beds" value="' + esc(searchState.minBeds) + '">' +
      '<label class="check"><input id="search-favonly" type="checkbox"' + (searchState.favOnly ? ' checked' : '') + '> Saved only</label>' +
      '</div></div>';
    h += '<div id="homes-grid"></div>';
    el.innerHTML = h;
    var keepFocus = function (id) {
      var pos = null;
      var active = document.getElementById(id);
      if (active) pos = active.selectionStart;
      renderHomesGridOnly();
      var again = document.getElementById(id);
      if (again) {
        again.focus();
        if (pos !== null) { try { again.setSelectionRange(pos, pos); } catch (e) {} }
      }
    };
    $('search-text').addEventListener('input', function (e) { searchState.text = e.target.value; keepFocus('search-text'); });
    $('search-city').addEventListener('change', function (e) { searchState.city = e.target.value; renderHomes(); });
    $('search-minprice').addEventListener('input', function (e) { searchState.minPrice = e.target.value; keepFocus('search-minprice'); });
    $('search-maxprice').addEventListener('input', function (e) { searchState.maxPrice = e.target.value; keepFocus('search-maxprice'); });
    $('search-minbeds').addEventListener('input', function (e) { searchState.minBeds = e.target.value; keepFocus('search-minbeds'); });
    $('search-favonly').addEventListener('change', function (e) { searchState.favOnly = e.target.checked; renderHomes(); });
    renderHomesGridOnly();
  }

  /* ---------- Favorites (saved in this browser only) ---------- */
  function renderFavorites() {
    var el = $('view-favorites');
    if (!house) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var saved = (house.listings || []).filter(function (l) { return isFav(l.id); });
    var h = '<h2>Saved homes — ' + esc(house.name) + '</h2>';
    if (!saved.length) {
      h += '<div class="card"><p class="info">No saved homes yet — tap ♡ Save on any home to keep it here, in this browser only.</p></div>';
      el.innerHTML = h;
      return;
    }
    h += '<div class="item-grid">';
    saved.forEach(function (l) { h += listingCardHtml(l); });
    h += '</div>';
    el.innerHTML = h;
    attachListingCardListeners(el);
  }

  /* ---------- Detail popup (photos, info, mortgage, ask) ---------- */
  /* Details popup, modelled on the Cars "I'm interested" popup and the
     dealer details popup: an overlay that closes on a backdrop tap, a
     card with a ✕ button, the pictures up top and every field below.
     It lives in the #view-detail section, shown in place of the tabs. */
  function monthlyMortgage(price, down, ratePct, years) {
    var principal = Math.max(0, Number(price || 0) - Number(down || 0));
    var n = Math.max(1, Math.floor(Number(years || 0)) * 12);
    var j = Number(ratePct || 0) / 1200;
    if (j === 0) return round2(principal / n);
    return round2(principal * (j / (1 - Math.pow(1 + j, -n))));
  }
  function renderDetail() {
    var el = $('view-detail');
    var l = detailListingId != null ? listingById(detailListingId) : null;
    if (!l) {
      el.innerHTML = '<p class="info">That home is no longer listed.</p>' +
        '<div class="row"><button class="secondary" id="detail-back">← Back to homes</button></div>';
      $('detail-back').addEventListener('click', function () { show('homes'); });
      return;
    }
    var rows = [
      ['Bedrooms', l.bedrooms], ['Bathrooms', l.bathrooms],
      ['Square feet', l.sqft ? fmtNum(l.sqft) : ''],
      ['Home age', (l.age != null && l.age !== '') ? l.age + ' years' : ''],
      ['Stories', l.stories]
    ];
    var feats = (l.features || []).map(function (f) {
      return '<span class="chip">' + esc(f) + '</span>';
    }).join(' ');
    var h = '<div class="modal-overlay" data-close-detail><div class="modal">' +
      '<button class="modal-close" data-close-detail aria-label="Close">✕</button>' +
      listingSlideshowHtml(l) +
      '<span class="price">' + money(l.price) + '</span>' +
      '<h3>' + esc(l.address) + '</h3>' +
      '<p class="info">' + esc(l.city || '') + (l.zip ? ', ' + esc(l.zip) : '') + '</p>' +
      (l.description ? '<p>' + esc(l.description) + '</p>' : '') +
      '<h3>Home info</h3><div class="detail-list">';
    rows.forEach(function (r) {
      if (r[1] === '' || r[1] == null) return;
      h += '<div class="detail-row"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>';
    });
    h += '</div>' +
      (feats ? '<h3>Features</h3><p>' + feats + '</p>' : '') +
      '<h3>Mortgage calculator</h3>' +
      '<p class="info">Estimate only — taxes, insurance, and fees are not included.</p>' +
      '<label>Price of home</label><input id="mort-price" type="number" min="0" value="' + esc(l.price == null ? '' : l.price) + '">' +
      '<label>Down payment</label><input id="mort-down" type="number" min="0" value="0">' +
      '<label>Years</label><input id="mort-years" type="number" min="1" max="50" value="30">' +
      '<label>Annual interest rate (%)</label><input id="mort-rate" type="number" step="0.01" min="0" value="7.5">' +
      '<div class="row"><button id="mort-calc">Calculate</button></div>' +
      '<p class="error" id="mort-err" hidden></p>' +
      '<div id="mort-out" style="margin-top:12px"></div>' +
      '<h3>Ask about this home</h3>' +
      '<form class="direct-help" id="ask-form">' +
      '<div class="field"><span class="field-label">Your name ' + helpHtml('Your own name — the person asking about this home. The agency uses it to know who the question is from, and to address you in the reply. Type your first and last name.') + '</span>' +
      '<input id="ask-name" type="text" placeholder="Full name"></div>' +
      '<div class="field"><span class="field-label">Phone ' + helpHtml('Your phone number, so the agency can call you back about this home. Digits only is fine — spaces or dashes do no harm.') + '</span>' +
      '<input id="ask-phone" type="tel" placeholder="Phone number"></div>' +
      '<div class="field"><span class="field-label">Email (optional) ' + helpHtml('Your email address — only if you would rather be reached by email than by phone. You can leave it empty.') + '</span>' +
      '<input id="ask-email" type="email" placeholder="Email address"></div>' +
      '<div class="field"><span class="field-label">Message ' + helpHtml('Anything you want to ask about this home — a viewing, the price, the area, or anything else. The more you say, the better the answer.') + '</span>' +
      '<textarea id="ask-message" rows="4" placeholder="Anything you want to ask about this home?"></textarea></div>' +
      '<div class="row"><button type="submit" id="ask-go">Send question</button>' +
      '<button type="button" class="secondary" id="detail-fav">' + (isFav(l.id) ? '♥ Saved' : '♡ Save this home') + '</button></div>' +
      '<p class="error" id="ask-err" hidden></p>' +
      '<div id="ask-out" style="margin-top:12px"></div></form>' +
      '</div></div>';
    el.innerHTML = h;
    attachListingCardListeners(el);
    el.querySelectorAll('[data-close-detail]').forEach(function (n) {
      n.addEventListener('click', function (e) {
        if (e && e.target && e.target !== n) return;
        detailListingId = null;
        show('homes');
      });
    });
    $('detail-fav').addEventListener('click', function () {
      toggleFav(l.id);
      renderDetail();
    });
    $('mort-calc').addEventListener('click', function () {
      var err = $('mort-err');
      var out = $('mort-out');
      var price = Number($('mort-price').value) || 0;
      var down = Number($('mort-down').value) || 0;
      var years = Number($('mort-years').value) || 0;
      var rate = Number($('mort-rate').value) || 0;
      if (price <= 0 || years <= 0 || years > 50 || down < 0 || down >= price) {
        err.hidden = false;
        err.textContent = 'Check the numbers: price above zero, down payment below the price, years between 1 and 50.';
        return;
      }
      err.hidden = true;
      var m = monthlyMortgage(price, down, rate, years);
      var n = years * 12;
      var principal = price - down;
      var paymentsTotal = m * n;
      var total = paymentsTotal + down;
      var interest = total - down - principal;
      out.innerHTML = '<div class="total">Monthly payment: <span class="big">' + money(m) + '</span></div>' +
        '<p>Total of ' + n + ' payments: ' + money(Math.round(paymentsTotal)) +
        '<br>Total cost including down payment: ' + money(Math.round(total)) +
        '<br>Total interest: ' + money(Math.round(interest)) + '</p>' +
        '<button class="secondary" id="mort-schedule">Show full schedule</button><div id="mort-schedule-out"></div>';
      $('mort-schedule').addEventListener('click', function () {
        var bal = principal;
        var j = rate / 1200;
        var rowsHtml = '<table class="info-table"><tr><th>Month</th><th>Interest</th><th>Principal</th><th>Balance</th></tr>';
        for (var k = 1; k <= n; k++) {
          var intr = bal * j;
          var prin = m - intr;
          bal = bal - prin;
          if (bal < 0) bal = 0;
          rowsHtml += '<tr><td>' + k + '</td><td>' + money(round2(intr)) +
            '</td><td>' + money(round2(prin)) +
            '</td><td>' + money(round2(bal)) + '</td></tr>';
        }
        rowsHtml += '</table>';
        $('mort-schedule-out').innerHTML = rowsHtml;
      });
    });
    $('ask-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('ask-err');
      var out = $('ask-out');
      var name = $('ask-name').value.trim();
      var phone = $('ask-phone').value.trim();
      var email = $('ask-email').value.trim();
      var message = $('ask-message').value.trim();
      if (!name) { err.hidden = false; err.textContent = 'Your name is required.'; return; }
      if (!phone) { err.hidden = false; err.textContent = 'Your phone number is required.'; return; }
      err.hidden = true;
      var label = listingLabel(l);
      rpc('place_houses_inquiry', { p_slug: SLUG, p_listing: label, p_name: name, p_phone: phone, p_email: email, p_message: message }).then(function (res) {
        var id = (res && typeof res === 'object') ? (res.id != null ? res.id : res.inquiry_id) : res;
        out.innerHTML = '<p class="info">✓ Sent — inquiry #' + esc(id) + ' about ' + esc(label) + '. Thanks, ' + esc(name) + ' — the agency will be in touch.</p>';
        notifyEmail('Houses inquiry: ' + label, 'houses_inquiry', { slug: SLUG, name: name, phone: phone, email: email, listing: label, message: message });
      }).catch(function (err2) {
        err.hidden = false;
        err.textContent = 'Error: ' + err2.message;
      });
    });
  }

  /* ---------- Inquiries (employee password) ---------- */
  function empGate(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the employee password for this agency to see inquiries.</p>' +
      '<label>Employee password</label><input id="emp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="emp-go">Unlock</button></div>' +
      '<p class="error" id="emp-err" hidden></p></div>';
    $('emp-go').addEventListener('click', function () {
      var pw = $('emp-pass').value;
      rpc('check_houses_employee_pass', { p_slug: SLUG, p_password: pw }).then(function (ok) {
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
  function loadBookings(quiet) {
    return rpc('list_houses_bookings', { p_slug: SLUG, p_epass: empPass }).then(function (d) {
      bookings = d || [];
      if (currentView === 'inquiries') renderBookingsList();
      return bookings;
    }).catch(function (e) { if (!quiet) throw e; });
  }
  function renderInquiries() {
    var el = $('view-inquiries');
    if (!house) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (passLocked && !empUnlocked) { empGate(el, 'Inquiries', renderInquiries); return; }
    el.innerHTML = '<h2>Inquiries — ' + esc(house.name) + '</h2><p class="info">Questions about homes refresh on their own every few seconds.</p><div id="bookings-list"><p class="info">Loading…</p></div>';
    loadBookings().catch(function (e) {
      var l = $('bookings-list');
      if (l) l.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  function bookingDetails(b) {
    var d = b.data || {};
    var lines = [];
    if (d.name) lines.push('<b>' + esc(d.name) + '</b>');
    if (d.phone) lines.push('Phone: ' + esc(d.phone));
    if (d.email) lines.push('Email: ' + esc(d.email));
    if (d.listing) lines.push('Home: ' + esc(d.listing));
    if (d.message) lines.push('Message: ' + esc(d.message));
    return lines.join('<br>');
  }
  function renderBookingsList() {
    var el = $('bookings-list');
    if (!el) return;
    if (!bookings.length) { el.innerHTML = '<div class="card"><p class="info">No inquiries yet.</p></div>'; return; }
    var h = '';
    if (bookingsErr) h += '<p class="error">' + esc(bookingsErr) + '</p>';
    bookings.forEach(function (b) {
      h += '<div class="card"><h3>Inquiry #' + esc(b.id) +
        (b.status && b.status !== 'active' ? ' <span class="voided">(' + esc(b.status) + ')</span>' : '') + '</h3>' +
        '<p class="info">' + esc(fmtDT(b.created_at)) + '</p>' +
        '<p>' + bookingDetails(b) + '</p>' +
        (b.status === 'active'
          ? (cancelConfirmId === b.id
            ? '<p><b>Cancel this inquiry?</b></p><div class="row"><button class="small danger" data-cancel-yes="' + b.id + '" data-kind="' + b.kind + '">Yes, cancel</button><button class="small secondary" data-cancel-no="' + b.id + '">Keep it</button></div>'
            : '<div class="row"><button class="small" data-done="' + b.id + '" data-kind="' + b.kind + '">Mark done</button><button class="small danger" data-cancel="' + b.id + '" data-kind="' + b.kind + '">Cancel</button></div>')
          : '') +
        '</div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-done]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-done'));
        var kind = btn.getAttribute('data-kind');
        btn.disabled = true;
        rpc('update_houses_booking', { p_slug: SLUG, p_epass: empPass, p_kind: kind, p_id: id, p_status: 'done' })
          .then(function () { bookingsErr = ''; return loadBookings(); })
          .catch(function (e) { bookingsErr = 'Error: ' + e.message; renderBookingsList(); });
      });
    });
    el.querySelectorAll('[data-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        cancelConfirmId = Number(btn.getAttribute('data-cancel'));
        bookingsErr = '';
        renderBookingsList();
      });
    });
    el.querySelectorAll('[data-cancel-no]').forEach(function (btn) {
      btn.addEventListener('click', function () { cancelConfirmId = null; renderBookingsList(); });
    });
    el.querySelectorAll('[data-cancel-yes]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-cancel-yes'));
        var kind = btn.getAttribute('data-kind');
        btn.disabled = true;
        rpc('update_houses_booking', { p_slug: SLUG, p_epass: empPass, p_kind: kind, p_id: id, p_status: 'cancelled' })
          .then(function () { cancelConfirmId = null; bookingsErr = ''; return loadBookings(); })
          .catch(function (e) { cancelConfirmId = null; bookingsErr = 'Error: ' + e.message; renderBookingsList(); });
      });
    });
  }

  /* ---------- Setup (owner) ---------- */
  function renderSetup() {
    var el = $('view-setup');
    if (!house) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (!ownerCreds) {
      el.innerHTML = '<h2>Setup</h2><div class="card">' +
        '<p class="info">Enter the username and password Yently gave this agency.</p>' +
        '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
        '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
        '<div class="row"><button id="st-go">Log in</button></div>' +
        '<p class="error" id="st-err" hidden></p></div>';
      $('st-go').addEventListener('click', function () {
        var u = $('st-user').value.trim();
        var p = $('st-pass').value;
        rpc('check_houses_login', { p_slug: SLUG, p_u: u, p_p: p }).then(function (ok) {
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
    var featChecks = FEATURES.map(function (f) {
      return '<label class="check"><input type="checkbox" data-feat="' + esc(f) + '"> ' + esc(f) + '</label>';
    }).join(' ');
    var h = '<h2>Setup — ' + esc(house.name) + '</h2>' +
      '<div class="card"><h3>Agency details</h3>' +
      '<p class="info">Changes save as a draft. Upload for approval and the admin makes them live.</p>' +
      '<label>Agency name</label><input id="d-name" type="text" value="' + esc(draft.name || '') + '">' +
      '<label>Icon picture</label>' +
      '<div class="icon-field">' +
      '<img id="setup-icon-preview" class="icon-preview" src="' + esc(draft.icon || '') + '" alt=""' + (draft.icon ? '' : ' hidden') + '>' +
      '<input id="setup-icon-file" type="file" accept="image/*">' +
      '<button type="button" id="setup-icon-remove" class="small secondary">Remove icon</button>' +
      '</div>' +
      '<p class="info" id="setup-icon-out">One small picture shown next to the agency name. It is shrunk to 200px before uploading.</p>' +
      '<label>Address</label><input id="d-address" type="text" value="' + esc(draft.address || '') + '">' +
      '<label>Phone</label><input id="d-phone" type="tel" value="' + esc(draft.phone || '') + '">' +
      '<label>Hours</label><input id="d-hours" type="text" value="' + esc(draft.hours || '') + '">' +
      '<label>About</label><textarea id="d-about">' + esc(draft.about || '') + '</textarea>' +
      '<div class="row"><button id="d-save">Save draft</button>' +
      '<button id="d-upload" class="secondary">Upload for approval</button></div>' +
      '<p class="info" id="d-status">Draft status: ' + esc(draftStatus) + (draftStatus === 'pending' ? ' — waiting for Yently to approve it.' : draftStatus === 'approved' ? ' — approved, live now.' : ' — not sent yet.') + '</p>' +
      '<p class="error" id="d-err" hidden></p></div>' +
      '<div class="card"><h3>Listings</h3>' +
      '<p class="info">Listings go live right away — no approval needed.</p>' +
      '<div id="listings-list"></div>' +
      '<h3 id="listing-form-title">Add a listing</h3>' +
      '<label>Street address</label><input id="l-address" type="text" placeholder="e.g. 12 Maple Street">' +
      '<label>City</label><input id="l-city" type="text">' +
      '<label>ZIP</label><input id="l-zip" type="text">' +
      '<label>Price</label><input id="l-price" type="number" min="0" step="0.01" inputmode="decimal">' +
      '<label>Bedrooms</label><input id="l-bedrooms" type="number" min="0" step="1" inputmode="numeric">' +
      '<label>Bathrooms</label><input id="l-bathrooms" type="number" min="0" step="1" inputmode="numeric">' +
      '<label>Square feet</label><input id="l-sqft" type="number" min="0" step="1" inputmode="numeric">' +
      '<label>Home age (years)</label><input id="l-age" type="number" min="0" step="1" inputmode="numeric">' +
      '<label>Stories</label><input id="l-stories" type="number" min="0" step="1" inputmode="numeric">' +
      '<label>Description</label><textarea id="l-desc" rows="3"></textarea>' +
      '<label>Features</label><div class="row wrap" id="l-features">' + featChecks + '</div>' +
      '<label>Pictures (up to 7)</label>' +
      '<input id="l-pics" type="file" accept="image/*" multiple>' +
      '<div id="l-pics-list"></div>' +
      '<p class="error" id="l-pics-status" hidden></p>' +
      '<div class="row"><button id="l-save">Save listing</button>' +
      '<button id="l-cancel" class="secondary" hidden>Cancel edit</button></div>' +
      '<p class="error" id="l-err" hidden></p></div>';
    el.innerHTML = h;
    renderListingsList();
    $('d-save').addEventListener('click', function () { saveDraft(false); });
    $('d-upload').addEventListener('click', function () { saveDraft(true); });
    $('l-save').addEventListener('click', saveListing);
    $('l-cancel').addEventListener('click', function () { listingEditId = null; renderSetup(); });
    if (!listingEditId) listingPics = [];
    renderListingPics();
    $('l-pics').addEventListener('change', onListingPicsChosen);
    wireIconField();
  }
  function renderListingsList() {
    var el = $('listings-list');
    if (!el) return;
    var listings = house.listings || [];
    if (!listings.length) { el.innerHTML = '<p class="info">No listings yet.</p>'; return; }
    var h = '';
    listings.forEach(function (l) {
      h += '<div class="cart-line"><div><b>' + esc(listingLabel(l)) + '</b><br><span class="info">' + money(l.price) + (l.bedrooms != null && l.bedrooms !== '' ? ' · ' + l.bedrooms + ' beds' : '') + (l.sqft ? ' · ' + fmtNum(l.sqft) + ' sq ft' : '') + '</span></div>' +
        '<div class="row"><button class="small secondary" data-edit="' + l.id + '">Edit</button>' +
        (delConfirmId === l.id
          ? '<span><b>Delete "' + esc(listingLabel(l)) + '"?</b> <button class="small danger" data-del-yes="' + l.id + '">Yes, delete</button> <button class="small secondary" data-del-no="' + l.id + '">Keep it</button></span>'
          : '<button class="small danger" data-del="' + l.id + '">Delete</button>') + '</div></div>';
    });
    el.innerHTML = h;
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var l = listingById(Number(b.getAttribute('data-edit')));
        if (!l) return;
        listingEditId = l.id;
        $('l-address').value = l.address || '';
        $('l-city').value = l.city || '';
        $('l-zip').value = l.zip || '';
        $('l-price').value = l.price == null ? '' : l.price;
        $('l-bedrooms').value = l.bedrooms == null ? '' : l.bedrooms;
        $('l-bathrooms').value = l.bathrooms == null ? '' : l.bathrooms;
        $('l-sqft').value = l.sqft == null ? '' : l.sqft;
        $('l-age').value = l.age == null ? '' : l.age;
        $('l-stories').value = l.stories == null ? '' : l.stories;
        $('l-desc').value = l.description || '';
        document.querySelectorAll('#l-features [data-feat]').forEach(function (box) {
          box.checked = (l.features || []).indexOf(box.getAttribute('data-feat')) !== -1;
        });
        listingPics = (l.pics || []).slice();
        renderListingPics();
        $('listing-form-title').textContent = 'Edit listing — ' + listingLabel(l);
        $('l-cancel').hidden = false;
        window.scrollTo(0, document.getElementById('listing-form-title').offsetTop - 80);
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        delConfirmId = Number(b.getAttribute('data-del'));
        renderListingsList();
      });
    });
    el.querySelectorAll('[data-del-no]').forEach(function (b) {
      b.addEventListener('click', function () { delConfirmId = null; renderListingsList(); });
    });
    el.querySelectorAll('[data-del-yes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var l = listingById(Number(b.getAttribute('data-del-yes')));
        if (!l) return;
        b.disabled = true;
        rpc('delete_houses_listing', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_listing_id: l.id })
          .then(function () { delConfirmId = null; return loadHouse(); })
          .then(function () { renderSetup(); })
          .catch(function (e) { delConfirmId = null; renderListingsList(); var er = $('l-err'); if (er) { er.hidden = false; er.textContent = 'Error: ' + e.message; } });
      });
    });
  }
  function collectDraft() {
    return {
      name: $('d-name').value.trim(),
      address: $('d-address').value.trim(),
      phone: $('d-phone').value.trim(),
      hours: $('d-hours').value.trim(),
      about: $('d-about').value.trim(),
      icon: draft.icon || ''
    };
  }
  function saveDraft(upload) {
    var d = collectDraft();
    var err = $('d-err');
    if (!d.name) { err.hidden = false; err.textContent = 'Agency name is required.'; return; }
    err.hidden = true;
    rpc('save_houses_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_draft: d })
      .then(function () {
        draft = d;
        draftStatus = 'editing';
        if (!upload) {
          $('d-status').textContent = 'Draft status: editing — saved, not sent yet.';
          return;
        }
        return rpc('submit_houses_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p }).then(function () {
          draftStatus = 'pending';
          $('d-status').textContent = 'Draft status: pending — waiting for Yently to approve it.';
          notifyEmail('Houses draft for approval: ' + d.name, 'houses_draft', { slug: SLUG, name: d.name });
        });
      })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  /* ---------- Listing pictures (Setup) ---------- */
  /* Shrink a picture in the browser before it is stored. Listing
     pictures are shrunk to 800px on the long edge at JPEG quality 0.8
     — big enough to see the home, not high quality. PNGs stay PNG,
     small pictures untouched, and anything that fails falls back to
     the original file. */
  function shrinkImage(file, maxEdge, quality) {
    maxEdge = maxEdge || 1600;
    quality = quality || 0.85;
    try {
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(file);
        var image = new Image();
        image.onload = function () {
          URL.revokeObjectURL(url);
          var w0 = image.naturalWidth, h0 = image.naturalHeight;
          if (!w0 || !h0 || Math.max(w0, h0) <= maxEdge) { resolve(file); return; }
          var scale = maxEdge / Math.max(w0, h0);
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(w0 * scale);
          canvas.height = Math.round(h0 * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          var outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          canvas.toBlob(function (blob) {
            if (!blob) { resolve(file); return; }
            var name = outType === 'image/jpeg' ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
            resolve(new File([blob], name, { type: outType }));
          }, outType, quality);
        };
        image.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
        image.src = url;
      }).catch(function () { return file; });
    } catch (e) {
      return Promise.resolve(file);
    }
  }
  /* Upload one picture to the product-images bucket, under store/houses/,
     and return its public URL. Anon uploads are only allowed under
     store/ — this path qualifies, and the bucket is publicly readable. */
  function uploadListingPicture(file) {
    return shrinkImage(file, 800, 0.8).then(function (up) {
      var safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = 'store/houses/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
      return fetch(SUPABASE_URL + '/storage/v1/object/product-images/' + path, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: up
      }).then(function (res) {
        if (!res.ok) throw new Error('Picture upload failed');
        return SUPABASE_URL + '/storage/v1/object/public/product-images/' + path;
      });
    });
  }
  function renderListingPics() {
    var el = $('l-pics-list');
    if (!el) return;
    var h = '<p class="info">' + listingPics.length + ' of 7 pictures</p>';
    if (listingPics.length) {
      h += '<div class="pic-thumbs">';
      listingPics.forEach(function (url, i) {
        h += '<div class="pic-thumb"><img src="' + esc(listingPicSrc(url)) + '" alt="Listing picture ' + (i + 1) + '"><button class="small danger" data-pic-remove="' + i + '">Remove</button></div>';
      });
      h += '</div>';
    }
    el.innerHTML = h;
    el.querySelectorAll('[data-pic-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        listingPics.splice(Number(b.getAttribute('data-pic-remove')), 1);
        renderListingPics();
      });
    });
  }
  function onListingPicsChosen() {
    var input = $('l-pics');
    var status = $('l-pics-status');
    var files = (input && input.files) ? Array.prototype.slice.call(input.files) : [];
    if (!files.length) return;
    var room = 7 - listingPics.length;
    if (room <= 0) {
      if (status) { status.hidden = false; status.textContent = 'This listing already has 7 pictures — remove one to add another.'; }
      input.value = '';
      return;
    }
    if (files.length > room) {
      if (status) { status.hidden = false; status.textContent = 'Only 7 pictures per listing — the extra ' + (files.length - room) + ' picture(s) were not added.'; }
    } else if (status) { status.hidden = true; }
    input.value = '';
    var chain = Promise.resolve();
    files.slice(0, room).forEach(function (file) {
      chain = chain.then(function () { return uploadListingPicture(file); }).then(function (url) {
        listingPics.push(url);
        renderListingPics();
      }).catch(function (err) {
        if (status) { status.hidden = false; status.textContent = 'Upload failed: ' + err.message; }
      });
    });
  }
  function collectListing() {
    var num = function (id) {
      var v = $(id).value.trim();
      return v === '' ? null : Number(v);
    };
    var feats = [];
    document.querySelectorAll('#l-features [data-feat]').forEach(function (box) {
      if (box.checked) feats.push(box.getAttribute('data-feat'));
    });
    return {
      address: $('l-address').value.trim(),
      city: $('l-city').value.trim(),
      zip: $('l-zip').value.trim(),
      price: num('l-price') == null ? 0 : num('l-price'),
      bedrooms: num('l-bedrooms'),
      bathrooms: num('l-bathrooms'),
      sqft: num('l-sqft'),
      stories: num('l-stories'),
      age: num('l-age'),
      description: $('l-desc').value.trim(),
      features: feats,
      pics: listingPics.slice()
    };
  }
  function saveListing() {
    var err = $('l-err');
    var l = collectListing();
    if (!l.address) { err.hidden = false; err.textContent = 'Street address is required.'; return; }
    if (!(l.price >= 0)) { err.hidden = false; err.textContent = 'Price must be 0 or more.'; return; }
    err.hidden = true;
    if (listingEditId) l.id = listingEditId;
    rpc('save_houses_listing', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p, p_listing: l })
      .then(function () { listingEditId = null; return loadHouse(); })
      .then(function () { renderSetup(); })
      .catch(function (e) { err.hidden = false; err.textContent = 'Error: ' + e.message; });
  }
  function loadDraft() {
    rpc('get_houses_draft', { p_slug: SLUG, p_u: ownerCreds.u, p_p: ownerCreds.p })
      .then(function (d) {
        draft = d || {};
        draftStatus = 'editing';
        renderSetup();
      })
      .catch(function (e) {
        var el = $('view-setup');
        el.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
      });
  }

  /* ---------- start ---------- */
  function init() {
    if (!SLUG) {
      $('site-name').textContent = 'Houses';
      $('view-homes').innerHTML = '<div class="card"><h2>Houses not found</h2><p class="info">This houses page needs your own agency link — ask Yently for it.</p></div>';
      return;
    }
    loadHouse().then(function (d) {
      if (!d) {
        $('site-name').textContent = 'Houses';
        $('view-homes').innerHTML = '<div class="card"><h2>Houses not found</h2><p class="info">No agency with this link yet. Ask Yently to set it up.</p></div>';
        return;
      }
      return rpc('houses_pass_status', { p_slug: SLUG }).then(function (st) {
        passLocked = st === 'locked';
        empUnlocked = !passLocked;
        renderHomes();
      });
    }).catch(function (e) {
      $('view-homes').innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
    });
  }
  resolveSlug().then(function () { init(); });
})();
