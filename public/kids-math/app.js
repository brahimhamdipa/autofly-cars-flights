/* Kids Math page app — ONE folder for every school.
   The school comes from its own private link, and its name, about
   text, students and questions-per-round live in the database —
   there is no data.json file here. Visitors see the last APPROVED
   version. The owner logs in with the username + password the
   admin created for their school (that login is what Yently
   sells); Setup edits save as a draft, and the Upload button sends
   the draft to the admin for approval. Approval makes the draft
   live instantly — no file swap, no redeploy wait.
   Play is PUBLIC: a child picks their name from the student list,
   picks a level and a game, and plays a round of questions. The
   score is saved so the teacher can see each student's progress.
   The Teacher tab needs the school's shared teacher password
   (one password for everybody, set by the admin; schools with
   none set stay fully open). Setup still asks for the owner's
   own login. All credentials live in memory only: a reload asks
   again, exactly like the other folder apps. */
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

  /* The round in progress. */
  var playStudent = '';
  var playLevel = 'Easy';
  var playGame = 'Addition';
  var playQuestions = [];
  var playIdx = 0;
  var playScore = 0;
  var playAnswered = false;
  var LAST_STUDENT_KEY = 'kids-math-last-student-' + SLUG;

  var LEVELS = [
    { name: 'Easy', blurb: 'Numbers to 10 · adding and taking away' },
    { name: 'Medium', blurb: 'Numbers to 50 · adding, taking away, and × 2, 3, 5' },
    { name: 'Hard', blurb: 'Numbers to 100 · all four operations' }
  ];
  var GAMES = ['Addition', 'Subtraction', 'Multiplication', 'Division'];
  var CHEERS = ['Great job! 🎉', 'Well done! ⭐', 'You did it! 🌟', 'Amazing! 👏', 'Super work! 🚀', 'Brilliant! 💪'];

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
        body: JSON.stringify({ subject: subject, table: 'kids_math_draft', record: record })
      }).catch(function () {});
    } catch (e) {}
  }
  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function questionsPerRound() {
    var n = data && data.questionsPerRound ? Number(data.questionsPerRound) : 10;
    if (!n || n < 1) n = 10;
    if (n > 50) n = 50;
    return n;
  }

  /* ---------- Question generation ---------- */
  /* Easy: numbers to 10, adding and taking away. Medium: numbers to
     50, adding, taking away, and multiplying by 2, 3 or 5. Hard:
     numbers to 100, all four operations. Division always has a
     whole-number answer. Subtraction never goes below zero. */
  function makeQuestion(game, level) {
    var a, b, ans, text;
    if (game === 'Addition') {
      var max = level === 'Easy' ? 10 : (level === 'Medium' ? 50 : 100);
      a = randInt(0, max); b = randInt(0, max);
      ans = a + b; text = a + ' + ' + b + ' = ?';
    } else if (game === 'Subtraction') {
      var maxS = level === 'Easy' ? 10 : (level === 'Medium' ? 50 : 100);
      a = randInt(0, maxS); b = randInt(0, a);
      ans = a - b; text = a + ' − ' + b + ' = ?';
    } else if (game === 'Multiplication') {
      if (level === 'Easy') { a = randInt(0, 5); b = randInt(0, 5); }
      else if (level === 'Medium') { a = randInt(0, 10); b = [2, 3, 5][randInt(0, 2)]; if (Math.random() < 0.5) { var t = a; a = b; b = t; } }
      else { a = randInt(0, 12); b = randInt(0, 12); }
      ans = a * b; text = a + ' × ' + b + ' = ?';
    } else { /* Division */
      if (level === 'Easy') { b = [2, 3, 5][randInt(0, 2)]; ans = randInt(0, 5); }
      else if (level === 'Medium') { b = [2, 3, 5][randInt(0, 2)]; ans = randInt(0, 10); }
      else { b = randInt(2, 12); ans = randInt(0, 12); }
      a = b * ans; text = a + ' ÷ ' + b + ' = ?';
    }
    var choices = [ans];
    var tries = 0;
    while (choices.length < 4 && tries < 40) {
      tries++;
      var d = ans + [1, -1, 2, -2, 10, -10, 3, -3][randInt(0, 7)];
      if (d < 0) continue;
      if (choices.indexOf(d) === -1) choices.push(d);
    }
    while (choices.length < 4) choices.push(ans + choices.length + 1);
    return { text: text, answer: ans, choices: shuffle(choices) };
  }
  function makeRound() {
    var n = questionsPerRound();
    var qs = [];
    for (var i = 0; i < n; i++) qs.push(makeQuestion(playGame, playLevel));
    return qs;
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

  /* ---------- Play (public) ---------- */
  function renderPlay() {
    var el = $('view-play');
    if (!data) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var students = data.students || [];
    if (!students.length) {
      el.innerHTML = '<h2>Play</h2><div class="card"><p class="info">No students have been added yet. The teacher can add names in Setup.</p></div>';
      return;
    }
    /* Remember the last picked student on this device, so a child
       does not have to find their name every time. */
    if (!playStudent) {
      try { playStudent = localStorage.getItem(LAST_STUDENT_KEY) || ''; } catch (e) {}
      if (students.indexOf(playStudent) === -1) playStudent = '';
    }
    var html = '<h2>Who is playing?</h2><div class="student-grid">';
    students.forEach(function (name) {
      html += '<button class="student-btn' + (playStudent === name ? ' selected' : '') + '" data-student="' + esc(name) + '">' + esc(name) + '</button>';
    });
    html += '</div>';
    html += '<h2>Pick a level</h2><div class="level-grid">';
    LEVELS.forEach(function (lv) {
      html += '<button class="level-btn' + (playLevel === lv.name ? ' selected' : '') + '" data-level="' + lv.name + '">' +
        '<span class="level-name">' + lv.name + '</span><span class="level-blurb">' + lv.blurb + '</span></button>';
    });
    html += '</div>';
    html += '<h2>Pick a game</h2><div class="game-grid">';
    GAMES.forEach(function (g) {
      html += '<button class="game-btn' + (playGame === g ? ' selected' : '') + '" data-game="' + g + '">' + g + '</button>';
    });
    html += '</div>';
    html += '<div class="row" style="margin-top:18px"><button id="play-start" class="big-btn"' + (playStudent ? '' : ' disabled') + '>▶ Start playing!</button></div>' +
      '<div id="play-out" style="margin-top:12px"></div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-student]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        playStudent = btn.getAttribute('data-student');
        try { localStorage.setItem(LAST_STUDENT_KEY, playStudent); } catch (e) {}
        renderPlay();
      });
    });
    el.querySelectorAll('[data-level]').forEach(function (btn) {
      btn.addEventListener('click', function () { playLevel = btn.getAttribute('data-level'); renderPlay(); });
    });
    el.querySelectorAll('[data-game]').forEach(function (btn) {
      btn.addEventListener('click', function () { playGame = btn.getAttribute('data-game'); renderPlay(); });
    });
    $('play-start').addEventListener('click', function () {
      if (!playStudent) {
        $('play-out').innerHTML = '<p class="error">Pick your name first!</p>';
        return;
      }
      playQuestions = makeRound();
      playIdx = 0;
      playScore = 0;
      renderQuestion();
    });
  }
  function renderQuestion() {
    var el = $('view-play');
    var q = playQuestions[playIdx];
    var total = playQuestions.length;
    playAnswered = false;
    var html = '<div class="progress">Question ' + (playIdx + 1) + ' of ' + total + ' &nbsp;·&nbsp; ⭐ ' + playScore + ' correct</div>' +
      '<div class="card question-card"><div class="question-text">' + esc(q.text) + '</div>' +
      '<div class="choice-grid">';
    q.choices.forEach(function (c) {
      html += '<button class="choice-btn" data-choice="' + c + '">' + c + '</button>';
    });
    html += '</div><div id="q-out" style="margin-top:14px"></div></div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (playAnswered) return;
        playAnswered = true;
        var picked = Number(btn.getAttribute('data-choice'));
        var correct = picked === q.answer;
        if (correct) playScore++;
        var prog = el.querySelector('.progress');
        if (prog) prog.innerHTML = 'Question ' + (playIdx + 1) + ' of ' + total + ' &nbsp;·&nbsp; ⭐ ' + playScore + ' correct';
        el.querySelectorAll('[data-choice]').forEach(function (b) {
          var v = Number(b.getAttribute('data-choice'));
          if (v === q.answer) b.classList.add('correct');
          else if (b === btn) b.classList.add('wrong');
          b.disabled = true;
        });
        var out = $('q-out');
        if (correct) {
          out.innerHTML = '<p class="cheer">' + CHEERS[randInt(0, CHEERS.length - 1)] + '</p>';
        } else {
          out.innerHTML = '<p class="info big">Not quite — the answer was <strong>' + q.answer + '</strong>. You will get the next one!</p>';
        }
        var nextLabel = playIdx + 1 >= total ? 'See my score! 🎉' : 'Next question →';
        out.innerHTML += '<div class="row" style="margin-top:14px"><button id="q-next" class="big-btn">' + nextLabel + '</button></div>';
        $('q-next').addEventListener('click', function () {
          playIdx++;
          if (playIdx >= total) renderResult();
          else renderQuestion();
        });
      });
    });
  }
  function renderResult() {
    var el = $('view-play');
    var total = playQuestions.length;
    var msg;
    if (playScore === total) msg = 'Perfect score! You are a maths star! 🌟🎉';
    else if (playScore >= Math.ceil(total * 0.7)) msg = 'Great job! You got most of them right! ⭐';
    else if (playScore >= Math.ceil(total * 0.4)) msg = 'Good try! Keep practising — you are getting better! 👍';
    else msg = 'Good effort! Try again — practice makes perfect! 💪';
    el.innerHTML = '<div class="card result-card"><h2>' + esc(playStudent) + ', you scored</h2>' +
      '<div class="score-big">' + playScore + ' / ' + total + '</div>' +
      '<p class="cheer">' + msg + '</p>' +
      '<p class="info">' + esc(playGame) + ' · ' + esc(playLevel) + '</p>' +
      '<p class="info" id="score-save-note">Saving your score…</p>' +
      '<div class="row"><button id="play-again" class="big-btn">Play again 🔁</button>' +
      '<button id="play-change" class="secondary big-btn">Change game</button></div></div>';
    rpc('record_kids_math_score', {
      p_slug: SLUG, p_student_name: playStudent, p_game: playGame,
      p_level: playLevel, p_score: playScore, p_total: total
    }).then(function () {
      var n = $('score-save-note');
      if (n) n.textContent = 'Your score was saved for your teacher to see. ✅';
    }).catch(function () {
      var n = $('score-save-note');
      if (n) n.textContent = 'Your score could not be saved this time — but great playing anyway!';
    });
    $('play-again').addEventListener('click', function () {
      playQuestions = makeRound();
      playIdx = 0;
      playScore = 0;
      renderQuestion();
    });
    $('play-change').addEventListener('click', function () { renderPlay(); });
  }

  /* ---------- Teacher (shared teacher password) ---------- */
  /* The scores are behind the school's shared teacher password —
     one password for everybody, set by the admin. Nothing is
     stored: a reload asks again. Schools with no password set skip
     this entirely (teacherUnlocked starts true for them, see the
     start block). */
  function renderTeacherPrompt(el) {
    el.innerHTML = '<h2>Teacher</h2><div class="card">' +
      '<p class="info">Enter the teacher password for this school to see the students\' scores.</p>' +
      '<label>Teacher password</label><input id="teacher-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="teacher-go">Unlock</button></div>' +
      '<div id="teacher-out" style="margin-top:12px"></div></div>';
    $('teacher-go').addEventListener('click', function () {
      var out = $('teacher-out');
      var p = $('teacher-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_kids_math_teacher_pass', { p_slug: SLUG, p_password: p }).then(function (ok) {
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
    rpc('list_kids_math_scores', { p_slug: SLUG, p_epass: teacherPass }).then(function (rows) {
      renderScores(rows || []);
    }).catch(function (err) {
      el.innerHTML = '<h2>Teacher</h2><div class="card"><p class="error">Could not load scores: ' + esc(err.message) + '</p></div>';
    });
  }
  function renderScores(rows) {
    var el = $('view-teacher');
    var html = '<h2>Teacher — Scores</h2>';
    if (!rows.length) {
      el.innerHTML = html + '<div class="card"><p class="info">No scores yet. Once children play a round, their scores will show up here.</p></div>';
      return;
    }
    /* Progress per student: how many rounds each child played, their
       best score and their average, so the teacher can see at a
       glance who is flying and who needs a little more practice. */
    var byStudent = {};
    rows.forEach(function (r) {
      var s = byStudent[r.student_name] || (byStudent[r.student_name] = { rounds: 0, best: 0, bestTotal: 0, sum: 0, sumTotal: 0 });
      s.rounds++;
      s.sum += r.score; s.sumTotal += r.total;
      if (r.total > 0 && (s.bestTotal === 0 || r.score / r.total > s.best / s.bestTotal)) { s.best = r.score; s.bestTotal = r.total; }
    });
    html += '<h3>Progress by student</h3><div class="card"><table class="scores-table"><thead><tr><th>Student</th><th>Rounds</th><th>Best</th><th>Average</th></tr></thead><tbody>';
    Object.keys(byStudent).sort().forEach(function (name) {
      var s = byStudent[name];
      var avg = s.sumTotal ? Math.round(100 * s.sum / s.sumTotal) : 0;
      html += '<tr><td><strong>' + esc(name) + '</strong></td><td>' + s.rounds + '</td><td>' + s.best + ' / ' + s.bestTotal + '</td><td>' + avg + '%</td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<h3>All scores (newest first)</h3><div class="card"><table class="scores-table"><thead><tr><th>Student</th><th>Game</th><th>Level</th><th>Score</th><th>Date</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var d = r.created_at ? new Date(r.created_at).toLocaleString() : '';
      html += '<tr><td><strong>' + esc(r.student_name) + '</strong></td><td>' + esc(r.game) + '</td><td>' + esc(r.level) + '</td><td>' + r.score + ' / ' + r.total + '</td><td>' + esc(d) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  }

  /* ---------- Setup (login only: draft + Upload for approval) ---------- */
  function openSetup() {
    if (!staffUnlocked()) {
      renderStaffLogin($('view-setup'), 'Setup sign-in', function () { openSetup(); });
      return;
    }
    var el = $('view-setup');
    el.innerHTML = '<h2>Setup</h2><div class="card"><p class="info">Loading your draft…</p></div>';
    rpc('get_kids_math_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p }).then(function (res) {
      draft = res.data || {};
      draft.students = draft.students || [];
      if (!draft.questionsPerRound) draft.questionsPerRound = 10;
      draftStatus = res.status || 'editing';
      renderSetup();
    }).catch(function () {
      el.innerHTML = '<h2>Setup</h2><div class="card"><p class="error">Could not load your draft. Please try again in a moment.</p></div>';
    });
  }
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
      rpc('check_kids_math_login', { p_slug: SLUG, p_username: u, p_password: p }).then(function (ok) {
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
      field('Questions per round', 'setup-qpr', draft.questionsPerRound, 'number') +
      '<p class="info">How many questions each round has. 10 is the usual number.</p>' +
      '</div><h2>Students</h2><div class="card">' +
      '<p class="info">Children pick their name from this list before they play. Add one name at a time.</p>' +
      '<div id="setup-students"></div>' +
      '<div class="row"><input id="setup-new-student" type="text" placeholder="New student name" style="flex:1;margin:0">' +
      '<button id="setup-add-student" class="secondary">+ Add student</button></div>' +
      '<div id="setup-student-out" style="margin-top:8px"></div></div>' +
      '<div class="row" style="margin-top:16px"><button id="setup-save" class="secondary">Save draft</button>' +
      '<button id="setup-upload">Upload for approval</button></div>' +
      '<div id="setup-out" style="margin-top:12px"></div>';
    el.innerHTML = html;
    function drawStudents() {
      var list = $('setup-students');
      if (!draft.students.length) {
        list.innerHTML = '<p class="info">No students yet — add the first one below.</p>';
        return;
      }
      var h = '';
      draft.students.forEach(function (name, i) {
        h += '<div class="student-row"><span>' + esc(name) + '</span>' +
          '<button class="small danger" data-remove-student="' + i + '">Remove</button></div>';
      });
      list.innerHTML = h;
      list.querySelectorAll('[data-remove-student]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          draft.students.splice(Number(btn.getAttribute('data-remove-student')), 1);
          drawStudents();
        });
      });
    }
    drawStudents();
    $('setup-add-student').addEventListener('click', function () {
      var input = $('setup-new-student');
      var out = $('setup-student-out');
      var name = input.value.trim();
      if (!name) { out.innerHTML = '<p class="error">Type a name first.</p>'; return; }
      if (draft.students.indexOf(name) !== -1) { out.innerHTML = '<p class="error">That name is already on the list.</p>'; return; }
      draft.students.push(name);
      input.value = '';
      out.innerHTML = '';
      drawStudents();
    });
    function collectDraft() {
      var qpr = Number($('setup-qpr').value);
      if (!qpr || qpr < 1) qpr = 10;
      if (qpr > 50) qpr = 50;
      return {
        name: $('setup-name').value.trim() || draft.name,
        about: $('setup-about').value,
        students: draft.students.filter(function (n) { return String(n).trim() !== ''; }),
        questionsPerRound: qpr
      };
    }
    $('setup-save').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Saving…</p>';
      var d = collectDraft();
      rpc('save_kids_math_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
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
      rpc('submit_kids_math_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'pending';
        notifyEmail('Kids Math draft for approval: ' + (d.name || SLUG), { school: d.name || '', slug: SLUG });
        out.innerHTML = '<p class="info">Uploaded! Your changes were sent to Yently and are waiting for approval. We will confirm once they are live. You will get your own private link by email.</p>';
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
  /* Black ↑ Top pill at the bottom-left, exactly like the other
     folder apps: always visible, tap it to jump back to the top. */
  var toTop = $('to-top');
  if (toTop) {
    toTop.addEventListener('click', function () { window.scrollTo(0, 0); });
  }
  if (!SLUG) {
    $('site-name').textContent = 'School not found';
    $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school. Check the link and try again — ask Yently for your school link.</div>';
  } else {
    rpc('get_kids_math_live', { p_slug: SLUG }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.students = data.students || [];
      if (!data.questionsPerRound) data.questionsPerRound = 10;
      document.title = data.name || 'Kids Math';
      var logo = $('site-logo');
      if (data.logo) { logo.src = (/^https?:\/\//.test(data.logo) ? data.logo : BASE + data.logo); logo.hidden = false; }
      $('site-name').textContent = data.name || 'Kids Math';
      $('site-about').textContent = data.about || '';
      var foot = [];
      if (data.about) foot.push(esc(data.about));
      var firstLine = foot.join(' · ');
      $('site-footer').innerHTML = (firstLine ? '<div>' + firstLine + '</div>' : '') +
        '<div>Powered by Yently</div>';
      rpc('kids_math_pass_status', { p_slug: SLUG }).then(function (s) {
        teacherUnlocked = !(s && s.has_pass === true);
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
