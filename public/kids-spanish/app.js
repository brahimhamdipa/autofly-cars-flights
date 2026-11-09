/* Kids Spanish — one folder for every school.
   Spanish vocabulary games for kids. The school comes from its own
   private link, and its name, students and word list live in the
   database — there is no data.json file here. Visitors always see
   the last APPROVED word list.
   Play is public: a child picks their name, picks a game, and plays
   10 rounds. Scores are saved so the teacher can see each student's
   progress. The Teacher tab needs the school's shared teacher
   password (one password for everybody, set by the admin; schools
   with none set stay fully open). Setup needs the owner's own
   username + password: edits save as a draft, and the Upload button
   sends the draft to the admin for approval. Approval makes the
   draft live instantly — no file swap, no redeploy wait.
   All credentials live in memory only: a reload asks again. */
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
  var STUDENT_KEY = 'kids-spanish-student-' + SLUG;

  /* Public by design: the same publishable key the main Yently site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null; // live school info + word list (visitors)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var staffCreds = null; // {u, p} in memory only, never stored
  var teacherPass = null; // teacher password in memory only, never stored
  var teacherUnlocked = false; // true once the teacher password is entered, or when the school has none set
  var currentView = 'play';

  /* ---------- Play state ---------- */
  var player = ''; // chosen student name
  var game = null; // 'spell' | 'pick' | 'meaning'
  var rounds = []; // the 10 words for this game, shuffled
  var roundIdx = 0;
  var score = 0;
  var answered = false; // true once the current round has been answered
  var lastAnswer = null; // { correct, picked, right } for the feedback line

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
        body: JSON.stringify({ subject: subject, table: 'kids_spanish_draft', record: record })
      }).catch(function () {});
    } catch (e) {}
  }
  /* Accents accepted with or without: "árbol" and "arbol" both count.
     Lowercase, split off accents (á → a, ñ → n), trim, collapse spaces. */
  function normalize(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function words() { return (data && data.words) || []; }
  function students() { return (data && data.students) || []; }

  var PRAISE = ['Great job! 🎉', 'Well done! ⭐', 'Awesome! 🌟', 'You did it! 👏', 'Brilliant! 😄', 'Keep going! 💪'];
  var TRY_AGAIN = ['Good try! 👍', 'Almost — you will get the next one! 💪', 'Nice effort! 🌟', 'Keep trying! 😊'];
  function praise() { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; }
  function tryAgain() { return TRY_AGAIN[Math.floor(Math.random() * TRY_AGAIN.length)]; }

  function loadPlayer() {
    try { player = localStorage.getItem(STUDENT_KEY) || ''; } catch (e) { player = ''; }
    if (player && students().indexOf(player) === -1) player = '';
  }
  function savePlayer() {
    try { localStorage.setItem(STUDENT_KEY, player); } catch (e) {}
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
  function gameTitle(g) {
    if (g === 'spell') return 'Spell it';
    if (g === 'pick') return 'Pick the word';
    return 'What does it mean?';
  }
  function renderPlay() {
    var el = $('view-play');
    if (!data) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (game) { renderRound(); return; }
    var html = '';
    if (!player) {
      html += '<h2>Who is playing? 👋</h2><div class="card"><p class="info">Tap your name to start playing!</p>';
      if (!students().length) {
        html += '<p class="info">No students yet — ask your teacher to add names in Setup.</p>';
      } else {
        html += '<div class="choice-grid">';
        students().forEach(function (name) {
          html += '<button class="big-choice" data-student="' + esc(name) + '">' + esc(name) + '</button>';
        });
        html += '</div>';
      }
      html += '</div>';
    } else {
      html += '<h2>Hi, ' + esc(player) + '! 👋</h2>' +
        '<div class="card"><p class="info">Pick a game — 10 rounds each. Good luck!</p>' +
        '<div class="game-grid">' +
        '<button class="game-card" data-game="spell"><span class="game-emoji">✏️</span><span class="game-name">Spell it</span><span class="game-desc">See the English word, type the Spanish word.</span></button>' +
        '<button class="game-card" data-game="pick"><span class="game-emoji">🔤</span><span class="game-name">Pick the word</span><span class="game-desc">See the English word, pick the right Spanish word.</span></button>' +
        '<button class="game-card" data-game="meaning"><span class="game-emoji">💬</span><span class="game-name">What does it mean?</span><span class="game-desc">See the Spanish word, pick the right English meaning.</span></button>' +
        '</div>' +
        '<p class="info">Not ' + esc(player) + '? <button class="small secondary" id="change-player">Change name</button></p></div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-student]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        player = btn.getAttribute('data-student');
        savePlayer();
        renderPlay();
      });
    });
    el.querySelectorAll('[data-game]').forEach(function (btn) {
      btn.addEventListener('click', function () { startGame(btn.getAttribute('data-game')); });
    });
    var change = $('change-player');
    if (change) change.addEventListener('click', function () {
      player = '';
      try { localStorage.removeItem(STUDENT_KEY); } catch (e) {}
      renderPlay();
    });
  }
  function startGame(g) {
    var list = shuffle(words());
    if (list.length < 4) {
      $('view-play').innerHTML = '<h2>' + esc(gameTitle(g)) + '</h2><div class="card"><p class="info">Not enough words yet to play — this school needs at least 4 words. Ask your teacher to add some in Setup.</p><button class="secondary" id="back-games">Back to games</button></div>';
      $('back-games').addEventListener('click', function () { game = null; renderPlay(); });
      return;
    }
    game = g;
    /* 10 rounds: cycle the shuffled words if there are fewer than 10. */
    rounds = [];
    for (var i = 0; i < 10; i++) rounds.push(list[i % list.length]);
    roundIdx = 0;
    score = 0;
    answered = false;
    lastAnswer = null;
    renderRound();
  }
  function choicesFor(right, field) {
    var others = shuffle(words().filter(function (w) { return w[field] !== right[field]; }));
    var picks = [right];
    for (var i = 0; i < others.length && picks.length < 4; i++) picks.push(others[i]);
    return shuffle(picks);
  }
  function renderRound() {
    var el = $('view-play');
    if (roundIdx >= rounds.length) { renderResult(); return; }
    var w = rounds[roundIdx];
    var html = '<div class="score-bar"><span>Round ' + (roundIdx + 1) + ' of ' + rounds.length + '</span><span>⭐ ' + score + ' correct</span><span>' + esc(player) + '</span></div>' +
      '<h2>' + esc(gameTitle(game)) + '</h2>';
    if (game === 'spell') {
      html += '<div class="card question"><p class="info">How do you say this in Spanish?</p>' +
        '<div class="big-word">' + esc(w.meaning) + '</div>' +
        '<input id="spell-input" type="text" placeholder="Type the Spanish word…" autocomplete="off" autocapitalize="off">' +
        '<button id="spell-check" class="big-btn">Check ✅</button>' +
        '<div id="round-out" style="margin-top:12px"></div></div>';
    } else if (game === 'pick') {
      html += '<div class="card question"><p class="info">Which Spanish word means this?</p>' +
        '<div class="big-word">' + esc(w.meaning) + '</div><div class="choice-grid">';
      choicesFor(w, 'word').forEach(function (c) {
        html += '<button class="big-choice" data-choice="' + esc(c.word) + '">' + esc(c.word) + '</button>';
      });
      html += '</div><div id="round-out" style="margin-top:12px"></div></div>';
    } else {
      html += '<div class="card question"><p class="info">What does this Spanish word mean?</p>' +
        '<div class="big-word">' + esc(w.word) + '</div><div class="choice-grid">';
      choicesFor(w, 'meaning').forEach(function (c) {
        html += '<button class="big-choice" data-choice="' + esc(c.meaning) + '">' + esc(c.meaning) + '</button>';
      });
      html += '</div><div id="round-out" style="margin-top:12px"></div></div>';
    }
    el.innerHTML = html;
    if (game === 'spell') {
      var input = $('spell-input');
      input.focus();
      $('spell-check').addEventListener('click', function () { answerSpell(input.value); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') answerSpell(input.value);
      });
    } else {
      el.querySelectorAll('[data-choice]').forEach(function (btn) {
        btn.addEventListener('click', function () { answerChoice(btn.getAttribute('data-choice')); });
      });
    }
    if (answered && lastAnswer) paintFeedback();
  }
  function feedbackHtml() {
    if (!lastAnswer) return '';
    var w = rounds[roundIdx];
    var h;
    if (lastAnswer.correct) {
      h = '<div class="note good">' + esc(praise()) + ' 🎉</div>';
    } else {
      h = '<div class="note bad">' + esc(tryAgain()) + ' The right answer is <b>' + esc(w.word) + '</b> — ' + esc(w.meaning) + '.</div>';
    }
    h += '<button id="next-round" class="big-btn">' + (roundIdx + 1 >= rounds.length ? 'See my score! 🏆' : 'Next 👉') + '</button>';
    return h;
  }
  function paintFeedback() {
    var bar = $('view-play').querySelector('.score-bar');
    if (bar) {
      var spans = bar.querySelectorAll('span');
      if (spans[1]) spans[1].textContent = '⭐ ' + score + ' correct';
    }
    var out = $('round-out');
    if (!out) return;
    out.innerHTML = feedbackHtml();
    var next = $('next-round');
    if (next) next.addEventListener('click', function () {
      roundIdx++;
      answered = false;
      lastAnswer = null;
      renderRound();
    });
    /* Disable the round's inputs so the answer cannot be changed. */
    var input = $('spell-input');
    if (input) input.disabled = true;
    var btn = $('spell-check');
    if (btn) btn.disabled = true;
    document.querySelectorAll('#view-play [data-choice]').forEach(function (b) {
      b.disabled = true;
      if (game === 'pick' && normalize(b.getAttribute('data-choice')) === normalize(rounds[roundIdx].word)) b.classList.add('correct');
      if (game === 'meaning' && normalize(b.getAttribute('data-choice')) === normalize(rounds[roundIdx].meaning)) b.classList.add('correct');
      if (lastAnswer && !lastAnswer.correct && b.getAttribute('data-choice') === lastAnswer.picked) b.classList.add('wrong');
    });
  }
  function answerSpell(typed) {
    if (answered) return;
    answered = true;
    var ok = normalize(typed) === normalize(rounds[roundIdx].word);
    if (ok) score++;
    lastAnswer = { correct: ok, picked: typed };
    paintFeedback();
  }
  function answerChoice(picked) {
    if (answered) return;
    answered = true;
    var right = game === 'pick' ? rounds[roundIdx].word : rounds[roundIdx].meaning;
    var ok = normalize(picked) === normalize(right);
    if (ok) score++;
    lastAnswer = { correct: ok, picked: picked };
    paintFeedback();
  }
  function renderResult() {
    var el = $('view-play');
    var total = rounds.length;
    var msg = score === total ? 'Perfect score! You are a Spanish star! 🌟🏆'
      : score >= 7 ? 'Great work, ' + player + '! You know a lot of Spanish! 😄'
      : score >= 4 ? 'Good job, ' + player + '! Keep practicing! 👍'
      : 'Good try, ' + player + '! Play again and you will get better! 💪';
    el.innerHTML = '<h2>Your score 🏆</h2><div class="card result">' +
      '<div class="big-score">' + score + ' / ' + total + '</div>' +
      '<p class="info">' + esc(msg) + '</p>' +
      '<p class="info" id="save-out">Saving your score…</p>' +
      '<div class="row"><button id="play-again" class="big-btn">Play again 🔄</button>' +
      '<button id="other-game" class="big-btn secondary">Other games</button></div></div>';
    $('play-again').addEventListener('click', function () { startGame(game); });
    $('other-game').addEventListener('click', function () { game = null; renderPlay(); });
    rpc('record_kids_spanish_score', { p_slug: SLUG, p_student_name: player, p_game: gameTitle(game), p_level: 'easy', p_score: score, p_total: total }).then(function () {
      var out = $('save-out');
      if (out) out.textContent = 'Score saved — your teacher can see it. 🎉';
    }).catch(function () {
      var out = $('save-out');
      if (out) out.textContent = 'Your score is ' + score + ' out of ' + total + '. (It could not be saved this time — try again later.)';
    });
  }

  /* ---------- Teacher (shared teacher password) ---------- */
  /* The scores table needs the school's shared teacher password —
     one password for everybody, set by the admin. Nothing is stored:
     a reload asks again. Schools with no password set skip this
     entirely (teacherUnlocked starts true for them, see the start
     block). */
  function renderTeacherPrompt(el, after) {
    el.innerHTML = '<h2>Teacher</h2><div class="card">' +
      '<p class="info">Enter the teacher password for this school to see the students\' scores.</p>' +
      '<label>Teacher password</label><input id="teacher-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="teacher-go" class="big-btn">Unlock</button></div>' +
      '<div id="teacher-out" style="margin-top:12px"></div></div>';
    $('teacher-go').addEventListener('click', function () {
      var out = $('teacher-out');
      var p = $('teacher-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_kids_spanish_teacher_pass', { p_slug: SLUG, p_password: p }).then(function (ok) {
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
  function needTeacher(el) {
    if (teacherUnlocked) return false;
    renderTeacherPrompt(el, function () { openTeacher(); });
    return true;
  }
  function openTeacher() {
    var el = $('view-teacher');
    if (needTeacher(el)) return;
    el.innerHTML = '<h2>Teacher — Scores</h2><div class="card"><p class="info">Loading scores…</p></div>';
    rpc('list_kids_spanish_scores', { p_slug: SLUG, p_epass: teacherPass }).then(function (rows) {
      var list = rows || [];
      if (!list.length) {
        el.innerHTML = '<h2>Teacher — Scores</h2><div class="card"><p class="info">No scores yet. Once a student finishes a game, their score shows here.</p></div>';
        return;
      }
      var html = '<h2>Teacher — Scores</h2><p class="info">Newest first. Each row is one finished game.</p><div class="card"><table class="scores"><thead><tr><th>Student</th><th>Game</th><th>Score</th><th>Date</th></tr></thead><tbody>';
      list.forEach(function (r) {
        html += '<tr><td>' + esc(r.student_name) + '</td><td>' + esc(r.game) + '</td><td><b>' + esc(r.score) + ' / ' + esc(r.total) + '</b></td><td>' + esc(new Date(r.created_at).toLocaleString()) + '</td></tr>';
      });
      html += '</tbody></table></div>';
      el.innerHTML = html;
    }).catch(function (err) {
      el.innerHTML = '<h2>Teacher — Scores</h2><div class="card"><p class="error">Could not load scores: ' + esc(err.message) + '</p></div>';
    });
  }

  /* ---------- Setup (owner login only: draft + Upload for approval) ---------- */
  function renderStaffLogin(el, heading, after) {
    el.innerHTML = '<h2>' + heading + '</h2><div class="card">' +
      '<p class="info">Enter the username and password Yently gave this school.</p>' +
      '<label>Username</label><input id="st-user" type="text" autocomplete="username">' +
      '<label>Password</label><input id="st-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="st-go" class="big-btn">Sign in</button></div>' +
      '<div id="st-out" style="margin-top:12px"></div></div>';
    $('st-go').addEventListener('click', function () {
      var out = $('st-out');
      var u = $('st-user').value.trim();
      var p = $('st-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_kids_spanish_login', { p_slug: SLUG, p_username: u, p_password: p }).then(function (ok) {
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
  function staffUnlocked() { return !!staffCreds; }
  function openSetup() {
    if (!staffUnlocked()) {
      renderStaffLogin($('view-setup'), 'Setup sign-in', function () { openSetup(); });
      return;
    }
    var el = $('view-setup');
    el.innerHTML = '<h2>Setup</h2><div class="card"><p class="info">Loading your draft…</p></div>';
    rpc('get_kids_spanish_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p }).then(function (res) {
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
      '</div>' +
      '<h2>Students</h2><div class="card"><p class="info">Children pick their name from this list before playing.</p>' +
      '<div id="setup-students"></div>' +
      '<div class="row"><input id="setup-new-student" type="text" placeholder="New student name…"><button id="setup-add-student" class="secondary">+ Add student</button></div></div>' +
      '<h2>Words</h2><div class="card"><p class="info">Each word has a Spanish word and its English meaning. At least 4 words are needed to play the games.</p>' +
      '<div id="setup-words"></div>' +
      '<button id="setup-add-word" class="secondary">+ Add word</button></div>' +
      '<div class="row" style="margin-top:16px"><button id="setup-save" class="secondary big-btn">Save draft</button>' +
      '<button id="setup-upload" class="big-btn">Upload for approval</button></div>' +
      '<div id="setup-out" style="margin-top:12px"></div>';
    el.innerHTML = html;
    var studentsEl = $('setup-students');
    function drawStudents() {
      studentsEl.innerHTML = '';
      if (!draft.students.length) studentsEl.innerHTML = '<p class="info">No students yet.</p>';
      draft.students.forEach(function (name, i) {
        var row = document.createElement('div');
        row.className = 'student-row';
        row.innerHTML = '<span>' + esc(name) + '</span><button class="small danger" data-remove-student="' + i + '">Remove</button>';
        row.querySelector('[data-remove-student]').addEventListener('click', function () {
          draft.students.splice(i, 1);
          drawStudents();
        });
        studentsEl.appendChild(row);
      });
    }
    drawStudents();
    $('setup-add-student').addEventListener('click', function () {
      var v = $('setup-new-student').value.trim();
      if (!v) return;
      if (draft.students.indexOf(v) === -1) draft.students.push(v);
      $('setup-new-student').value = '';
      drawStudents();
    });
    var wordsEl = $('setup-words');
    function drawWords() {
      wordsEl.innerHTML = '';
      if (!draft.words.length) wordsEl.innerHTML = '<p class="info">No words yet.</p>';
      draft.words.forEach(function (w, i) {
        var row = document.createElement('div');
        row.className = 'card word-row';
        row.innerHTML =
          '<label>Spanish word</label><input data-f="word" value="' + esc(w.word) + '">' +
          '<label>English meaning</label><input data-f="meaning" value="' + esc(w.meaning) + '">' +
          '<button class="small danger" data-remove-word="' + i + '">Remove word</button>';
        row.querySelectorAll('[data-f]').forEach(function (input) {
          input.addEventListener('input', function () {
            w[input.getAttribute('data-f')] = input.value;
          });
        });
        row.querySelector('[data-remove-word]').addEventListener('click', function () {
          draft.words.splice(i, 1);
          drawWords();
        });
        wordsEl.appendChild(row);
      });
    }
    drawWords();
    $('setup-add-word').addEventListener('click', function () {
      draft.words.push({ word: '', meaning: '' });
      drawWords();
    });
    /* collectDraft must include EVERY editable field — anything left
       out here is silently dropped when the owner saves. */
    function collectDraft() {
      return {
        name: $('setup-name').value.trim() || draft.name,
        about: $('setup-about').value,
        students: draft.students.slice(),
        words: draft.words.filter(function (w) { return String(w.word || '').trim() !== '' && String(w.meaning || '').trim() !== ''; })
          .map(function (w) { return { word: String(w.word).trim(), meaning: String(w.meaning).trim() }; })
      };
    }
    $('setup-save').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Saving…</p>';
      var d = collectDraft();
      rpc('save_kids_spanish_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
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
      rpc('submit_kids_spanish_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'pending';
        notifyEmail('Kids Spanish draft for approval: ' + (d.name || SLUG), { school: d.name || '', slug: SLUG });
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
  var toTop = $('to-top');
  if (toTop) {
    toTop.addEventListener('click', function () { window.scrollTo(0, 0); });
  }
  if (!SLUG) {
    $('site-name').textContent = 'School not found';
    $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school. Check the link and try again — ask Yently for your school link.</div>';
  } else {
    rpc('get_kids_spanish_live', { p_slug: SLUG }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.students = data.students || [];
      data.words = data.words || [];
      document.title = data.name || 'Kids Spanish';
      $('site-name').textContent = data.name || 'Kids Spanish';
      $('site-about').textContent = data.about || '';
      $('site-footer').innerHTML = '<div>Powered by Yently</div>';
      loadPlayer();
      rpc('kids_spanish_pass_status', { p_slug: SLUG }).then(function (s) {
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
