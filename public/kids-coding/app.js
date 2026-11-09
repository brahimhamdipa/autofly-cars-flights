/* Kids Coding page app — ONE folder for every school.
   The school comes from its own private link, and its students and
   puzzles live in the database — there is no data.json file here.
   Visitors see the last APPROVED puzzles. The school logs in with
   the username + password the admin created for it (that login is
   what Yently sells); Setup edits save as a draft, and the Upload
   button sends the draft to the admin for approval. Approval makes
   the draft live instantly — no file swap, no redeploy wait.
   Play is PUBLIC: a child picks their name, picks a puzzle, and
   builds a program from blocks — Move forward, Turn left, Turn
   right, and Repeat 2× / 3× / 4×. A Repeat block repeats the NEXT
   block that many times (Repeat 3× + Move forward = 3 moves).
   No Blockly library is loaded: this is a small tap-to-add block
   system of our own, inspired by Blockly Games' Maze, so the
   folder stays self-contained and works offline of any CDN.
   The Teacher tab needs the school's shared teacher password
   (one password for everybody, set by the admin; schools with
   none set stay fully open). Solved puzzles are saved with the
   record RPC and shown as stars next to each puzzle. All
   credentials live in memory only: a reload asks again. */
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
  if (!SLUG) {
    // Clean link (yently.com/<slug>): the middleware rewrites the
    // page server-side, so location.search is empty in the browser.
    // The shop slug is then the last path segment. Ignore this
    // system's own folder name, so a bare /kids-coding visit still
    // shows "not found" by design.
    var segs = location.pathname.split('/').filter(function (s) { return s; });
    var lastSeg = (segs[segs.length - 1] || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    if (lastSeg && lastSeg !== 'kids-coding') SLUG = lastSeg;
  }
  var STUDENT_KEY = 'kids-coding-student-' + SLUG;
  var SOLVED_KEY = 'kids-coding-solved-' + SLUG;

  /* Public by design: the same publishable key the main Yently site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var data = null; // live school info + puzzles (visitors)
  var draft = null; // school draft (Setup)
  var draftStatus = 'editing';
  var staffCreds = null; // {u, p} in memory only, never stored
  var teacherPass = null; // teacher password in memory only, never stored
  var teacherUnlocked = false; // true once the teacher password is entered, or when the school has none set
  var currentView = 'play';

  /* ---------- Play state ---------- */
  var student = ''; // picked student name
  var puzzleId = null; // picked puzzle id
  var program = []; // blocks: {t:'fwd'|'left'|'right'|'rep', k:number}
  var robot = null; // {r, c, dir} — dir 0 up, 1 right, 2 down, 3 left
  var running = false;
  var runTimer = null;
  var runSteps = []; // expanded steps: {block, action}
  var runIdx = 0;
  var playMsg = ''; // message line under the grid (bump / win / try again)
  var playMsgKind = ''; // '', 'win', 'oops'
  var solved = loadSolved(); // {student: {puzzleId: stars}} — local copy of saved stars
  var delPuzzleIdx = null; // Setup puzzle index awaiting an in-page delete confirmation
  var editPuzzleIdx = null; // Setup puzzle index being edited, or -1 for a new puzzle
  var editPuzzle = null; // working copy of the puzzle being edited in Setup

  var ARROWS = ['⬆️', '➡️', '⬇️', '⬅️'];
  var DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function loadSolved() {
    try { return JSON.parse(localStorage.getItem(SOLVED_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function saveSolved() {
    try { localStorage.setItem(SOLVED_KEY, JSON.stringify(solved)); } catch (e) {}
  }
  try { student = localStorage.getItem(STUDENT_KEY) || ''; } catch (e) {}
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
        body: JSON.stringify({ subject: subject, table: 'kids_coding_draft', record: record })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- Puzzles ---------- */
  function getPuzzle(id) {
    var list = (data && data.puzzles) || [];
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
  function puzzleStars(id) {
    if (!student || !solved[student]) return 0;
    return solved[student][String(id)] || 0;
  }
  function starsText(n) {
    if (n >= 3) return '⭐⭐⭐';
    if (n === 2) return '⭐⭐';
    if (n === 1) return '⭐';
    return '';
  }
  function isWall(p, r, c) {
    var walls = p.walls || [];
    for (var i = 0; i < walls.length; i++) {
      if (walls[i][0] === r && walls[i][1] === c) return true;
    }
    return false;
  }
  function resetRobot() {
    var p = getPuzzle(puzzleId);
    if (!p) { robot = null; return; }
    robot = { r: p.start.r, c: p.start.c, dir: p.start.dir };
  }
  /* Expand the block program into single actions. A Repeat block
     repeats the NEXT block that many times (Repeat 3× + Move
     forward = 3 moves). Repeats in a row multiply (Repeat 2× +
     Repeat 3× + Move forward = 6 moves). A Repeat with nothing
     after it does nothing. */
  function expandProgram(prog) {
    var steps = [];
    var i = 0;
    while (i < prog.length) {
      var b = prog[i];
      if (b.t === 'rep') {
        var mult = b.k || 2;
        var j = i + 1;
        while (j < prog.length && prog[j].t === 'rep') { mult *= (prog[j].k || 2); j++; }
        if (j < prog.length) {
          for (var n = 0; n < mult; n++) steps.push({ block: j, action: prog[j].t });
          i = j + 1;
        } else {
          i = j;
        }
      } else {
        steps.push({ block: i, action: b.t });
        i++;
      }
    }
    return steps;
  }
  function blockLabel(b) {
    if (b.t === 'fwd') return '➡️ Move forward';
    if (b.t === 'left') return '↩️ Turn left';
    if (b.t === 'right') return '↪️ Turn right';
    return '🔁 Repeat ' + (b.k || 2) + '× the next block';
  }
  /* How many stars a solve earns: 3 stars when the program uses at
     most the puzzle's par number of blocks, 2 stars within par + 2,
     otherwise 1 star. */
  function starsFor(blockCount, par) {
    if (blockCount <= par) return 3;
    if (blockCount <= par + 2) return 2;
    return 1;
  }

  /* ---------- Tabs ---------- */
  function show(view) {
    currentView = view;
    stopRun();
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
  function gridHtml(p, highlightBlock) {
    var h = '<div class="maze" style="grid-template-columns:repeat(' + p.cols + ',1fr)">';
    for (var r = 0; r < p.rows; r++) {
      for (var c = 0; c < p.cols; c++) {
        var cls = 'cell';
        var inner = '';
        if (isWall(p, r, c)) cls += ' wall';
        if (p.goal.r === r && p.goal.c === c) { cls += ' goal'; inner = '⭐'; }
        if (robot && robot.r === r && robot.c === c) {
          cls += ' robot';
          inner = '<span class="robot-arrow">' + ARROWS[robot.dir] + '</span>';
        }
        h += '<div class="' + cls + '">' + inner + '</div>';
      }
    }
    h += '</div>';
    return h;
  }
  function programHtml() {
    if (!program.length) return '<p class="info">Tap the blocks below to build your program. The robot will follow them in order, from top to bottom.</p>';
    var h = '<ol class="program-list">';
    program.forEach(function (b, i) {
      h += '<li class="' + (running && runSteps[runIdx] && runSteps[runIdx].block === i ? 'active-step' : '') + '">' +
        '<span>' + esc(blockLabel(b)) + '</span>' +
        '<button class="small danger" data-rm-block="' + i + '" aria-label="Remove block">✕</button></li>';
    });
    h += '</ol>';
    return h;
  }
  function renderPlay() {
    var el = $('view-play');
    if (!data) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    var students = data.students || [];
    var puzzles = data.puzzles || [];
    var html = '<h2>Play</h2>';
    /* Student picker */
    html += '<div class="card"><h3>Who is playing? 🙋</h3>';
    if (!students.length) {
      html += '<p class="info">No students yet — ask your teacher to add names in Setup.</p>';
    } else {
      html += '<div class="row student-row">';
      students.forEach(function (s) {
        html += '<button class="student-btn' + (student === s ? ' picked' : '') + '" data-student="' + esc(s) + '">' + esc(s) + '</button>';
      });
      html += '</div>';
    }
    html += '</div>';
    if (!student) {
      html += '<div class="card"><p class="info">Pick your name above to start playing. Your stars are saved under your name. ✨</p></div>';
      el.innerHTML = html;
      wireStudentButtons(el);
      return;
    }
    /* Puzzle list */
    html += '<div class="card"><h3>Puzzles 🧩</h3><div class="puzzle-list">';
    if (!puzzles.length) {
      html += '<p class="info">No puzzles yet.</p>';
    }
    puzzles.forEach(function (p) {
      var st = puzzleStars(p.id);
      html += '<button class="puzzle-btn' + (String(puzzleId) === String(p.id) ? ' picked' : '') + '" data-puzzle="' + esc(String(p.id)) + '">' +
        '<span class="puzzle-name">' + esc(p.name) + '</span>' +
        '<span class="puzzle-meta">' + p.rows + '×' + p.cols + ' · par ' + p.par + '</span>' +
        (st ? '<span class="puzzle-stars">' + starsText(st) + '</span>' : '<span class="puzzle-stars dim">not solved yet</span>') +
        '</button>';
    });
    html += '</div></div>';
    var p = getPuzzle(puzzleId);
    if (!p) {
      html += '<div class="card"><p class="info">Pick a puzzle above and help the robot reach the ⭐!</p></div>';
      el.innerHTML = html;
      wireStudentButtons(el);
      wirePuzzleButtons(el);
      return;
    }
    /* Maze + program builder */
    html += '<div class="card"><h3>' + esc(p.name) + ' ' + starsText(puzzleStars(p.id)) + '</h3>';
    if (p.hint) html += '<p class="info">💡 Hint: ' + esc(p.hint) + '</p>';
    html += '<p class="info">Get the robot to the ⭐ in ' + p.par + ' blocks or fewer for 3 stars!</p>';
    html += '<div id="maze-wrap">' + gridHtml(p) + '</div>';
    if (playMsg) html += '<div class="note' + (playMsgKind === 'win' ? ' win-note' : '') + '">' + esc(playMsg) + '</div>';
    html += '<h3>Your program</h3><div id="program-wrap">' + programHtml() + '</div>';
    html += '<div class="row">' +
      '<button id="run-btn"' + (running || !program.length ? ' disabled' : '') + '>▶ Run</button>' +
      '<button id="reset-robot-btn" class="secondary">↺ Reset robot</button>' +
      '<button id="clear-btn" class="secondary">Clear program</button></div>';
    html += '<h3>Add a block 👇</h3>' +
      '<p class="info">“Repeat” repeats the <b>next</b> block — for example, Repeat 3× then Move forward moves 3 steps.</p>' +
      '<div class="row palette">' +
      '<button data-add-block="fwd">➡️ Move forward</button>' +
      '<button data-add-block="left">↩️ Turn left</button>' +
      '<button data-add-block="right">↪️ Turn right</button>' +
      '<button data-add-block="rep2">🔁 Repeat 2×</button>' +
      '<button data-add-block="rep3">🔁 Repeat 3×</button>' +
      '<button data-add-block="rep4">🔁 Repeat 4×</button>' +
      '</div></div>';
    el.innerHTML = html;
    wireStudentButtons(el);
    wirePuzzleButtons(el);
    el.querySelectorAll('[data-add-block]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (running) return;
        var k = btn.getAttribute('data-add-block');
        if (k === 'fwd') program.push({ t: 'fwd' });
        else if (k === 'left') program.push({ t: 'left' });
        else if (k === 'right') program.push({ t: 'right' });
        else if (k === 'rep2') program.push({ t: 'rep', k: 2 });
        else if (k === 'rep3') program.push({ t: 'rep', k: 3 });
        else if (k === 'rep4') program.push({ t: 'rep', k: 4 });
        playMsg = ''; playMsgKind = '';
        renderPlay();
      });
    });
    el.querySelectorAll('[data-rm-block]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (running) return;
        program.splice(Number(btn.getAttribute('data-rm-block')), 1);
        renderPlay();
      });
    });
    var runBtn = $('run-btn');
    if (runBtn) runBtn.addEventListener('click', startRun);
    var resetBtn = $('reset-robot-btn');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      stopRun();
      resetRobot();
      playMsg = ''; playMsgKind = '';
      renderPlay();
    });
    var clearBtn = $('clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      if (running) return;
      program = [];
      playMsg = ''; playMsgKind = '';
      renderPlay();
    });
  }
  function wireStudentButtons(el) {
    el.querySelectorAll('[data-student]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        student = btn.getAttribute('data-student');
        try { localStorage.setItem(STUDENT_KEY, student); } catch (e) {}
        if (!getPuzzle(puzzleId)) puzzleId = null;
        program = [];
        playMsg = ''; playMsgKind = '';
        resetRobot();
        loadScoresFromDb();
        renderPlay();
      });
    });
  }
  function wirePuzzleButtons(el) {
    el.querySelectorAll('[data-puzzle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        stopRun();
        puzzleId = btn.getAttribute('data-puzzle');
        program = [];
        playMsg = ''; playMsgKind = '';
        resetRobot();
        renderPlay();
      });
    });
  }
  /* Read the saved stars back from the scores list (teacher-pass
     RPC — works with the teacher password when the Teacher tab was
     unlocked, or with no password on schools with none set). When
     the list cannot be read (a locked school, child playing), the
     stars saved in this browser are used instead, so a child still
     sees their own stars right after solving. */
  function loadScoresFromDb() {
    rpc('list_kids_coding_scores', { p_slug: SLUG, p_epass: teacherPass || '' }).then(function (rows) {
      var list = rows || [];
      list.forEach(function (r) {
        if (!r.student_name || r.game == null) return;
        solved[r.student_name] = solved[r.student_name] || {};
        var prev = solved[r.student_name][String(r.game)] || 0;
        solved[r.student_name][String(r.game)] = Math.max(prev, Number(r.score) || 0);
      });
      saveSolved();
      if (currentView === 'play' && !running) renderPlay();
    }).catch(function () { /* locked school or offline — keep the browser copy */ });
  }
  function stopRun() {
    if (runTimer) { clearTimeout(runTimer); runTimer = null; }
    running = false;
    runSteps = [];
    runIdx = 0;
  }
  function startRun() {
    var p = getPuzzle(puzzleId);
    if (!p || !program.length || running) return;
    stopRun();
    resetRobot();
    playMsg = ''; playMsgKind = '';
    runSteps = expandProgram(program);
    if (!runSteps.length) {
      playMsg = 'Your program has only Repeat blocks — add a Move or Turn block after the Repeat and try again.';
      playMsgKind = 'oops';
      renderPlay();
      return;
    }
    running = true;
    renderPlay();
    runIdx = 0;
    stepRun();
  }
  function stepRun() {
    var p = getPuzzle(puzzleId);
    if (!running || !p) return;
    if (runIdx >= runSteps.length) {
      /* Program finished without reaching the goal. */
      running = false;
      if (!(robot.r === p.goal.r && robot.c === p.goal.c)) {
        playMsg = 'Not yet — the robot did not reach the ⭐. Try changing your blocks and run again!';
        playMsgKind = 'oops';
      }
      renderPlay();
      return;
    }
    var step = runSteps[runIdx];
    var bumped = false;
    if (step.action === 'left') robot.dir = (robot.dir + 3) % 4;
    else if (step.action === 'right') robot.dir = (robot.dir + 1) % 4;
    else if (step.action === 'fwd') {
      var nr = robot.r + DIRS[robot.dir][0];
      var nc = robot.c + DIRS[robot.dir][1];
      if (nr < 0 || nr >= p.rows || nc < 0 || nc >= p.cols) {
        bumped = true;
        playMsg = 'Oops — the robot can\'t leave the maze! Try a turn instead.';
        playMsgKind = 'oops';
      } else if (isWall(p, nr, nc)) {
        bumped = true;
        playMsg = 'Oops — the robot bumped into a wall! Try a different way.';
        playMsgKind = 'oops';
      } else {
        robot.r = nr; robot.c = nc;
      }
    }
    runIdx++;
    /* Re-paint just the maze + program so the robot visibly moves. */
    var mazeWrap = $('maze-wrap');
    if (mazeWrap) mazeWrap.innerHTML = gridHtml(p);
    var progWrap = $('program-wrap');
    if (progWrap) progWrap.innerHTML = programHtml();
    /* Re-wire the remove buttons after the program re-paint. */
    if (progWrap) progWrap.querySelectorAll('[data-rm-block]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (running) return;
        program.splice(Number(btn.getAttribute('data-rm-block')), 1);
        renderPlay();
      });
    });
    if (bumped) {
      running = false;
      renderPlay();
      return;
    }
    if (robot.r === p.goal.r && robot.c === p.goal.c) {
      running = false;
      var stars = starsFor(program.length, p.par);
      solved[student] = solved[student] || {};
      if ((solved[student][String(p.id)] || 0) < stars) solved[student][String(p.id)] = stars;
      saveSolved();
      playMsg = '🎉 You did it! ' + starsText(stars) + ' ' + (stars === 3 ? 'Amazing — you used ' + program.length + ' blocks!' : stars === 2 ? 'Great job — ' + program.length + ' blocks. Can you do it in ' + p.par + ' for 3 stars?' : 'Well done! Can you do it in fewer blocks for more stars?');
      playMsgKind = 'win';
      /* Save the solve in the database (game = puzzle id, score =
         stars, total = 3) so the teacher can see it. A save failure
         never takes the celebration away — the stars are already
         kept in this browser. */
      rpc('record_kids_coding_score', { p_slug: SLUG, p_student_name: student, p_game: String(p.id), p_level: 1, p_score: stars, p_total: 3 }).catch(function () {});
      renderPlay();
      return;
    }
    runTimer = setTimeout(stepRun, 400);
  }

  /* ---------- Teacher (shared teacher password) ---------- */
  function openTeacher() {
    var el = $('view-teacher');
    if (teacherUnlocked) { renderTeacher(); return; }
    el.innerHTML = '<h2>Teacher</h2><div class="card">' +
      '<p class="info">Enter the teacher password for this school to see everyone\'s progress.</p>' +
      '<label>Teacher password</label><input id="teach-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="teach-go">Unlock</button></div>' +
      '<div id="teach-out" style="margin-top:12px"></div></div>';
    $('teach-go').addEventListener('click', function () {
      var out = $('teach-out');
      var pw = $('teach-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_kids_coding_teacher_pass', { p_slug: SLUG, p_password: pw }).then(function (ok) {
        if (ok === true) {
          teacherPass = pw;
          teacherUnlocked = true;
          renderTeacher();
        } else {
          out.innerHTML = '<p class="error">Wrong teacher password.</p>';
        }
      }).catch(function () {
        out.innerHTML = '<p class="error">Could not reach the sign-in check. Please try again in a moment.</p>';
      });
    });
  }
  function renderTeacher() {
    var el = $('view-teacher');
    el.innerHTML = '<h2>Teacher</h2><div class="card"><p class="info">Loading progress…</p></div>';
    rpc('list_kids_coding_scores', { p_slug: SLUG, p_epass: teacherPass || '' }).then(function (rows) {
      var list = rows || [];
      var html = '<h2>Teacher — progress</h2>';
      if (!list.length) {
        html += '<div class="card"><p class="info">No puzzles solved yet. When a child reaches the ⭐, their stars show up here.</p></div>';
      } else {
        html += '<div class="card"><table class="score-table"><thead><tr><th>Student</th><th>Puzzle</th><th>Stars</th><th>Date</th></tr></thead><tbody>';
        list.forEach(function (r) {
          var p = getPuzzle(r.game);
          var pname = p ? p.name : String(r.game);
          var when = r.created_at ? new Date(r.created_at).toLocaleString() : '';
          html += '<tr><td>' + esc(r.student_name) + '</td><td>' + esc(pname) + '</td><td>' + starsText(Number(r.score) || 0) + '</td><td>' + esc(when) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '<button id="teach-refresh" class="secondary">Refresh</button>';
      el.innerHTML = html;
      $('teach-refresh').addEventListener('click', renderTeacher);
    }).catch(function (err) {
      el.innerHTML = '<h2>Teacher</h2><div class="card"><p class="error">Could not load progress: ' + esc(err.message) + '</p></div>';
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
      rpc('check_kids_coding_login', { p_slug: SLUG, p_username: u, p_password: p }).then(function (ok) {
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
    rpc('get_kids_coding_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p }).then(function (res) {
      draft = res.data || {};
      draft.students = draft.students || [];
      draft.puzzles = draft.puzzles || [];
      draftStatus = res.status || 'editing';
      delPuzzleIdx = null;
      editPuzzleIdx = null;
      editPuzzle = null;
      renderSetup();
    }).catch(function () {
      el.innerHTML = '<h2>Setup</h2><div class="card"><p class="error">Could not load your draft. Please try again in a moment.</p></div>';
    });
  }
  function statusLine() {
    if (draftStatus === 'pending') return 'Your changes were sent to Yently and are waiting for approval. Children still see the approved puzzles.';
    if (draftStatus === 'approved') return 'Your last upload was approved and is now live.';
    return 'Your changes are saved as a draft. Children still see the approved puzzles until you upload and Yently approves.';
  }
  function parseWalls(text) {
    var walls = [];
    String(text || '').split('\n').forEach(function (line) {
      var parts = line.trim().split(',');
      if (parts.length !== 2) return;
      var r = Number(parts[0]);
      var c = Number(parts[1]);
      if (isFinite(r) && isFinite(c)) walls.push([Math.floor(r), Math.floor(c)]);
    });
    return walls;
  }
  function wallsText(walls) {
    return (walls || []).map(function (w) { return w[0] + ',' + w[1]; }).join('\n');
  }
  /* Validate one puzzle: size 5–7, start and goal inside the grid
     and not on a wall, start and goal different cells, par at
     least 1. Reachability is NOT checked — a hard puzzle is fine. */
  function validatePuzzle(p) {
    var errs = [];
    if (!p.name || !String(p.name).trim()) errs.push('Give the puzzle a name.');
    if (!(p.rows >= 5 && p.rows <= 7)) errs.push('Rows must be between 5 and 7.');
    if (!(p.cols >= 5 && p.cols <= 7)) errs.push('Columns must be between 5 and 7.');
    if (!(p.par >= 1)) errs.push('Par must be at least 1 block.');
    var wallSet = {};
    (p.walls || []).forEach(function (w) { wallSet[w[0] + ',' + w[1]] = true; });
    function inBounds(r, c) { return r >= 0 && r < p.rows && c >= 0 && c < p.cols; }
    if (!inBounds(p.start.r, p.start.c)) errs.push('The start cell is outside the grid.');
    else if (wallSet[p.start.r + ',' + p.start.c]) errs.push('The start cell is on a wall.');
    if (!inBounds(p.goal.r, p.goal.c)) errs.push('The goal cell is outside the grid.');
    else if (wallSet[p.goal.r + ',' + p.goal.c]) errs.push('The goal cell is on a wall.');
    if (p.start.r === p.goal.r && p.start.c === p.goal.c) errs.push('Start and goal cannot be the same cell.');
    (p.walls || []).forEach(function (w) {
      if (!inBounds(w[0], w[1])) errs.push('Wall ' + w[0] + ',' + w[1] + ' is outside the grid.');
    });
    return errs;
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
      '<label>About text</label><textarea id="setup-about" rows="3">' + esc(draft.about || '') + '</textarea>' +
      '</div>' +
      '<h2>Students</h2><div class="card"><div id="setup-students"></div>' +
      '<div class="row"><input id="setup-new-student" type="text" placeholder="New student name" style="flex:1">' +
      '<button id="setup-add-student" class="secondary">+ Add student</button></div></div>' +
      '<h2>Puzzles</h2><div id="setup-puzzles"></div>' +
      '<button id="setup-add-puzzle" class="secondary">+ Add puzzle</button>' +
      '<div id="setup-puzzle-editor"></div>' +
      '<div class="row" style="margin-top:16px"><button id="setup-save" class="secondary">Save draft</button>' +
      '<button id="setup-upload">Upload for approval</button></div>' +
      '<div id="setup-out" style="margin-top:12px"></div>';
    el.innerHTML = html;
    /* Keep name/about in the draft as the owner types. */
    $('setup-name').addEventListener('input', function () { draft.name = $('setup-name').value.trim(); });
    $('setup-about').addEventListener('input', function () { draft.about = $('setup-about').value; });
    drawStudents();
    drawPuzzles();
    drawPuzzleEditor();
    $('setup-add-student').addEventListener('click', function () {
      var v = $('setup-new-student').value.trim();
      if (!v) return;
      if (draft.students.indexOf(v) === -1) draft.students.push(v);
      $('setup-new-student').value = '';
      drawStudents();
    });
    $('setup-add-puzzle').addEventListener('click', function () {
      editPuzzleIdx = -1;
      editPuzzle = { id: 'p' + Date.now(), name: 'New puzzle', rows: 5, cols: 5, walls: [], start: { r: 4, c: 0, dir: 1 }, goal: { r: 0, c: 4 }, par: 4, hint: '' };
      drawPuzzles();
      drawPuzzleEditor();
      var ed = $('setup-puzzle-editor');
      if (ed) ed.scrollIntoView();
    });
    function collectDraft() {
      return {
        name: ($('setup-name') ? $('setup-name').value.trim() : draft.name) || draft.name,
        about: $('setup-about') ? $('setup-about').value : (draft.about || ''),
        students: (draft.students || []).filter(function (s) { return String(s).trim() !== ''; }),
        puzzles: (draft.puzzles || []).filter(function (p) { return p && String(p.name || '').trim() !== ''; })
      };
    }
    $('setup-save').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Saving…</p>';
      var d = collectDraft();
      rpc('save_kids_coding_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'editing';
        out.innerHTML = '<p class="info">Draft saved. Children still see the approved puzzles.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not save: ' + esc(err.message) + '</p>';
      });
    });
    $('setup-upload').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Uploading…</p>';
      var d = collectDraft();
      rpc('submit_kids_coding_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'pending';
        notifyEmail('Kids Coding draft for approval: ' + (d.name || SLUG), { school: d.name || '', slug: SLUG });
        out.innerHTML = '<p class="info">Uploaded! Your changes were sent to Yently and are waiting for approval. We will email you once they are live.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not upload: ' + esc(err.message) + '</p>';
      });
    });
    function drawStudents() {
      var box = $('setup-students');
      if (!box) return;
      if (!draft.students.length) { box.innerHTML = '<p class="info">No students yet — add names below.</p>'; return; }
      var h = '';
      draft.students.forEach(function (s, i) {
        h += '<div class="order-line"><span>' + esc(s) + '</span>' +
          '<button class="small danger" data-rm-student="' + i + '">Remove</button></div>';
      });
      box.innerHTML = h;
      box.querySelectorAll('[data-rm-student]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          draft.students.splice(Number(btn.getAttribute('data-rm-student')), 1);
          drawStudents();
        });
      });
    }
    function drawPuzzles() {
      var box = $('setup-puzzles');
      if (!box) return;
      if (!draft.puzzles.length) { box.innerHTML = '<div class="card"><p class="info">No puzzles yet — add one below.</p></div>'; return; }
      var h = '';
      draft.puzzles.forEach(function (p, i) {
        h += '<div class="card"><h3>' + esc(p.name) + '</h3>' +
          '<p class="info">' + p.rows + '×' + p.cols + ' · par ' + p.par + ' · ' + (p.walls || []).length + ' wall(s)</p>' +
          '<div class="row"><button class="secondary" data-edit-puzzle="' + i + '">Edit</button>' +
          (delPuzzleIdx === i
            ? '<span><b>Delete this puzzle?</b> <button class="danger" data-del-puzzle-yes="' + i + '">Yes, delete</button> <button class="secondary" data-del-puzzle-no="' + i + '">Keep it</button></span>'
            : '<button class="danger" data-del-puzzle="' + i + '">Delete</button>') + '</div></div>';
      });
      box.innerHTML = h;
      box.querySelectorAll('[data-edit-puzzle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          editPuzzleIdx = Number(btn.getAttribute('data-edit-puzzle'));
          editPuzzle = JSON.parse(JSON.stringify(draft.puzzles[editPuzzleIdx]));
          delPuzzleIdx = null;
          drawPuzzles();
          drawPuzzleEditor();
        });
      });
      box.querySelectorAll('[data-del-puzzle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          delPuzzleIdx = Number(btn.getAttribute('data-del-puzzle'));
          drawPuzzles();
        });
      });
      box.querySelectorAll('[data-del-puzzle-no]').forEach(function (btn) {
        btn.addEventListener('click', function () { delPuzzleIdx = null; drawPuzzles(); });
      });
      box.querySelectorAll('[data-del-puzzle-yes]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = Number(btn.getAttribute('data-del-puzzle-yes'));
          draft.puzzles.splice(idx, 1);
          delPuzzleIdx = null;
          if (editPuzzleIdx === idx) { editPuzzleIdx = null; editPuzzle = null; }
          drawPuzzles();
          drawPuzzleEditor();
        });
      });
    }
    function drawPuzzleEditor() {
      var box = $('setup-puzzle-editor');
      if (!box) return;
      if (!editPuzzle) { box.innerHTML = ''; return; }
      var p = editPuzzle;
      function numField(label, id, value) {
        return '<label>' + label + '</label><input id="' + id + '" type="number" min="0" value="' + esc(value) + '">';
      }
      box.innerHTML = '<div class="card"><h3>' + (editPuzzleIdx === -1 ? 'New puzzle' : 'Edit puzzle') + '</h3>' +
        field('Puzzle name', 'pz-name', p.name) +
        '<div class="row"><div style="flex:1">' + numField('Rows (5–7)', 'pz-rows', p.rows) + '</div>' +
        '<div style="flex:1">' + numField('Columns (5–7)', 'pz-cols', p.cols) + '</div></div>' +
        '<label>Walls — one “row,col” per line (e.g. 2,0)</label><textarea id="pz-walls" rows="4">' + esc(wallsText(p.walls)) + '</textarea>' +
        '<div class="row"><div style="flex:1">' + numField('Start row', 'pz-sr', p.start.r) + '</div>' +
        '<div style="flex:1">' + numField('Start column', 'pz-sc', p.start.c) + '</div></div>' +
        '<label>Start direction</label><select id="pz-dir">' +
        '<option value="0"' + (p.start.dir === 0 ? ' selected' : '') + '>⬆️ Up</option>' +
        '<option value="1"' + (p.start.dir === 1 ? ' selected' : '') + '>➡️ Right</option>' +
        '<option value="2"' + (p.start.dir === 2 ? ' selected' : '') + '>⬇️ Down</option>' +
        '<option value="3"' + (p.start.dir === 3 ? ' selected' : '') + '>⬅️ Left</option></select>' +
        '<div class="row"><div style="flex:1">' + numField('Goal row', 'pz-gr', p.goal.r) + '</div>' +
        '<div style="flex:1">' + numField('Goal column', 'pz-gc', p.goal.c) + '</div></div>' +
        numField('Par — blocks for 3 stars', 'pz-par', p.par) +
        '<label>Hint for the child</label><input id="pz-hint" type="text" value="' + esc(p.hint || '') + '">' +
        '<h3>Live preview</h3><div id="pz-preview"></div>' +
        '<div id="pz-err" style="margin-top:8px"></div>' +
        '<div class="row" style="margin-top:12px"><button id="pz-save">Save puzzle</button>' +
        '<button id="pz-cancel" class="secondary">Cancel</button></div></div>';
      function readEditor() {
        p.name = $('pz-name').value.trim();
        p.rows = Number($('pz-rows').value) || 5;
        p.cols = Number($('pz-cols').value) || 5;
        p.walls = parseWalls($('pz-walls').value);
        p.start = { r: Number($('pz-sr').value) || 0, c: Number($('pz-sc').value) || 0, dir: Number($('pz-dir').value) || 0 };
        p.goal = { r: Number($('pz-gr').value) || 0, c: Number($('pz-gc').value) || 0 };
        p.par = Number($('pz-par').value) || 1;
        p.hint = $('pz-hint').value;
      }
      function paintPreview() {
        readEditor();
        var errs = validatePuzzle(p);
        var savedRobot = robot;
        robot = { r: p.start.r, c: p.start.c, dir: p.start.dir };
        var prev = $('pz-preview');
        if (prev) prev.innerHTML = gridHtml(p);
        robot = savedRobot;
        var errEl = $('pz-err');
        if (errEl) errEl.innerHTML = errs.length ? '<p class="error">' + errs.map(esc).join('<br>') + '</p>' : '<p class="info">Looks good — save the puzzle, then Save draft below.</p>';
      }
      ['pz-name', 'pz-rows', 'pz-cols', 'pz-walls', 'pz-sr', 'pz-sc', 'pz-dir', 'pz-gr', 'pz-gc', 'pz-par', 'pz-hint'].forEach(function (id) {
        var f = $(id);
        if (f) f.addEventListener('input', paintPreview);
      });
      paintPreview();
      $('pz-save').addEventListener('click', function () {
        readEditor();
        var errs = validatePuzzle(p);
        if (errs.length) {
          $('pz-err').innerHTML = '<p class="error">' + errs.map(esc).join('<br>') + '</p>';
          return;
        }
        if (editPuzzleIdx === -1) draft.puzzles.push(JSON.parse(JSON.stringify(p)));
        else draft.puzzles[editPuzzleIdx] = JSON.parse(JSON.stringify(p));
        editPuzzleIdx = null;
        editPuzzle = null;
        drawPuzzles();
        drawPuzzleEditor();
      });
      $('pz-cancel').addEventListener('click', function () {
        editPuzzleIdx = null;
        editPuzzle = null;
        drawPuzzleEditor();
      });
    }
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
    rpc('get_kids_coding_live', { p_slug: SLUG }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.students = data.students || [];
      data.puzzles = data.puzzles || [];
      document.title = data.name || 'Kids Coding';
      var logo = $('site-logo');
      if (data.logo) { logo.src = (/^https?:\/\//.test(data.logo) ? data.logo : BASE + data.logo); logo.hidden = false; }
      $('site-name').textContent = data.name || 'Kids Coding';
      $('site-about').textContent = data.about || '';
      var foot = [];
      if (data.about) foot.push(esc(data.about));
      var firstLine = foot.join(' · ');
      $('site-footer').innerHTML = (firstLine ? '<div>' + firstLine + '</div>' : '') +
        '<div>Powered by Yently</div>';
      /* If no teacher password is set, the Teacher tab stays open. */
      rpc('kids_coding_pass_status', { p_slug: SLUG }).then(function (s) {
        teacherUnlocked = !!(s && s.has_pass === false);
        if (student && data.students.indexOf(student) === -1) student = '';
        if (!getPuzzle(puzzleId)) puzzleId = null;
        renderPlay();
        loadScoresFromDb();
      }).catch(function () {
        teacherUnlocked = false;
        renderPlay();
      });
    }).catch(function () {
      $('site-name').textContent = 'School not found';
      $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school yet. Check the link and try again.</div>';
    });
  }
})();
