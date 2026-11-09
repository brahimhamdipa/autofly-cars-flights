# Kids Coding — one folder for every school

Kids Coding is a Blockly-style coding puzzle game for children. There
is NO `data.json` here on purpose: each school's students and puzzles
live in the database, and the page knows which school from the link.

No Blockly library is loaded — no vendored copy, no CDN. The block
system is our own small tap-to-add builder, inspired by Blockly
Games' Maze, so the folder stays self-contained and reliable: the
child taps blocks in the palette and the robot follows them in order.

## Links

- Visitor link: the school's own private link — you'll get your own
  private link by email. Anyone with the link can play.
- Play (public): the child picks their name from the student list,
  picks a puzzle, and builds a program from blocks: Move forward,
  Turn left, Turn right, Repeat 2×, Repeat 3×, Repeat 4×. A Repeat
  block repeats the NEXT block that many times — Repeat 3× + Move
  forward = 3 moves. Repeats in a row multiply. Run executes the
  program step by step (about 400ms per step). Bumping into a wall
  stops the robot with a gentle message; reaching the ⭐ celebrates
  and saves stars.
- Stars: 3 stars when the program uses at most the puzzle's par
  number of blocks, 2 stars within par + 2, otherwise 1 star. Solved
  puzzles show their stars next to the puzzle name, per student.
  Solved stars are saved in the database (record RPC) and read back
  from the scores list; a copy is also kept in this browser, so a
  child still sees their stars right after solving even on a school
  whose teacher list needs the teacher password.
- Teacher: the **Teacher** tab needs the school's shared teacher
  password — one password for everybody, set by the admin and given
  to the owner with the Setup login. It shows a table of saved
  progress (student, puzzle, stars, date). Schools with no teacher
  password set stay fully open, as before.
- Setup only: the Setup tab asks for the school's username +
  password. Credentials live in memory only — a reload asks for
  login again.
- New schools start with the demo puzzles (6 seed puzzles below).
  The school changes them in Setup.

## How changes go live

1. The school edits in Setup and taps **Save draft** (private) or
   **Upload for approval** (sends the draft to Yently: email +
   a pending item in Admin).
2. Admin approves. The draft becomes the live puzzles instantly —
   no file swap, no redeploy wait.
3. Children always see the last approved puzzles. A new save after
   an upload reverts the status to editing, so the school uploads
   again.

## The 6 seed puzzles

1. **First steps** (5×5, no walls) — Move forward 4 times. Par 4.
2. **Around the corner** (5×5, wall at 2,0) — right, turn left, up,
   turn right, right to the star. Par 10.
3. **The long way** (6×6, a 2×2 wall block in the middle) — all the
   way along the bottom, then all the way up. Par 11.
4. **Two turns** (6×6, walls block the bottom road and the right
   column) — turn up early, turn right at the top. Par 12.
5. **Maze** (7×7, several walls) — follow the only open path:
   right, up, right, up, right. Par 16.
6. **Repeat to win** (7×7, one wall) — designed to need Repeat
   blocks: Repeat 3× + Move forward, twice, turn left, then the
   same again. Par 9 (13 blocks without repeats).

## Setup — puzzles

Each puzzle has a name, grid size (5–7 rows and columns), walls
(one "row,col" per line), start cell + facing direction, goal cell,
par (blocks for 3 stars), and a hint. The editor shows a live
preview of the grid as you type, and checks the puzzle before it
can be saved: start and goal must be inside the grid and not on a
wall, and different cells. Whether the goal can actually be
reached is NOT checked — a hard puzzle is fine.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other
template folders), `app.js`, `style.css`, `README.md`. No `data.json`
— so kids-coding does not appear in Admin Folder Passes (there is
no file to pass-protect) and is not copy-managed: it is one folder
for all. SQL is in `supabase/kids_coding.sql` (one paste,
idempotent): tables `kids_coding_shops` + `kids_coding_scores` and
the RPCs the page uses. Demo school: slug `demo-coding`, name
"Demo Coding", username / password / teacher password all `demo`,
students Alex, Sara, Omar (fake names only).

## Style

Deliberately the Yently site style: navy `#161d44` header, blue
`#2563eb` buttons, `#f6f7fb` background, white shadow cards — the
same look as yently.com, so a visitor feels no style change
moving from the main site to a school page. Buttons and text are
bigger than the other folder apps, because children tap them, and
the maze cells are large with a clear robot arrow, dark walls, and
a gold goal cell.
