# content/laeringsdesign — texts and settings for læringsdesign

| File | What it holds |
|---|---|
| `phases.yaml` | The names and texts of the three phases (Forarbeid, Mellomarbeid, Etterarbeid) and of the *samling* |
| `references.yaml` | The full references that the guide and the patterns cite |
| `guide.nn.md`, `guide.nb.md`, `guide.en.md` | The guide on the page `/laeringsdesign`, in Nynorsk, Bokmål and English (a draft for ALU to review, Q17) |
| `patterns/<id>/` | One folder per pattern: what it is for (`pattern.yaml`) and the activity it starts from (a skeleton) |
| `hint-thresholds.yaml` | The limits of the pedagogical hints the validator gives before publishing |

Every file is checked when the server starts. `npm run content:check` (see [../README.md](../README.md)) checks
`phases.yaml`, `references.yaml`, the patterns and the studio's other texts without a server; `hint-thresholds.yaml`
is checked by its own test instead (see "What catches mistakes" under hint-thresholds.yaml below).

The phases, references, guide and patterns here are drafts written from public sources until ALU confirms them
(open question Q17). What ALU is asked to review, and where to record the outcome, is in the review packet
[`docs/reference/alu-review-s5.md`](../../docs/reference/alu-review-s5.md).

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
| `description` | One or two sentences on what the phase is, at most 400 characters | studio page |
| `purpose` | The pedagogical purpose (spec 04 §3, phase matrix), at most 400 characters | phase matrix |
| `canvasPlacement` | Where the activity goes in Canvas, and how many attempts students get, at most 400 characters | phase matrix |

`anchor` describes the *samling* itself, with a `label` and a `description`. `status: proposed` means ALU has not
yet confirmed the texts; while it says so, the studio pages show a banner saying the texts are a draft. Change it to
`status: confirmed-by-alu` when ALU has approved them.

### Change a phase's name or text, step by step

1. Open `phases.yaml` and find the phase by its `key` (`forarbeid`, `underveis` or `etterarbeid`), or `anchor` for
   the *samling*.
2. Change the text under `label`, `description`, `purpose` or `canvasPlacement`, in all three languages: `nn`,
   `nb` and `en` each need a text. A label is at most 60 characters and the other texts at most 400; every text is
   one line (see "Writing long texts" below).
3. Leave `key`, `order` and `position` as they are, and do not add or remove a phase: the file always has the three
   keys, each once, with `order` 1, 2 and 3.
4. Run `npm run content:check` (see [../README.md](../README.md)). It prints `✓` and the three labels, or names the
   line and key of each mistake.
5. Propose the change as a pull request. After the next start, every page, the planner and the portfolio use the new
   words; activities keep their phase, because they store only the key.
6. When ALU has approved all the studio's texts, change `status: proposed` to `status: confirmed-by-alu` the same
   way; that removes the draft banner.

For example, to call the second phase «Mellomøkt», change the three lines under its `label`:

```yaml
  - key: underveis
    order: 2
    position: between-samlingar
    label:
      nn: Mellomøkt
      nb: Mellomøkt
      en: Between sessions
```

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
- **`language`** is the language the reference is written in. Leave it out for English. For any other language, add
  a line such as `language: nb` (or `nn`, `sv`, `da`, `de`) under `verify`: the page then tells screen readers to
  read that reference in its own language (`UD-010`). `mogelvang2025` is written in Bokmål and says `language: nb`.

To add a reference, add a key with `text` and `verify` (and `language` if it is not in English), then cite it as
`[@key]` in a guide text or a pattern.

## What catches mistakes in phases.yaml and references.yaml

- `npm run content:check`, the pre-commit check on this folder, CI on every pull request, and the server's start
  all stop on: a text missing in `nn`, `nb` or `en`; a key the file does not know (a misspelling such as `lable`);
  a key written twice; a phase key other than `forarbeid`, `underveis` and `etterarbeid`, or one of them missing or
  listed twice; a reference key in capitals; a reference without `verify`; a `language` that is not a language code
  (such as `norsk` instead of `nb`); and a citation of a key this file does not list. Each message names the file, the line and the key.
- The tests in `apps/server/test/learningDesign/content/` load these files on every test run, and check that a
  renamed label is loaded without a code change (`PED-001`). The studio pages, the planner and the portfolio take
  every name from what is loaded here.

## guide.nn.md, guide.nb.md and guide.en.md — the guide

The page `/laeringsdesign` shows the guide: why asynchronous work often fails and what helps, the phase matrix and
the pattern catalogue (spec 04 §2, `PED-002`). The guide is three files, one per language, written in Markdown: plain
text with a few marks for headings, lists and links. The page shows the guide in the reader's language; the three
files have the same structure, and their wording may differ.

**Status: draft (2026-10-29).** The three files are a first draft for ALU and the pilot teachers to review (open
question Q17); ALU names the page, whose working title comes from the system, not from these files. Every research claim
cites a reference in `references.yaml`, all of which still say `verify: true`, and the links go to the ALU page and the
Emnedesign module (UPED854) as `docs/reference/hvl-laeringsdesign-model.md` gives them. Rewrite the wording freely. If
all three files are removed, the page shows the phase matrix and the catalogue alone, and `npm run content:check` says
`no guide yet`; one or two of them alone is an error. Spec 04 requires the guide (`PED-002`), so the repository's own
test (below) then fails until the guide is back.

The guide follows the order spec 04 sets (`PED-002`), which its test checks by the headings, boxes and markers only:

1. `##` why asynchronous work often fails, and what helps (three sentences);
2. `##` «HVL læringsdesign» in brief, citing Møgelvang & Isaksen (2025) as `[@mogelvang2025]`;
3. `##` the three mechanisms, each a `###` heading followed by its own box: segment and retrieve; explain, don't just
   mark; practise judgement safely;
4. `##` where the activity belongs, with `{{phase-matrix}}` and then `{{pattern-catalogue}}`, each after a paragraph;
5. `##` help and further learning, with the two links (ALU and Emnedesign).

### Edit the guide, step by step

1. Open `guide.nn.md`. Nynorsk is the reference: the check compares the Bokmål and English files with it.
2. Change the wording with the marks in "What you can write" below. Keep the `##` and `###` headings in their order,
   the box (`>`) after each `###` mechanism, the two marker lines, and the citations `[@key]` in their order.
3. Make the same change in `guide.nb.md` and `guide.en.md`: the same headings by level and order, the same markers
   and the same citations in the same order. The wording may differ between the languages.
4. To cite a new source, first add it to `references.yaml` (see above), then write its `[@key]` at the same place in
   all three files.
5. Run `npm run content:check`. It prints `guide in nn, nb and en (… sections, … citations)` in its `✓` line, or the
   file and line of each mistake (the rules are under "The rules, and why" below).
6. Propose the change as a pull request. A new `##` section, a new `###` mechanism or a new box changes the order
   spec 04 sets, so the repository's test of the guide fails on purpose: agree on it with the developers, who
   change `PED-002` in spec 04 and the test first.

### What you can write

| You write | The page shows |
|---|---|
| `## Heading` and `### Heading` | a heading and a subheading |
| an empty line between two paragraphs | two paragraphs (lines without an empty line between them are one paragraph) |
| `**word**` and `*word*` | bold and italics |
| `- item` or `1. item`; indent by two spaces for a list in a list | a bulleted or a numbered list (numbers always start at 1) |
| `> text`, on every line of the box | a box headed «Kva dette betyr for aktiviteten din» (the heading comes from the system) |
| `[@guo2014]` | a numbered citation, linked to the list of references at the end of the page |
| `[text](https://www.hvl.no/alu)`, `[text](mailto:alu@hvl.no)`, `[text](/laeringsdesign/monster/fa-video)` | a link; a link to another website says so |
| `{{phase-matrix}}` alone on its line | the phase matrix |
| `{{pattern-catalogue}}` alone on its line | the pattern catalogue with its filters |

### Example

```markdown
## Kvifor asynkront arbeid ofte sviktar

Lange videoar utan oppgåver gir lite læring: engasjementet fell etter rundt seks minutt [@guo2014].

> Del videoen i bitar på under seks minutt, og legg inn eit spørsmål i kvar bit [@szpunar2013].
>
> - Spørsmålet skal få studenten til å bruke stoffet.

{{phase-matrix}}

Vel eit mønster som passar til fasen og emnet ditt.

{{pattern-catalogue}}

## Hjelp og vidare lesing

Hjelp får du hos [ALU](https://www.hvl.no/alu).
```

### The rules, and why

- **Headings start at `##`.** The page's own title (`#`) comes from the system. Write `##` or `###` in front of the
  heading; a heading underlined with `===` or `---` is refused, because an underline can be a rule by mistake.
- **Markers.** `{{phase-matrix}}` and `{{pattern-catalogue}}` each stand exactly once in each language, alone on
  their line, not in a list, a box or bold text. The phase matrix has its own caption and the catalogue its own
  heading («Mønsterkatalogen»), so do not write a heading for them just before the marker.
- **Boxes.** A box holds paragraphs and lists: no heading, and no box in a box or in a list.
- **Citations.** A citation is `[@key]` with a key from `references.yaml` (lower-case letters, digits and hyphens).
  The list at the end of the page holds each cited reference once, numbered in the order it is first cited. A
  citation cannot stand inside a link's text; put it after the link.
- **Links** go to `https:` addresses, `mailto:` addresses or a page of this site starting with a single `/`. An
  `http:` address is refused: use `https:`. A link needs text that readers can see: `[](…)` and `[ ](…)` are refused.
- **The same structure in three languages.** The three files have the same headings (`##` and `###` in the same
  order), the same markers and the same citations in the same order. A difference is reported in the Bokmål or
  English file, at its first differing line, compared with Nynorsk.
- **Refused, with the file and the line:** HTML (a `<` followed by a letter; write `&lt;` when you mean the
  character), images, tables, code (between backticks, or a line indented by four spaces), rules (`---`, `***`),
  struck-through text (`~~`), a hard line break (two spaces or a `\` at the end of a line), `{{` anywhere but a
  marker line, headings with one `#` or with four or more, and reference definitions (`[label]: address`), which
  would silently turn a citation into a link. The page shows only what the system knows how to show safely and
  accessibly (D-083): no file can add code, unlabelled images or tables that do not fit a phone.

A pattern's `whyItWorks` follows the same rules, but holds only paragraphs and lists: no headings, boxes or markers.

### What catches mistakes in the guide

- `npm run content:check`, the pre-commit check on this folder, CI on every pull request, and the server's start
  all stop on: one or two of the three files missing; an empty file; anything the rules above refuse; a missing or
  repeated marker; a citation of a key `references.yaml` does not list; and a heading, marker or citation that differs
  from the Nynorsk file. Each message names the file and the line.
- The tests of the guide loader (`apps/server/test/learningDesign/content/`) use a test guide in
  `apps/server/test/fixtures/studio-content/guide-fixture/`, and the page's tests (`apps/web/test/features/`) their
  own, never the texts here, so rewording the guide breaks no test.
- `apps/server/test/learningDesign/content/realGuideContent.test.ts` loads the three files here and checks only their
  structure against the order above: five `##` sections; three `###` headings in the third, each followed by a box;
  both markers in the fourth, the phase matrix first, neither straight after a heading; at least two `https:` links
  in the last; `[@mogelvang2025]` in the second; and every citation listed in `references.yaml`. Rewording, a new
  paragraph or list, or another link breaks nothing; a new `##` section, `###` heading or box breaks it on purpose:
  change `PED-002` in spec 04 first, then the test.

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
| `whyItWorks` | Why it works, at most 2 000 characters, citing research as `[@key]` from `references.yaml`. All three languages cite the same references in the same order. It is Markdown with the guide's rules (see the guide's section above), holding paragraphs and lists only. |
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

### Add a pattern, step by step

1. Choose the pattern's ID: lower-case letters, digits and hyphens, starting with a letter. The nine patterns start
   with the phase they suit (`fa-` Forarbeid, `uv-` Mellomarbeid, `ea-` Etterarbeid). Make the folder
   `patterns/<ID>/`, named exactly as the ID.
2. Write `pattern.yaml` with every field of the table above, each text in `nn`, `nb` and `en`. `id` is the folder's
   name; `phases` and `contentTypes` list one or two each. Start the file with a comment that says what the skeleton
   holds, as most of the other patterns do.
3. Make the skeleton, best from an activity built in the editor (next section). Name it `skeleton.json`, or, for a
   pattern with two content types, one `skeleton.<content type>.json` per type, such as `skeleton.H5P.Blanks.json`.
4. Put every text the activity gets under `texts` in `pattern.yaml` and use it in the skeleton as `{{name}}`;
   wrap guidance in `⟦…⟧`. Every token needs a text, and every text must be used.
5. If `whyItWorks` cites research that `references.yaml` does not list yet, add the reference there first.
6. Run `npm run content:check` and fix each mistake it names; its `✓` line counts the patterns. On your own machine,
   run `npm run h5p:fetch-libraries` once first, so that the check can also read the content types and check the
   skeleton's versions, keys and field lengths; CI always does.
7. Propose the folder as a pull request. The tests create the new pattern in each of its content types, phases and
   languages (see "What catches mistakes in a pattern" below). After the next start the catalogue shows it, with no
   code change (`PED-011`).
8. On the test server, use «Lag frå dette mønsteret» on the new pattern, replace the guidance, and check and publish
   the activity, to see it as an author will.

### Edit a pattern, step by step

1. Open the pattern's `pattern.yaml` and change the texts, in all three languages. Do not change `id`: activities
   made from the pattern remember it.
2. To change what a new activity contains (a question more, another setting), change the skeleton too: a new text
   needs a token in the skeleton and a text under `texts`, and a text you remove from the skeleton must go from
   `texts` as well.
3. Run `npm run content:check`, then propose the change as a pull request.

Activities already made from the pattern do not change: a pattern is where an activity starts, not a link to it.

### Making a skeleton from an exported .h5p file

The easiest way to make a skeleton is to build an example activity in the editor and take its content.

1. Build the activity in HVL Interaktiv, in Nynorsk, the way the pattern should start: every question, option or
   slide it needs, and the settings the pattern is about (retry and «Vis svar» on, no time limit). Leave out images,
   videos and other files: a skeleton holds no media, and the author adds them.
2. Download it as an `.h5p` file: signed in, open `/h5p/download/<ID>`, where `<ID>` is the last part of the
   activity's address (`/aktivitet/<ID>`). Rename the file to end in `.zip` and unzip it into an empty folder.
3. Pin the version: open `h5p.json`, find the entry under `preloadedDependencies` whose `machineName` is the
   `mainLibrary`, and write it as `"library": "<machineName> <majorVersion>.<minorVersion>"`, for example
   `"H5P.QuestionSet 1.21"`. HVL's editor saves an activity with the newest version installed, which is the one the
   check expects.
4. Start the skeleton file with three keys: `"library"` from step 3, `"metadataTitle": "{{title}}"` (the new
   activity's title, a token), and `"params"`, which holds all of `content/content.json`. The parts inside it
   (sub-content) already name their own library and version, such as `"library": "H5P.MultiChoice 1.16"`; keep them.
5. Replace every text a student reads with a token, keeping the HTML around it, for example
   `"<p>{{question1}}</p>"`. Put the text under `texts` in `pattern.yaml`, in `nn`, `nb` and `en`, wrapped in `⟦…⟧`
   where it is guidance. In a Fill in the Blanks or Drag the Words answer (between `*`), guidance may not hold `:` or
   `/`.
6. Give every part a title: `"metadata": { "title": "{{question1Title}}", "license": "U" }`. You may delete the
   `subContentId` lines; the system gives every part a new one anyway. Keep every item of a list (questions,
   answers, slides): the defaults never add items.
7. Delete the settings you did not choose on purpose; the content type's defaults come back in the author's
   language. Keep or set with tokens the buttons and messages of Multiple Choice, Question Set, Interactive Book and
   Branching Scenario, whose defaults are English (see above). Keys the editor wrote are fine as they are, including
   Branching Scenario's `contentId` on each part.
8. Run `npm run content:check` and fix what it names: a version the editor does not offer, a key the content type
   does not have, a text too long for its field, a token without a text or a text without a token.

### What catches mistakes in a pattern

- `npm run content:check` (with the pinned content types installed by `npm run h5p:fetch-libraries`; CI always has
  them) stops on: a text missing in `nn`, `nb` or `en`; a misspelt key; an ID that is not the folder's name; a phase
  or content type that does not exist; a missing skeleton or a file that does not belong; a skeleton that is not
  valid JSON; a token without a text, or a text no token uses; a wrong library version; a key in the skeleton that
  the content type does not have (a misspelt setting such as `enableRetyr` would otherwise be ignored by H5P, and
  retry would quietly stay as the content type's default); a filled-in text too long for its field; a title over 255
  characters; guidance with `:` or `/` in a blank; a citation of a key `references.yaml` does not list; a `whyItWorks`
  that breaks the guide's Markdown rules or holds a heading, a box or a marker. Each message
  names the file, the line and the key. Without the pinned content types on your own machine, the versions, keys and
  length limits are not checked; the summary line says so.
- The tests in `apps/server/test/learningDesign/content/` (the loader) and `apps/server/test/learningDesign/patterns/`
  (creating an activity) run on every pull request. A test pattern in `apps/server/test/fixtures/studio-content/`
  shows that a new pattern folder loads and can be created without a code change (`PED-011`).
- The tests `apps/server/test/learningDesign/patterns/realPattern*.int.test.ts` create every folder in `patterns/`
  in each of its content types and phases, in Nynorsk, Bokmål and English, and stop on: any check error other than
  V-PLACEHOLDER; a V-PLACEHOLDER on a field that holds no guidance; retry or «Vis svar» switched off, a time limit, or
  a pass mark that ends the attempts (`PROD-009`); and a new activity with no V-PLACEHOLDER at all, since every
  pattern starts as guidance. They compare no text with a fixed wording, so rewording a text does not break them; a
  text breaks them only when it makes another check report an error, or when it removes the last `⟦…⟧` from a
  pattern that has no video or image slot to report.

The nine patterns in `patterns/` (spec 04 §4) are drafts for ALU and the pilot teachers to review (open question
Q17): their texts, times, and the choices written into their skeletons may all change. Every `pattern.yaml` but
`ea-diagnose` (a single question) starts with a comment that says what its skeleton holds.

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
