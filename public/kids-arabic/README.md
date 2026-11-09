# Kids Arabic — one folder for every Arabic school/class

Kids Arabic replaces the one-folder-per-school model. There is NO
`data.json` here on purpose: each school's name, about text,
students and word list live in the database, and the page knows
which school from the link.

## Links

- Visitor link: the school's own private link — the public Play
  page. Anyone with the link can play the games. The school's link
  is private: it is given to the owner by email, never printed on
  a public page.
- Teacher: the **Teacher** tab shows the saved scores so the
  teacher can see each student's progress. It needs the school's
  shared teacher password — one password for everybody, set by
  the admin and given to the owner with the Setup login. Schools
  with no teacher password set stay fully open, as before.
- Setup only: the Setup tab asks for the school's username +
  password. Credentials live in memory only — a reload asks for
  login again.
- New schools start with the demo content: 10 simple words and
  the demo students Alex, Sara and Omar (fake names only). The
  owner changes them in Setup. The 28 Arabic letters (with names)
  and the numbers 1–10 (Arabic-Indic numerals) are fixed in the
  code — the same for every school.

## The games

Play has three games, 10 rounds each:

- **Letters (الحروف)** — show an Arabic letter, the child picks
  its name from 4 choices.
- **Words (الكلمات)** — show an Arabic word, the child picks its
  English meaning from 4 choices.
- **Numbers (الأرقام)** — show an Arabic-Indic numeral (١٢٣…),
  the child picks the right number from 4 choices.

The child picks their name first, so every finished game saves
its score (student, game, score/total, date) for the Teacher tab.
Encouraging messages are in Arabic, with simple English where
helpful. The whole app is RTL, with big buttons and very large
Arabic text made for kids.

## How changes go live

1. The owner edits in Setup — school name, about text, students
   list (add/remove), word list (each word: Arabic word + English
   meaning, add/edit/delete) — and taps **Save draft** (private)
   or **Upload for approval** (sends the draft to Yently: email +
   a pending item in Admin).
2. Admin approves the pending draft. The draft becomes the live
   content instantly — no file swap, no redeploy wait.
3. Visitors always see the last approved version. A new save after
   an upload reverts the status to editing, so the owner uploads
   again.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other
template folders, with `dir="rtl" lang="ar"`), `app.js`,
`style.css`, `README.md`. No `data.json` — so kids-arabic does
not appear in Admin Folder Passes (there is no file to
pass-protect) and is not copy-managed: it is one folder for all.

## Style

Deliberately the Yently site style: navy `#161d44` header, blue
`#2563eb` buttons, `#f6f7fb` background, white shadow cards — the
same look as yently.com, so a visitor feels no style change
moving from the main site to a school page. Adapted for kids:
bigger buttons, very large Arabic text, RTL layout throughout.
