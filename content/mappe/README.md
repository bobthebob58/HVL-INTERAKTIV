# content/mappe — the template and criteria of the pedagogisk mappe

A teacher at HVL can download a draft *pedagogisk mappe* (teaching portfolio) built from their own activities in
HVL Interaktiv, as Markdown or as an accessible PDF (spec 04 §7, `MAPPE-001` to `MAPPE-004`). This folder holds the
two things ALU decides in that document, so they can be changed without code (D-094):

| File | What it holds | Status |
|---|---|---|
| `template.nn.md`, `template.nb.md`, `template.en.md` | The portfolio's headings and fixed guidance text, with places where the teacher's activities are filled in | to be added in Session 5, from the proposal in `docs/reference/proposals/mappe-template.nn.md` |
| `criteria.nn.yaml`, `criteria.nb.yaml`, `criteria.en.yaml` | The criteria for merittering, grouped by criteria set (one set per HVL call, e.g. 2025), with each set's limits | to be added in Session 5 |

Until ALU confirms them, both are drafts (open question Q17).

## How the files will work

- **The template** is ordinary Markdown with places for values written in double braces, such as `{{dato}}`.
  Only the names the server knows are allowed; a misspelt name stops the check, so a value can never silently be
  left out. Lines between `<!--` and `-->` are notes for the people who edit the file and never reach the
  portfolio. Triple braces (`{{{…}}}`) are refused: every value a teacher wrote (an activity title, a learning
  outcome) is shown as plain text, so it cannot turn into a heading or a link.
- **The criteria** are listed per criteria set. Choosing another set changes every criterion text and the reader's
  guide (the table that shows where in the portfolio each criterion is answered), which the server builds from the
  criteria, so it is not written in the template.
- **The limits** are part of each criteria set: the most words in Del 1 (7 500 in the 2025 call) and the most
  attachments (11). Both are *(verify)* until ALU confirms them for the next call. The word count covers Del 1 only,
  not the reader's guide or the references.
- **The three languages** must match: the three templates use the same values, and the three criteria files the same
  criteria IDs.
- **Privacy:** the portfolio never names a student or shows a student's answer or score. Numbers about students are
  totals for groups of at least five (`MAPPE-003`).

The exact list of value names, the markers around Del 1 and an example are added to this guide together with the
files.

## What catches mistakes

`npm run content:check` (see [../README.md](../README.md)) checks these files as soon as they exist, the same way the
server does when it starts: a missing language, an unknown or repeated key, a value name the server does not know,
or criteria IDs that differ between the languages. Each message names the file, the line and the key.
