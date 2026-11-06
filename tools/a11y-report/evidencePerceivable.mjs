/**
 * evidencePerceivable — which of our checks and manual protocol steps give evidence for WCAG guidelines 1.1 to 1.3
 * (text alternatives, time-based media, adaptable), criterion by criterion. Guideline 1.4 is in
 * ./evidenceDistinguishable.mjs; axe's rules are added from axe-core's own tags (./axeRuleIndex.mjs).
 *
 * Why: UD-040 maps every criterion to its evidence. Which test speaks to which criterion is a judgement, so it is
 *      written down here, reviewed like code, rather than guessed from test titles.
 * Spec: UD-040, UD-001, UD-002, UD-003, UD-008, UD-021
 * Invariants:
 *   - One key per criterion of guidelines 1.1 to 1.3 in ./wcagCriteria.mjs, even when nothing checks it.
 *   - `protocol` names steps of docs/accessibility/manual-test-protocol.md §6 (J1.1 …) or checks of its §7
 *     (`§7 Greyscale (KB, Z400)`); the generator stops on one the protocol does not have.
 *   - `note` states a fact about scope, never a verdict: verdicts are written by people in the report.
 * Collaborators: ./evidenceShapes.mjs, ./criterionEvidence.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { WEB_AND_PLAYERS, suiteCheck, testCheck } from './evidenceShapes.mjs';

const AUTHORED =
  'Media and their alternatives in an activity are authored content: the author supplies them.';

/** Evidence for criteria 1.1.1 to 1.3.5. */
export const PERCEIVABLE = {
  '1.1.1': {
    checks: [
      testCheck(
        ['UD-021', 'V-IMG-ALT'],
        'The pre-publish validator: an image without alternative text, or with a file name as its text, is an error ' +
          'the author fixes or acknowledges with a reason',
      ),
      testCheck(
        ['UD-021', 'V-IMG-ALT-LENGTH'],
        'The validator warns about alternative text over 250 characters',
      ),
      testCheck(['INS-008'], 'Every insight chart has a visible data table and a text summary'),
    ],
    protocol: ['J3.2'],
    note: 'The validator checks that an authored image has alternative text and that it is not a file name, not that it describes the image.',
  },
  '1.2.1': {
    checks: [
      testCheck(
        ['UD-021', 'V-VID-TRANSCRIPT'],
        'The validator warns when a video has no transcript or text alternative',
      ),
    ],
    protocol: [],
    note: AUTHORED,
  },
  '1.2.2': {
    checks: [
      testCheck(
        ['UD-021', 'V-VID-CAPTIONS'],
        'The validator: an InteractiveVideo or Video without a text track, unless its Panopto source is listed as ' +
          'captioned, is an error',
      ),
    ],
    protocol: [],
    note: AUTHORED,
  },
  '1.2.3': {
    checks: [
      testCheck(
        ['UD-021', 'V-VID-TRANSCRIPT'],
        'The validator warns when a video has no transcript or text alternative',
      ),
    ],
    protocol: [],
    note: `${AUTHORED} Nothing checks audio description automatically.`,
  },
  '1.2.4': { checks: [], protocol: [] },
  '1.2.5': { checks: [], protocol: [], note: `${AUTHORED} Nothing checks audio description automatically.` },
  '1.3.1': {
    checks: [
      testCheck(
        ['UD-021', 'V-HEADING-ORDER'],
        'The validator warns about rich-text headings that skip a level',
      ),
      testCheck(
        ['UD-021', 'V-TABLE-HEADERS'],
        'The validator warns about tables in activities without header cells',
      ),
      testCheck(
        ['MAPPE-004'],
        'The portfolio PDF is tagged: headings, paragraphs, lists and the table with header scopes, and an outline',
        // WHY: the file also holds the PDF's sandbox and timing tests, which say nothing about structure.
        { path: 'taggedPdf', contains: ['structure tree', 'outline', 'marked as tagged'] },
      ),
    ],
    protocol: ['J3.1', 'J4.2', 'J4.6', 'J4.9'],
  },
  '1.3.2': {
    checks: [
      testCheck(
        ['UD-021', 'V-HOTSPOT-ORDER'],
        'The validator warns when ImageHotspots’ hotspots are not ordered or a hotspot has no header',
      ),
    ],
    protocol: ['J1.11', 'J4.7'],
  },
  '1.3.3': {
    checks: [
      testCheck(['UD-021', 'V-COLOUR-WORDS'], 'The validator hints at text that refers to colour alone'),
    ],
    protocol: [],
  },
  '1.3.4': {
    checks: [
      suiteCheck(
        'reflowAndMotion.a11y.test.ts',
        ['UD-008'],
        'Nothing scrolls sideways in either orientation: 320 × 640 and 640 × 320 CSS px',
        WEB_AND_PLAYERS,
        'scroll sideways',
      ),
    ],
    protocol: ['J2.1'],
  },
  '1.3.5': {
    checks: [],
    protocol: [],
    note: 'Sign-in goes through Feide or Canvas (UD-013); our own forms ask for no personal details.',
  },
};
