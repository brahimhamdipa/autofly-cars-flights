/* Kids Reading page app — ONE folder for every school or library.
   The school comes from its own private link, and its name, about
   text, students and books live in the database — there is no
   data.json file here. Visitors see the last APPROVED books. The
   owner logs in with the username + password the admin created
   for their school (that login is what Yently sells); Setup edits
   save as a draft, and the Upload button sends the draft to the
   admin for approval. Approval makes the draft live instantly —
   no file swap, no redeploy wait.
   Play is public: a child picks their name, opens a book, and
   reads it one page at a time. On the last page the finish button
   records the finish (one row per child per book, so re-reading
   never doubles the teacher's list). The bookshelf shows a tick
   on books this child already finished — from this browser's own
   finished list, plus the server list whenever the teacher has
   unlocked the Teacher tab in this session. The Teacher tab needs
   the school's shared teacher password (one password for all
   teachers, set by the admin; schools with none set stay fully
   open). The password is enforced on the server by the list RPC,
   not just in the page, so it cannot be bypassed. All credentials
   live in memory only: a reload asks again, exactly like the
   barber intake form. */
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
    // system's own folder name, so a bare /kids-reading visit still
    // shows "not found" by design.
    var segs = location.pathname.split('/').filter(function (s) { return s; });
    var lastSeg = (segs[segs.length - 1] || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    if (lastSeg && lastSeg !== 'kids-reading') SLUG = lastSeg;
  }
  var STUDENT_KEY = 'kids-reading-student-' + SLUG;
  var FINISHED_KEY = 'kids-reading-finished-' + SLUG;

  /* Public by design: the same publishable key the main Yently site ships
     in its own pages. Used only for the database calls below. */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var EMOJIS = ['📚', '⛵', '🐱', '🐶', '🦁', '🐸', '🚀', '🌈', '🐘', '🦋', '🌙', '⭐', '🐳', '🍎', '🏰', '🚂'];

  var data = null; // live name/about/students/books (visitors)
  var draft = null; // owner draft (Setup)
  var draftStatus = 'editing';
  var staffCreds = null; // {u, p} in memory only, never stored
  var teacherPass = null; // teacher password in memory only, never stored
  var teacherUnlocked = false; // true once the teacher password is entered, or when the school has none set
  var teacherScores = null; // rows from list_kids_reading_scores, newest first
  var serverScores = null; // same list, used by Play for the finished ticks
  var currentStudent = null; // picked name, kept in this browser only
  var finishedLocal = {}; // student name -> [book ids finished in this browser]
  var readingBook = null; // book open in the reader, or null
  var readingPage = 0; // 0-based page index in the reader
  var justFinished = false; // true right after the finish button is tapped
  var currentView = 'play';

  try {
    currentStudent = localStorage.getItem(STUDENT_KEY) || null;
    finishedLocal = JSON.parse(localStorage.getItem(FINISHED_KEY) || '{}');
  } catch (e) {
    currentStudent = null;
    finishedLocal = {};
  }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function saveFinishedLocal() {
    try { localStorage.setItem(FINISHED_KEY, JSON.stringify(finishedLocal)); } catch (e) {}
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
        body: JSON.stringify({ subject: subject, table: 'kids_reading_draft', record: record })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- Finished books ---------- */
  /* A book counts as finished for the picked child when it is in
     this browser's finished list, or in the server list (which Play
     only has when the teacher unlocked the Teacher tab in this
     session, or the school has no teacher password at all). */
  function isFinished(bookId) {
    if (!currentStudent) return false;
    var local = finishedLocal[currentStudent] || [];
    if (local.indexOf(bookId) !== -1) return true;
    if (serverScores) {
      return serverScores.some(function (r) {
        return r.student_name === currentStudent && r.game === bookId && Number(r.score) >= 1;
      });
    }
    return false;
  }
  function markFinishedLocal(bookId) {
    if (!currentStudent) return;
    var list = finishedLocal[currentStudent] || [];
    if (list.indexOf(bookId) === -1) list.push(bookId);
    finishedLocal[currentStudent] = list;
    saveFinishedLocal();
  }
  function bookTitle(gameId) {
    var found = (data.books || []).filter(function (b) { return b.id === gameId; })[0];
    return found ? found.title : gameId;
  }
  function fetchServerScores() {
    if (!teacherUnlocked) return Promise.resolve();
    return rpc('list_kids_reading_scores', { p_slug: SLUG, p_epass: teacherPass }).then(function (rows) {
      serverScores = rows || [];
    }).catch(function () {
      serverScores = null;
    });
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
  function renderPlay() {
    var el = $('view-play');
    if (!data) { el.innerHTML = '<p class="info">Loading…</p>'; return; }
    if (readingBook) { renderReader(); return; }
    if (!currentStudent) {
      var students = data.students || [];
      if (!students.length) {
        el.innerHTML = '<h2>Play</h2><div class="card"><p class="info">No students yet — the teacher adds names in Setup.</p></div>';
        return;
      }
      var html = '<h2>Who is reading today?</h2><div class="card"><p class="info">Tap your name to see your bookshelf.</p>' +
        '<div class="name-grid">';
      students.forEach(function (name) {
        html += '<button data-student="' + esc(name) + '">' + esc(name) + '</button>';
      });
      html += '</div></div>';
      el.innerHTML = html;
      el.querySelectorAll('[data-student]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          currentStudent = btn.getAttribute('data-student');
          try { localStorage.setItem(STUDENT_KEY, currentStudent); } catch (e) {}
          renderPlay();
        });
      });
      return;
    }
    var books = data.books || [];
    var h = '<h2>Hello, ' + esc(currentStudent) + '! 📚</h2>' +
      '<p class="info">Pick a book and read it, one page at a time. ' +
      '<button id="switch-student" class="small secondary">Not you? Change name</button></p>';
    if (!books.length) {
      h += '<div class="card"><p class="info">No books yet — the teacher adds books in Setup.</p></div>';
    } else {
      h += '<div class="book-grid">';
      books.forEach(function (book) {
        var pages = (book.pages || []).length;
        var done = isFinished(book.id);
        h += '<div class="book-card' + (done ? ' finished' : '') + '" data-book="' + esc(book.id) + '" role="button" tabindex="0">' +
          '<div class="book-emoji">' + esc(book.emoji || '📚') + '</div>' +
          '<h3>' + esc(book.title) + '</h3>' +
          '<div class="book-author">' + esc(book.author || '') + '</div>' +
          '<div class="book-pages">' + pages + ' page' + (pages === 1 ? '' : 's') + '</div>' +
          (done ? '<span class="book-done">✓ Finished</span>' : '') +
          '</div>';
      });
      h += '</div>';
    }
    el.innerHTML = h;
    $('switch-student').addEventListener('click', function () {
      currentStudent = null;
      try { localStorage.removeItem(STUDENT_KEY); } catch (e) {}
      renderPlay();
    });
    el.querySelectorAll('[data-book]').forEach(function (card) {
      function open() {
        var book = books.filter(function (b) { return b.id === card.getAttribute('data-book'); })[0];
        if (!book) return;
        readingBook = book;
        readingPage = 0;
        justFinished = false;
        renderReader();
      }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }
  function renderReader() {
    var el = $('view-play');
    var book = readingBook;
    if (!book) { renderPlay(); return; }
    var pages = (book.pages && book.pages.length) ? book.pages : ['This book has no pages yet.'];
    if (justFinished) {
      el.innerHTML = '<div class="celebration"><div class="big">🎉</div>' +
        '<h2>You finished ' + esc(book.title) + '!</h2>' +
        '<p>Great reading, ' + esc(currentStudent || '') + '! Your teacher can see that you finished this book.</p>' +
        '<button id="back-shelf">Choose another book</button></div>';
      $('back-shelf').addEventListener('click', function () {
        readingBook = null;
        justFinished = false;
        renderPlay();
      });
      return;
    }
    var last = readingPage >= pages.length - 1;
    var done = isFinished(book.id);
    var html = '<div class="reader">' +
      '<div class="reader-emoji">' + esc(book.emoji || '📚') + '</div>' +
      '<h2>' + esc(book.title) + '</h2>' +
      '<div class="reader-author">' + esc(book.author || '') + '</div>' +
      '<div class="reader-page">' + esc(pages[readingPage]) + '</div>' +
      '<div class="reader-count">Page ' + (readingPage + 1) + ' of ' + pages.length + '</div>' +
      '<div class="reader-nav">' +
      '<button id="reader-prev" class="secondary"' + (readingPage === 0 ? ' disabled' : '') + '>← Prev</button>' +
      '<button id="reader-next" class="secondary"' + (last ? ' disabled' : '') + '>Next →</button>' +
      '</div>';
    if (last) {
      if (done) {
        html += '<p class="info" style="margin-top:16px">✓ You already finished this book! Great reading!</p>';
      } else {
        html += '<button id="reader-finish" class="finish-btn">I finished this book! 🎉</button><div id="reader-out" style="margin-top:12px"></div>';
      }
    }
    html += '<div style="margin-top:16px"><button id="back-shelf" class="secondary">← Back to bookshelf</button></div></div>';
    el.innerHTML = html;
    $('reader-prev').addEventListener('click', function () {
      if (readingPage > 0) { readingPage--; renderReader(); }
    });
    $('reader-next').addEventListener('click', function () {
      if (readingPage < pages.length - 1) { readingPage++; renderReader(); }
    });
    var finishBtn = $('reader-finish');
    if (finishBtn) finishBtn.addEventListener('click', function () {
      var out = $('reader-out');
      out.innerHTML = '<p class="info">Saving…</p>';
      rpc('record_kids_reading_score', { p_slug: SLUG, p_student_name: currentStudent, p_game: book.id, p_level: null, p_score: 1, p_total: 1 }).then(function () {
        markFinishedLocal(book.id);
        justFinished = true;
        renderReader();
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not save your finish: ' + esc(err.message) + ' Please try again.</p>';
      });
    });
    $('back-shelf').addEventListener('click', function () {
      readingBook = null;
      justFinished = false;
      renderPlay();
    });
  }

  /* ---------- Teacher (shared teacher password) ---------- */
  /* The bookshelf stays public, but the Teacher tab needs the
     school's shared teacher password — one password for everybody,
     set by the admin. Nothing is stored: a reload asks again.
     Schools with no password set skip this entirely. */
  function openTeacher() {
    if (teacherUnlocked) {
      fetchTeacherScores().then(renderTeacher);
      return;
    }
    renderTeacherPrompt($('view-teacher'));
  }
  function renderTeacherPrompt(el) {
    el.innerHTML = '<h2>Teacher</h2><div class="card">' +
      '<p class="info">Enter the teacher password for this school to see who finished which book.</p>' +
      '<label>Teacher password</label><input id="teacher-pass" type="password" autocomplete="current-password">' +
      '<div class="row"><button id="teacher-go">Unlock</button></div>' +
      '<div id="teacher-out" style="margin-top:12px"></div></div>';
    $('teacher-go').addEventListener('click', function () {
      var out = $('teacher-out');
      var p = $('teacher-pass').value;
      out.innerHTML = '<p class="info">Checking…</p>';
      rpc('check_kids_reading_teacher_pass', { p_slug: SLUG, p_password: p }).then(function (ok) {
        if (ok === true) {
          teacherPass = p;
          teacherUnlocked = true;
          fetchTeacherScores().then(renderTeacher);
        } else {
          out.innerHTML = '<p class="error">Wrong teacher password.</p>';
        }
      }).catch(function () {
        out.innerHTML = '<p class="error">Could not reach the sign-in check. Please try again in a moment.</p>';
      });
    });
  }
  function fetchTeacherScores() {
    return rpc('list_kids_reading_scores', { p_slug: SLUG, p_epass: teacherPass }).then(function (rows) {
      teacherScores = rows || [];
      serverScores = teacherScores;
    }).catch(function (err) {
      teacherScores = null;
      var el = $('view-teacher');
      el.innerHTML = '<h2>Teacher</h2><div class="card"><p class="error">Could not load finished books: ' + esc(err.message) + '</p></div>';
    });
  }
  function renderTeacher() {
    var el = $('view-teacher');
    if (!teacherScores) { el.innerHTML = '<h2>Teacher</h2><p class="info">Loading…</p>'; return; }
    var html = '<h2>Teacher</h2>' +
      '<div class="row" style="margin-bottom:12px"><button id="teacher-refresh" class="secondary">Refresh</button></div>';
    if (!teacherScores.length) {
      html += '<div class="card"><p class="info">No books finished yet. When a child finishes a book, their name and the book show up here.</p></div>';
    } else {
      html += '<div class="card"><p class="info">' + teacherScores.length + ' book' + (teacherScores.length === 1 ? '' : 's') + ' finished.</p>';
      teacherScores.forEach(function (r) {
        var when = r.created_at ? new Date(r.created_at).toLocaleString() : '';
        html += '<div class="score-line"><span><strong>' + esc(r.student_name) + '</strong> finished <strong>' + esc(bookTitle(r.game)) + '</strong></span>' +
          '<span class="when">' + esc(when) + '</span></div>';
      });
      html += '</div>';
    }
    el.innerHTML = html;
    $('teacher-refresh').addEventListener('click', function () {
      fetchTeacherScores().then(renderTeacher);
    });
  }

  /* ---------- Setup (owner login only: draft + Upload for approval) ---------- */
  function openSetup() {
    if (!staffCreds) {
      renderStaffLogin($('view-setup'), 'Setup sign-in', function () { openSetup(); });
      return;
    }
    var el = $('view-setup');
    el.innerHTML = '<h2>Setup</h2><div class="card"><p class="info">Loading your draft…</p></div>';
    rpc('get_kids_reading_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p }).then(function (res) {
      draft = res.data || {};
      draft.students = draft.students || [];
      draft.books = draft.books || [];
      draftStatus = res.status || 'editing';
      renderSetup();
    }).catch(function () {
      el.innerHTML = '<h2>Setup</h2><div class="card"><p class="error">Could not load your draft. Please try again in a moment.</p></div>';
    });
  }
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
      rpc('check_kids_reading_login', { p_slug: SLUG, p_username: u, p_password: p }).then(function (ok) {
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
    if (draftStatus === 'pending') return 'Your changes were sent to Yently and are waiting for approval. Children still see the approved books.';
    if (draftStatus === 'approved') return 'Your last upload was approved and is now live.';
    return 'Your changes are saved as a draft. Children still see the approved books until you upload and Yently approves.';
  }
  function renderSetup() {
    var el = $('view-setup');
    var html = '<h2>Setup</h2>' +
      '<div class="note">' + esc(statusLine()) + '</div>' +
      '<div class="card">' +
      '<label>School name</label><input id="setup-name" type="text" value="' + esc(draft.name || '') + '">' +
      '<label>About text</label><textarea id="setup-about" rows="3">' + esc(draft.about || '') + '</textarea>' +
      '</div>' +
      '<h2>Students</h2><div class="card"><div id="setup-students"></div>' +
      '<div class="row"><input id="setup-student-new" type="text" placeholder="Add a student name" style="flex:1;margin:0">' +
      '<button id="setup-student-add" class="secondary">+ Add student</button></div></div>' +
      '<h2>Books</h2><div id="setup-books"></div>' +
      '<button id="setup-book-add" class="secondary">+ Add book</button>' +
      '<div class="row" style="margin-top:16px"><button id="setup-save" class="secondary">Save draft</button>' +
      '<button id="setup-upload">Upload for approval</button></div>' +
      '<div id="setup-out" style="margin-top:12px"></div>';
    el.innerHTML = html;

    /* Students: names live on draft.students; add/remove re-renders
       Setup. Nothing is saved until Save draft or Upload. */
    var studentsEl = $('setup-students');
    function drawStudents() {
      studentsEl.innerHTML = '';
      if (!draft.students.length) {
        studentsEl.innerHTML = '<p class="info">No students yet — add names below.</p>';
        return;
      }
      draft.students.forEach(function (name, i) {
        var row = document.createElement('div');
        row.className = 'student-row';
        row.innerHTML = '<span>' + esc(name) + '</span>' +
          '<button class="small danger" data-remove-student="' + i + '">Remove</button>';
        row.querySelector('[data-remove-student]').addEventListener('click', function () {
          draft.students.splice(i, 1);
          renderSetup();
        });
        studentsEl.appendChild(row);
      });
    }
    drawStudents();
    $('setup-student-add').addEventListener('click', function () {
      var input = $('setup-student-new');
      var name = input.value.trim();
      if (!name) return;
      if (draft.students.indexOf(name) === -1) draft.students.push(name);
      renderSetup();
    });

    /* Books: each card edits one book in place. Title, author and
       pages update the draft as you type; the emoji picker and
       Remove update it at once. Nothing is saved until Save draft
       or Upload. */
    var booksEl = $('setup-books');
    function bookCard(book, i) {
      var card = document.createElement('div');
      card.className = 'book-edit';
      var emojiBtns = EMOJIS.map(function (e) {
        return '<button type="button" data-emoji="' + e + '" class="' + (book.emoji === e ? 'picked' : '') + '">' + e + '</button>';
      }).join('');
      card.innerHTML =
        '<label>Title</label><input data-f="title" type="text" value="' + esc(book.title || '') + '">' +
        '<label>Author</label><input data-f="author" type="text" value="' + esc(book.author || '') + '">' +
        '<label>Cover emoji</label><div class="emoji-pick">' + emojiBtns + '</div>' +
        '<label>Pages — one page per line</label><textarea data-f="pages" rows="6">' + esc((book.pages || []).join('\n')) + '</textarea>' +
        '<button type="button" class="small danger" data-remove-book="' + i + '">Remove book</button>';
      card.querySelectorAll('[data-f]').forEach(function (input) {
        input.addEventListener('input', function () {
          var f = input.getAttribute('data-f');
          if (f === 'pages') {
            book.pages = input.value.split('\n').map(function (line) { return line.trim(); }).filter(function (line) { return line !== ''; });
          } else {
            book[f] = input.value;
          }
        });
      });
      card.querySelectorAll('[data-emoji]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          book.emoji = btn.getAttribute('data-emoji');
          card.querySelectorAll('[data-emoji]').forEach(function (b) {
            b.classList.toggle('picked', b.getAttribute('data-emoji') === book.emoji);
          });
        });
      });
      card.querySelector('[data-remove-book]').addEventListener('click', function () {
        draft.books.splice(i, 1);
        renderSetup();
      });
      return card;
    }
    draft.books.forEach(function (book, i) { booksEl.appendChild(bookCard(book, i)); });
    $('setup-book-add').addEventListener('click', function () {
      draft.books.push({
        id: 'book-' + Date.now().toString(36) + '-' + draft.books.length,
        title: 'New book',
        author: '',
        emoji: '📚',
        pages: ['Once upon a time...']
      });
      renderSetup();
    });

    /* collectDraft must include EVERY editable field — name, about,
       students and books — or Setup silently drops it. */
    function collectDraft() {
      return {
        name: $('setup-name').value.trim() || draft.name,
        about: $('setup-about').value,
        students: draft.students.filter(function (n) { return String(n).trim() !== ''; }),
        books: draft.books.filter(function (b) { return String(b.title || '').trim() !== ''; }).map(function (b) {
          return {
            id: b.id,
            title: String(b.title).trim(),
            author: b.author || '',
            emoji: b.emoji || '📚',
            pages: (b.pages || []).filter(function (p) { return String(p).trim() !== ''; })
          };
        })
      };
    }
    $('setup-save').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Saving…</p>';
      var d = collectDraft();
      rpc('save_kids_reading_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'editing';
        out.innerHTML = '<p class="info">Draft saved. Children still see the approved books.</p>';
      }).catch(function (err) {
        out.innerHTML = '<p class="error">Could not save: ' + esc(err.message) + '</p>';
      });
    });
    $('setup-upload').addEventListener('click', function () {
      var out = $('setup-out');
      out.innerHTML = '<p class="info">Uploading…</p>';
      var d = collectDraft();
      rpc('submit_kids_reading_draft', { p_slug: SLUG, p_username: staffCreds.u, p_password: staffCreds.p, p_draft: d }).then(function () {
        draft = d;
        draftStatus = 'pending';
        notifyEmail('Kids Reading draft for approval: ' + (d.name || SLUG), { school: d.name || '', slug: SLUG });
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
    $('site-name').textContent = 'Reading page not found';
    $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school yet. Check the link and try again — ask Yently for your reading link.</div>';
  } else {
    rpc('get_kids_reading_live', { p_slug: SLUG }).then(function (json) {
      if (!json || !json.name) throw new Error('not found');
      data = json;
      data.students = data.students || [];
      data.books = data.books || [];
      document.title = data.name || 'Kids Reading';
      var logo = $('site-logo');
      if (data.logo) { logo.src = (/^https?:\/\//.test(data.logo) ? data.logo : BASE + data.logo); logo.hidden = false; }
      $('site-name').textContent = data.name || 'Kids Reading';
      $('site-about').textContent = data.about || '';
      $('site-footer').innerHTML = '<div>Powered by Yently</div>';
      rpc('kids_reading_pass_status', { p_slug: SLUG }).then(function (s) {
        teacherUnlocked = !(s && s.has_pass);
        if (teacherUnlocked) {
          fetchServerScores().then(function () { renderPlay(); });
        } else {
          renderPlay();
        }
      }).catch(function () {
        /* If the status check itself is unreachable, stay open rather
           than locking every teacher out of a working school. */
        teacherUnlocked = true;
        fetchServerScores().then(function () { renderPlay(); });
      });
    }).catch(function () {
      $('site-name').textContent = 'Reading page not found';
      $('view-play').innerHTML = '<div class="error">This link doesn\'t point to a school yet. Check the link and try again.</div>';
    });
  }
})();
