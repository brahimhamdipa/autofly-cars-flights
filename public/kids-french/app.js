/* Kids French — French vocabulary games for kids.
   One folder for every school. The school comes from its own
   private link, and its name, students, and word list live in the
   database — there is no data.json file here. Visitors always see
   the last APPROVED word list.
   Play is public: a child picks their name, picks a game, and
   plays 10 rounds. Three games: "Spell it" (see the English
   meaning, type the French word — accents are accepted with or
   without), "Pick the word" (see the English meaning, pick the
   right French word from 4 choices), and "What does it mean?"
   (see a French word, pick the right English meaning from 4).
   The score at the end is saved, so the teacher can see each
   student's progress.
   Teacher needs the school's shared teacher password (one
   password for everybody, set by the admin; schools with none set
   stay fully open) and shows a table of saved scores. The
   password is checked on the server by the RPC, not just in the
   page, so it cannot be bypassed.
   Setup is the owner's own username + password. Setup edits save
   as a draft, and the Upload button sends the draft to the admin
   for approval. Approval makes the draft live instantly — no file
   swap, no redeploy wait.
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
  var STUDENT_KEY = 'kids-french-student-' + SLUG;

  /* Public by design: the same publishable key the main Yently site
     ships in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null; // live school info (Play)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var staffCreds = null; // {u, p} in memory only, never stored
  var teacherPass = null; // teacher password in memory only, never stored
  var teacherUnlocked = false; // true once the teacher password is entered, or when the school has none set
  var currentView = 'play';

  /* ---------- Play state ---------- */
  var player = ''; // chosen student name
  var game = null; // 'spell' | 'pick' | 'meaning'
  var rounds = []; // the 10 words for this game, in order
  var roundIdx = 0;
  var score = 0;
  var choices = []; // the 4 choices for the current round
  var answered = false; // true once the current round has been answered
  var removeStudentIdx = -1; // Setup: student index awaiting an in-page remove check
  var removeWordIdx = -1; // Setup: word index awaiting an in-page remove check

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
        body: JSON.stringify({ subject: subject, table: 'kids_french_draft', record: record })
      }).catch(function () {});
    } catch (e) {}
  }
  /* Accents do not matter when checking an answer: é, è, ê and ë
     all count as e, ç counts as c, and so on — so a child can type
     "elephant" or "éléphant" and both are right. */
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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
  var GAME_NAMES = {
    spell: 'Spell it',
    pick: 'Pick the word',
    meaning: 'What does it mean?'
  };
  var GAME_DESCS = {
    spell: 'See the English meaning, type the French word.',
    pick: 'See the English meaning, pick the right French word.',
    meaning: 'See a French word, pick the right English meaning.'
  };
  var CHEERS = ['Great job! 🎉', 'Well done! ⭐', 'You did it! 👏', 'Super! 🌟', 'Amazing! 🏆'];

  function renderPlay() {
    var el = $('view-play');
    if (!data) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (game) { renderGame(); return; }
    var html = '<h2>Bonjour! 👋</h2>';
    html += '<div class="card"><p class="big">Who is playing today?</p>';
    if (!students().length) {
      html += '<p class="info">No students yet — the teacher adds names in Setup.</p>';
    } else {
      html += '<div class="name-grid">';
      students().forEach(function (name) {
        html += '<button class="name-btn' + (player === name ? ' selected' : '') + '" data-name="' + esc(name) + '">' + esc(name) + '</button>';
      });
      html += '</div>';
    }
    html += '</div>';
    if (player) {
      html += '<div class="card"><p class="big">Hi, ' + esc(player) + '! Pick a game:</p>';
      ['spell', 'pick', 'meaning'].forEach(function (g) {
        html += '<button class="game-btn" data-game="' + g + '">' + GAME_NAMES[g] + '<span>' + GAME_DESCS[g] + '</span></button>';
      });
      html += '</div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-name]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        player = btn.getAttribute('data-name');
        savePlayer();
        renderPlay();
      });
    });
    el.querySelectorAll('[data-game]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startGame(btn.getAttribute('data-game'));
      });
    });
  }

  function startGame(g) {
    var list = words();
    if (list.length < 4) {
      var el = $('view-play');
      el.innerHTML = '<h2>Not ready yet</h2><div class="card"><p class="info">This school needs at least 4 words before the games can start. The teacher adds words in Setup.</p><button id="back-home">Back</button></div>';
      $('back-home').addEventListener('click', function () { game = null; renderPlay(); });
      return;
    }
    game = g;
    rounds = shuffle(list).slice(0, 10);
    roundIdx = 0;
    score = 0;
    renderGame();
  }

  /* The 4 choices for a round: the right answer plus 3 others,
     picked at random from the word list and shuffled. */
  function makeChoices(correct, field) {
    var pool = shuffle(words().filter(function (w) { return norm(w[field]) !== norm(correct[field]); }));
    var opts = [correct];
    pool.slice(0, 3).forEach(function (w) { opts.push(w); });
    return shuffle(opts);
  }

  function renderGame() {
    var el = $('view-play');
    if (roundIdx >= rounds.length) { renderResult(); return; }
    var w = rounds[roundIdx];
    answered = false;
    var html = '<h2>' + GAME_NAMES[game] + '</h2>';
    html += '<p class="progress">Round ' + (roundIdx + 1) + ' of ' + rounds.length + ' &nbsp;•&nbsp; ⭐ ' + score + '</p>';
    html += '<p class="big">Playing as <strong>' + esc(player) + '</strong></p>';
    if (game === 'spell') {
      html += '<div class="card game-card"><p class="prompt-label">How do you say this in French?</p>' +
        '<p class="prompt-word">' + esc(w.meaning) + '</p>' +
        '<input id="spell-input" type="text" autocomplete="off" placeholder="Type the French word…">' +
        '<button id="spell-check" class="big-btn">Check ✅</button>' +
        '<div id="spell-out" style="margin-top:12px"></div></div>';
    } else if (game === 'pick') {
      choices = makeChoices(w, 'word');
      html += '<div class="card game-card"><p class="prompt-label">Which French word means this?</p>' +
        '<p class="prompt-word">' + esc(w.meaning) + '</p><div class="choice-grid">';
      choices.forEach(function (c, i) {
        html += '<button class="choice-btn" data-choice="' + i + '">' + esc(c.word) + '</button>';
      });
      html += '</div><div id="pick-out" style="margin-top:12px"></div></div>';
    } else {
      choices = makeChoices(w, 'meaning');
      html += '<div class="card game-card"><p class="prompt-label">What does this French word mean?</p>' +
        '<p class="prompt-word">' + esc(w.word) + '</p><div class="choice-grid">';
      choices.forEach(function (c, i) {
        html += '<button class="choice-btn" data-choice="' + i + '">' + esc(c.meaning) + '</button>';
      });
      html += '</div><div id="meaning-out" style="margin-top:12px"></div></div>';
    }
    html += '<button id="quit-game" class="secondary">Stop playing</button>';
    el.innerHTML = html;
    $('quit-game').addEventListener('click', function () { game = null; renderPlay(); });
    if (game === 'spell') {
      var input = $('spell-input');
      input.focus();
      var check = function () {
        if (answered) return;
        answered = true;
        var typed = input.value;
        var out = $('spell-out');
        var right = norm(typed) === norm(w.word);
        if (right) {
          score++;
          out.innerHTML = '<p class="correct">✅ ' + CHEERS[Math.floor(Math.random() * CHEERS.length)] + ' "' + esc(w.word) + '" is right!</p>';
        } else {
          out.innerHTML = '<p class="wrong">Not quite — "' + esc(w.word) + '" means "' + esc(w.meaning) + '". You will get the next one! 💪</p>';
        }
        nextButton(out);
      };
      $('spell-check').addEventListener('click', check);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); check(); }
      });
    } else {
      var outId = game === 'pick' ? 'pick-out' : 'meaning-out';
      el.querySelectorAll('[data-choice]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (answered) return;
          answered = true;
          var picked = choices[Number(btn.getAttribute('data-choice'))];
          var out = $(outId);
          var right = game === 'pick'
            ? norm(picked.word) === norm(w.word)
            : norm(picked.meaning) === norm(w.meaning);
          el.querySelectorAll('[data-choice]').forEach(function (b) {
            var c = choices[Number(b.getAttribute('data-choice'))];
            var isRight = game === 'pick' ? norm(c.word) === norm(w.word) : norm(c.meaning) === norm(w.meaning);
            if (isRight) b.classList.add('right');
            else if (b === btn) b.classList.add('wrong-pick');
            b.disabled = true;
          });
          if (right) {
            score++;
            out.innerHTML = '<p class="correct">✅ ' + CHEERS[Math.floor(Math.random() * CHEERS.length)] + '</p>';
          } else {
            out.innerHTML = '<p class="wrong">Not quite — the right answer is "' + esc(game === 'pick' ? w.word : w.meaning) + '". You will get the next one! 💪</p>';
          }
          nextButton(out);
        });
      });
    }
  }
  function nextButton(out) {
    var b = document.createElement('button');
    b.className = 'big-btn';
    b.textContent = roundIdx + 1 >= rounds.length ? 'See my score 🏆' : 'Next ➜';
    b.addEventListener('click', function () {
      roundIdx++;
      renderGame();
    });
    out.appendChild(b);
  }

  function renderResult() {
    var el = $('view-play');
    var total = rounds.length;
    var msg = score === total
      ? 'Perfect score! You are a French star! 🌟🏆'
      : score >= Math.ceil(total * 0.7)
        ? 'Great playing! You know a lot of French! 🎉'
        : score >= Math.ceil(total * 0.4)
          ? 'Good try! Keep playing and you will get even better! 💪'
          : 'Nice try! Play again and see how much you learn! 😊';
    el.innerHTML = '<h2>Your score</h2><div class="card game-card">' +
      '<p class="score-big">' + score + ' / ' + total + '</p>' +
      '<p class="big">' + esc(player) + ' — ' + GAME_NAMES[game] + '</p>' +
      '<p class="big">' + msg + '</p>' +
      '<p class="info" id="score-out">Saving your score…</p>' +
      '<div class="row"><button id="play-again" class="big-btn">Play again 🔄</button>' +
      '<button id="other-game" class="secondary">Try another game</button></div></div>';
    $('play-again').addEventListener('click', function () { startGame(game); });
    $('other-game').addEventListener('click', function () { game = null; renderPlay(); });
    rpc('record_kids_french_score', {
      p_slug: SLUG, p_student_name: player, p_game: GAME_NAMES[game],
      p_level: 'easy', p_score: score, p_total: total
    }).then(function () {
      var out = $('score-out');
      if (out) out.textContent = 'Score saved — your teacher can see it. ✅';
    }).catch(function () {
      var out = $('score-out');
      if (out) out.textContent = 'Score could not be saved this time — your teacher will not see this one.';
    });
  }

  /* ---------- Teacher (shared teacher password) ---------- */
  function renderTeacherPrompt(el, after) {
    el.innerHTML = '<h2>Teacher</h2><div class="card">' +
      '<p class="info">Enter the teacher password for this school to see student scores.</p>' +
      '<label>Teacher password</label><input id="teacher-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="teacher-go" class="big-btn">Unlock</button></div>' +
      '<div id="teacher-out" style="margin-top:12px"></div></div>';
    $('teacher-go').addEventListener('click', function () {
      var out = $('teacher-out');
      var p = $('teacher-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_kids_french_teacher_pass', { p_slug: SLUG, p_password: p }).then(function (ok) {
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
  function openTeacher() {
    var el = $('view-teacher');
    if (teacherUnlocked) { renderScores(el); return; }
    /* Schools with no teacher password set stay fully open. */
    rpc('kids_french_pass_status', { p_slug: SLUG }).then(function (s) {
      if (s && s.has_pass === false) {
        teacherUnlocked = true;
        teacherPass = '';
        renderScores(el);
      } else {
        renderTeacherPrompt(el, function () { renderScores($('view-teacher')); });
      }
    }).catch(function () {
      renderTeacherPrompt(el, function () { renderScores($('view-teacher')); });
    });
  }
  function renderScores(el) {
    el.innerHTML = '<h2>Student scores</h2><div class="card"><p class="info">Loading scores…</p></div>';
    rpc('list_kids_french_scores', { p_slug: SLUG, p_epass: teacherPass || '' }).then(function (rows) {
      var list = rows || [];
      var html = '<h2>Student scores</h2>';
      if (!list.length) {
        html += '<div class="card"><p class="info">No scores yet — once a child finishes a game, their score shows up here.</p></div>';
      } else {
        html += '<div class="card"><table class="scores"><thead><tr><th>Student</th><th>Game</th><th>Score</th><th>Date</th></tr></thead><tbody>';
        list.forEach(function (r) {
          var d = r.created_at ? new Date(r.created_at).toLocaleString() : '';
          html += '<tr><td>' + esc(r.student_name) + '</td><td>' + esc(r.game) + '</td><td><strong>' + esc(r.score) + ' / ' + esc(r.total) + '</strong></td><td>' + esc(d) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '<div class="row"><button id="scores-refresh" class="secondary">Refresh</button></div>';
      el.innerHTML = html;
      $('scores-refresh').addEventListener('click', function () { renderScores(el); });
    }).catch(function (err) {
      el.innerHTML = '<h2>Student scores</h2><div class="card"><p class="error">Could not load scores: ' + esc(err.message) + '</p></div>';
    });
  }

  /* ---------- Setup (owner login only: draft + Upload for approval) ---------- */
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
      rpc('check_kids_french_login', { p_slug: SLUG, p_username: u, p_password: p }).then(function (ok) {
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
    rpc('get_kids_french_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p }).then(function (res) {
      draft = res.data || {};
      draft.students = draft.students || [];
      draft.words = draft.words || [];
      draftStatus = res.status || 'editing';
      removeStudentIdx = -1;
      removeWordIdx = -1;
      renderSetup();
    }).catch(function () {
      el.innerHTML = '<h2>Setup</h2><div class="card"><p class="error">Could not load your draft. Please try again in a moment.</p></div>';
    });
  }
  function statusLine() {
    if (draftStatus === 'pending') return 'Your changes were sent to Yently and are waiting for approval. Children still see the approved word list.';
    if (draftStatus === 'approved') return 'Your last upload was approved and is now live.';
    return 'Your changes are saved as a draft. Children still see the approved word list until you upload and Yently approves.';
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
      '<div class="row"><input id="setup-new-student" type="text" placeholder="New student name…"><button id="setup-add-student" class="secondary">+ Add student</button></div>' +
      '<h2>Words</h2><div id="setup-words"></div>' +
      '<div class="row"><input id="setup-new-word" type="text" placeholder="French word…"><input id="setup-new-meaning" type="text" placeholder="English meaning…"><button id="setup-add-word" class="secondary">+ Add word</button></div>' +
      '<div class="row" style="margin-top:16px"><button id="setup-save" class="secondary">Save draft</button>' +
      '<button id="setup-upload">Upload for approval</button></div>' +
      '<div id="setup-out" style="margin-top:12px"></div>';
    el.innerHTML = html;

    var stEl = $('setup-students');
    function drawStudents() {
      stEl.innerHTML = '';
      if (!draft.students.length) {
        stEl.innerHTML = '<p class="info">No students yet.</p>';
        return;
      }
      draft.students.forEach(function (name, i) {
        var row = document.createElement('div');
        row.className = 'card setup-row';
        if (removeStudentIdx === i) {
          row.innerHTML = '<strong>' + esc(name) + '</strong><span> Remove this student?</span> ' +
            '<button class="danger" data-student-yes="' + i + '">Yes, remove</button> <button class="secondary" data-student-no="' + i + '">Keep</button>';
        } else {
          row.innerHTML = '<strong>' + esc(name) + '</strong><span style="flex:1"></span>' +
            '<button class="small danger" data-student-del="' + i + '">Remove</button>';
        }
        row.querySelectorAll('[data-student-del]').forEach(function (b) {
          b.addEventListener('click', function () { removeStudentIdx = i; drawStudents(); });
        });
        row.querySelectorAll('[data-student-no]').forEach(function (b) {
          b.addEventListener('click', function () { removeStudentIdx = -1; drawStudents(); });
        });
        row.querySelectorAll('[data-student-yes]').forEach(function (b) {
          b.addEventListener('click', function () {
            draft.students.splice(i, 1);
            removeStudentIdx = -1;
            drawStudents();
          });
        });
        stEl.appendChild(row);
      });
    }
    drawStudents();
    $('setup-add-student').addEventListener('click', function () {
      var v = $('setup-new-student').value.trim();
      if (!v) return;
      draft.students.push(v);
      $('setup-new-student').value = '';
      drawStudents();
    });

    var wEl = $('setup-words');
    function drawWords() {
      wEl.innerHTML = '';
      if (!draft.words.length) {
        wEl.innerHTML = '<p class="info">No words yet — add at least 4 so the games can start.</p>';
        return;
      }
      draft.words.forEach(function (w, i) {
        var row = document.createElement('div');
        row.className = 'card';
        row.innerHTML =
          '<label>French word</label><input data-f="word" value="' + esc(w.word) + '">' +
          '<label>English meaning</label><input data-f="meaning" value="' + esc(w.meaning) + '">' +
          (removeWordIdx === i
            ? '<p><b>Remove this word?</b> <button class="danger" data-word-yes="' + i + '">Yes, remove</button> <button class="secondary" data-word-no="' + i + '">Keep</button></p>'
            : '<button class="small danger" data-word-del="' + i + '">Remove word</button>');
        row.querySelectorAll('[data-f]').forEach(function (input) {
          input.addEventListener('input', function () {
            w[input.getAttribute('data-f')] = input.value;
          });
        });
        row.querySelectorAll('[data-word-del]').forEach(function (b) {
          b.addEventListener('click', function () { removeWordIdx = i; drawWords(); });
        });
        row.querySelectorAll('[data-word-no]').forEach(function (b) {
          b.addEventListener('click', function () { removeWordIdx = -1; drawWords(); });
        });
        row.querySelectorAll('[data-word-yes]').forEach(function (b) {
          b.addEventListener('click', function () {
            draft.words.splice(i, 1);
            removeWordIdx = -1;
            drawWords();
          });
        });
        wEl.appendChild(row);
      });
    }
    drawWords();
    $('setup-add-word').addEventListener('click', function () {
      var w = $('setup-new-word').value.trim();
      var m = $('setup-new-meaning').value.trim();
      if (!w || !m) return;
      draft.words.push({ word: w, meaning: m });
      $('setup-new-word').value = '';
      $('setup-new-meaning').value = '';
      drawWords();
    });

    function collectDraft() {
      return {
        name: $('setup-name').value.trim() || draft.name,
        about: $('setup-about').value,
        students: draft.students.filter(function (s) { return String(s).trim() !== ''; }),
        words: draft.words.filter(function (w) { return String(w.word).trim() !== '' && String(w.meaning).trim() !== ''; })
          .map(function (w) { return { word: String(w.word).trim(), meaning: String(w.meaning).trim() }; })
      };
    }
    $('setup-save').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Saving…</p>';
      var d = collectDraft();
      rpc('save_kids_french_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'editing';
        out.innerHTML = '<p class="info">Draft saved. Children still see the approved word list.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not save: ' + esc(err.message) + '</p>';
      });
    });
    $('setup-upload').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Uploading…</p>';
      var d = collectDraft();
      rpc('submit_kids_french_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'pending';
        notifyEmail('Kids French draft for approval: ' + (d.name || SLUG), { school: d.name || '', slug: SLUG });
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
  var toTop = $('to-top');
  if (toTop) {
    toTop.addEventListener('click', function () { window.scrollTo(0, 0); });
  }
  if (!SLUG) {
    $('site-name').textContent = 'School not found';
    $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school. Check the link and try again — ask Yently for your school link.</div>';
  } else {
    rpc('get_kids_french_live', { p_slug: SLUG }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.students = data.students || [];
      data.words = data.words || [];
      document.title = data.name || 'Kids French';
      var logo = $('site-logo');
      if (data.logo) { logo.src = (/^https?:\/\//.test(data.logo) ? data.logo : BASE + data.logo); logo.hidden = false; }
      $('site-name').textContent = data.name || 'Kids French';
      $('site-about').textContent = data.about || '';
      var foot = [];
      if (data.about) foot.push(esc(data.about));
      $('site-footer').innerHTML = (foot.length ? '<div>' + foot.join('') + '</div>' : '') +
        '<div>Powered by Yently</div>';
      loadPlayer();
      renderPlay();
    }).catch(function () {
      $('site-name').textContent = 'School not found';
      $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school yet. Check the link and try again.</div>';
    });
  }
})();
