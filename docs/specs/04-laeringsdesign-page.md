# Spec 04 — Læringsdesign Studio, Patterns, Pedagogical Hints and the Pedagogisk Mappe Export

| | |
|---|---|
| **Status** | Approved for build (v1.0, 2026-10-16) |
| **Load in sessions** | S5 (all). S4 loads §5 only, because the hint rules plug into the validator engine. |
| **Owns requirement IDs** | `PED-*`, `MAPPE-*` |
| **Code location** | `apps/web/src/app/(portal)/laeringsdesign/`, `apps/web/src/app/(portal)/mappe/`, `apps/web/src/features/` (studio views), `apps/server/src/learningDesign/` (content loader, patterns, metadata, planner, collaboration, mappe), `apps/server/src/validation/rules/*Hint.ts`, `content/laeringsdesign/`, `content/mappe/` (amended in S5, D-084, D-089) |

This is the part of HVL Interaktiv that teachers will judge it by. It turns research on asynchronous
learning into concrete starting points. It nudges authors towards designs that work, and it gives
them something useful back for their own career (the *pedagogisk mappe*).

---

## 1. Terminology is configuration, not code

**HVL's model.** HVL has developed a model for learning design, *«HVL læringsdesign»*, and teaches it
to course leaders in the *Emnedesign* module (UPED854). Its public description (Møgelvang & Isaksen
2025, MNT-konferansen; HVL Årsrapport 2024 p. 23) presents an alignment model built on three
interdependent parts, **kontekst**, **kunnskap** and **samskaping**. It applies across levels, from the
single *læringsøkt* (mikronivå) through the *emne* and *studieprogram* to the institution, and uses
*baklengs planlegging* (backward planning) and *meningsskapande samsvar* (constructive alignment).
See [`docs/reference/hvl-laeringsdesign-model.md`](../reference/hvl-laeringsdesign-model.md).

**Where HVL Interaktiv sits.** The activities live at the model's **mikronivå**: the work students do
before, between and after a *samling*. HVL's course pages call this work *forarbeid*, *mellomarbeid*
and *etterarbeid* (*før- og etterarbeid*; English "pre-, intermediate and post-work"). These are
course-organisation terms, not named phases of the model (D-019).

Every label lives in `content/laeringsdesign/phases.yaml`, with `nn`/`nb`/`en` strings, and code
refers only to stable keys. The proposed file is
[`docs/reference/proposals/phases.yaml`](../reference/proposals/phases.yaml); ALU must confirm the
labels against the model document (`hvl-modellen-for-laeringsdesign.pdf`, not yet provided).

| Key | Label (nn / en) | Meaning |
|---|---|---|
| `forarbeid` | Forarbeid / Pre-work | Asynchronous pre-work before a seminar, lab or lecture |
| `underveis` | Mellomarbeid / Intermediate work | Asynchronous active processing between sessions and during *praksis*. The key keeps its old name; the label is HVL's term. Not to be confused with *undervegsvurdering* (formative assessment) |
| `etterarbeid` | Etterarbeid / Post-work | Consolidation, retrieval practice and self-assessment (*eigenvurdering*) |

The synchronous session in the middle (*samling*; online: *nettsamling*) is not authored in HVL
Interaktiv. It appears on the studio page to show where the activities fit.

#### PED-001 · MUST · S5 · Phases and labels load from content files
- **Acceptance:** Renaming a label in `phases.yaml` changes it everywhere with no code change. The
  build fails if a key is missing a locale.
- **Verify:** Unit test of the loader; key-parity test (`PROD-012`).

---

## 2. Studio routes

| Route | Purpose | Audience |
|---|---|---|
| `/laeringsdesign` | Guide: *Studentaktiv læring med «HVL læringsdesign»* (working title; ALU to name it). The model in brief, the research summary, the phase matrix, and the pattern catalogue with filters. | Everyone, without signing in (owner, 2026-10-28, D-089) |
| `/laeringsdesign/monster/[patternId]` | Pattern detail: when to use it, why it works, an example, and *Create from this pattern* | Everyone; create = author |
| `/laeringsdesign/planlegg` | Alignment planner for one course (`PED-031`) | Authors |
| `/mappe` | Portfolio export (`MAPPE-*`) | Authors |
| `/laeringsdesign/innhaldsbank` | The HVL content bank (`PROD-007`, D-091) | HVL authors |

#### PED-002 · MUST · S5 · Guide page content
The guide page contains, in this order:
1. A 3-sentence introduction to why asynchronous work often fails (passive material, high cognitive load) and what helps.
2. A short introduction to «HVL læringsdesign» (kontekst, kunnskap, samskaping; backward planning from
   the learning outcomes) and where the activities sit in it (mikronivå), citing Møgelvang & Isaksen (2025).
3. **Three mechanisms**, each with a plain-language explanation, a "what this means for your
   activity" box and its references (§3): *segment and retrieve*; *explain, don't just mark*;
   *practise judgement safely*.
4. **The phase matrix** (§3), with a filter by phase that also filters the pattern catalogue.
5. **The pattern catalogue** (§4) as cards: name, phase, content type, one-line purpose, time to build.
6. Links to ALU support (hvl.no/alu) and the *Emnedesign* module (UPED854).
- **Acceptance:** Every factual claim has a reference. Page text lives in
  `content/laeringsdesign/guide.{nn,nb,en}.mdx`, so ALU can edit it without changing code.
- **Amended (D-083, 2026-10-28):** `SPEC-DEVIATION`: the guide is CommonMark Markdown, `guide.{nn,nb,en}.md`, rendered
  from a closed node tree without HTML; the phase matrix and the catalogue are placed by marker lines.
- **Verify:** Component test; ALU content review is recorded in `PROGRESS.md`.

#### PED-003 · MUST · S5 · Pattern filter
Authors filter patterns by phase, content type and estimated build time. The filter state is in the URL, so a filtered view can be shared.
- **Verify:** Component test.

---

## 3. Phase matrix (shown on the guide page)

| Phase | Pedagogical purpose | Recommended patterns (§4) | Canvas placement and attempt policy |
|---|---|---|---|
| **Forarbeid** | Activate prior knowledge; meet threshold concepts; surface misconceptions *before* teaching | `fa-video`, `fa-slides`, `fa-hotspots`, `ea-diagnose` | In the module before the seminar. Unlimited retries; *Show solution* on. The teacher reviews **Før samlinga** insight the evening before. |
| **Mellomarbeid** (`underveis`) | Deepen integration; practise professional judgement (*profesjonell dømmekraft*, *didaktisk skjønn*) on realistic cases | `uv-case`, `uv-module`, `uv-column` | One or two interactive items per Canvas page. Resume enabled. |
| **Etterarbeid** | Consolidate through spaced retrieval; check the learning outcomes (*læringsutbytte*) | `ea-retrieval`, `ea-terms`, `ea-diagnose` | Graded through AGS with the `mastery` or `best` policy (`LTI-012`), unlimited attempts. Suggested repetition dates (`PROD-014`). |

Research basis for the guide page (titles and venues must be checked by ALU before publishing):

| Mechanism | Key references |
|---|---|
| Segment and retrieve | Mayer (2009) *Multimedia Learning* (2nd ed.), segmenting principle; Guo, Kim & Rubin (2014) *L@S '14*; Szpunar, Khan & Schacter (2013) *PNAS* 110(16); Roediger & Karpicke (2006) *Psychological Science* 17(3); Brame (2016) *CBE—Life Sciences Education* 15(4) |
| Explain, don't just mark | Shute (2008) *RER* 78(1); Hattie & Timperley (2007) *RER* 77(1); Nicol & Macfarlane-Dick (2006) *Studies in Higher Education* 31(2) |
| Spacing and practice testing | Cepeda et al. (2006) *Psychological Bulletin* 132(3); Dunlosky et al. (2013) *PSPI* 14(1) |
| Practise judgement safely | Schön (1983) *The Reflective Practitioner*; van Manen (1991) *The Tact of Teaching* |
| Aligning it all | Biggs (1996) *Higher Education* 32(3); Wiggins & McTighe (2005) *Understanding by Design* (2nd ed.); Møgelvang & Isaksen (2025) *Nordic Journal of STEM Education* 9(2) — HVL's own model |
| Using pre-work in class | Novak, Patterson, Gavrin & Christian (1999) *Just-in-Time Teaching* |

---

## 4. Pattern catalogue

A pattern is a YAML file in `content/laeringsdesign/patterns/` (editable by ALU, `PED-011`) plus an
H5P parameter skeleton in `apps/server/src/patterns/skeletons/` (*amended, D-084:* the skeleton sits beside the YAML in
`content/laeringsdesign/patterns/<id>/`, with text tokens and a pinned library version; guidance is marked `⟦…⟧` and
flagged by V-PLACEHOLDER, D-086). Skeleton text is **guidance**
written as placeholders, e.g. "Skriv eit spørsmål som får studenten til å bruke omgrepet, ikkje
berre kjenne det att" ("Write a question that makes the student use the concept, not just recognise it").

| ID | Name (working, nn) | Phase | Content type | Skeleton defaults | Build time |
|---|---|---|---|---|---|
| `fa-video` | Kort video med kontrollspørsmål | forarbeid | InteractiveVideo | 3 interaction placeholders at ~2:30, ~5:00 and ~7:30; a summary task at the end; `enableRetry`, `enableSolutionsButton`; guidance to keep video 6–9 min | 30 min |
| `fa-slides` | Omgrepspresentasjon | forarbeid | CoursePresentation | 6 slides: title, 4 × "one concept + one check", a summary slide; keyboard navigation on | 30 min |
| `fa-hotspots` | Visuell gjennomgang | forarbeid | ImageHotspots | 5 numbered hotspots in reading order, each with header and text; alt text placeholder flagged | 20 min |
| `uv-case` | Profesjonelt dilemma | underveis | BranchingScenario | Intro → 3 decision nodes → endings; every choice has explanatory feedback; a "try again from this decision" path; endings scored for reflection, not judgement | 60 min |
| `uv-module` | Studiemodul | underveis | InteractiveBook | 3 chapters (≤ 1 000 words each), each ending with a 3-question check; a summary page | 90 min |
| `uv-column` | Fokusert arbeidsøkt | underveis | Column | Text intro + 2 activities (Blanks, MultiChoice); a "max 3 items" note | 20 min |
| `ea-retrieval` | Repetisjonssett | etterarbeid | QuestionSet | 10 MultiChoice placeholders on **one** concept; option-specific feedback fields marked as required; pass mark 80 % (informative); unlimited retries | 45 min |
| `ea-terms` | Fagomgrep i kontekst | etterarbeid | DragText or Blanks | A paragraph with 6–8 key terms; case-insensitive matching; typo tolerance on (Blanks) | 15 min |
| `ea-diagnose` | Misoppfatningssjekk | forarbeid or etterarbeid | MultiChoice | 1 question, 4 options. Each distractor is labelled with the misconception it represents, and its feedback explains it. Results feed `INS-003`. | 10 min |

#### PED-010 · MUST · S5 · All nine patterns exist and instantiate
- **Acceptance:** `PROD-001` acceptance holds for every pattern. Each pattern YAML has: `id`,
  `phase`, `contentType`, `purpose`, `whenToUse`, `whyItWorks` (with reference keys),
  `buildMinutes`, `skeleton`, and `nn`/`nb`/`en` text.
- **Verify:** Schema validation test for all YAML files; an integration test instantiates each skeleton.

#### PED-011 · MUST · S5 · Patterns are editable without code
Adding or editing a pattern needs only YAML, MDX and a JSON skeleton, with no TypeScript changes.
`content/laeringsdesign/README.md` explains how, for non-developers.
- **Amended (D-083, D-084, 2026-10-28):** YAML, Markdown and a JSON skeleton, all in
  `content/laeringsdesign/patterns/<id>/`.
- **Verify:** A test adds a fixture pattern directory and asserts it appears.

---

## 5. Pedagogical hint rules

These plug into the validator engine (`UD-020`). Their severity is **warning** or **hint** only, so
pedagogy is never blocked. Thresholds live in `content/laeringsdesign/hint-thresholds.yaml`.

| Rule ID | Applies to | Triggers when | Severity | Message intent |
|---|---|---|---|---|
| `PED-H01` | InteractiveVideo | The video is longer than 15 min (when known from metadata) | warning | Split into segments of 6–9 min (Guo et al. 2014). |
| `PED-H02` | InteractiveVideo | More than 4 min of video without an interaction | hint | Add a check every 2–3 min (Szpunar et al. 2013). |
| `PED-H03` | InteractiveVideo | There is no summary or reflection task at the end | hint | End with a summary to consolidate. |
| `PED-H04` | QuestionSet | More than 15 questions | warning | Prefer several focused sets of about 10. |
| `PED-H05` | MultiChoice, QuestionSet, SingleChoiceSet | A wrong option has empty `chosenFeedback` (or equivalent) | warning | Explain why this option is wrong. |
| `PED-H06` | BranchingScenario | Fewer than 2 or more than 4 decision points on the main path; a choice has no feedback; or no retry path | warning | Keep cases to 3–4 decisions with explanations and a way back. |
| `PED-H07` | All | `enableRetry` or `enableSolutionsButton` is turned off | hint | Formative activities work best with retry and solutions on. |
| `PED-H08` | Column | More than 3 sub-activities | warning | Split across pages to manage cognitive load. |
| `PED-H09` | CoursePresentation | A slide has more than 150 words of text | hint | One concept per slide. |
| `PED-H10` | InteractiveBook | A chapter has more than 1 500 words and no interaction | hint | Add a check per chapter. |
| `PED-H11` | All with feedback | Overall feedback is only "Correct"/"Wrong" (or *Riktig/Feil*) without explanation | hint | Say why. |

#### PED-020 · MUST · S4 · Implement the hint rules
- **Acceptance:** Each rule is one file with positive and negative fixtures. Messages exist in `nn`, `nb` and `en`, and each names its reference.
- **Verify:** Unit tests `[PED-020][PED-H05] …`.

---

## 6. Learning-design metadata and the alignment planner

#### PED-030 · MUST · S5 · Tag each activity
Authors can attach `LearningDesignMetadata` to an activity. It is optional while in draft and
prompted (but not required) on publish.

| Field | Type | Notes |
|---|---|---|
| `phase` | `forarbeid \| underveis \| etterarbeid` (labels *Forarbeid*, *Mellomarbeid*, *Etterarbeid*) | From the pattern by default |
| `courseCode` | string, e.g. `SYK110` | Free text. Prefilled from the LTI context label when available |
| `learningOutcomes` | list of `{ text, category }` | `category` follows the Norwegian qualifications framework (NKR): `kunnskap`, `ferdigheiter`, `generell kompetanse` |
| `rationale` | text ≤ 1 000 characters | "Why this design for this outcome?" Used in the portfolio |
| `estimatedStudentMinutes` | integer | Shown to students before they start |
| `learnerPurpose` | text ≤ 200 characters | *Amended (D-087, 2026-10-28):* the one-line "why this matters" of `PED-032`, shown to learners with the activity's language |
| `patternId` | pattern key | *Amended (D-087):* the pattern the activity was created from; kept on copies, never edited by hand |

- **Verify:** Component and API tests.

#### PED-031 · SHOULD · S5 · Constructive alignment planner
For one course, the planner shows a grid of **learning outcomes × phases** filled with the author's
tagged activities. It highlights gaps, such as an outcome with no *etterarbeid* activity or a phase
with no activities. It offers *Create from pattern* inside any empty cell.
- **Acceptance:** The grid is an accessible HTML table with row and column headers, not only a visual canvas.
- **Verify:** Component test; axe.

#### PED-032 · SHOULD · S5 · Students see time estimate and purpose
Before an activity starts, learners see the estimated time and a one-line "why this matters" text
taken from the metadata. This helps them plan their study and self-regulate.
- **Verify:** Component test.

---

## 7. Pedagogisk mappe export

HVL asks staff who apply for appointment, promotion (*opprykk*) or *merittert undervisar* status to
document their teaching practice and their reasoning in a *pedagogisk mappe*. ALU states that the
portfolio also covers work with educational technology, and the 2025 merit criteria name *varierte
læremidler* (sub-criterion 2.3). This feature produces a ready-to-edit draft from work the teacher has
already done. The evidence behind this section is in
[`docs/reference/hvl-pedagogisk-mappe-criteria.md`](../reference/hvl-pedagogisk-mappe-criteria.md) (D-020).

#### MAPPE-001 · SHOULD · S5 · Select and export
On `/mappe`, an author selects activities, filtered by course, phase or date. The author exports
**Markdown** (for editing) and **PDF** (for submission).
- **Verify:** Integration test produces both files from fixtures.

#### MAPPE-002 · SHOULD · S5 · Dossier structure
Headings come from `content/mappe/template.{nn,nb,en}.md` and criterion texts from
`content/mappe/criteria.{nn,nb,en}.yaml`, keyed by criteria set (default `hvl-merittering-2025`).
HVL revises the merit criteria for every call (next call 2027), so a new set is a content change only.
The proposed Nynorsk template is
[`docs/reference/proposals/mappe-template.nn.md`](../reference/proposals/mappe-template.nn.md). The
default structure follows HVL's three-part merit portfolio:
1. **Reader's guide:** a table mapping each 2025 criterion (1.1–1.4, 2.1–2.4, 3.1–3.3) to the chapter
   and attachment that address it, as in published HVL portfolios.
2. **Del 1 – Samanhengande framstilling:** chapters ordered by the criteria, each with a pre-filled
   writing prompt. The teacher's learning-design approach opens the text. For each selected activity
   (under 2.3, *varierte læremidler*): title, content type, phase, course, learning outcomes, didactic
   rationale, universal design status (validator result plus any acknowledgements with reasons), a link,
   and **anonymised aggregates** (participants, completion rate, median attempts, change between first
   and last attempts). A live word count shows Del 1 against the limit (default 7 500 words, references
   excluded).
3. **Del 2 – Pedagogisk CV:** entries HVL Interaktiv can document (digital learning resources developed,
   with dates), to paste into HVL's own CV template.
4. **Del 3 – Suggested attachments** (default limit 11, including the manager's letter, which the tool
   never produces): documentation of developed learning resources, and an anonymised summary of student
   feedback.
5. **References**, pre-filled from the patterns' research keys (§3).

The word limit, attachment limit and criteria set are content values marked *(verify)* until ALU
confirms them. A promotion mode (*opprykk*, rules in force from 13 June 2025) uses the same three parts;
its Del 1 headings wait for ALU.
- **Acceptance:** Switching the criteria set changes every criterion text and the reader's guide with no
  code change. The word count excludes the references and the reader's guide.
- **Verify:** Integration test with two fixture criteria sets.

#### MAPPE-003 · MUST · S5 · Privacy in the export
Aggregates apply the same minimum group size as insight (`INS-006`, default *k* = 5). No learner
identifiers, free-text answers or individual scores ever appear. The export is generated on demand
and **not stored** on the server.
- **Verify:** A test with a 4-learner fixture asserts suppression.

#### MAPPE-004 · SHOULD · S5 · Accessible PDF
The PDF is rendered from the same semantic HTML template with headless Chromium and **tagged-PDF**
output enabled. It has document language, a title, a heading outline and real text, never images of text.
- **Verify:** The test checks the PDF has a structure tree and outline (e.g. with `pdfjs-dist`); a manual check with PAC or a screen reader is recorded in the accessibility results.
