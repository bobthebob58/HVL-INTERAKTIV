/**
 * evidenceNavigable — which of our checks and manual protocol steps give evidence for WCAG guidelines 2.4
 * (Navigable) and 2.5 (Input Modalities), criterion by criterion. axe's rules are added from axe-core's own tags
 * (./axeRuleIndex.mjs).
 *
 * Why: UD-040 maps every criterion to its evidence. Which test speaks to which criterion is a judgement, so it is
 *      written down here, reviewed like code, rather than guessed from test titles.
 * Spec: UD-040, UD-004, UD-005, UD-006, UD-007, UD-013, UD-021
 * Invariants:
 *   - One key per criterion of guidelines 2.4 and 2.5 in ./wcagCriteria.mjs, even when nothing checks it.
 *   - `protocol` names steps of docs/accessibility/manual-test-protocol.md §6 or checks of its §7; the generator
 *     stops on one the protocol does not have.
 *   - `note` states a fact about scope or a recorded upstream barrier, never a verdict.
 * Collaborators: ./evidenceShapes.mjs, ./criterionEvidence.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { PLAYERS, WEB_VIEWS, suiteCheck, testCheck } from './evidenceShapes.mjs';

const STUDIO = 'the studio’s catalogue, planner, an activity’s Deling tab and `/mappe`';
const TAB_WALK = `${WEB_VIEWS}; the player of each of the ten content types in Canvas`;

/** Evidence for criteria 2.4.1 to 2.5.8. */
export const NAVIGABLE = {
  '2.4.1': {
    checks: [
      suiteCheck(
        'keyboardFocus.a11y.test.ts',
        ['UD-006'],
        'The first Tab reaches the skip link «Gå til hovudinnhaldet», which moves focus to `main`',
        WEB_VIEWS,
        'skip link',
      ),
      testCheck(['UD-006'], 'The skip link appears when focused', { contains: 'skip link' }),
    ],
    protocol: ['J1.4'],
  },
  '2.4.2': {
    checks: [
      testCheck(['UD-013'], 'Every route has its own title, its name first', { contains: 'own title' }),
    ],
    protocol: ['J1.4'],
  },
  '2.4.3': {
    checks: [
      suiteCheck(
        'keyboardJourneys.a11y.test.ts',
        ['UD-006'],
        'Focus moves into the publish dialog and back to its opener, and stays in the formative notice’s panel',
        'an activity page',
        ['publish dialog', 'formative-use notice'],
      ),
      suiteCheck(
        'keyboardStudioJourneys.a11y.test.ts',
        ['UD-006'],
        'Focus after a filter, a link to the catalogue, adding or leaving as co-author and the portfolio picker',
        STUDIO,
      ),
      testCheck(['UD-006'], 'Component tests of where focus goes after a change', { contains: 'focus' }),
    ],
    protocol: ['J1.3', 'J1.8', 'J1.13', 'J4.1'],
  },
  '2.4.4': {
    checks: [
      testCheck(
        ['UD-021', 'V-LINK-TEXT'],
        'The validator warns about link texts such as «klikk her», «her», «les meir» or a bare URL',
      ),
      testCheck(
        ['UD-007'],
        'External links say that they leave the site; file links name their type and size',
      ),
    ],
    protocol: ['J4.2'],
  },
  '2.4.5': { checks: [], protocol: [] },
  '2.4.6': { checks: [], protocol: ['J1.4', 'J1.6', 'J3.1', 'J4.1'] },
  '2.4.7': {
    checks: [
      suiteCheck(
        'keyboardFocus.a11y.test.ts',
        ['UD-004'],
        'Every element that takes focus from the keyboard shows a ring that differs from its unfocused look',
        TAB_WALK,
      ),
      testCheck(
        ['UD-004'],
        'The two-tone focus ring (#004357 outside, white inside) in the web app and in H5P',
      ),
    ],
    protocol: ['J2.6'],
  },
  '2.4.11': {
    checks: [
      suiteCheck(
        'keyboardFocus.a11y.test.ts',
        ['UD-004'],
        'Every focused element is in the viewport and not covered by the header or anything else ' +
          '(`elementFromPoint`)',
        TAB_WALK,
      ),
    ],
    protocol: ['J2.6'],
  },
  '2.5.1': { checks: [], protocol: [] },
  '2.5.2': { checks: [], protocol: [] },
  '2.5.3': { checks: [], protocol: [] },
  '2.5.4': { checks: [], protocol: [] },
  '2.5.7': {
    checks: [
      testCheck(['UD-006'], 'DragText: a word dropped by keyboard lands in a named drop zone', {
        contains: 'DragText',
      }),
    ],
    protocol: ['J2.6'],
    note:
      'H5P.DragQuestion, which has no single-pointer alternative, is never offered (H5P-002); DragText’s keyboard ' +
      'and click mode is the alternative UD-005 names.',
  },
  '2.5.8': {
    checks: [
      suiteCheck(
        'targetSize.a11y.test.ts',
        ['UD-005'],
        'Every pointer target of the page and its frames is at least 24 × 24 CSS px, or one of the exceptions of ' +
          'WCAG 2.5.8 (inline, spacing, equivalent, essential)',
        `${WEB_VIEWS}; ${PLAYERS}`,
      ),
      suiteCheck(
        'reflowAndMotion.a11y.test.ts',
        ['UD-005'],
        'At 320, 390 and 640 CSS px a pointer can press all of every footer control of CoursePresentation',
        'H5P.CoursePresentation in Canvas',
        'footer control',
      ),
      testCheck(['UD-005'], 'Style rules: the theme and the web app give every control a 24 px minimum'),
    ],
    protocol: [],
    note:
      'CoursePresentation’s progress bar in full screen is H5P’s own, with parts smaller than 24 px; D-080 relies ' +
      'on the side menu and the previous and next buttons as the equivalent controls (protocol §8).',
  },
};
