/**
 * evidenceOperable — which of our checks and manual protocol steps give evidence for WCAG guidelines 2.1 to 2.3
 * (keyboard, enough time, seizures), criterion by criterion. Guidelines 2.4 and 2.5 are in ./evidenceNavigable.mjs;
 * axe's rules are added from axe-core's own tags (./axeRuleIndex.mjs).
 *
 * Why: UD-040 maps every criterion to its evidence. Which test speaks to which criterion is a judgement, so it is
 *      written down here, reviewed like code, rather than guessed from test titles.
 * Spec: UD-040, UD-004, UD-006, UD-009
 * Invariants:
 *   - One key per criterion of guidelines 2.1 to 2.3 in ./wcagCriteria.mjs, even when nothing checks it.
 *   - `protocol` names steps of docs/accessibility/manual-test-protocol.md §6 (J1.1 …) or checks of its §7
 *     (`§7 Reduced motion`); the generator stops on one the protocol does not have.
 *   - `note` states a fact about scope or a recorded upstream barrier, never a verdict.
 * Collaborators: ./evidenceShapes.mjs, ./criterionEvidence.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { WEB_AND_PLAYERS, WEB_VIEWS, suiteCheck, testCheck } from './evidenceShapes.mjs';

const CANVAS_PICKER =
  'the Deep Linking picker in Canvas, an activity page and `/app/play` with H5P.MultiChoice';
const STUDIO = 'the studio’s catalogue, planner, an activity’s Deling tab and `/mappe`';
const TAB_WALK = `${WEB_VIEWS}; the player of each of the ten content types in Canvas`;

/** Evidence for criteria 2.1.1 to 2.3.1. */
export const OPERABLE = {
  '2.1.1': {
    checks: [
      suiteCheck(
        'keyboardJourneys.a11y.test.ts',
        ['UD-006'],
        'Journeys J1 and J2 by keyboard alone: an activity picked in the Deep Linking picker, the tabs, the ' +
          'publish dialog, a MultiChoice answer in Canvas and the formative notice',
        CANVAS_PICKER,
      ),
      suiteCheck(
        'keyboardStudioJourneys.a11y.test.ts',
        ['UD-006'],
        'The studio by keyboard: the catalogue filters, the planner table and its links, adding and leaving as ' +
          'co-author, and the portfolio picker with its download',
        STUDIO,
      ),
      suiteCheck(
        'axeGradeSync.a11y.test.ts',
        ['UD-006'],
        'The retry on «Poeng til Canvas» by keyboard',
        'an activity page in the portal',
      ),
      suiteCheck(
        'axeInsight.a11y.test.ts',
        ['UD-006'],
        'The «Ta opp i samlinga» list on «Innsikt» by keyboard',
        'an activity page in the portal',
      ),
      testCheck(
        ['UD-006'],
        'Component and browser tests of the tabs, the dialogs, the focus moves and the editor’s «Gå til feltet»',
      ),
    ],
    protocol: ['J1.5', 'J1.8', 'J1.13', 'J2.6', 'J3.3', 'J4.1'],
    note:
      'D-080 records three barriers in the H5P editor that axe cannot see (protocol §8): QuestionSet’s ' +
      'editor-mode switch does not work by keyboard, the vertical-tab buttons open with Space only, and the hotspot ' +
      'position picker of ImageHotspots needs a pointer.',
  },
  '2.1.2': {
    checks: [
      suiteCheck(
        'keyboardFocus.a11y.test.ts',
        ['UD-004'],
        'Tab is pressed through every page and its frames until focus comes back to the start or leaves the page; ' +
          'a stop that holds focus for three presses, or a cycle that never returns, fails',
        TAB_WALK,
      ),
      suiteCheck(
        'keyboardJourneys.a11y.test.ts',
        ['UD-006'],
        'The publish dialog keeps focus inside and returns it on Escape',
        'an activity page',
        'publish dialog',
      ),
    ],
    protocol: ['J1.8', 'J1.13', 'J2.6'],
  },
  '2.1.4': { checks: [], protocol: [], note: 'No automated check looks for single-character shortcuts.' },
  '2.2.1': { checks: [], protocol: [] },
  '2.2.2': {
    checks: [
      suiteCheck(
        'reflowAndMotion.a11y.test.ts',
        ['UD-009'],
        'With reduced motion emulated, no CSS animation or transition runs (a recorder in every frame logs each one)',
        WEB_AND_PLAYERS,
        'reduced motion',
      ),
      testCheck(['UD-009'], 'The HVL theme stops transitions inside H5P under reduced motion', {
        path: 'hvlTheme',
      }),
    ],
    protocol: ['§7 Reduced motion'],
  },
  '2.3.1': {
    checks: [],
    protocol: ['§7 Reduced motion'],
    note: 'No automated check counts flashes; UD-009 forbids anything that flashes more than three times a second.',
  },
};
