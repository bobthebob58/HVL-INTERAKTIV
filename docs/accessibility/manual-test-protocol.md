# Manual accessibility test protocol

> Requirement `UD-031` (spec 03 §5), with the journeys J1–J4 of spec 00 §3 and the matrix of `NFR-003`.
> Decision D-079: CI runs the automated suite in Chromium (`npm run test:a11y`); this protocol covers what a
> person with assistive technology must check. Results are recorded per release in
> [results/](results/README.md). This file contains **no results**.

## 1. Why a manual protocol

Automated tools find only part of the barriers. axe cannot tell whether a screen reader announces feedback in a
useful order, whether a task can be completed without seeing the screen, or whether text at 400 % zoom is still
readable in practice. The persona Jonas (spec 00 §2) completes every activity with NVDA and the keyboard on
Windows and with VoiceOver on his iPhone; this protocol is how HVL checks that he can.

## 2. Who runs it, and when

- **Who:** HVL/ALU staff who use the assistive technology daily, or an external tester engaged by HVL. A tester
  who is not a daily screen-reader user records that in the result file.
- **When:** before every release that changes `apps/web`, `packages/hvl-h5p-theme`, `packages/design-tokens`, the
  H5P pages in `apps/server/src/h5p/render/` or the installed H5P libraries, and at least once per semester.
- **What is tested:** the release candidate on the test server, launched from HVL's Canvas test instance and
  through Feide test users. Never with real student data.

## 3. Test set-ups

Each set-up is one row of the matrix in [nfr-003-matrix.md](nfr-003-matrix.md). Use the current and the previous
major version of the browser (`NFR-003`); record the exact versions.

| ID | Assistive technology | Browser and platform | Settings to record |
|---|---|---|---|
| **AT-1** | NVDA (current release) | Firefox on Windows 11 | Speech viewer on; browse mode and focus mode switching automatic |
| **AT-2** | JAWS (current release) | Chrome on Windows 11 | Virtual PC cursor on; verbosity default |
| **AT-3** | VoiceOver | Safari on iOS (current release) | Rotor with headings, links, form controls; speech rate as the tester prefers |
| **KB** | Keyboard only, no pointer | Edge or Chrome on Windows, Firefox on macOS | Mouse/trackpad disconnected or not touched |
| **Z400** | Browser zoom 400 % | Chrome or Edge on a 1280 × 1024 window | Zoom 400 % (320 CSS px wide); Windows text size 100 % |

Optional, recorded when available: Windows contrast themes (forced colours) in Edge, TalkBack with Chrome on
Android, VoiceOver with Safari on macOS.

The portfolio PDF (from Session 5, `MAPPE-004`) has one more set-up, **PDF**, which is a check of a file rather than
of a browser: PAC 2024 (or PAC 3, the PDF Accessibility Checker of the PDF/UA Foundation) on Windows 11, and NVDA
(current release) with Adobe Acrobat Reader (current release; in its reading preferences, «Override the reading
order in tagged documents» off). Record the versions of all three. Its steps are J4.5–J4.10.

## 4. Preparation

1. Note the release (git tag or commit SHA shown in the deployment) and the date.
2. In Canvas (test instance): a course with the HVL Interaktiv tool, a test teacher and a test student.
3. In HVL Interaktiv: the ten example activities of `npm run h5p:fetch-libraries` (one per content type, all in
   Nynorsk) imported and published by the test teacher, plus one draft MultiChoice activity.
4. From Session 5, for J1.10–J1.13 and J4: the test teacher is signed in to the portal as HVL staff, the studio's
   patterns load (`npm run content:check` on the release), and the teacher has at least three activities with a
   phase, the same course code, learning outcomes and a rationale on the **Læringsdesign** tab: one published with an
   error and a reason, one whose title is long enough to wrap onto a second line in the PDF, and one draft. For
   J1.13, a test student has saved progress in a published MultiChoice activity (J2.5).
5. Copy the result template from [results/README.md](results/README.md) into a new, dated file **before** starting,
   and fill it in as you go.

## 5. How to judge a step

- **Pass:** the tester completed the step with the set-up alone, and every expected result was perceivable
  (spoken, shown or reachable) without a workaround.
- **Pass with remark:** completed, but with a problem worth fixing (e.g. a confusing announcement order).
- **Fail:** the step could not be completed, or an expected result was missing. Record the WCAG criterion, what
  happened and, for H5P content, the content type and library version (see §8).
- **Blocked:** an earlier failure prevented the step. Record which.

## 6. Tasks per journey

The UI texts below are in Nynorsk (`nn`, the default). Run every task once in `nn`; run J2 once more in `en`
(launch with an English Canvas profile) to check language switching (`UD-010`).

### J1 — Create and place an activity in Canvas (teacher; `LTI-005`, `PROD-003`, `UD-006`, `UD-013`)

Spec 00 §3 starts J1 with a phase and a pattern (**Forarbeid**, *Short video with retrieval checks*). The patterns
came with the læringsdesign studio in Session 5, in the portal only: creating from a pattern inside Canvas's picker
waits for S6 (D-098). J1.1–J1.9 therefore start from the draft activity of §4, and J1.10–J1.13 start from a pattern
in the portal.

| Step | Action | Expected result |
|---|---|---|
| J1.1 | In a Canvas module choose *Add item → External tool → HVL Interaktiv*. | The picker opens with the heading «Vel aktivitet» and the group «Aktivitetane dine». The formative notice is announced as a region and can be dismissed for good with «Ikkje vis meldinga igjen» (the same per-user dismissal as the web app's notice). |
| J1.2 | Move through the list of activities. | Each activity is a radio button or checkbox with its title; the draft is announced as unavailable with its reason, not by colour or dimming alone. |
| J1.3 | Choose a published activity and activate «Legg inn i Canvas». | Canvas shows the new item. Focus is not lost on the way. |
| J1.4 | Sign in to HVL Interaktiv with Feide and open the draft activity from «Aktivitetane dine». | The page starts with the skip link «Gå til hovudinnhaldet»; it moves to the main content. The page title and the `h1` name the activity. |
| J1.5 | Use the tabs «Spel», «Rediger», «Sjekk og publiser». | Arrow keys move between tabs; Enter or Space selects (manual activation). The selected tab is announced. |
| J1.6 | In «Rediger», change the question text and save («Lagre»). | The H5P editor frame is announced with its title «Rediger: …». Every field has a label. The save result is announced. Known H5P problems: §8. |
| J1.7 | In «Sjekk og publiser», read the findings and use «Gå til feltet» on one. | Each finding states severity in text. «Gå til feltet» moves focus to the field in the editor. |
| J1.8 | Activate «Publiser». | A dialog «Publiser aktiviteten» opens and takes focus; Tab stays inside it; Escape closes it and focus returns to «Publiser». |
| J1.9 | Open it again; give a reason for each error if asked; activate «Publiser no». | Errors in the form are listed at the top and linked to their fields (`UD-013`). After publishing, the status «Publisert» is announced, and focus stays on the same button, now «Gjer om til utkast». |
| J1.10 | Open «Læringsdesign» in the main menu (`/laeringsdesign`). Move by headings to «Mønsterkatalogen» and set «Fase» to Forarbeid. | The guide's boxes are regions with distinct names. The phase matrix is a table with its caption «Fasane rundt samlinga»; its link «Alle mønstera for … i katalogen» moves focus to the catalogue's heading. Choosing a phase keeps focus on the select and announces «Viser … av … mønster»; the address keeps the filter (`PED-003`). |
| J1.11 | Open the short-video pattern (`/laeringsdesign/monster/fa-video`), read it, and under «Lag frå dette mønsteret» activate «Lag aktiviteten». | The page reads in order: what it is for, when it fits, why it works with its references (an English reference read with an English voice). The fields have labels and hints. The new draft opens on «Rediger» with the editor frame announced (`PROD-001`). |
| J1.12 | In «Sjekk og publiser», read the errors and use «Gå til feltet» on one. | Each placeholder error says in text that the field still holds guidance from the pattern, quotes the guidance (without the marks) and asks the author to remove the marks «⟦» and «⟧» (V-PLACEHOLDER, D-086). «Gå til feltet» reaches the field, or says that the field cannot be opened. |
| J1.13 | Open the published MultiChoice with a student's progress (§4), add an answer option in «Rediger» and activate «Lagre». | A dialog «Endringa nullstiller framgangen til studentane» opens with focus on «Avbryt»; Tab and Shift+Tab stay inside it; Escape cancels, and focus returns to «Lagre». Nothing of the page around the editor is read while it is open. «Lagre som ny versjon» opens the copy, whose page says «Kopi av …» (`PROD-013`, D-093). |

### J2 — Study on a phone and resume (student; `UD-003`, `UD-006`, `UD-008`, `PROD-008`)

Run once per content type (ten activities). With AT-3 the phone is in portrait orientation; turn it to landscape
once per activity.

| Step | Action | Expected result |
|---|---|---|
| J2.1 | Open the activity from the Canvas module. | The page is in the launch language (`<html lang>`); the activity's own text is read in Nynorsk voice where the screen reader switches language (`UD-010`). No sideways scrolling at 320 px (`UD-008`); ImageHotspots may pan its image. |
| J2.2 | Find the activity's first task with headings or the rotor, and answer one item wrongly. | Every control has a name and a role; the chosen state is announced. |
| J2.3 | Check the answer («Sjekk»). | The verdict is announced as «Feil:» (or «Riktig:») before the answer text, followed by the explanation (`UD-003`). Nothing is conveyed by colour alone. |
| J2.4 | Retry and answer correctly. | «Riktig:» is announced; the earlier «Feil:» is gone. Scores are described as formative, never as a grade. |
| J2.5 | Leave the activity halfway, close the browser tab, and open it again from Canvas. | The activity resumes where it was left (`PROD-008`), and the resumed state is announced or easy to find. |
| J2.6 | Complete the activity with the keyboard only (KB) and with NVDA (AT-1). | No keyboard trap; focus is always visible with the two-tone ring and never hidden under the header (`UD-004`). |

Per content type, additionally note: CoursePresentation slide navigation and its progress bar; InteractiveVideo
play/pause, seeking with the keyboard, captions and the interaction pop-ups; DragText with the keyboard drag mode
(the single-pointer alternative of `UD-005`); BranchingScenario start, each branch choice and the end screen;
ImageHotspots opening and closing each hotspot; InteractiveBook chapter navigation; QuestionSet progress and the
result screen.

### J3 — Prepare the seminar from evidence (teacher; `INS-001`…`INS-006`) — from Session 6

Insight is not built yet. It comes as an **Innsikt** tab, on the activity page `/aktivitet/[id]` and in the Canvas
view `/app/play`, one context at a time, never as a page of its own (D-101, D-106). When it arrives, run:

| Step | Action | Expected result |
|---|---|---|
| J3.1 | Open **Innsikt → Før samlinga** for an activity. | Headings structure the page; the aggregate numbers are text, not only a chart. |
| J3.2 | Read the per-question results. | Every chart has an equivalent table; suppressed cells (fewer than five students) are announced as hidden, not as zero. |
| J3.3 | Add a question to the *Bring to seminar* shortlist. | The change is announced; the shortlist is reachable by keyboard. |

### J4 — Document practice for the teaching portfolio (teacher; `PED-030`, `MAPPE-001`…`MAPPE-004`) — from Session 5

Run J4.1–J4.4 with the browser set-ups and J4.5–J4.10 with the set-up **PDF** (§3), on the PDF exported in J4.4.
The PDF is printed by Chromium on the server; the automated test (`apps/server/test/learningDesign/mappe/`) already
finds its structure tree, an outline equal to the headings, `/Lang`, the title and real text, so these steps check
what a person hears and what PAC reports.

| Step | Action | Expected result |
|---|---|---|
| J4.1 | On an activity's «Læringsdesign» tab, set the phase, the course code, two learning outcomes with their category, a rationale, the minutes and the purpose; remove an outcome; save with «Lagre læringsdesignet». | Every field has a label, and its hint and error are read with it; the course code's suggestions can be chosen by keyboard. Adding or removing an outcome moves focus to a sensible place and says so. «Læringsdesignet er lagra.» is announced; errors are listed at the top and linked to their fields (`PED-030`, `UD-013`). |
| J4.2 | Open «Planleggar», choose the course and «Vis planen». | The table has the caption «Læringsutbytte og fasar i …», column headers for the phases and a row header for each outcome. The table region is reached with Tab and scrolls sideways with the arrow keys at 320 px. Gaps are read as text («Hol»), never shown by colour alone, and each «Lag frå mønster» link names its phase and outcome (`PED-031`). |
| J4.3 | Open «Mappe» (`/mappe`), filter by the course, choose the activities with «Vel alle som passar», and pick the criteria set and the language Nynorsk. | The filters' result («… av … aktivitetar passar med filtera») and the Del 1 word count are announced politely, the word count with a text prefix besides its icon; the picker is a group of checkboxes with its legend, and its limit of 50 is said in text (`MAPPE-001`, `MAPPE-002`). |
| J4.4 | Download «Last ned Markdown (til å redigere)» and «Last ned PDF». | Each button names the file type, and «Fila … er lasta ned» is announced. The size is not known until the server has made the file, so it is not shown: record whether that is a problem for `UD-007` («file links show type and size»). |
| J4.5 | Run PAC on the PDF and record its PDF/UA and WCAG results. | No failure other than the residuals listed below. The document has a title, shown in the title bar instead of the file name, and the language `nn` (`MAPPE-004`). |
| J4.6 | In PAC's logical-structure view (or Acrobat's Tags pane), compare the tags with the Markdown file's headings. | The headings are tagged H1–H4 in the Markdown's order and levels; the reader's guide is a Table of TR rows whose header cells are TH (with column and row scopes); lists are L with LI items; text is P. There is no image, and no untagged text beyond the residuals below. |
| J4.7 | Open the PDF in Adobe Acrobat Reader with NVDA and read it from the start with NVDA's say all. | The reading order follows the Markdown file: the title, the author and date, the reader's guide, Del 1 with its chapters and the activities, the references, Del 2 and Del 3. Nothing is read twice or skipped; æ, ø and å are read correctly; NVDA uses its Norwegian voice (with automatic language switching on), also for English titles and references (residuals below). |
| J4.8 | Move by headings (H, and the elements list NVDA+F7) and open Acrobat's bookmarks. | Every heading is reachable at its level; there is one bookmark per heading with the same text, also for the long activity title that wraps, whose words keep their space (D-096). |
| J4.9 | In the reader's guide, move through the table with NVDA's table commands (Ctrl+Alt+arrows). | Each cell is read with its column header, and each row's first cell, the criterion, as its row header. |
| J4.10 | Export the same activities in English and repeat J4.5 and J4.7. | The language is `en` and NVDA reads with its English voice; the result is otherwise the same. |

**Known residuals of the PDF (D-096), to record in J4.5–J4.9 with PAC's or NVDA's own wording, not as new
barriers:** list numbers («1.») are not tagged, list items have no `Lbl` or `LBody`, and lists carry no numbering
attribute; a table's caption and its header row group become `NonStruct`, and there are no `Caption`, `THead` or
`TBody` elements; there is no XMP metadata, so no PDF/UA identifier; links have no `/Contents`; the file header says
PDF 1.4; activity titles carry no language of their own, so an English title in a Nynorsk portfolio is read with
the Norwegian voice (WCAG 3.1.2); references carry no language of their own either, so an English reference in a
Nynorsk portfolio, or a Norwegian one in an English portfolio, is read with the portfolio's voice (D-094
amendment); and an activity's address is plain text, not a link. Anything PAC or the screen
reader reports beyond these is a new finding. Record the outcome as `MAPPE-004`'s manual check (spec 04), which the
S5 gate lists as open until it is done; `apps/server/test/learningDesign/mappe/taggedPdf.browser.test.ts` pins the
structure Chromium makes today, so a Chromium update that changes it fails that test first.

## 7. Checks for every page (all set-ups)

| Check | Expected result | Criterion |
|---|---|---|
| Skip link | The first Tab shows «Gå til hovudinnhaldet»; it moves focus to the main content. | 2.4.1 |
| Landmarks | Banner (with the navigation «Hjelp og informasjon»), main, contentinfo (navigation «Om tenesta»). | 1.3.1 |
| Help link | «Hjelp» is in the same place on every page. | 3.2.6 |
| 400 % zoom (Z400) | All text readable without sideways scrolling; nothing overlaps or is cut off; the header is not sticky. | 1.4.4, 1.4.10 |
| Text spacing | With a text-spacing bookmarklet, no text is cut off. | 1.4.12 |
| Forced colours | In a Windows contrast theme, focus rings and the feedback borders are visible; no information is lost. | 1.4.11, `UD-012` |
| Greyscale (KB, Z400) | With the operating system's colour filter set to greyscale (Windows 11: Accessibility → Colour filters), a right and a wrong answer (J2.3, J2.4), the severity of each finding (J1.7) and the activity's status are told apart by icon and text alone. This is the greyscale check of `UD-003` (D-072). | 1.4.1, `UD-003` |
| Reduced motion | With "show animations" off, nothing slides or flashes. | 2.3.3, `UD-009` |

## 8. Known H5P problems to expect

The automated suite records serious and critical problems in H5P's own markup that HVL Interaktiv cannot repair
(`apps/server/a11y/support/upstreamRegister.ts`), and repairs the others at run time (D-080). Testers should still record what each of them means in practice
for the set-up, because the impact on a screen-reader user is what the conformance report (`UD-040`) needs:

- Repaired at run time (D-080), to confirm with each screen reader: CoursePresentation's progress bar is a list of
  links named by slide, the current slide announced as the current step, and each slide is a group named by its
  title; DragText's drop zones are groups announced with their label when a word is dropped by keyboard, and the
  title of the explanation shown after «Sjekk» ("Forklaring") is a heading of level 2; in the editor, the
  score-range "to" field is announced by the column heading, H5P's required marker, the row's "from" value and the
  dash (for example "Poengområde* 51 % –"; a screen reader may read the "*" as "star", as in every required field
  of H5P's editor), the vertical tabs of QuestionSet, InteractiveBook and ImageHotspots are buttons
  (the open item current) and their forms plain groups, CoursePresentation's paste button is named "Paste" (H5P has
  no nn or nb text for it), and QuestionSet's editor-mode switch is a group whose active mode is pressed.
- CoursePresentation's progress bar keeps H5P's keyboard model: only one slide link is in the Tab order, and the
  arrow, Home and End keys move between the links, which the list does not announce. With each screen reader,
  confirm that every slide link can be reached and activated both in browse mode and with Tab plus the arrow keys.
- CoursePresentation in full screen («Fullskjerm»), on the phone (AT-3): the progress bar is H5P's own there, and
  its parts are smaller than 24 px (WCAG 2.5.8). Confirm that every slide can be reached with the side menu («Vis
  sidemeny») and the previous and next buttons, the equivalent controls D-080 relies on, and that the footer's
  controls lie above the bar, whole, so a tap near their top edge still presses them. The accessibility suite checks
  this in Chromium at 320, 390 and 640 CSS px (`apps/server/a11y/reflowAndMotion.a11y.test.ts`); this step covers a
  real phone and its own full screen.
- Editor, keyboard (WCAG 2.1.1, `UD-006`; axe cannot see these): QuestionSet's editor-mode switch cannot be used by
  keyboard (Enter and Space do nothing; its items have `tabindex="1"`); the vertical-tab buttons open with Space
  only, not Enter; the hotspot position picker works with a pointer only, and its image is decorative. All three are
  recorded in D-080 for the upstream list of `UD-040`.
- BranchingScenario editor: the disabled «Paste» item is not announced as disabled, and it stays faded in a
  contrast theme. While the guided tour shows a step, the faded parts of the editor are inert (D-080): confirm that
  the tour's dialog is reachable, that the editor returns when the tour ends, and that the tour does not start
  again when the editor is opened again in the same browser (D-069 amendment, WEBA11Y-5).
- New activity: H5P's content-type list is a group named by its heading, but its tabs and content types still nest
  interactive elements.
- Forced colours: the theme sets the text fill of BranchingScenario's controls to the system colour Chromium
  paints, so axe no longer misreads them. In a Windows contrast theme, confirm that the start, back and proceed
  buttons and the editor toolbar are readable (protocol §7, forced colours).

Two exceptions are by design: an ImageHotspots image may pan at 320 px (`UD-008`), and in the editor the
score-range table of the overall feedback scrolls sideways inside its own box at 320 px, because its columns
belong together (WCAG 1.4.10 allows this for content that needs two dimensions). Check that both can be used
with the keyboard and at 400 % zoom.

## 9. After the run

1. Save the result file in [results/](results/README.md) and link any new issue.
2. File each new H5P barrier upstream (the repository is in `tools/h5p-libraries/libraries.manifest.json`) and
   add it to the register if the automated suite does not already show it.
3. Update `PROGRESS.md` with the date of the latest complete run per set-up.
