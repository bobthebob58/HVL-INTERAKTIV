/**
 * evidenceDistinguishable — which of our checks and manual protocol steps give evidence for WCAG guideline 1.4
 * (Distinguishable: colour, audio, contrast, resizing, reflow, spacing, hover), criterion by criterion. axe's rules are
 * added from axe-core's own tags (./axeRuleIndex.mjs).
 *
 * Why: UD-040 maps every criterion to its evidence. Which test speaks to which criterion is a judgement, so it is
 *      written down here, reviewed like code, rather than guessed from test titles.
 * Spec: UD-040, UD-001, UD-002, UD-003, UD-004, UD-008, UD-011, UD-012
 * Invariants:
 *   - One key per criterion of guideline 1.4 in ./wcagCriteria.mjs, even when nothing checks it (an empty list).
 *   - `protocol` names steps of docs/accessibility/manual-test-protocol.md §6 (J1.1 …) or checks of its §7; the
 *     generator stops on one the protocol does not have.
 *   - `note` states a fact about scope, never a verdict: verdicts are written by people in the report.
 * Collaborators: ./evidenceShapes.mjs, ./criterionEvidence.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { PLAYERS, WEB_AND_PLAYERS, WEB_VIEWS, suiteCheck, testCheck } from './evidenceShapes.mjs';

/** Evidence for criteria 1.4.1 to 1.4.13. */
export const DISTINGUISHABLE = {
  '1.4.1': {
    checks: [
      testCheck(
        ['UD-003'],
        'Every right and wrong answer shows an icon and a text prefix (✓ Riktig: / ✗ Feil:) besides colour, drawn ' +
          'and in the accessibility tree, in the content types and inside containers; status badges likewise',
      ),
      testCheck(
        ['UD-021', 'V-BRANCH-COLOUR'],
        'The validator warns when a BranchingScenario choice relies on colour coding without text',
      ),
      testCheck(['UD-021', 'V-COLOUR-WORDS'], 'The validator hints at text that refers to colour alone'),
    ],
    protocol: ['J2.3', 'J4.2'],
  },
  '1.4.2': { checks: [], protocol: [] },
  '1.4.3': {
    checks: [
      testCheck(
        ['UD-001'],
        'Every foreground and background pairing of the design tokens is computed (≥ 4.5 : 1 for text, 3 : 1 for ' +
          'large text)',
        { path: 'contrast.test' },
      ),
      testCheck(['UD-011'], 'H5P Core 1.28’s Daylight colours point at the HVL tokens and pass with them', {
        contains: 'Daylight',
      }),
    ],
    protocol: [],
  },
  '1.4.4': {
    checks: [
      suiteCheck(
        'textSpacingZoom.a11y.test.ts',
        ['UD-002'],
        'At 200 % zoom no text is clipped and nothing scrolls sideways',
        WEB_AND_PLAYERS,
        '200 % zoom',
      ),
      testCheck(
        ['UD-002'],
        'Style rules and theme: no font size in px, the HVL typeface and line height in the web app, the server ' +
          'pages and H5P',
        // WHY: other UD-002 tests (a disabled button's look, the order of stylesheets) say nothing about resizing.
        { contains: ['typography', 'font', 'typeface'] },
      ),
    ],
    protocol: [],
  },
  '1.4.5': { checks: [], protocol: [] },
  '1.4.10': {
    checks: [
      suiteCheck(
        'reflowAndMotion.a11y.test.ts',
        ['UD-008'],
        'Nothing scrolls sideways at 320 CSS px wide (except an ImageHotspots image, which may pan, and the editor’s ' +
          'score-range table, which scrolls in its own box)',
        WEB_AND_PLAYERS,
        'scroll sideways',
      ),
    ],
    protocol: ['J2.1', 'J4.2'],
  },
  '1.4.11': {
    checks: [
      testCheck(['UD-001'], 'Non-text token pairings are at least 3 : 1', { path: 'contrast.test' }),
      testCheck(
        ['UD-004'],
        'The two-tone focus ring (#004357 outside, white inside) in the web app and in H5P',
      ),
      testCheck(
        ['UD-012'],
        'Under forced colours, focus rings, tabs and feedback borders use system colours',
      ),
    ],
    protocol: [],
  },
  '1.4.12': {
    checks: [
      suiteCheck(
        'textSpacingZoom.a11y.test.ts',
        ['UD-002'],
        'With the 1.4.12 text-spacing styles applied, no text is clipped',
        WEB_AND_PLAYERS,
        'text-spacing',
      ),
    ],
    protocol: [],
  },
  '1.4.13': {
    checks: [],
    protocol: [],
    note: `No automated check opens content on hover or focus in ${WEB_VIEWS} or ${PLAYERS}.`,
  },
};
