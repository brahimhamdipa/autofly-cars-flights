# Kids Geography — one folder for every school

Kids Geography is a countries, capitals and flags quiz for kids.
There is NO `data.json` here on purpose: each school's name, about
text, students and country list live in the database, and the page
knows which school from the link.

## Links

- Visitor link: the school's own private link — the PUBLIC Play
  page. Anyone with the link can play. No full example link is ever
  printed in public copy; each school gets its own private link by
  email.
- Teacher only: the **Teacher** tab asks for the school's shared
  teacher password — one password for everybody, set by the admin
  and given to the owner with the Setup login. Schools with no
  teacher password set stay fully open.
- Setup only: the Setup tab asks for the school's username +
  password. Credentials live in memory only — a reload asks for
  login again.
- New schools start with the demo country list (20 countries) and
  the demo students (Alex, Sara, Omar — fake names). The owner
  changes them in Setup.

## How changes go live

1. The owner edits in Setup and taps **Save draft** (private) or
   **Upload for approval** (sends the draft to Yently: email +
   a pending item in Admin).
2. Admin approves the draft. The draft becomes the live version
   instantly — no file swap, no redeploy wait.
3. Children always see the last approved version. A new save after
   an upload reverts the status to editing, so the owner uploads
   again.

## Play

A child picks their name from the student list, picks a game and a
level, then plays 10 rounds:

- **Capitals** — see a country, pick its capital from 4 choices.
- **Flags** — see a big flag emoji, pick the country from 4 choices.
- **Continents** — see a country, pick its continent from 4 choices.

**Easy** uses only the well-known countries (the ones the owner
marked Easy). **Hard** uses every country in the list. Big buttons,
large text and encouraging messages after every answer. The score
is shown at the end and saved, so the teacher can see each
student's progress.

## Teacher

The Teacher tab shows a table of saved scores (student, game,
level, score out of 10, date), newest first, so the teacher can see
each student's progress. The teacher password is checked on the
server by the list RPC, not just in the page, so it cannot be
bypassed.

## Setup

The owner edits the school name, about text, students list (add /
remove names) and the country list. Each country has a name,
capital, continent, flag emoji and an Easy flag (well-known or
not) — the owner can add, edit or delete countries. The draft
status (editing / pending / approved) is shown at the top of Setup.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other
template folders), `app.js`, `style.css`, `README.md`. No `data.json`
— so kids-geography does not appear in Admin Folder Passes (there
is no file to pass-protect) and is not copy-managed: it is one
folder for all.

## Style

Deliberately the Yently site style: navy `#161d44` header, blue
`#2563eb` buttons, `#f6f7fb` background, white shadow cards — the
same look as yently.com, so a visitor feels no style change
moving from the main site to a school page. Buttons and text are
bigger than the other folder apps, because children tap them.
