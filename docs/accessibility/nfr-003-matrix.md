# NFR-003 browser and assistive-technology matrix

> Requirement `NFR-003` (spec 00 §6): "Works on the last two versions of Chrome, Edge, Firefox and Safari, on iOS
> Safari and on Android Chrome, and with NVDA, JAWS and VoiceOver." Decision D-079: CI verifies what Chromium can
> show; HVL records the rest by hand with the [manual test protocol](manual-test-protocol.md), in
> [results/](results/README.md).

## 1. What CI verifies automatically (Chromium)

The build environment and CI have one engine: Chromium, driven by `playwright-core` 1.56.1 (D-065, D-079).
`npm run build && npm run test:a11y` runs the suite in `apps/server/a11y/` against the built web app, the real
H5P content types (D-078) and the server's own pages, all behind the production router.

| Check | Where | Requirement | Test file (`apps/server/a11y/`) |
|---|---|---|---|
| axe, tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa`; fails on serious and critical | Every web route signed out and in, the activity tabs, the publish dialog, the Canvas page | `UD-030` | `axeWebRoutes.a11y.test.ts` |
| axe inside the player of one example per content type, fresh and once started and answered | Ten types in the Canvas page | `UD-030`, `UD-011` | `axeContentTypes.a11y.test.ts` |
| axe on the H5P editor of each type (and BranchingScenario after its tour) | Ten types on the **Rediger** tab | `UD-030` | `axeEditor.a11y.test.ts` |
| axe on the server-rendered pages | Friendly error pages, the Deep Linking picker | `UD-030`, `UD-013` | `axeServerPages.a11y.test.ts` |
| Every axe run above also with forced colours emulated | as above | `UD-012` | as above |
| No sideways scrolling at 320 × 640 and 640 × 320 | Every route (the editor tab included) and every type (ImageHotspots may pan its image; the editor's score-range table scrolls in its own box) | `UD-008` | `reflowAndMotion.a11y.test.ts` |
| No running CSS animation or transition with reduced motion | Every web view and every type, fresh and answered | `UD-009` | `reflowAndMotion.a11y.test.ts` |
| No clipped text at 200 % zoom and with the 1.4.12 text-spacing styles | Every web view | `UD-002` | `textSpacingZoom.a11y.test.ts` |
| Skip link first and working; every focused element visible and not covered | Every web view, and the player of every type | `UD-004`, `UD-006` | `keyboardFocus.a11y.test.ts` |
| Keyboard-only scripts of J1 (picker, tabs, publish dialog) and J2 (answer in Canvas) | As named | `UD-006` | `keyboardJourneys.a11y.test.ts` |
| Pointer targets ≥ 24 × 24 px or a 2.5.8 exception, printed | Every web view, the player of every type | `UD-005` | `targetSize.a11y.test.ts` |
| `lang` on `<html>` and on the content container | Every web view, launches in nn, nb, en, player and editor of every type | `UD-010` | `language.a11y.test.ts` |
| Only first-party requests | Every web view, player and editor of every type | `DATA-011` | `firstParty.a11y.test.ts` |

"Started" means that QuestionSet, InteractiveBook and BranchingScenario have left their intro screen; the checks of
a player then run on the first question or screen as well, not only on the start button.

`accessibilityDocs.a11y.test.ts` keeps the manual side consistent: the protocol's set-ups and journeys, this
matrix's browsers, screen readers and suite names, and the names of the dated result files. It checks documents
only: it passes with no result file at all, so it proves that the protocol and this matrix exist and agree, not
that anything was tested by hand. Its `[UD-031]` and `[NFR-003]` titles are why `docs/TRACEABILITY.md` lists both
requirements as "tested".

Answer prefixes in the accessibility tree (`UD-003`) and the theme inside H5P (`UD-011`) are covered by the
browser tests in `apps/server/test/h5p/` (`hvlFeedback.browser.int.test.ts`, `hvlTheme.browser.int.test.ts`).

What the automated suite cannot show: how a screen reader announces anything; the behaviour of Firefox (Gecko)
and Safari (WebKit), of mobile browsers and touch screens; real Windows contrast themes (Chromium only emulates
`forced-colors: active`); speech, braille and switch access; whether the content makes sense.

## 2. The matrix

`CI` = verified automatically on every change. `Manual` = verified by a person with the protocol; the set-up ID
refers to protocol §3. `—` = not required by `NFR-003`.

| Browser (last two versions) | Platform | Rendering engine | No assistive technology | Keyboard only | Screen reader | Zoom 400 % |
|---|---|---|---|---|---|---|
| Chromium (Playwright build) | Linux (CI) | Blink | **CI** | **CI** (Tab walk, J1, J2) | — | **CI** (320 px reflow) |
| Chrome | Windows 11 | Blink | Manual | Manual (KB) | Manual: JAWS (AT-2) | Manual (Z400) |
| Edge | Windows 11 | Blink | Manual | Manual (KB) | — (NVDA or Narrator optional) | Manual (Z400) |
| Firefox | Windows 11 | Gecko | Manual | Manual (KB) | Manual: NVDA (AT-1) | Manual |
| Firefox | macOS | Gecko | Manual | Manual (KB) | — | — |
| Safari | macOS | WebKit | Manual | Manual | VoiceOver optional | Manual |
| Safari | iOS (current and previous) | WebKit | Manual | — | Manual: VoiceOver (AT-3) | Manual (pinch zoom, text size) |
| Chrome | Android (current and previous) | Blink | Manual | — | TalkBack optional | Manual |

Edge in a Windows contrast theme checks `UD-012` for real; it is recorded as an optional set-up.

## 3. How a release is judged

- A release may ship when CI is green and the latest manual runs of AT-1, AT-2, AT-3, KB and Z400 (at most one
  semester old, or newer than any change named in protocol §2) have no **Fail** that is not recorded as a known
  problem with an issue.
- `UD-031` and `NFR-003` are documented protocols whose results HVL records (D-079). Until HVL has run the
  protocol for the first time, that first run is an open item of S4 in `PROGRESS.md`: Firefox, Safari, Edge, the
  mobile browsers and the three screen readers are untested, and `docs/accessibility/results/` holds no result.
