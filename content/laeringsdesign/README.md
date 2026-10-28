# content/laeringsdesign — texts and settings for læringsdesign

| File | What it holds |
|---|---|
| `phases.yaml` | The names and texts of the three phases (Forarbeid, Mellomarbeid, Etterarbeid) and of the *samling* |
| `references.yaml` | The full references that the guide and the patterns cite |
| `hint-thresholds.yaml` | The limits of the pedagogical hints the validator gives before publishing |

Every file is checked when the server starts. `npm run content:check` (see [../README.md](../README.md)) checks
`phases.yaml`, `references.yaml` and the studio's other texts without a server; `hint-thresholds.yaml` is checked by
its own test instead (see "What catches mistakes" under hint-thresholds.yaml below).

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
