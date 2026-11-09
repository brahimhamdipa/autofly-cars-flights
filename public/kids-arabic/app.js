/* Kids Arabic page app — ONE folder for every Arabic school/class.
   The school comes from its own private link, and its name, about
   text, students and word list live in the database — there is no
   data.json file here. Visitors see the last APPROVED content. The
   owner logs in with the username + password the admin created for
   their school (that login is what Yently sells); Setup edits save
   as a draft, and the Upload button sends the draft to the admin
   for approval. Approval makes the draft live instantly — no file
   swap, no redeploy wait.
   Play is PUBLIC: a child picks their name, picks a game (Letters,
   Words or Numbers), and plays 10 rounds. The score is saved at
   the end so the teacher can see each student's progress. The
   Teacher tab needs the school's shared teacher password (one
   password for everybody, set by the admin; schools with none set
   stay fully open). All credentials live in memory only: a reload
   asks again, exactly like the diner employee password. The whole
   app is RTL (Arabic), with big buttons and very large Arabic text
   made for kids. */
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
  var STUDENT_KEY = 'kids-arabic-student-' + SLUG;

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

  /* The child playing right now, and the game in progress. */
  var student = '';
  try { student = localStorage.getItem(STUDENT_KEY) || ''; } catch (e) {}
  var game = null; // { kind: 'letters'|'words'|'numbers', rounds: [...], idx: 0, score: 0, picked: null, correct: false }
  var delStudentIdx = null; // Setup: student index awaiting an in-page delete confirmation
  var delWordIdx = null; // Setup: word index awaiting an in-page delete confirmation

  /* The 28 Arabic letters with their names — fixed in code, the same
     for every school. */
  var LETTERS = [
    { letter: 'ا', name: 'ألف' }, { letter: 'ب', name: 'باء' },
    { letter: 'ت', name: 'تاء' }, { letter: 'ث', name: 'ثاء' },
    { letter: 'ج', name: 'جيم' }, { letter: 'ح', name: 'حاء' },
    { letter: 'خ', name: 'خاء' }, { letter: 'د', name: 'دال' },
    { letter: 'ذ', name: 'ذال' }, { letter: 'ر', name: 'راء' },
    { letter: 'ز', name: 'زاي' }, { letter: 'س', name: 'سين' },
    { letter: 'ش', name: 'شين' }, { letter: 'ص', name: 'صاد' },
    { letter: 'ض', name: 'ضاد' }, { letter: 'ط', name: 'طاء' },
    { letter: 'ظ', name: 'ظاء' }, { letter: 'ع', name: 'عين' },
    { letter: 'غ', name: 'غين' }, { letter: 'ف', name: 'فاء' },
    { letter: 'ق', name: 'قاف' }, { letter: 'ك', name: 'كاف' },
    { letter: 'ل', name: 'لام' }, { letter: 'م', name: 'ميم' },
    { letter: 'ن', name: 'نون' }, { letter: 'ه', name: 'هاء' },
    { letter: 'و', name: 'واو' }, { letter: 'ي', name: 'ياء' }
  ];
  /* Numbers 1–10 with their Arabic-Indic numerals — fixed in code. */
  var NUMBERS = [
    { num: 1, ar: '١' }, { num: 2, ar: '٢' }, { num: 3, ar: '٣' },
    { num: 4, ar: '٤' }, { num: 5, ar: '٥' }, { num: 6, ar: '٦' },
    { num: 7, ar: '٧' }, { num: 8, ar: '٨' }, { num: 9, ar: '٩' },
    { num: 10, ar: '١٠' }
  ];
  var PRAISE = ['أحسنت! 🎉', 'رائع! ⭐', 'ممتاز! 👏', 'برافو! 🌟', 'عمل جميل! 😊'];
  var TRY_AGAIN = 'حاول مرة أخرى 💪 — Try again!';

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
  function pickN(arr, n) { return shuffle(arr).slice(0, n); }
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
        body: JSON.stringify({ subject: subject, table: 'kids_arabic_draft', record: record })
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
  function gameTitle(kind) {
    if (kind === 'letters') return '🔤 الحروف — Letters';
    if (kind === 'words') return '📖 الكلمات — Words';
    return '🔢 الأرقام — Numbers';
  }
  /* Build 10 rounds for a game. Each round: a question (big Arabic
     text) and 4 choices, exactly one of them correct. */
  function buildRounds(kind) {
    var rounds = [];
    if (kind === 'letters') {
      pickN(LETTERS, 10).forEach(function (item) {
        var wrong = pickN(LETTERS.filter(function (l) { return l.letter !== item.letter; }), 3);
        rounds.push({
          question: item.letter,
          questionLabel: 'ما اسم هذا الحرف؟ — What is this letter called?',
          choices: shuffle([item.name].concat(wrong.map(function (w) { return w.name; }))),
          answer: item.name
        });
      });
    } else if (kind === 'words') {
      var words = (data.words || []).filter(function (w) { return w.ar && w.en; });
      pickN(words, Math.min(10, words.length)).forEach(function (item) {
        var wrong = pickN(words.filter(function (w) { return w.ar !== item.ar; }), Math.min(3, words.length - 1));
        rounds.push({
          question: item.ar,
          questionLabel: 'ما معنى هذه الكلمة؟ — What does this word mean?',
          choices: shuffle([item.en].concat(wrong.map(function (w) { return w.en; }))),
          answer: item.en
        });
      });
    } else {
      pickN(NUMBERS, 10).forEach(function (item) {
        var wrong = pickN(NUMBERS.filter(function (n) { return n.num !== item.num; }), 3);
        rounds.push({
          question: item.ar,
          questionLabel: 'ما هذا الرقم؟ — What number is this?',
          choices: shuffle([String(item.num)].concat(wrong.map(function (w) { return String(w.num); }))),
          answer: String(item.num)
        });
      });
    }
    return rounds;
  }
  function startGame(kind) {
    var rounds = buildRounds(kind);
    if (!rounds.length) return;
    game = { kind: kind, rounds: rounds, idx: 0, score: 0, picked: null, correct: false };
    renderPlay();
  }
  function renderPlay() {
    var el = $('view-play');
    if (!data) { el.innerHTML = '<p class="info">جارٍ التحميل… Loading…</p>'; return; }
    var students = data.students || [];
    var html = '';
    /* Step 1: pick your name. */
    html += '<div class="card"><h2>👋 مرحباً! — Hello!</h2>' +
      '<p class="info">اختر اسمك — Pick your name:</p>';
    if (!students.length) {
      html += '<p class="info">لا يوجد طلاب بعد — No students yet. Ask your teacher to add names in Setup.</p>';
    } else {
      html += '<div class="row student-row">';
      students.forEach(function (s) {
        html += '<button class="kid-btn' + (student === s ? ' selected' : '') + '" data-student="' + esc(s) + '">' + esc(s) + '</button>';
      });
      html += '</div>';
    }
    html += '</div>';
    if (!student) {
      el.innerHTML = html;
      wireStudentButtons(el);
      return;
    }
    /* Step 2: pick a game. */
    html += '<div class="card"><h2>🎮 اختر لعبة — Pick a game, ' + esc(student) + '!</h2>' +
      '<div class="game-grid">' +
      '<button class="game-btn" data-game="letters">🔤<span>الحروف</span><span class="game-en">Letters</span></button>' +
      '<button class="game-btn" data-game="words">📖<span>الكلمات</span><span class="game-en">Words</span></button>' +
      '<button class="game-btn" data-game="numbers">🔢<span>الأرقام</span><span class="game-en">Numbers</span></button>' +
      '</div></div>';
    /* Step 3: the game itself, or the final score. */
    if (game) html += gameHtml();
    el.innerHTML = html;
    wireStudentButtons(el);
    el.querySelectorAll('[data-game]').forEach(function (btn) {
      btn.addEventListener('click', function () { startGame(btn.getAttribute('data-game')); });
    });
    wireGameButtons(el);
  }
  function wireStudentButtons(el) {
    el.querySelectorAll('[data-student]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        student = btn.getAttribute('data-student');
        try { localStorage.setItem(STUDENT_KEY, student); } catch (e) {}
        game = null;
        renderPlay();
      });
    });
  }
  function gameHtml() {
    if (game.idx >= game.rounds.length) {
      /* Finished: big score, praise, and a Play again button. The
         score was already saved when the last answer was picked. */
      var total = game.rounds.length;
      var msg = game.score === total ? '🏆 ممتاز! نتيجة كاملة! — Perfect score!'
        : game.score >= total * 0.7 ? '🌟 رائع جداً! — Great job!'
        : game.score >= total * 0.5 ? '👏 أحسنت! واصل التدريب! — Good work, keep practising!'
        : '💪 حاول مرة أخرى! — Try again, you can do it!';
      return '<div class="card score-card"><h2>🎉 انتهت اللعبة!</h2>' +
        '<div class="big-score">' + game.score + ' / ' + total + '</div>' +
        '<p class="praise">' + msg + '</p>' +
        '<p class="info">' + esc(student) + ' — ' + esc(gameTitle(game.kind)) + '</p>' +
        '<p class="info">تم حفظ نتيجتك — Your score was saved for your teacher.</p>' +
        '<button id="play-again">🔄 العب مرة أخرى — Play again</button></div>';
    }
    var round = game.rounds[game.idx];
    var html = '<div class="card game-card"><h2>' + esc(gameTitle(game.kind)) + '</h2>' +
      '<p class="info">السؤال ' + (game.idx + 1) + ' من ' + game.rounds.length +
      ' — Question ' + (game.idx + 1) + ' of ' + game.rounds.length +
      ' &nbsp;•&nbsp; النقاط: ' + game.score + ' — Score: ' + game.score + '</p>' +
      '<p class="question-label">' + esc(round.questionLabel) + '</p>' +
      '<div class="big-question">' + esc(round.question) + '</div>' +
      '<div class="choices-grid">';
    round.choices.forEach(function (c) {
      var cls = 'choice-btn';
      if (game.picked !== null) {
        if (c === round.answer) cls += ' correct';
        else if (c === game.picked) cls += ' wrong';
      }
      html += '<button class="' + cls + '" data-choice="' + esc(c) + '"' + (game.picked !== null ? ' disabled' : '') + '>' + esc(c) + '</button>';
    });
    html += '</div>';
    if (game.picked !== null) {
      html += '<p class="praise">' + (game.correct ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : TRY_AGAIN + '<br>الإجابة الصحيحة: ' + esc(round.answer) + ' — The right answer: ' + esc(round.answer)) + '</p>' +
        '<button id="next-round">' + (game.idx + 1 >= game.rounds.length ? '🏁 النتيجة — See my score' : '➡️ التالي — Next') + '</button>';
    }
    html += '</div>';
    return html;
  }
  function wireGameButtons(el) {
    el.querySelectorAll('[data-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!game || game.picked !== null) return;
        var picked = btn.getAttribute('data-choice');
        var round = game.rounds[game.idx];
        game.picked = picked;
        game.correct = picked === round.answer;
        if (game.correct) game.score++;
        renderPlay();
      });
    });
    var next = $('next-round');
    if (next) next.addEventListener('click', function () {
      game.idx++;
      game.picked = null;
      /* Last round answered: save the score for the teacher. A
         failed save never blocks the score screen. */
      if (game.idx >= game.rounds.length) {
        rpc('record_kids_arabic_score', {
          p_slug: SLUG, p_student_name: student, p_game: game.kind,
          p_level: 'easy', p_score: game.score, p_total: game.rounds.length
        }).catch(function () {});
      }
      renderPlay();
    });
    var again = $('play-again');
    if (again) again.addEventListener('click', function () { game = null; renderPlay(); });
  }

  /* ---------- Teacher (shared teacher password) ---------- */
  /* The score list is public to nobody: the teacher password is
     checked on the server by the list RPC itself, so the gate
     cannot be bypassed. Schools with no password set skip this
     entirely (teacherUnlocked starts true for them, see the start
     block). Nothing is stored: a reload asks again. */
  function renderTeacherPrompt(el, after) {
    el.innerHTML = '<h2>👩‍🏫 المعلم — Teacher</h2><div class="card">' +
      '<p class="info">أدخل كلمة مرور المعلم لرؤية نتائج الطلاب — Enter the teacher password to see student scores.</p>' +
      '<label>Teacher password — كلمة المرور</label><input id="teacher-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="teacher-go">Unlock — فتح</button></div>' +
      '<div id="teacher-out" style="margin-top:12px"></div></div>';
    $('teacher-go').addEventListener('click', function () {
      var out = $('teacher-out');
      var p = $('teacher-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_kids_arabic_teacher_pass', { p_slug: SLUG, p_password: p }).then(function (ok) {
        if (ok === true) {
          teacherPass = p;
          teacherUnlocked = true;
          after();
        } else {
          out.innerHTML = '<p class="error">Wrong teacher password — كلمة المرور غير صحيحة.</p>';
        }
      }).catch(function () {
        out.innerHTML = '<p class="error">Could not reach the sign-in check. Please try again in a moment.</p>';
      });
    });
  }
  function needTeacher(el) {
    if (teacherUnlocked) return false;
    renderTeacherPrompt(el, function () { show('teacher'); });
    return true;
  }
  function openTeacher() {
    var el = $('view-teacher');
    if (needTeacher(el)) return;
    el.innerHTML = '<h2>👩‍🏫 نتائج الطلاب — Student scores</h2><div class="card"><p class="info">Loading…</p></div>';
    rpc('list_kids_arabic_scores', { p_slug: SLUG, p_epass: teacherPass || '' }).then(function (rows) {
      var list = rows || [];
      var html = '<h2>👩‍🏫 نتائج الطلاب — Student scores</h2>';
      if (!list.length) {
        html += '<div class="card"><p class="info">لا توجد نتائج بعد — No scores yet. Scores appear here after a child finishes a game.</p></div>';
      } else {
        html += '<div class="card"><table class="scores-table"><thead><tr>' +
          '<th>الطالب — Student</th><th>اللعبة — Game</th><th>النتيجة — Score</th><th>التاريخ — Date</th>' +
          '</tr></thead><tbody>';
        list.forEach(function (r) {
          var gameName = r.game === 'letters' ? 'الحروف Letters' : r.game === 'words' ? 'الكلمات Words' : r.game === 'numbers' ? 'الأرقام Numbers' : esc(r.game || '');
          html += '<tr><td>' + esc(r.student_name || '') + '</td><td>' + gameName + '</td>' +
            '<td><strong>' + esc(r.score) + ' / ' + esc(r.total) + '</strong></td>' +
            '<td>' + esc(new Date(r.created_at).toLocaleString()) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      el.innerHTML = html;
    }).catch(function (err) {
      el.innerHTML = '<h2>👩‍🏫 نتائج الطلاب — Student scores</h2><div class="card"><p class="error">Could not load scores: ' + esc(err.message) + '</p></div>';
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
      rpc('check_kids_arabic_login', { p_slug: SLUG, p_username: u, p_password: p }).then(function (ok) {
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
    rpc('get_kids_arabic_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p }).then(function (res) {
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
    if (draftStatus === 'pending') return 'Your changes were sent to Yently and are waiting for approval. Visitors still see the approved version.';
    if (draftStatus === 'approved') return 'Your last upload was approved and is now live.';
    return 'Your changes are saved as a draft. Visitors still see the approved version until you upload and Yently approves.';
  }
  function renderSetup() {
    var el = $('view-setup');
    function field(label, id, value, type) {
      return '<label>' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '">';
    }
    var html = '<h2>Setup — الإعدادات</h2>' +
      '<div class="note">' + esc(statusLine()) + '</div>' +
      '<div class="card">' +
      field('School name — اسم المدرسة', 'setup-name', draft.name) +
      field('About text — نبذة', 'setup-about', draft.about) +
      '</div>' +
      '<h2>Students — الطلاب</h2><div id="setup-students"></div>' +
      '<div class="row"><input id="setup-new-student" type="text" placeholder="New student name — اسم طالب جديد" style="flex:1">' +
      '<button id="setup-add-student" class="secondary">+ Add student</button></div>' +
      '<h2>Words — الكلمات</h2><div id="setup-words"></div>' +
      '<button id="setup-add-word" class="secondary">+ Add word — أضف كلمة</button>' +
      '<div class="row" style="margin-top:16px"><button id="setup-save" class="secondary">Save draft</button>' +
      '<button id="setup-upload">Upload for approval</button></div>' +
      '<div id="setup-out" style="margin-top:12px"></div>';
    el.innerHTML = html;

    /* Students list: each name with an in-page delete confirmation. */
    var studentsEl = $('setup-students');
    function drawStudents() {
      studentsEl.innerHTML = '';
      if (!draft.students.length) {
        studentsEl.innerHTML = '<div class="card"><p class="info">No students yet — add one below.</p></div>';
        return;
      }
      draft.students.forEach(function (s, i) {
        var row = document.createElement('div');
        row.className = 'card list-row';
        if (delStudentIdx === i) {
          row.innerHTML = '<span><strong>' + esc(s) + '</strong> — remove this student?</span>' +
            '<span><button class="danger small" data-student-del-yes="' + i + '">Yes, remove</button> ' +
            '<button class="secondary small" data-student-del-no>Keep</button></span>';
        } else {
          row.innerHTML = '<span><strong>' + esc(s) + '</strong></span>' +
            '<button class="small danger" data-student-del="' + i + '">Remove</button>';
        }
        studentsEl.appendChild(row);
      });
      studentsEl.querySelectorAll('[data-student-del]').forEach(function (b) {
        b.addEventListener('click', function () { delStudentIdx = Number(b.getAttribute('data-student-del')); drawStudents(); });
      });
      studentsEl.querySelectorAll('[data-student-del-no]').forEach(function (b) {
        b.addEventListener('click', function () { delStudentIdx = null; drawStudents(); });
      });
      studentsEl.querySelectorAll('[data-student-del-yes]').forEach(function (b) {
        b.addEventListener('click', function () {
          draft.students.splice(Number(b.getAttribute('data-student-del-yes')), 1);
          delStudentIdx = null;
          drawStudents();
        });
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

    /* Word list: each word has an Arabic word + English meaning,
       editable in place, with an in-page delete confirmation. */
    var wordsEl = $('setup-words');
    function drawWords() {
      wordsEl.innerHTML = '';
      if (!draft.words.length) {
        wordsEl.innerHTML = '<div class="card"><p class="info">No words yet — add one below.</p></div>';
        return;
      }
      draft.words.forEach(function (w, i) {
        var row = document.createElement('div');
        row.className = 'card';
        if (delWordIdx === i) {
          row.innerHTML = '<p><strong>' + esc(w.ar) + '</strong> — ' + esc(w.en) + '</p>' +
            '<p>Delete this word?</p>' +
            '<div class="row"><button class="danger small" data-word-del-yes="' + i + '">Yes, delete</button>' +
            '<button class="secondary small" data-word-del-no>Keep</button></div>';
        } else {
          row.innerHTML =
            '<label>Arabic word — الكلمة</label><input data-f="ar" value="' + esc(w.ar) + '">' +
            '<label>English meaning — المعنى</label><input data-f="en" value="' + esc(w.en) + '">' +
            '<button class="small danger" data-word-del="' + i + '">Remove word</button>';
        }
        wordsEl.appendChild(row);
        row.querySelectorAll('[data-f]').forEach(function (input) {
          input.addEventListener('input', function () {
            w[input.getAttribute('data-f')] = input.value;
          });
        });
        var delBtn = row.querySelector('[data-word-del]');
        if (delBtn) delBtn.addEventListener('click', function () { delWordIdx = i; drawWords(); });
        var noBtn = row.querySelector('[data-word-del-no]');
        if (noBtn) noBtn.addEventListener('click', function () { delWordIdx = null; drawWords(); });
        var yesBtn = row.querySelector('[data-word-del-yes]');
        if (yesBtn) yesBtn.addEventListener('click', function () {
          draft.words.splice(Number(yesBtn.getAttribute('data-word-del-yes')), 1);
          delWordIdx = null;
          drawWords();
        });
      });
    }
    drawWords();
    $('setup-add-word').addEventListener('click', function () {
      draft.words.push({ ar: '', en: '' });
      drawWords();
    });

    /* collectDraft must include EVERY editable field, or Setup
       silently drops it — name, about, students and words. */
    function collectDraft() {
      return {
        name: $('setup-name').value.trim() || draft.name,
        about: $('setup-about').value,
        students: draft.students.filter(function (s) { return String(s).trim() !== ''; }),
        words: draft.words.filter(function (w) { return String(w.ar || '').trim() !== '' && String(w.en || '').trim() !== ''; })
      };
    }
    $('setup-save').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Saving…</p>';
      var d = collectDraft();
      rpc('save_kids_arabic_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'editing';
        out.innerHTML = '<p class="info">Draft saved. Visitors still see the approved version.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not save: ' + esc(err.message) + '</p>';
      });
    });
    $('setup-upload').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Uploading…</p>';
      var d = collectDraft();
      rpc('submit_kids_arabic_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'pending';
        notifyEmail('Kids Arabic draft for approval: ' + (d.name || SLUG), { school: d.name || '', slug: SLUG });
        out.innerHTML = '<p class="info">Uploaded! Your changes were sent to Yently and are waiting for approval. You will be emailed once they are live.</p>';
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
    $('site-name').textContent = 'School not found — المدرسة غير موجودة';
    $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school. Check the link and try again — ask Yently for your school link.</div>';
  } else {
    rpc('get_kids_arabic_live', { p_slug: SLUG }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.students = data.students || [];
      data.words = data.words || [];
      document.title = data.name || 'Kids Arabic';
      var logo = $('site-logo');
      if (data.logo) { logo.src = (/^https?:\/\//.test(data.logo) ? data.logo : BASE + data.logo); logo.hidden = false; }
      $('site-name').textContent = data.name || 'Kids Arabic';
      $('site-about').textContent = data.about || '';
      $('site-footer').innerHTML = '<div>Powered by Yently</div>';
      rpc('kids_arabic_pass_status', { p_slug: SLUG }).then(function (s) {
        teacherUnlocked = !(s && s.has_pass);
        renderPlay();
      }).catch(function () {
        /* If the status check itself is unreachable, stay open rather
           than locking the teacher out of a working school. */
        teacherUnlocked = true;
        renderPlay();
      });
    }).catch(function () {
      $('site-name').textContent = 'School not found — المدرسة غير موجودة';
      $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school yet. Check the link and try again.</div>';
    });
  }
})();
