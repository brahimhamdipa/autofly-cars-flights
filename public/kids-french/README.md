# Kids French — French vocabulary games for kids

One folder for every school. There is NO `data.json` here on
purpose: each school's name, students, and word list live in the
database, and the page knows which school from the link.

## Links

- Visitor link: the school's own private link — the Play tab.
  Anyone with the link can play. Never print a full example link
  in public copy; say "you'll get your own private link by email".
- Teacher: the **Teacher** tab asks for the school's shared
  teacher password — one password for everybody, set by the admin
  and given to the owner with the Setup login. Schools with no
  teacher password set stay fully open. The password is checked
  on the server by the RPC, not just in the page.
- Setup only: the Setup tab asks for the school's username +
  password. Credentials live in memory only — a reload asks for
  login again.
- New schools start with the demo word list (12 simple words:
  pomme, chat, soleil, livre, chien, maison, lait, ballon,
  poisson, arbre, oiseau, heureux). The owner changes it in Setup.

## The games

A child picks their name, then picks a game. Every game is 10
rounds, and the score at the end is saved so the teacher can see
each student's progress.

- **Spell it** — see the English meaning, type the French word.
  Accents are accepted with or without: "elephant" and
  "éléphant" both count as right.
- **Pick the word** — see the English meaning, pick the right
  French word from 4 choices.
- **What does it mean?** — see a French word, pick the right
  English meaning from 4 choices.

Big buttons, large text, and encouraging messages after every
answer. A game needs at least 4 words in the list to start.

## Teacher

The Teacher tab shows a table of saved scores (student, game,
score/total, date), newest first, so the teacher can see each
student's progress. The list refreshes with the Refresh button.

## How changes go live

1. The owner edits in Setup and taps **Save draft** (private) or
   **Upload for approval** (sends the draft to Yently: email +
   a pending item in Admin).
2. Admin approves (the approve RPC). The draft becomes the live
   word list instantly — no file swap, no redeploy wait.
3. Children always see the last approved word list. A new save
   after an upload reverts the status to editing, so the owner
   uploads again.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other
template folders), `app.js`, `style.css`, `README.md`. No
`data.json` — so kids-french does not appear in Admin Folder
Passes (there is no file to pass-protect) and is not
copy-managed: it is one folder for all.

SQL: `supabase/kids_french.sql` (one paste, idempotent) — tables
`kids_french_shops` + `kids_french_scores` and all RPCs.

## Style

Deliberately the Yently site style: navy `#161d44` header, blue
`#2563eb` buttons, `#f6f7fb` background, white shadow cards — the
same look as yently.com, so a visitor feels no style change
moving from the main site to a school page. Buttons and text are
bigger than the other folder apps, because children tap them.
