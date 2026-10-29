# content/laeringsdesign — texts and settings for læringsdesign

| File | What it holds |
|---|---|
| `phases.yaml` | The names and texts of the three phases (Forarbeid, Mellomarbeid, Etterarbeid) and of the *samling* |
| `references.yaml` | The full references that the guide and the patterns cite |
| `patterns/<id>/` | One folder per pattern: what it is for (`pattern.yaml`) and the activity it starts from (a skeleton) |
| `hint-thresholds.yaml` | The limits of the pedagogical hints the validator gives before publishing |

Every file is checked when the server starts. `npm run content:check` (see [../README.md](../README.md)) checks
`phases.yaml`, `references.yaml`, the patterns and the studio's other texts without a server; `hint-thresholds.yaml`
is checked by its own test instead (see "What catches mistakes" under hint-thresholds.yaml below).

## phases.yaml

The studio sorts activities into three phases around the *samling*, the synchronous session (spec 04 §1). Code and
the database only know the phases' **keys**: `forarbeid`, `underveis` and `etterarbeid`. Everything people read is
in this file, in Nynorsk (`nn`), Bokmål (`nb`) and English (`en`): the studio page, the phase matrix, the filters,
the planner and the portfolio take their words from here.

Each phase has:

| Field | What it is | Where it shows |
|---|---|---|
| `key` | The code: `forarbeid`, `underveis` or `etterarbeid`. **Never change it.** | nowhere; code uses it |
| `order` | 1, 2 or 3: the order of the columns | matrix, filters, planner |
| `position` | `before-samling`, `between-samlingar` or `after-samling` | where the phase sits around the *samling* |
| `label` | The phase's name, at most 60 characters | everywhere |
| `description` | One or two sentences on what the phase is | studio page |
| `purpose` | The pedagogical purpose (spec 04 §3, phase matrix) | phase matrix |
| `canvasPlacement` | Where the activity goes in Canvas, and how many attempts students get | phase matrix |

`anchor` describes the *samling* itself, with a `label` and a `description`. `status: proposed` means ALU has not
yet confirmed the texts; while it says so, the studio pages show a banner saying the texts are a draft. Change it to
`status: confirmed-by-alu` when ALU has approved them.

### Example: rename a phase

The key `underveis` stays; only the label changes. To call it «Mellomøkt», change the three lines under `label`:

```yaml
  - key: underveis
    order: 2
    position: between-samlingar
    label:
      nn: Mellomøkt
      nb: Mellomøkt
      en: Between sessions
```

Leave `key`, `order`, `position` and the other texts below `label` as they are.

Nothing else is needed: every page, the planner and the portfolio use the new name after the next start.

### Writing long texts

A text that is too long for one line can be written over several lines after `>-`; the lines are joined with spaces:

```yaml
    purpose:
      nn: >-
        Aktivere forkunnskapane til studentane, møte terskelomgrep og avdekkje misoppfatningar
        før undervisninga.
```

Use `>-` also when a text contains a colon followed by a space (`: `), which YAML would otherwise read as a new key.

## references.yaml

The guide and the patterns cite research as `[@key]`, for example `[@guo2014]`. This file gives each key its full
reference, which the page lists at the end (spec 04 §3 and `PED-002`).

```yaml
references:
  guo2014:
    text: >-
      Guo, P. J., Kim, J., & Rubin, R. (2014). How video production affects student engagement: An empirical study
      of MOOC videos. In Proceedings of the First ACM Conference on Learning @ Scale (L@S ’14). Association for
      Computing Machinery.
    verify: true
```

- **The key** is lower-case letters, digits and hyphens, usually the first author and the year (`guo2014`,
  `mogelvang2025`; write `ø` as `o`). Do not rename a key that a text cites.
- **`text`** is the whole reference as plain text: no Markdown, so titles are not in italics. At most 600 characters.
- **`verify`** is `true` until someone at ALU has checked the reference against the source (open question Q17).
  The references were written from the research table in spec 04 §3; titles and publishers have not been checked
  yet, and no DOIs or page numbers were added that the project's own sources do not give. Set `verify: false` only
  after checking.

To add a reference, add a key with `text` and `verify`, then cite it as `[@key]` in a guide text or a pattern.

## What catches mistakes in phases.yaml and references.yaml

- `npm run content:check`, the pre-commit check on this folder, CI on every pull request, and the server's start
  all stop on: a text missing in `nn`, `nb` or `en`; a key the file does not know (a misspelling such as `lable`);
  a key written twice; a phase key other than `forarbeid`, `underveis` and `etterarbeid`, or one of them missing or
  listed twice; a reference key in capitals; a reference without `verify`; and a citation of a key this file does
  not list. Each message names the file, the line and the key.
- The tests in `apps/server/test/learningDesign/content/` load these files on every test run, and check that a
  renamed label is loaded without a code change (`PED-001`). The studio pages, the planner and the portfolio take
  every name from what is loaded here.

## patterns/ — the pattern catalogue

A pattern is a tried way of building one kind of activity, such as «Kort video med kontrollspørsmål» (spec 04 §4).
An author who picks a pattern gets a new activity that is already built the way the pattern says, with *guidance*
in place of the real content: «⟦Skriv eit spørsmål som får studenten til å bruke omgrepet⟧». The author then
replaces the guidance with their own content. Adding or changing a pattern needs no code: only the files in its
folder.

Each pattern is a folder named by its ID, with two or three files:

```text
patterns/
  ea-retrieval/                  one content type
    pattern.yaml
    skeleton.json
  ea-terms/                      two content types: one skeleton per type
    pattern.yaml
    skeleton.H5P.DragText.json
    skeleton.H5P.Blanks.json
```

- **`pattern.yaml`** says what the pattern is for, in Nynorsk, Bokmål and English, and holds every text the new
  activity gets.
- **The skeleton** is the activity itself, as H5P stores it, with a `{{token}}` wherever a text from `pattern.yaml`
  goes. A pattern with one content type has `skeleton.json`. A pattern with two content types has one file per type,
  named after the type (`skeleton.H5P.DragText.json` and `skeleton.H5P.Blanks.json`), and no `skeleton.json`.
- Nothing else belongs in the folder; `content:check` names any other file.

### pattern.yaml

| Field | What it is |
|---|---|
| `id` | The pattern's ID, the same as the folder's name: lower-case letters, digits and hyphens, e.g. `ea-retrieval`. Do not rename a pattern that activities were made from: they remember the ID. |
| `phases` | One or two of `forarbeid`, `underveis` and `etterarbeid`. With two, the author chooses; the first in that order is the default. |
| `contentTypes` | One or two of the ten content types, e.g. `H5P.QuestionSet`. With two, the author chooses, and each has its own skeleton file. |
| `name` | The pattern's name, at most 80 characters |
| `purpose` | One line on what it does, at most 200 characters |
| `whenToUse` | When to choose it, at most 600 characters |
| `example` | A short example of it in use, at most 600 characters |
| `whyItWorks` | Why it works, at most 2 000 characters, citing research as `[@key]` from `references.yaml`. All three languages cite the same references in the same order. |
| `buildMinutes` | About how many minutes an author needs to build it (1–600) |
| `studentMinutes` | About how many minutes a student needs; the new activity gets this as its suggested time (1–600) |
| `texts` | Every text the skeleton's tokens are filled with, in `nn`, `nb` and `en`, each one line of at most 1 000 characters (its field in the activity may allow less; see below). A text's name is a letter followed by letters, digits or hyphens, e.g. `question1`. |

Every text has `nn`, `nb` and `en`. A short example:

```yaml
id: ea-retrieval
phases:
  - etterarbeid
contentTypes:
  - H5P.QuestionSet
name:
  nn: Repetisjonssett
  nb: Repetisjonssett
  en: Retrieval set
# … purpose, whenToUse, example, whyItWorks, buildMinutes and studentMinutes …
texts:
  question1:
    nn: ⟦Skriv eit spørsmål som får studenten til å bruke omgrepet, ikkje berre kjenne det att⟧
    nb: ⟦Skriv et spørsmål som får studenten til å bruke begrepet, ikke bare kjenne det igjen⟧
    en: ⟦Write a question that makes the student use the concept, not just recognise it⟧
```

### The skeleton and its tokens

A skeleton is a JSON file with three parts:

```json
{
  "library": "H5P.QuestionSet 1.21",
  "metadataTitle": "{{title}}",
  "params": { "questions": [ … ], "passPercentage": 80 }
}
```

- **`library`** is the content type and its version. Use the version the editor offers; `content:check` names it if
  you got it wrong. A question or other part inside the activity (sub-content) names its own library, and that must
  be a version its place in the activity offers; `content:check` lists the versions it offers.
- **`metadataTitle`** is the new activity's title. It may hold tokens; filled in, it is one line of at most 255
  characters.
- **`params`** is the activity's content, as H5P stores it (its `content.json`).

A token is a name between double braces, `{{question1}}`, anywhere in a text of the skeleton. When an author creates
the activity in Nynorsk, `{{question1}}` becomes the `nn` text of `question1`; in Bokmål the `nb` text, and so on.
The rules:

- Every token needs a text under `texts`, and every text must be used by a token in a skeleton.
- A text is plain text. Write `&`, `<` and `>` as they are; the system writes them the way H5P stores them. For the
  activity's formatting, put the HTML in the skeleton around the token: `"<p>{{question1}}</p>"`.
- A text cannot hold `{{` or `}}`, and it is one line (use `>-` for a long one, see "Writing long texts" above).
- Some fields have a length limit, for example the start-screen title of an Interactive Video (60 characters).
  `content:check` measures every filled-in field in all three languages, and names the field and the language that
  is too long. Note that `&` counts as five characters there, because H5P stores it as `&amp;`.
- Settings a pattern is about are written in the skeleton (retry and «Vis svar» on, no time limits, an informative
  pass mark: `PROD-009`). Everything else is left out: the system adds the content type's own defaults, in the
  author's language, when the activity is created.
- Some content types have English defaults even in Nynorsk and Bokmål, for buttons and messages (for example
  Multiple Choice, Question Set, Interactive Book and Branching Scenario). Set those fields in the skeleton with
  tokens, so the activity gets the pattern's own `nn`, `nb` and `en` texts.

### The guidance marker ⟦…⟧ and V-PLACEHOLDER

Guidance is wrapped in `⟦` and `⟧` (Unicode U+27E6 and U+27E7; copy them from this page). The marks are visible to the
author and never occur in ordinary text, so the system can find guidance that is still there:

- Before an author publishes, the check (V-PLACEHOLDER) lists every field that still holds `⟦…⟧`, also in button
  labels and in titles, with «Gå til feltet». It is an error, so the author either replaces the guidance or publishes
  with a reason, as for every other error. A single `⟦` or `⟧` left behind counts too.
- The same check reports an Interactive Video without a video and an Image Hotspots without a background image,
  because students would otherwise see only an English error message. A skeleton never holds media: the author adds
  them.
- In Fill in the Blanks and Drag the Words, the answer between two `*` may not hold guidance with `:` or `/` (the
  content type reads them as a tip and as another accepted answer). `content:check` names such a text.

Every learner-facing title of a part should be a token or guidance as well, for example an Interactive Book chapter's
title, which students see as a heading.

### Making a skeleton from an exported .h5p file

The easiest way to make a skeleton is to build an example activity in the editor and take its content.

1. Build the activity in HVL Interaktiv, in Nynorsk, the way the pattern should start. Leave out images and videos.
2. Download it as an `.h5p` file: signed in, open `/h5p/download/<ID>`, where `<ID>` is the last part of the
   activity's address (`/aktivitet/<ID>`). Rename the file to end in `.zip` and unzip it.
3. Open `h5p.json`. Under `preloadedDependencies`, find the entry whose `machineName` is the `mainLibrary`, and write
   it as `"library": "<machineName> <majorVersion>.<minorVersion>"`, for example `"H5P.QuestionSet 1.21"`.
4. Open `content/content.json` and put all of it under `"params"` in the skeleton.
5. Replace every text a student reads with a token, for example `"<p>{{question1}}</p>"`, and put the text,
   wrapped in `⟦…⟧` where it is guidance, under `texts` in `pattern.yaml`, in `nn`, `nb` and `en`.
6. Give every part (sub-content) a title, `"metadata": { "title": "{{question1Title}}", "license": "U" }`.
   You may delete the `subContentId` lines; the system gives every part a new one anyway. Keep every item of a list
   (questions, answers, slides): the defaults never add items.
7. Delete settings you did not choose on purpose: the content type's defaults come back in the author's language.
8. Run `npm run content:check` and fix what it names.

### What catches mistakes in a pattern

- `npm run content:check` (with the pinned content types installed by `npm run h5p:fetch-libraries`; CI always has
  them) stops on: a text missing in `nn`, `nb` or `en`; a misspelt key; an ID that is not the folder's name; a phase
  or content type that does not exist; a missing skeleton or a file that does not belong; a skeleton that is not
  valid JSON; a token without a text, or a text no token uses; a wrong library version; a filled-in text too long for
  its field; a title over 255 characters; guidance with `:` or `/` in a blank; a citation of a key `references.yaml`
  does not list. Each message names the file, the line and the key. Without the pinned content types on your own
  machine, the versions and length limits are not checked; the summary line says so.
- The tests in `apps/server/test/learningDesign/content/` (the loader) and `apps/server/test/learningDesign/patterns/`
  (creating an activity) run on every pull request. A test pattern in `apps/server/test/fixtures/studio-content/`
  shows that a new pattern folder loads and can be created without a code change (`PED-011`).

## hint-thresholds.yaml

Before an author publishes an activity, the validator gives pedagogical hints (spec 04 §5, `PED-H01` to
`PED-H11`), for example "the video is longer than 15 minutes" or "the question set has more than 15 questions".
These hints never block publishing; they are warnings or hints. The numbers they use are in
`hint-thresholds.yaml`, so ALU can adjust them without changing code.

| Key | Hint | Default | Allowed |
|---|---|---|---|
| `maxVideoMinutes` | `PED-H01`: an Interactive Video is longer than this (minutes) | 15 | more than 0, at most 180 |
| `maxMinutesWithoutInteraction` | `PED-H02`: a video runs this long without a task (minutes) | 4 | more than 0, at most 60 |
| `maxQuestionsPerSet` | `PED-H04`: a Question Set shows more questions than this | 15 | whole number, 1–100 |
| `minDecisionPoints` | `PED-H06`: a Branching Scenario has fewer decision points on its main path | 2 | whole number, 1–20 |
| `maxDecisionPoints` | `PED-H06`: … or more than this (must not be below `minDecisionPoints`) | 4 | whole number, 1–20 |
| `maxColumnActivities` | `PED-H08`: a Column holds more tasks than this | 3 | whole number, 1–50 |
| `maxSlideWords` | `PED-H09`: a Course Presentation slide has more words than this | 150 | whole number, 10–2000 |
| `maxChapterWordsWithoutInteraction` | `PED-H10`: an Interactive Book chapter without a task has more words | 1500 | whole number, 100–50000 |

### Example

To allow videos of up to 20 minutes before the hint appears, change one line:

```yaml
maxVideoMinutes: 20
```

Minutes may have decimals (`4.5`); counts are whole numbers. Lines starting with `#` are comments and are ignored.

### What catches mistakes

- The server checks the file when it starts. A missing, misspelt, repeated or out-of-range key stops the start,
  and the message names the key and the line, for example
  `maxVideoMinutes: Too big: expected number to be <=180 (line 13)`.
- The test `apps/server/test/config/validationContext.test.ts` loads this file in every test run (also in CI on a
  pull request), so a broken file is caught before it is merged.
- Changing a number changes which hints authors see; the hint rules' own tests use fixed numbers, so they keep
  passing, and the test `apps/server/test/validation/realisticExamples.test.ts` shows which hints the ten example
  activities get.
