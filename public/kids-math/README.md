# Kids Math — one folder for every school

Kids Math replaces the one-folder-per-school model. There is NO
`data.json` here on purpose: each school's name, about text,
students and questions-per-round live in the database, and the
page knows which school from the link.

## Links

- Visitor link: the school's own private link — the Play tab is
  public. A child picks their name from the student list, picks a
  level and a game, and plays a round of questions. Scores are
  saved for the teacher to see.
- Teacher: the **Teacher** tab needs the school's shared teacher
  password — one password for everybody, set by the admin in Kids
  Math Schools and given to the owner with the Setup login.
  Schools with no teacher password set stay fully open, as before.
  The teacher sees a table of saved scores (student, game, level,
  score/total, date) plus a per-student progress summary (rounds
  played, best score, average).
- Setup only: the Setup tab asks for the school's username +
  password. Credentials live in memory only — a reload asks for
  login again.
- New schools start with the demo setup (Demo Math: Alex, Sara,
  Omar; 10 questions per round). The customer changes it in Setup.

## Levels and games

Levels and games are fixed in the page, not in the database:

- **Easy** — numbers to 10, adding and taking away.
- **Medium** — numbers to 50, adding, taking away, and
  multiplying by 2, 3 or 5.
- **Hard** — numbers to 100, all four operations.
- Games: Addition, Subtraction, Multiplication, Division.
  Division always has a whole-number answer; subtraction never
  goes below zero. Each round has the number of questions set in
  Setup (default 10), with four big answer choices per question
  and an encouraging message at the end.

## How changes go live

1. The customer edits in Setup and taps **Save draft** (private) or
   **Upload for approval** (sends the draft to Yently: email +
   a pending item in Admin).
2. Admin approves the draft. The draft becomes the live version
   instantly — no file swap, no redeploy wait.
3. Children always see the last approved version. A new save after
   an upload reverts the status to editing, so the customer uploads
   again.

## Scores

Every finished round is saved with the student's name, game,
level, score and total. The teacher list shows the newest 200
scores. Scores are saved through the record RPC, which needs no
password — the child never sees a login screen.

## Footer and tabs

The footer is centered: the about line first, then
"Powered by Yently". The Play / Teacher / Setup tabs are centered
inside the oval, including on narrow screens where they wrap.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other
template folders), `app.js`, `style.css`, `README.md`. No `data.json`
— so kids-math does not appear in Admin Folder Passes (there is no file
to pass-protect) and is not copy-managed: it is one folder for all.

## Style

Deliberately the Yently site style: navy `#161d44` header, blue
`#2563eb` buttons, `#f6f7fb` background, white shadow cards — the
same look as yently.com, so a visitor feels no style change
moving from the main site to a school page. Buttons and text are
bigger than the other folder apps, because children tap them.
