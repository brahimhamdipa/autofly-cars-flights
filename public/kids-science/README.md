# Kids Science — one folder for every school

Kids Science is the science quiz app for Yently Kids: science quizzes
and facts for kids, by topic and level. There is NO `data.json` here
on purpose: each school's name, students, topics, facts and quiz
questions live in the database, and the page knows which school from
the link.

## Links

- Visitor link: the school's own private link — you'll get your own
  private link by email. Anyone with the link can play.
- Play (public): a child picks their name from the student list,
  picks a topic (Animals, Space, Human Body, Plants, Earth & Weather)
  and a level (Easy / Medium / Hard), then answers 5 quiz questions
  (4 choices each). After each answer the page says whether it was
  right and shows a one-line fun fact; the score is shown at the end
  and saved for the teacher. A "Did you know?" fact from the chosen
  topic is shown on the Play home.
- Teacher: the **Teacher** tab needs the school's shared teacher
  password — one password for everybody, set by the admin and given
  to the owner with the Setup login. It shows a table of saved scores
  (student, topic, level, score/total, date) so the teacher can see
  each student's progress. Schools with no teacher password set stay
  fully open. The password is checked on the server by the RPCs, not
  just in the page.
- Setup only: the Setup tab asks for the school's username +
  password. Credentials live in memory only — a reload asks for
  login again.
- New schools start with the demo content (3 topics: Animals, Space,
  Human Body — 2 facts and 6 questions each, 2 per level). The owner
  changes it in Setup.

## How changes go live

1. The owner edits in Setup and taps **Save draft** (private) or
   **Upload for approval** (sends the draft to Yently: email +
   a pending item in Admin).
2. Admin approves the draft (approve RPC). The draft becomes the live
   content instantly — no file swap, no redeploy wait.
3. Children always see the last approved content. A new save after an
   upload reverts the status to editing, so the owner uploads again.

## Scores

A finished quiz saves one row per play (student, topic as the game,
level, score, total) through the record RPC. The Teacher tab lists
the newest 200 scores. Scores are never edited from the page.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other
template folders), `app.js`, `style.css`, `README.md`. No `data.json`
— so kids-science does not appear in Admin Folder Passes (there is
no file to pass-protect) and is not copy-managed: it is one folder
for all.

## Style

Deliberately the Yently site style: navy `#161d44` header, blue
`#2563eb` buttons, `#f6f7fb` background, white shadow cards — the
same look as yently.com, so a visitor feels no style change moving
from the main site to a science page. Buttons and text are bigger
than the other folder apps, because the players are children.
