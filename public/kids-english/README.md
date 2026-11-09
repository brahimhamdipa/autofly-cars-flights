# Kids English — one folder for every school

Kids English is the Yently Kids English vocabulary + spelling app.
There is NO `data.json` here on purpose: each school's students
and word list live in the database, and the page knows which
school from the link.

## Links

- Visitor link: the school's own private link — the PUBLIC Play
  page. Anyone with the link can play. (Never print a full example
  link anywhere public — owners are told they'll get their own
  private link by email.)
- Teacher only: the **Teacher** tab asks for the school's shared
  teacher password — one password for everybody, set by the admin
  and given to the owner with the Setup login. Schools with no
  teacher password set stay fully open, as before.
- Setup only: the Setup tab asks for the school's username +
  password. Credentials live in memory only — a reload asks for
  login again.
- New schools start with the demo word list (12 simple words:
  apple, cat, sun, book, dog, house, milk, ball, fish, tree,
  bird, happy). The owner changes it in Setup.

## How changes go live

1. The owner edits in Setup and taps **Save draft** (private) or
   **Upload for approval** (sends the draft to Yently: email +
   a pending item in Admin).
2. Admin approves (the approve RPC). The draft becomes the live
   word list instantly — no file swap, no redeploy wait.
3. Children always see the last approved word list. A new save
   after an upload reverts the status to editing, so the owner
   uploads again.

## Play

A child picks their name from the student list, then picks a game:

- **Spell it** — see the meaning/hint, type the word, check the
  spelling.
- **Pick the word** — see a meaning, pick the right word from 4
  choices.
- **What does it mean?** — see a word, pick the right meaning
  from 4 choices.

Each game is 10 rounds. The score shows at the end with an
encouraging message, and is saved so the teacher can see it.
The teacher password is enforced on the server by the scores
list RPC, not just in the page, so the gate cannot be bypassed.
Teacher passwords are readable BY DESIGN like the other folder
credentials — throwaway only.

## Teacher

The Teacher tab shows a table of saved scores (student, game,
score/total, date), newest first, so the teacher can see each
student's progress.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other
template folders), `app.js`, `style.css`, `README.md`. No
`data.json` — so kids-english does not appear in Admin Folder
Passes (there is no file to pass-protect) and is not
copy-managed: it is one folder for all.

## Style

Deliberately the Yently site style: navy `#161d44` header, blue
`#2563eb` buttons, `#f6f7fb` background, white shadow cards — the
same look as yently.com, so a visitor feels no style change
moving from the main site to a school page. Buttons and text are
bigger than the other folder apps, because children tap them.
