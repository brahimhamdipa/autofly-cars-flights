# Kids Reading — one folder for every school

Kids Reading replaces the one-folder-per-school model. There is NO
`data.json` here on purpose: each school's name, about text, students
and books live in the database, and the page knows which school from
the link.

## Links

- Visitor link: the school's own private link — the PUBLIC bookshelf.
  Anyone with the link can pick a name and read. The owner gets
  their own private link by email — it is never printed on a public
  page.
- Play: a child taps their name, picks a book, and reads it one page
  at a time. On the last page the "I finished this book! 🎉" button
  records the finish. Finished books show a ✓ on that child's
  bookshelf.
- Teacher: the **Teacher** tab asks for the school's shared teacher
  password — one password for everybody, set by the admin and given
  to the owner with the Setup login. It shows who finished which
  book, newest first. Schools with no teacher password set stay
  fully open, as before. The password is enforced on the server by
  the list RPC, not just in the page, so it cannot be bypassed.
- Setup only: the Setup tab asks for the school's username +
  password. Credentials live in memory only — a reload asks for
  login again.
- New schools start with the demo books (two short original stories
  written for young readers). The owner changes them in Setup.

## How changes go live

1. The owner edits in Setup and taps **Save draft** (private) or
   **Upload for approval** (sends the draft to Yently: email +
   a pending item in Admin). The owner is emailed once the changes
   are live.
2. Admin approves the pending draft (approve RPC). The draft becomes
   the live bookshelf instantly — no file swap, no redeploy wait.
3. Children always see the last approved books. A new save after an
   upload reverts the status to editing, so the owner uploads again.

## Finished books

A finish is one row in `kids_reading_scores` per child per book
(game = book id, score = 1, total = 1). A second finish of the same
book by the same child is ignored on the server, so re-reading never
doubles the teacher's list. The Teacher tab reads the list through
the teacher password; children never see it. The bookshelf ✓ comes
from this browser's own finished list, plus the server list whenever
the teacher has unlocked the Teacher tab in this session (or the
school has no teacher password).

## Books

Each book has a title, author, cover emoji (picked from a small
list), and pages — one page per line in Setup. The two seed stories,
"The Brave Little Boat" and "Milo and the Moon Cat", are short
original stories written for this demo — they are not copied from
any published book. The owner can add their own books in Setup, or
use CC-BY picture books from StoryWeaver or Book Dash (with
attribution to the authors, as those licences ask).

## Footer and tabs

The footer is centered, on one line: "Powered by Yently". The Play /
Teacher / Setup tabs are centered inside the oval, including on
narrow screens where they wrap.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other
template folders), `app.js`, `style.css`, `README.md`. No `data.json`
— so kids-reading does not appear in Admin Folder Passes (there is
no file to pass-protect) and is not copy-managed: it is one folder
for all.

## Style

Deliberately the Yently site style: navy `#161d44` header, blue
`#2563eb` buttons, `#f6f7fb` background, white shadow cards — the
same look as the main site, so a visitor feels no style change
moving from the main site to a reading page. Buttons are bigger and
book text is larger than the other folder apps, for young readers.
