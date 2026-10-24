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

## 4. Preparation

1. Note the release (git tag or commit SHA shown in the deployment) and the date.
2. In Canvas (test instance): a course with the HVL Interaktiv tool, a test teacher and a test student.
3. In HVL Interaktiv: the ten example activities of `npm run h5p:fetch-libraries` (one per content type, all in
   Nynorsk) imported and published by the test teacher, plus one draft MultiChoice activity.
4. Copy the result template from [results/README.md](results/README.md) into a new, dated file **before** starting,
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

Spec 00 §3 starts J1 with a phase and a pattern (**Forarbeid**, *Short video with retrieval checks*); the
patterns arrive with the læringsdesign studio in Session 5. Until then J1 starts from the draft activity of §4,
and the pattern steps are added here when the studio exists.

| Step | Action | Expected result |
|---|---|---|
| J1.1 | In a Canvas module choose *Add item → External tool → HVL Interaktiv*. | The picker opens with the heading «Vel aktivitet» and the group «Aktivitetane dine». The formative notice is announced as a region and can be closed with «Lukk meldinga». |
| J1.2 | Move through the list of activities. | Each activity is a radio button or checkbox with its title; the draft is announced as unavailable with its reason, not by colour or dimming alone. |
| J1.3 | Choose a published activity and activate «Legg inn i Canvas». | Canvas shows the new item. Focus is not lost on the way. |
| J1.4 | Sign in to HVL Interaktiv with Feide and open the draft activity from «Aktivitetane dine». | The page starts with the skip link «Gå til hovudinnhaldet»; it moves to the main content. The page title and the `h1` name the activity. |
| J1.5 | Use the tabs «Spel», «Rediger», «Sjekk og publiser». | Arrow keys move between tabs; Enter or Space selects (manual activation). The selected tab is announced. |
| J1.6 | In «Rediger», change the question text and save («Lagre»). | The H5P editor frame is announced with its title «Rediger: …». Every field has a label. The save result is announced. Known H5P problems: §8. |
| J1.7 | In «Sjekk og publiser», read the findings and use «Gå til feltet» on one. | Each finding states severity in text. «Gå til feltet» moves focus to the field in the editor. |
| J1.8 | Activate «Publiser». | A dialog «Publiser aktiviteten» opens and takes focus; Tab stays inside it; Escape closes it and focus returns to «Publiser». |
| J1.9 | Open it again; give a reason for each error if asked; activate «Publiser no». | Errors in the form are listed at the top and linked to their fields (`UD-013`). After publishing, the status «Publisert» is announced. |

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

The insight pages do not exist yet. When they arrive, run:

| Step | Action | Expected result |
|---|---|---|
| J3.1 | Open **Innsikt → Før samlinga** for an activity. | Headings structure the page; the aggregate numbers are text, not only a chart. |
| J3.2 | Read the per-question results. | Every chart has an equivalent table; suppressed cells (fewer than five students) are announced as hidden, not as zero. |
| J3.3 | Add a question to the *Bring to seminar* shortlist. | The change is announced; the shortlist is reachable by keyboard. |

### J4 — Document practice for the teaching portfolio (teacher; `PED-030`, `MAPPE-001`…`MAPPE-004`) — from Session 5

The portfolio export does not exist yet. When it arrives, run:

| Step | Action | Expected result |
|---|---|---|
| J4.1 | Tag an activity with phase, learning outcomes and a rationale. | Every field has a label and an error message tied to it. |
| J4.2 | Choose **Pedagogisk mappe → Export**. | The file links state type and size (`UD-007`). |
| J4.3 | Open the exported PDF with the screen reader. | The PDF is tagged: headings, reading order, alternative text, document language Nynorsk. |

## 7. Checks for every page (all set-ups)

| Check | Expected result | Criterion |
|---|---|---|
| Skip link | The first Tab shows «Gå til hovudinnhaldet»; it moves focus to the main content. | 2.4.1 |
| Landmarks | Banner (with the navigation «Hjelp og informasjon»), main, contentinfo (navigation «Om tenesta»). | 1.3.1 |
| Help link | «Hjelp» is in the same place on every page. | 3.2.6 |
| 400 % zoom (Z400) | All text readable without sideways scrolling; nothing overlaps or is cut off; the header is not sticky. | 1.4.4, 1.4.10 |
| Text spacing | With a text-spacing bookmarklet, no text is cut off. | 1.4.12 |
| Forced colours | In a Windows contrast theme, focus rings and the feedback borders are visible; no information is lost. | 1.4.11, `UD-012` |
| Reduced motion | With "show animations" off, nothing slides or flashes. | 2.3.3, `UD-009` |

## 8. Known H5P problems to expect

The automated suite records serious and critical problems in H5P's own markup that HVL Interaktiv cannot repair
(`apps/server/a11y/support/upstreamRegister.ts`). Testers should still record what each of them means in practice
for the set-up, because the impact on a screen-reader user is what the conformance report (`UD-040`) needs:

- CoursePresentation: the progress-bar links have no text; each progress-bar tab contains a link.
- DragText: the drop zones carry a label on an element without a role.
- Editor (several types): the "to" field of the score ranges has no label; the vertical tabs of QuestionSet,
  InteractiveBook and ImageHotspots have a broken tab structure; the image of the hotspot position picker has no
  alternative text; CoursePresentation's paste button has no name; QuestionSet's editor-mode switch is a list
  without list items.
- BranchingScenario editor: the guided tour fades the editor without hiding it from assistive technology; the
  disabled «Paste» item is not announced as disabled.
- New activity: H5P's content-type list nests interactive elements and its frame has an empty title.
- Forced colours: axe reports BranchingScenario's buttons and parts of its editor as unreadable because Chromium
  keeps the author colour in `-webkit-text-fill-color` while it paints the system colour. In a Windows contrast
  theme, confirm that the start, back and proceed buttons are readable (protocol §7, forced colours).

Two exceptions are by design: an ImageHotspots image may pan at 320 px (`UD-008`), and in the editor the
score-range table of the overall feedback scrolls sideways inside its own box at 320 px, because its columns
belong together (WCAG 1.4.10 allows this for content that needs two dimensions). Check that both can be used
with the keyboard and at 400 % zoom.

## 9. After the run

1. Save the result file in [results/](results/README.md) and link any new issue.
2. File each new H5P barrier upstream (the repository is in `tools/h5p-libraries/libraries.manifest.json`) and
   add it to the register if the automated suite does not already show it.
3. Update `PROGRESS.md` with the date of the latest complete run per set-up.
