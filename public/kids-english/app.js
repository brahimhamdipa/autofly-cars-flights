/* Kids English page app — ONE folder for every school.
   The school comes from its own private link, and its students,
   words and scores live in the database — there is no data.json
   file here. Visitors see the last APPROVED word list. The owner
   logs in with the username + password the admin created for
   their school (that login is what Yently sells); Setup edits
   save as a draft, and the Upload button sends the draft to the
   admin for approval. Approval makes the draft live instantly —
   no file swap, no redeploy wait.
   Play is PUBLIC: a child picks their name, picks a game, and
   plays 10 rounds. Scores are saved so the teacher can see each
   student's progress. The Teacher tab needs the school's shared
   teacher password (one password for everybody, set by the
   admin; schools with none set stay fully open). All credentials
   live in memory only: a reload asks again. */
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
  var STUDENT_KEY = 'kids-english-student-' + SLUG;

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
  var player = ''; // picked student name
  var game = ''; // 'spell' | 'pick-word' | 'pick-meaning'
  var questions = []; // words for this game, in round order
  var round = 0; // 0-based round index
  var score = 0;
  var answered = false; // true once the current round has been answered
  var scoreSaved = false;

  try { player = localStorage.getItem(STUDENT_KEY) || ''; } catch (e) {}

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rpc(name, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (res) {
      /* Some calls (save/upload/record) return no body at all — read text first
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
  function notifyEmail(subject, record) {
    try {
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ subject: subject, table: 'kids_english_draft', record: record })
      }).catch(function () {});
    } catch (e) {}
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function words() { return (data && data.words) || []; }
  function students() { return (data && data.students) || []; }

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

  /* ---------- Staff sign-in (Setup only) ---------- */
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
      rpc('check_kids_english_login', { p_slug: SLUG, p_username: u, p_password: p }).then(function (ok) {
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

  /* ---------- Teacher unlock (scores) ---------- */
  /* Scores are behind the school's shared teacher password — one
     password for everybody, set by the admin. Nothing is stored:
     a reload asks again. Schools with no password set skip this
     entirely (teacherUnlocked starts true for them, see the start
     block). The password is checked on the server by the list RPC,
     not just in the page, so the gate cannot be bypassed. */
  function renderTeacherPrompt(el, after) {
    el.innerHTML = '<h2>Teacher</h2><div class="card">' +
      '<p class="info">Enter the teacher password for this school to see the students\' scores.</p>' +
      '<label>Teacher password</label><input id="tp-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="tp-go">Unlock</button></div>' +
      '<div id="tp-out" style="margin-top:12px"></div></div>';
    $('tp-go').addEventListener('click', function () {
      var out = $('tp-out');
      var p = $('tp-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_kids_english_teacher_pass', { p_slug: SLUG, p_password: p }).then(function (ok) {
        if (ok === true) {
          teacherPass = p;
          teacherUnlocked = true;
          after();
        } else {
          out.innerHTML = '<p class="error">Wrong teacher password.</p>';
        }
      }).catch(function () {
        out.innerHTML = '<p class="error">Could not reach the sign-in check. Please try again in a moment.</p>';
      });
    });
  }
  function needTeacher(el, view) {
    if (teacherUnlocked) return false;
    renderTeacherPrompt(el, function () { show(view); });
    return true;
  }

  /* ---------- Play ---------- */
  var GAME_NAMES = { 'spell': 'Spell it', 'pick-word': 'Pick the word', 'pick-meaning': 'What does it mean?' };
  var PRAISE = ['Great job! 🎉', 'Well done! ⭐', 'You got it! 😄', 'Amazing! 🌟', 'Super! 👏'];
  function praise() { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; }

  function renderPlay() {
    var el = $('view-play');
    if (!data) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (!game) { renderPickPlayer(el); return; }
    if (round >= questions.length) { renderResult(el); return; }
    renderRound(el);
  }
  /* Step 1: who is playing, and which game? */
  function renderPickPlayer(el) {
    var list = students();
    var html = '<h2>Hi! Who is playing? 👋</h2>';
    if (!list.length) {
      html += '<div class="card"><p class="info">No students yet — the teacher adds names in Setup.</p></div>';
    } else {
      html += '<div class="student-grid">';
      list.forEach(function (name) {
        html += '<button class="student-btn' + (player === name ? ' selected' : '') + '" data-student="' + esc(name) + '">' + esc(name) + '</button>';
      });
      html += '</div>';
    }
    html += '<h2>Pick a game 🎮</h2><div class="game-grid">' +
      '<button class="game-btn" data-game="spell">✏️ Spell it<br><span>Type the word from its meaning</span></button>' +
      '<button class="game-btn" data-game="pick-word">🔤 Pick the word<br><span>Find the word that matches the meaning</span></button>' +
      '<button class="game-btn" data-game="pick-meaning">💡 What does it mean?<br><span>Find the meaning of the word</span></button>' +
      '</div><div id="play-out" style="margin-top:12px"></div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-student]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        player = btn.getAttribute('data-student');
        try { localStorage.setItem(STUDENT_KEY, player); } catch (e) {}
        renderPlay();
      });
    });
    el.querySelectorAll('[data-game]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var out = $('play-out');
        if (!player) {
          out.innerHTML = '<p class="error">Pick your name first, then pick a game. 😊</p>';
          return;
        }
        if (words().length < 4) {
          out.innerHTML = '<p class="error">This school needs at least 4 words before you can play — the teacher adds words in Setup.</p>';
          return;
        }
        startGame(btn.getAttribute('data-game'));
      });
    });
  }
  function startGame(g) {
    game = g;
    /* 10 rounds: shuffle the word list and take the first 10 (if
       there are fewer than 10 words, cycle the shuffled list). */
    var pool = shuffle(words());
    questions = [];
    while (questions.length < 10) questions = questions.concat(shuffle(pool));
    questions = questions.slice(0, 10);
    round = 0;
    score = 0;
    answered = false;
    scoreSaved = false;
    renderPlay();
  }
  function roundHeader() {
    return '<p class="round-line">Round ' + (round + 1) + ' of ' + questions.length + ' &nbsp;·&nbsp; ' + esc(player) + ' &nbsp;·&nbsp; ⭐ ' + score + '</p>';
  }
  function nextButtonHtml() {
    return '<div class="row"><button id="next-round">' + (round + 1 >= questions.length ? 'See my score! 🎉' : 'Next ➜') + '</button></div>';
  }
  function wireNext(el) {
    $('next-round').addEventListener('click', function () {
      round++;
      answered = false;
      renderPlay();
    });
  }
  /* Three wrong choices for a multiple-choice round: random other
     words (or meanings), never the right answer, never repeated. */
  function wrongChoices(right, all) {
    var pool = shuffle(all.filter(function (x) { return x !== right; }));
    return pool.slice(0, 3);
  }
  function renderRound(el) {
    var q = questions[round];
    var html = '<h2>' + esc(GAME_NAMES[game]) + '</h2>' + roundHeader();
    if (game === 'spell') {
      html += '<div class="card question-card"><p class="hint-label">What word means this?</p>' +
        '<p class="question-big">💬 ' + esc(q.meaning) + '</p>' +
        '<label>Type the word</label><input id="spell-answer" type="text" autocomplete="off" autocapitalize="off" placeholder="Type here…">' +
        '<div class="row"><button id="spell-check">Check ✅</button></div>' +
        '<div id="round-out" style="margin-top:12px"></div></div>';
      el.innerHTML = html;
      var input = $('spell-answer');
      input.focus();
      $('spell-check').addEventListener('click', function () { checkSpell(el); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !answered) checkSpell(el);
      });
      return;
    }
    if (game === 'pick-word') {
      var opts = shuffle([q.word].concat(wrongChoices(q.word, words().map(function (w) { return w.word; }))));
      html += '<div class="card question-card"><p class="hint-label">Which word means this?</p>' +
        '<p class="question-big">💬 ' + esc(q.meaning) + '</p><div class="choice-grid">';
      opts.forEach(function (opt) {
        html += '<button class="choice-btn" data-choice="' + esc(opt) + '">' + esc(opt) + '</button>';
      });
      html += '</div><div id="round-out" style="margin-top:12px"></div></div>';
      el.innerHTML = html;
      el.querySelectorAll('[data-choice]').forEach(function (btn) {
        btn.addEventListener('click', function () { answerChoice(el, btn, btn.getAttribute('data-choice') === q.word, q.word); });
      });
      return;
    }
    /* pick-meaning */
    var meanings = shuffle([q.meaning].concat(wrongChoices(q.meaning, words().map(function (w) { return w.meaning; }))));
    html += '<div class="card question-card"><p class="hint-label">What does this word mean?</p>' +
      '<p class="question-big">🔤 ' + esc(q.word) + '</p><div class="choice-grid">';
    meanings.forEach(function (m) {
      html += '<button class="choice-btn meaning-btn" data-choice="' + esc(m) + '">' + esc(m) + '</button>';
    });
    html += '</div><div id="round-out" style="margin-top:12px"></div></div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () { answerChoice(el, btn, btn.getAttribute('data-choice') === q.meaning, q.meaning); });
    });
  }
  function checkSpell(el) {
    if (answered) return;
    answered = true;
    var q = questions[round];
    var typed = ($('spell-answer').value || '').trim().toLowerCase();
    var right = String(q.word || '').trim().toLowerCase();
    var out = $('round-out');
    if (typed && typed === right) {
      score++;
      var rl = el.querySelector('.round-line');
      if (rl) rl.innerHTML = 'Round ' + (round + 1) + ' of ' + questions.length + ' &nbsp;·&nbsp; ' + esc(player) + ' &nbsp;·&nbsp; ⭐ ' + score;
      out.innerHTML = '<p class="good">' + praise() + ' "' + esc(q.word) + '" is right! ⭐</p>' + nextButtonHtml();
    } else {
      out.innerHTML = '<p class="try-again">Good try! The word is <strong>' + esc(q.word) + '</strong>. You will get the next one! 💪</p>' + nextButtonHtml();
    }
    var checkBtn = $('spell-check');
    if (checkBtn) checkBtn.disabled = true;
    var input = $('spell-answer');
    if (input) input.disabled = true;
    wireNext(el);
  }
  function answerChoice(el, btn, correct, rightText) {
    if (answered) return;
    answered = true;
    var out = $('round-out');
    el.querySelectorAll('[data-choice]').forEach(function (b) { b.disabled = true; });
    if (correct) {
      score++;
      var rl = el.querySelector('.round-line');
      if (rl) rl.innerHTML = 'Round ' + (round + 1) + ' of ' + questions.length + ' &nbsp;·&nbsp; ' + esc(player) + ' &nbsp;·&nbsp; ⭐ ' + score;
      btn.classList.add('correct');
      out.innerHTML = '<p class="good">' + praise() + '</p>' + nextButtonHtml();
    } else {
      btn.classList.add('wrong');
      out.innerHTML = '<p class="try-again">Good try! The right answer is <strong>' + esc(rightText) + '</strong>. You will get the next one! 💪</p>' + nextButtonHtml();
    }
    wireNext(el);
  }
  function renderResult(el) {
    var total = questions.length;
    var msg = score === total ? 'Perfect! You are a star! 🌟🎉'
      : score >= 7 ? 'Great work! You are learning so fast! 😄'
      : score >= 4 ? 'Good job! Keep practising! 💪'
      : 'Good try! Play again and you will do even better! 🌱';
    el.innerHTML = '<h2>Your score 🎉</h2><div class="card score-card">' +
      '<p class="score-big">' + score + ' / ' + total + '</p>' +
      '<p class="score-msg">' + msg + '</p>' +
      '<p class="info">' + esc(player) + ' · ' + esc(GAME_NAMES[game]) + '</p>' +
      '<div id="save-out"></div>' +
      '<div class="row"><button id="play-again">Play again 🔁</button>' +
      '<button id="change-game" class="secondary">Pick another game</button></div></div>';
    $('play-again').addEventListener('click', function () { startGame(game); });
    $('change-game').addEventListener('click', function () { game = ''; renderPlay(); });
    if (!scoreSaved) {
      scoreSaved = true;
      rpc('record_kids_english_score', { p_slug: SLUG, p_student_name: player, p_game: game, p_level: '', p_score: score, p_total: total }).catch(function () {
        var out = $('save-out');
        if (out) out.innerHTML = '<p class="info">Your score could not be saved this time — it will still show here.</p>';
      });
    }
  }

  /* ---------- Teacher (scores) ---------- */
  function openTeacher() {
    if (needTeacher($('view-teacher'), 'teacher')) return;
    var el = $('view-teacher');
    el.innerHTML = '<h2>Teacher — Scores</h2><div class="card"><p class="info">Loading scores…</p></div>';
    rpc('list_kids_english_scores', { p_slug: SLUG, p_epass: teacherPass }).then(function (rows) {
      var list = rows || [];
      var html = '<h2>Teacher — Scores</h2>';
      if (!list.length) {
        html += '<div class="card"><p class="info">No scores yet. Scores appear here once a student finishes a game.</p></div>';
      } else {
        html += '<div class="card"><table class="scores-table"><thead><tr><th>Student</th><th>Game</th><th>Score</th><th>Date</th></tr></thead><tbody>';
        list.forEach(function (r) {
          var when = r.created_at ? new Date(r.created_at).toLocaleString() : '';
          html += '<tr><td>' + esc(r.student_name) + '</td><td>' + esc(GAME_NAMES[r.game] || r.game) + '</td><td><strong>' + esc(r.score) + ' / ' + esc(r.total) + '</strong></td><td>' + esc(when) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      el.innerHTML = html;
    }).catch(function (err) {
      el.innerHTML = '<h2>Teacher — Scores</h2><div class="card"><p class="error">Could not load scores: ' + esc(err.message) + '</p></div>';
    });
  }

  /* ---------- Setup (login only: draft + Upload for approval) ---------- */
  function openSetup() {
    if (!staffUnlocked()) {
      renderStaffLogin($('view-setup'), 'Setup sign-in', function () { openSetup(); });
      return;
    }
    var el = $('view-setup');
    el.innerHTML = '<h2>Setup</h2><div class="card"><p class="info">Loading your draft…</p></div>';
    rpc('get_kids_english_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p }).then(function (res) {
      draft = res.data || {};
      draft.students = draft.students || [];
      draft.words = draft.words || [];
      draftStatus = res.status || 'editing';
      renderSetup();
    }).catch(function () {
      el.innerHTML = '<h2>Setup</h2><div class="card"><p class="error">Could not load your draft. Please try again in a moment.</p></div>';
    });
  }
  function statusLine() {
    if (draftStatus === 'pending') return 'Your changes were sent to Yently and are waiting for approval. Children still see the approved words.';
    if (draftStatus === 'approved') return 'Your last upload was approved and is now live.';
    return 'Your changes are saved as a draft. Children still see the approved words until you upload and Yently approves.';
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
      '<div class="row"><input id="setup-new-student" type="text" placeholder="New student name…" style="flex:1;margin:0">' +
      '<button id="setup-add-student" class="secondary">+ Add student</button></div>' +
      '<h2>Words</h2><p class="info">Each word has a meaning or hint the children see while they play.</p><div id="setup-words"></div>' +
      '<button id="setup-add-word" class="secondary">+ Add word</button>' +
      '<div class="row" style="margin-top:16px"><button id="setup-save" class="secondary">Save draft</button>' +
      '<button id="setup-upload">Upload for approval</button></div>' +
      '<div id="setup-out" style="margin-top:12px"></div>';
    el.innerHTML = html;

    var studentsEl = $('setup-students');
    function drawStudents() {
      studentsEl.innerHTML = '';
      if (!draft.students.length) {
        studentsEl.innerHTML = '<div class="card"><p class="info">No students yet — add names above.</p></div>';
        return;
      }
      draft.students.forEach(function (name, i) {
        var row = document.createElement('div');
        row.className = 'card student-row';
        row.innerHTML = '<strong>' + esc(name) + '</strong><span style="flex:1"></span>' +
          '<button class="small danger" data-remove-student="' + i + '">Remove</button>';
        row.querySelector('[data-remove-student]').addEventListener('click', function () {
          draft.students.splice(i, 1);
          drawStudents();
        });
        studentsEl.appendChild(row);
      });
    }
    drawStudents();
    $('setup-add-student').addEventListener('click', function () {
      var input = $('setup-new-student');
      var name = input.value.trim();
      if (!name) return;
      if (draft.students.indexOf(name) === -1) draft.students.push(name);
      input.value = '';
      drawStudents();
    });

    var wordsEl = $('setup-words');
    function wordRow(item, i) {
      var row = document.createElement('div');
      row.className = 'card';
      row.innerHTML =
        '<label>Word</label><input data-f="word" value="' + esc(item.word) + '">' +
        '<label>Meaning / hint</label><input data-f="meaning" value="' + esc(item.meaning || '') + '">' +
        '<button class="small danger" data-remove="' + i + '">Remove word</button>';
      row.querySelectorAll('[data-f]').forEach(function (input) {
        input.addEventListener('input', function () {
          item[input.getAttribute('data-f')] = input.value;
        });
      });
      row.querySelector('[data-remove]').addEventListener('click', function () {
        draft.words.splice(i, 1);
        drawWords();
      });
      return row;
    }
    function drawWords() {
      wordsEl.innerHTML = '';
      draft.words.forEach(function (item, i) { wordsEl.appendChild(wordRow(item, i)); });
    }
    drawWords();
    $('setup-add-word').addEventListener('click', function () {
      draft.words.push({ word: 'New word', meaning: '' });
      drawWords();
    });

    /* collectDraft must include EVERY editable field — name, about,
       students and words — or Setup silently drops it. */
    function collectDraft() {
      return {
        name: $('setup-name').value.trim() || draft.name,
        about: $('setup-about').value,
        students: draft.students.slice(),
        words: draft.words.filter(function (w) { return String(w.word || '').trim() !== ''; })
          .map(function (w) { return { word: String(w.word).trim(), meaning: String(w.meaning || '').trim() }; })
      };
    }
    $('setup-save').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Saving…</p>';
      var d = collectDraft();
      rpc('save_kids_english_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'editing';
        out.innerHTML = '<p class="info">Draft saved. Children still see the approved words.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not save: ' + esc(err.message) + '</p>';
      });
    });
    $('setup-upload').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Uploading…</p>';
      var d = collectDraft();
      rpc('submit_kids_english_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'pending';
        notifyEmail('Kids English draft for approval: ' + (d.name || SLUG), { school: d.name || '', slug: SLUG });
        out.innerHTML = '<p class="info">Uploaded! Your changes were sent to Yently and are waiting for approval. We will email you once they are live.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not upload: ' + esc(err.message) + '</p>';
      });
    });
  }

  /* ---------- Start ---------- */
  document.querySelectorAll('#tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      show(btn.getAttribute('data-view'));
    });
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
    rpc('get_kids_english_live', { p_slug: SLUG }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.students = data.students || [];
      data.words = data.words || [];
      document.title = data.name || 'Kids English';
      var logo = $('site-logo');
      if (data.logo) { logo.src = (/^https?:\/\//.test(data.logo) ? data.logo : BASE + data.logo); logo.hidden = false; }
      $('site-name').textContent = data.name || 'Kids English';
      $('site-about').textContent = data.about || '';
      $('site-footer').innerHTML = '<div>Powered by Yently</div>';
      rpc('kids_english_pass_status', { p_slug: SLUG }).then(function (s) {
        teacherUnlocked = !(s && s.has_pass);
        renderPlay();
      }).catch(function () {
        /* If the status check itself is unreachable, stay open rather
           than locking the teacher out of a working school. */
        teacherUnlocked = true;
        renderPlay();
      });
    }).catch(function () {
      $('site-name').textContent = 'School not found';
      $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school yet. Check the link and try again.</div>';
    });
  }
})();
