/* Kids Geography page app — ONE folder for every school.
   The school comes from its own private link, and its name, about
   text, students and country list live in the database — there is
   no data.json file here. Visitors see the last APPROVED version.
   The school logs in with the username + password the admin created
   for it (that login is what Yently sells); Setup edits save as a
   draft, and the Upload button sends the draft to the admin for
   approval. Approval makes the draft live instantly — no file swap,
   no redeploy wait.
   Play is PUBLIC: a child picks their name from the student list,
   picks a game (Capitals, Flags or Continents) and a level (Easy or
   Hard), and plays 10 rounds. The score is saved at the end so the
   teacher can see each student's progress. The Teacher tab needs
   the school's shared teacher password (one password for everybody,
   set by the admin; schools with none set stay fully open). Setup
   still asks for the owner's own login. All credentials live in
   memory only: a reload asks again. */
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
  var SLUG = String(params.s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
  var SLUG_FROM_PATH = false;
  var slugResolved = false;
  if (!SLUG) {
    // Clean link (yently.com/<slug>): the middleware rewrites the
    // page server-side, so location.search is empty in the browser.
    // The shop slug is then the last path segment. Ignore this
    // system's own folder name, so a bare /kids-geography visit still
    // shows "not found" by design.
    var segs = location.pathname.split('/').filter(function (s) { return s; });
    var lastSeg = (segs[segs.length - 1] || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    if (lastSeg && lastSeg !== 'kids-geography') { SLUG = lastSeg; SLUG_FROM_PATH = true; }
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
  var STUDENT_KEY = 'kids-geography-student-' + SLUG;

  /* Public by design: the same publishable key the main Yently site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null; // live school info (visitors)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var staffCreds = null; // {u, p} in memory only, never stored
  var teacherPass = null; // teacher password in memory only, never stored
  var teacherUnlocked = false; // true once the teacher password is entered, or when the school has none set
  var currentView = 'play';

  /* ---------- Play state ---------- */
  var playStudent = '';
  var playGame = 'capitals';
  var playLevel = 'easy';
  var rounds = []; // [{question, choices, answer}]
  var roundIdx = 0;
  var playScore = 0;
  var answered = false;
  var scoreSaved = false;

  var CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
  var CHEERS = ['Great job! 🎉', 'Well done! ⭐', 'You got it! 👏', 'Awesome! 🌟', 'Brilliant! 🏆'];
  var TRY_AGAIN = ['Good try — you will get the next one! 💪', 'Not quite — keep going! 🌈', 'Almost! Give the next one a go! 😊'];

  try { playStudent = localStorage.getItem(STUDENT_KEY) || ''; } catch (e) {}

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(arr, n, exclude) {
    var pool = arr.filter(function (x) { return exclude.indexOf(x) === -1; });
    return shuffle(pool).slice(0, n);
  }
  function rpc(name, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (res) {
      /* Some calls (save/upload/record) return no body at all — read
         text first and only parse when there is something to parse,
         so an empty success reply is not mistaken for a failure. */
      return res.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!res.ok) throw new Error((j && j.message) || 'request failed');
        return j;
      });
    });
  }
  function notifyEmail(subject, record) {
    try {
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ subject: subject, table: 'kids_geography_draft', record: record })
      }).catch(function () {});
    } catch (e) {}
  }

  function show(view) {
    currentView = view;
    ['play', 'teacher', 'setup'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
    });
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view);
    });
    if (view === 'play') renderPlay();
    if (view === 'teacher') openTeacher();
    if (view === 'setup') openSetup();
    window.scrollTo(0, 0);
  }

  /* ---------- Play ---------- */
  function countryPool() {
    var list = (data.countries || []).slice();
    if (playLevel === 'easy') {
      var easy = list.filter(function (c) { return c.easy; });
      if (easy.length >= 4) return easy;
    }
    return list;
  }
  function buildRounds() {
    var pool = shuffle(countryPool());
    var chosen = pool.slice(0, 10);
    rounds = chosen.map(function (c) {
      if (playGame === 'capitals') {
        var others = pick((data.countries || []).map(function (x) { return x.capital; }), 3, [c.capital]);
        return { prompt: 'What is the capital of <b>' + esc(c.name) + '</b>?', flag: '', choices: shuffle([c.capital].concat(others)), answer: c.capital };
      }
      if (playGame === 'flags') {
        var othersF = pick((data.countries || []).map(function (x) { return x.name; }), 3, [c.name]);
        return { prompt: 'Which country has this flag?', flag: c.flag || '', choices: shuffle([c.name].concat(othersF)), answer: c.name };
      }
      /* continents */
      var othersC = pick(CONTINENTS, 3, [c.continent]);
      return { prompt: 'Which continent is <b>' + esc(c.name) + '</b> in?', flag: '', choices: shuffle([c.continent].concat(othersC)), answer: c.continent };
    });
    roundIdx = 0;
    playScore = 0;
    answered = false;
    scoreSaved = false;
  }
  function gameTitle() {
    return playGame === 'capitals' ? 'Capitals' : playGame === 'flags' ? 'Flags' : 'Continents';
  }
  function renderPlay() {
    var el = $('view-play');
    if (!data) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var students = data.students || [];
    if (!students.length) {
      el.innerHTML = '<h2>🌍 Play</h2><div class="card"><p class="info">No students yet — ask your teacher to add students in Setup.</p></div>';
      return;
    }
    if (rounds.length === 0) {
      var html = '<h2>🌍 Play</h2>';
      html += '<div class="card"><p class="info">Pick your name, pick a game, and play 10 rounds. Good luck! 🍀</p>' +
        '<label>Your name</label><select id="play-student">' +
        '<option value="">— Pick your name —</option>' +
        students.map(function (s) { return '<option value="' + esc(s) + '"' + (s === playStudent ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
        '</select>' +
        '<label>Game</label><div class="game-pick">' +
        '<button type="button" class="game-btn' + (playGame === 'capitals' ? ' active' : '') + '" data-game="capitals">🏛️ Capitals</button>' +
        '<button type="button" class="game-btn' + (playGame === 'flags' ? ' active' : '') + '" data-game="flags">🚩 Flags</button>' +
        '<button type="button" class="game-btn' + (playGame === 'continents' ? ' active' : '') + '" data-game="continents">🌎 Continents</button>' +
        '</div>' +
        '<label>Level</label><div class="game-pick">' +
        '<button type="button" class="game-btn' + (playLevel === 'easy' ? ' active' : '') + '" data-level="easy">😊 Easy</button>' +
        '<button type="button" class="game-btn' + (playLevel === 'hard' ? ' active' : '') + '" data-level="hard">😎 Hard</button>' +
        '</div>' +
        '<p class="info">Easy uses only the well-known countries. Hard uses every country in the list.</p>' +
        '<button id="play-start" class="big-btn">▶ Start playing!</button>' +
        '<div id="play-out" style="margin-top:12px"></div></div>';
      el.innerHTML = html;
      $('play-student').addEventListener('change', function () {
        playStudent = $('play-student').value;
        try { localStorage.setItem(STUDENT_KEY, playStudent); } catch (e) {}
      });
      el.querySelectorAll('[data-game]').forEach(function (b) {
        b.addEventListener('click', function () { playGame = b.getAttribute('data-game'); renderPlay(); });
      });
      el.querySelectorAll('[data-level]').forEach(function (b) {
        b.addEventListener('click', function () { playLevel = b.getAttribute('data-level'); renderPlay(); });
      });
      $('play-start').addEventListener('click', function () {
        if (!playStudent) {
          $('play-out').innerHTML = '<p class="error">Please pick your name first. 🙂</p>';
          return;
        }
        if ((data.countries || []).length < 4) {
          $('play-out').innerHTML = '<p class="error">Not enough countries yet — ask your teacher to add more in Setup.</p>';
          return;
        }
        buildRounds();
        renderRound();
      });
      return;
    }
    renderRound();
  }
  function renderRound() {
    var el = $('view-play');
    if (roundIdx >= rounds.length) { renderResult(); return; }
    var r = rounds[roundIdx];
    var html = '<h2>🌍 ' + gameTitle() + ' — Round ' + (roundIdx + 1) + ' of ' + rounds.length + '</h2>' +
      '<div class="card"><p class="score-line">⭐ ' + esc(playStudent) + ' · Score: ' + playScore + '</p>' +
      '<p class="question">' + r.prompt + '</p>' +
      (r.flag ? '<p class="big-flag">' + esc(r.flag) + '</p>' : '') +
      '<div class="choices">' +
      r.choices.map(function (c, i) { return '<button class="choice-btn" data-choice="' + i + '">' + esc(c) + '</button>'; }).join('') +
      '</div><div id="round-out" style="margin-top:14px"></div></div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (answered) return;
        answered = true;
        var picked = r.choices[Number(btn.getAttribute('data-choice'))];
        var correct = picked === r.answer;
        if (correct) playScore++;
        var sl = el.querySelector('.score-line');
        if (sl) sl.textContent = '⭐ ' + playStudent + ' · Score: ' + playScore;
        el.querySelectorAll('[data-choice]').forEach(function (b) {
          var v = r.choices[Number(b.getAttribute('data-choice'))];
          if (v === r.answer) b.classList.add('correct');
          else if (b === btn) b.classList.add('wrong');
          b.disabled = true;
        });
        var out = $('round-out');
        var cheer = correct
          ? CHEERS[Math.floor(Math.random() * CHEERS.length)]
          : TRY_AGAIN[Math.floor(Math.random() * TRY_AGAIN.length)] + ' The answer was <b>' + esc(r.answer) + '</b>.';
        out.innerHTML = '<p class="note">' + cheer + '</p>' +
          '<button id="round-next" class="big-btn">' + (roundIdx + 1 === rounds.length ? '🏁 See my score!' : 'Next ➜') + '</button>';
        $('round-next').addEventListener('click', function () {
          roundIdx++;
          answered = false;
          renderRound();
        });
      });
    });
  }
  function renderResult() {
    var el = $('view-play');
    var total = rounds.length;
    var msg = playScore === total ? 'Perfect score! You are a geography star! 🌟🏆'
      : playScore >= 7 ? 'Great job! You know your geography! 🎉'
      : playScore >= 4 ? 'Good work — keep practising and you will get even better! 🙂'
      : 'Good try! Play again and see if you can beat your score! 💪';
    el.innerHTML = '<h2>🏁 Your score</h2><div class="card result-card">' +
      '<p class="big-score">' + playScore + ' / ' + total + '</p>' +
      '<p class="question">' + msg + '</p>' +
      '<p class="info">' + esc(playStudent) + ' · ' + gameTitle() + ' · ' + (playLevel === 'easy' ? 'Easy' : 'Hard') + '</p>' +
      '<div id="result-out"><p class="info">Saving your score…</p></div>' +
      '<button id="play-again" class="big-btn">🔄 Play again</button></div>';
    $('play-again').addEventListener('click', function () {
      rounds = [];
      renderPlay();
    });
    if (scoreSaved) return;
    scoreSaved = true;
    rpc('record_kids_geography_score', { p_slug: SLUG, p_student_name: playStudent, p_game: gameTitle(), p_level: playLevel, p_score: playScore, p_total: total }).then(function () {
      var out = $('result-out');
      if (out) out.innerHTML = '<p class="note">Your score was saved — your teacher can see it. ✅</p>';
    }).catch(function () {
      var out = $('result-out');
      if (out) out.innerHTML = '<p class="error">Your score could not be saved this time. You can play again.</p>';
    });
  }

  /* ---------- Teacher (shared teacher password) ---------- */
  /* The scores list needs the school's shared teacher password —
     one password for everybody, set by the admin. Nothing is
     stored: a reload asks again. Schools with no password set skip
     this entirely (teacherUnlocked starts true for them, see the
     start block). The password is checked on the server by the
     list RPC, not just in the page, so it cannot be bypassed. */
  function renderTeacherPrompt(el) {
    el.innerHTML = '<h2>Teacher</h2><div class="card">' +
      '<p class="info">Enter the teacher password for this school to see students\' scores.</p>' +
      '<label>Teacher password</label><input id="teacher-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="teacher-go">Unlock</button></div>' +
      '<div id="teacher-out" style="margin-top:12px"></div></div>';
    $('teacher-go').addEventListener('click', function () {
      var out = $('teacher-out');
      var p = $('teacher-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_kids_geography_teacher_pass', { p_slug: SLUG, p_password: p }).then(function (ok) {
        if (ok === true) {
          teacherPass = p;
          teacherUnlocked = true;
          openTeacher();
        } else {
          out.innerHTML = '<p class="error">Wrong teacher password.</p>';
        }
      }).catch(function () {
        out.innerHTML = '<p class="error">Could not reach the sign-in check. Please try again in a moment.</p>';
      });
    });
  }
  function openTeacher() {
    var el = $('view-teacher');
    if (!teacherUnlocked) { renderTeacherPrompt(el); return; }
    el.innerHTML = '<h2>Teacher</h2><div class="card"><p class="info">Loading scores…</p></div>';
    rpc('list_kids_geography_scores', { p_slug: SLUG, p_epass: teacherPass }).then(function (rows) {
      var list = rows || [];
      if (!list.length) {
        el.innerHTML = '<h2>Teacher</h2><div class="card"><p class="info">No scores saved yet. Once students play a game, their scores will appear here.</p></div>';
        return;
      }
      var html = '<h2>Teacher</h2><p class="info">' + list.length + ' saved score' + (list.length === 1 ? '' : 's') + ', newest first.</p>' +
        '<div class="card"><table class="scores-table"><thead><tr><th>Student</th><th>Game</th><th>Level</th><th>Score</th><th>Date</th></tr></thead><tbody>';
      list.forEach(function (r) {
        html += '<tr><td>' + esc(r.student_name) + '</td><td>' + esc(r.game) + '</td><td>' + esc(r.level) + '</td>' +
          '<td><b>' + esc(r.score) + ' / ' + esc(r.total) + '</b></td>' +
          '<td>' + esc(new Date(r.created_at).toLocaleString()) + '</td></tr>';
      });
      html += '</tbody></table></div>';
      el.innerHTML = html;
    }).catch(function (err) {
      el.innerHTML = '<h2>Teacher</h2><div class="card"><p class="error">Could not load scores: ' + esc(err.message) + '</p></div>';
    });
  }

  /* ---------- Setup (login only: draft + Upload for approval) ---------- */
  function staffUnlocked() { return !!staffCreds; }
  function renderStaffLogin(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the username and password Yently gave this school.</p>' +
      '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
      '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="st-go">Sign in</button></div>' +
      '<div id="st-out" style="margin-top:12px"></div></div>';
    $('st-go').addEventListener('click', function () {
      var out = $('st-out');
      var u = $('st-user').value.trim();
      var p = $('st-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_kids_geography_login', { p_slug: SLUG, p_username: u, p_password: p }).then(function (ok) {
        if (ok === true) {
          staffCreds = { u: u, p: p };
          after();
        } else {
          out.innerHTML = '<p class="error">Wrong username or password.</p>';
        }
      }).catch(function () {
        out.innerHTML = '<p class="error">Could not reach the sign-in check. Please try again in a moment.</p>';
      });
    });
  }
  function openSetup() {
    if (!staffUnlocked()) {
      renderStaffLogin($('view-setup'), 'Setup sign-in', function () { openSetup(); });
      return;
    }
    var el = $('view-setup');
    el.innerHTML = '<h2>Setup</h2><div class="card"><p class="info">Loading your draft…</p></div>';
    rpc('get_kids_geography_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p }).then(function (res) {
      draft = res.data || {};
      draft.students = draft.students || [];
      draft.countries = draft.countries || [];
      draftStatus = res.status || 'editing';
      renderSetup();
    }).catch(function () {
      el.innerHTML = '<h2>Setup</h2><div class="card"><p class="error">Could not load your draft. Please try again in a moment.</p></div>';
    });
  }
  function statusLine() {
    if (draftStatus === 'pending') return 'Your changes were sent to Yently and are waiting for approval. Children still see the approved version.';
    if (draftStatus === 'approved') return 'Your last upload was approved and is now live.';
    return 'Your changes are saved as a draft. Children still see the approved version until you upload and Yently approves.';
  }
  function renderSetup() {
    var el = $('view-setup');
    function field(label, id, value, type) {
      return '<label>' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '">';
    }
    var html = '<h2>Setup</h2>' +
      '<div class="note">' + esc(statusLine()) + '</div>' +
      '<div class="card">' +
      field('School name', 'setup-name', draft.name) +
      field('About text', 'setup-about', draft.about) +
      '</div><h2>Students</h2><div id="setup-students"></div>' +
      '<div class="row"><input id="setup-student-new" type="text" placeholder="New student name" style="flex:1;margin:0">' +
      '<button id="setup-student-add" class="secondary">+ Add student</button></div>' +
      '<h2>Countries</h2><div id="setup-countries"></div>' +
      '<button id="setup-country-add" class="secondary">+ Add country</button>' +
      '<div class="row" style="margin-top:16px"><button id="setup-save" class="secondary">Save draft</button>' +
      '<button id="setup-upload">Upload for approval</button></div>' +
      '<div id="setup-out" style="margin-top:12px"></div>';
    el.innerHTML = html;

    function drawStudents() {
      var box = $('setup-students');
      if (!box) return;
      if (!draft.students.length) {
        box.innerHTML = '<div class="card"><p class="info">No students yet — add one below.</p></div>';
        return;
      }
      box.innerHTML = '<div class="card">' + draft.students.map(function (s, i) {
        return '<div class="student-line"><span>' + esc(s) + '</span>' +
          '<button class="small danger" data-student-remove="' + i + '">Remove</button></div>';
      }).join('') + '</div>';
      box.querySelectorAll('[data-student-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          draft.students.splice(Number(btn.getAttribute('data-student-remove')), 1);
          drawStudents();
        });
      });
    }
    drawStudents();
    $('setup-student-add').addEventListener('click', function () {
      var v = $('setup-student-new').value.trim();
      if (!v) return;
      if (draft.students.indexOf(v) === -1) draft.students.push(v);
      $('setup-student-new').value = '';
      drawStudents();
    });

    var countriesEl = $('setup-countries');
    function countryRow(c, i) {
      var row = document.createElement('div');
      row.className = 'card';
      row.innerHTML =
        '<label>Country name</label><input data-f="name" value="' + esc(c.name) + '">' +
        '<label>Capital</label><input data-f="capital" value="' + esc(c.capital) + '">' +
        '<label>Continent</label><select data-f="continent">' +
        CONTINENTS.map(function (ct) { return '<option value="' + ct + '"' + (c.continent === ct ? ' selected' : '') + '>' + ct + '</option>'; }).join('') +
        '</select>' +
        '<label>Flag emoji (e.g. 🇫🇷)</label><input data-f="flag" value="' + esc(c.flag || '') + '">' +
        '<label class="check-label"><input type="checkbox" data-f="easy"' + (c.easy ? ' checked' : '') + '> Easy — a well-known country (shown on the Easy level)</label>' +
        '<button class="small danger" data-remove="' + i + '">Remove country</button>';
      row.querySelectorAll('[data-f]').forEach(function (input) {
        input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', function () {
          var f = input.getAttribute('data-f');
          c[f] = input.type === 'checkbox' ? input.checked : input.value;
        });
      });
      row.querySelector('[data-remove]').addEventListener('click', function () {
        draft.countries.splice(i, 1);
        renderSetup();
      });
      return row;
    }
    function drawCountries() {
      countriesEl.innerHTML = '';
      draft.countries.forEach(function (c, i) { countriesEl.appendChild(countryRow(c, i)); });
    }
    drawCountries();
    $('setup-country-add').addEventListener('click', function () {
      draft.countries.push({ name: 'New country', capital: '', continent: 'Europe', flag: '', easy: false });
      drawCountries();
    });

    /* collectDraft builds the draft field-by-field — EVERY editable
       field must be listed here, or Setup save silently drops it. */
    function collectDraft() {
      return {
        name: $('setup-name').value.trim() || draft.name,
        about: $('setup-about').value,
        students: draft.students.filter(function (s) { return String(s).trim() !== ''; }),
        countries: draft.countries.filter(function (c) { return String(c.name || '').trim() !== ''; }).map(function (c) {
          return { name: String(c.name).trim(), capital: String(c.capital || '').trim(), continent: c.continent || 'Europe', flag: String(c.flag || '').trim(), easy: !!c.easy };
        })
      };
    }
    $('setup-save').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Saving…</p>';
      var d = collectDraft();
      rpc('save_kids_geography_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'editing';
        out.innerHTML = '<p class="info">Draft saved. Children still see the approved version.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not save: ' + esc(err.message) + '</p>';
      });
    });
    $('setup-upload').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Uploading…</p>';
      var d = collectDraft();
      rpc('submit_kids_geography_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'pending';
        notifyEmail('Kids Geography draft for approval: ' + (d.name || SLUG), { school: d.name || '', slug: SLUG });
        out.innerHTML = '<p class="info">Uploaded! Your changes were sent to Yently and are waiting for approval. We will email you once they are live.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not upload: ' + esc(err.message) + '</p>';
      });
    });
  }

  /* ---------- Start ---------- */
  document.querySelectorAll('#tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () { show(btn.getAttribute('data-view')); });
  });
  /* Black ↑ Top pill at the bottom-left, exactly like the shop pages:
     always visible, tap it to jump back to the top. */
  var toTop = $('to-top');
  if (toTop) {
    toTop.addEventListener('click', function () { window.scrollTo(0, 0); });
  }
  if (!SLUG) {
    $('site-name').textContent = 'School not found';
    $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school. Check the link and try again — ask Yently for your school link.</div>';
  } else {
    resolveSlug().then(function () { return rpc('get_kids_geography_live', { p_slug: SLUG }); }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.students = data.students || [];
      data.countries = data.countries || [];
      document.title = data.name || 'Kids Geography';
      var logo = $('site-logo');
      if (data.logo) { logo.src = (/^https?:\/\//.test(data.logo) ? data.logo : BASE + data.logo); logo.hidden = false; }
      $('site-name').textContent = data.name || 'Kids Geography';
      $('site-about').textContent = data.about || '';
      $('site-footer').innerHTML = '<div>Powered by Yently</div>';
      rpc('kids_geography_pass_status', { p_slug: SLUG }).then(function (s) {
        teacherUnlocked = !(s && s.has_pass);
        renderPlay();
      }).catch(function () {
        /* If the status check itself is unreachable, stay open rather
           than locking everyone out of a working school. */
        teacherUnlocked = true;
        renderPlay();
      });
    }).catch(function () {
      $('site-name').textContent = 'School not found';
      $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school yet. Check the link and try again.</div>';
    });
  }
})();
