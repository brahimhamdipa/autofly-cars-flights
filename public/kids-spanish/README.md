# Kids Spanish — one folder for every school

Kids Spanish is a Spanish vocabulary game for children. There is NO
`data.json` here on purpose: each school's name, students and word
list live in the database, and the page knows which school from the
link.

## Links

- Visitor link: the school's own private link — the Play tab is
  public. A child picks their name from the student list, picks a
  game, and plays 10 rounds. Anyone with the link can play.
- Teacher: the **Teacher** tab needs the school's shared teacher
  password — one password for everybody, set by the admin and given
  to the owner with the Setup login. It shows a table of saved
  scores (student, game, score/total, date), newest first, so the
  teacher can see each student's progress. Schools with no teacher
  password set stay fully open, as before.
- Setup only: the Setup tab asks for the school's username +
  password. Credentials live in memory only — a reload asks for
  login again.
- New schools start with the demo word list (12 simple words:
  manzana, gato, sol, libro, perro, casa, leche, pelota, pez,
  árbol, pájaro, feliz). The owner changes it in Setup.

## The games

- **Spell it** — show the English meaning, the child types the
  Spanish word. Accents count with or without them: "árbol" and
  "arbol" are both right.
- **Pick the word** — show an English meaning, the child picks the
  right Spanish word from 4 choices.
- **What does it mean?** — show a Spanish word, the child picks the
  right English meaning from 4 choices.

10 rounds per game. The score is shown at the end with an
encouraging message, and saved so the teacher can see it. Big
buttons and large text throughout, because children tap them.

## How changes go live

1. The owner edits in Setup and taps **Save draft** (private) or
   **Upload for approval** (sends the draft to Yently: email +
   a pending item in Admin).
2. Admin approves the draft. The draft becomes the live word list
   instantly — no file swap, no redeploy wait.
3. Children always see the last approved word list. A new save after
   an upload reverts the status to editing, so the owner uploads
   again.

## Scores

Each finished game saves one row (student, game, score/total,
date). The teacher password is enforced on the server by the
score-listing RPC, not just in the page, so it cannot be bypassed.
Teacher passwords are readable BY DESIGN like the other school
credentials — throwaway only.

## Footer and tabs

The footer is centered: "Powered by Yently". The Play / Teacher /
Setup tabs are centered inside the oval, including on narrow
screens where they wrap.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other
template folders), `app.js`, `style.css`, `README.md`. No `data.json`
— so kids-spanish does not appear in Admin Folder Passes (there is
no file to pass-protect) and is not copy-managed: it is one folder
for all.

## Style

Deliberately the Yently site style: navy `#161d44` header, blue
`#2563eb` buttons, `#f6f7fb` background, white shadow cards — the
same look as yently.com, so a visitor feels no style change
moving from the main site to a school page. Buttons and text are
bigger than the other folder apps, because children tap them.
