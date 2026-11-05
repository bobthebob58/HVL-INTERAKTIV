/**
 * evidenceUnderstandableRobust — which of our checks and manual protocol steps give evidence for WCAG principles 3
 * (Understandable) and 4 (Robust), criterion by criterion. axe's rules are added from axe-core's own tags
 * (./axeRuleIndex.mjs), and the register's English texts are added to 3.1.2 (./upstreamEntries.mjs).
 *
 * Why: UD-040 maps every criterion to its evidence. Which test speaks to which criterion is a judgement, so it is
 *      written down here, reviewed like code, rather than guessed from test titles.
 * Spec: UD-040, UD-003, UD-006, UD-010, UD-013, UD-021
 * Invariants:
 *   - One key per criterion of principles 3 and 4 in ./wcagCriteria.mjs, even when nothing checks it.
 *   - `protocol` names steps of docs/accessibility/manual-test-protocol.md §6 or checks of its §7; the generator
 *     stops on one the protocol does not have.
 *   - `note` states a fact about scope, never a verdict.
 * Collaborators: ./evidenceShapes.mjs, ./criterionEvidence.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { WEB_VIEWS, suiteCheck, testCheck } from './evidenceShapes.mjs';

const EDITOR_AND_PLAYER = 'the player and the editor of each of the ten content types';

/** Evidence for criteria 3.1.1 to 4.1.3. */
export const UNDERSTANDABLE_ROBUST = {
  '3.1.1': {
    checks: [
      suiteCheck(
        'language.a11y.test.ts',
        ['UD-010'],
        'Every page has `<html lang="nn">` for an author with the default locale',
        WEB_VIEWS,
        'html lang',
      ),
      testCheck(['UD-010'], 'The page language follows the locale Express decides, not the client', {
        contains: ['page language', 'request locale'],
      }),
    ],
    protocol: ['J2.1'],
  },
  '3.1.2': {
    checks: [
      suiteCheck(
        'language.a11y.test.ts',
        ['UD-010'],
        'The player’s content container and the editor’s frame carry the activity’s language',
        EDITOR_AND_PLAYER,
        'player content container',
      ),
      suiteCheck(
        'language.a11y.test.ts',
        ['UD-010'],
        'A reference, a learner purpose or a source title in another language than the page carries its own lang',
        'the guide page, an activity’s learner purpose and a copy’s attribution sign',
        ['reference', 'purpose', 'source’s title'],
      ),
      testCheck(['UD-021', 'V-LANG'], 'The validator warns when an activity does not state its language'),
      testCheck(
        ['UD-010'],
        'Server, component and theme tests of the lang of parts: the content container, titles, purposes, references ' +
          'and feedback prefixes',
        {
          contains: 'lang',
        },
      ),
    ],
    protocol: ['J1.11', 'J2.1', 'J4.7', 'J4.10'],
    note:
      'The portfolio PDF gives activity titles and references no language of their own (D-096, D-094 amendment; ' +
      'protocol §6, J4).',
  },
  '3.2.1': { checks: [], protocol: [] },
  '3.2.2': {
    checks: [
      suiteCheck(
        'keyboardStudioJourneys.a11y.test.ts',
        ['UD-006', 'PED-003'],
        'Choosing a filter in the catalogue keeps focus on the select and announces the count',
        'the studio’s pattern catalogue',
      ),
    ],
    protocol: ['J1.10', 'J4.3'],
  },
  '3.2.3': {
    checks: [
      testCheck(
        ['UD-013'],
        'The header orders the site name, the main menu and Hjelp the same way on every page',
        {
          contains: 'same way',
        },
      ),
    ],
    protocol: [],
  },
  '3.2.4': { checks: [], protocol: [] },
  '3.2.6': {
    checks: [
      testCheck(
        ['UD-013'],
        'Hjelp is in the same place in the header of the portal, the server pages and Canvas',
        {
          contains: 'Hjelp',
        },
      ),
    ],
    protocol: [],
  },
  '3.3.1': {
    checks: [
      testCheck(['UD-013'], 'Errors are listed in a summary at the top and linked to their fields', {
        contains: ['summary', 'names the error'],
      }),
    ],
    protocol: ['J1.9', 'J4.1'],
  },
  '3.3.2': { checks: [], protocol: ['J1.6', 'J1.11', 'J4.1', 'J4.3'] },
  '3.3.3': {
    checks: [
      testCheck(['UD-013'], 'A refused save or copy gives the server’s reason and says what to do', {
        // WHY: not a bare "reason", which also matches the publish dialog's reason field (3.3.1, 3.3.7).
        contains: ['server’s reason', 'what to do'],
      }),
    ],
    protocol: ['J1.9', 'J1.12'],
  },
  '3.3.4': {
    checks: [
      suiteCheck(
        'axeSaveChoice.a11y.test.ts',
        ['UD-030'],
        'A change that would reset students’ progress opens a dialog first (PROD-013); axe scans it open',
        'an activity page with the dialog open',
      ),
    ],
    protocol: ['J1.8', 'J1.13'],
  },
  '3.3.7': {
    checks: [
      testCheck(['UD-013'], 'Closing the publish dialog keeps the typed reasons for the next opening', {
        contains: 'typed reasons',
      }),
    ],
    protocol: ['J1.9'],
  },
  '3.3.8': {
    checks: [testCheck(['UD-013'], 'The start page logs in through Feide', { contains: 'logs in' })],
    protocol: [],
    note: 'Sign-in goes through Feide or Canvas only (UD-013); HVL Interaktiv adds no cognitive test of its own.',
  },
  '4.1.1': {
    checks: [],
    protocol: [],
    note: 'Obsolete in WCAG 2.2, where it is always satisfied; listed for WCAG 2.1 and EN 301 549.',
  },
  '4.1.2': {
    checks: [
      testCheck(['UD-006'], 'Tabs follow the WAI-ARIA tabs pattern; dialogs are labelled modals', {
        contains: ['WAI-ARIA', 'labelled modal', 'names the tab list'],
      }),
      testCheck(['UD-003'], 'Right and wrong answers carry their state in the accessibility tree', {
        contains: 'accessibility tree',
      }),
    ],
    protocol: ['J1.2', 'J1.5', 'J1.6', 'J2.2'],
  },
  '4.1.3': {
    checks: [
      suiteCheck(
        'keyboardJourneys.a11y.test.ts',
        ['UD-006'],
        'A student answers a MultiChoice question in Canvas and hears the verdict',
        'H5P.MultiChoice in Canvas',
        'hears the verdict',
      ),
      suiteCheck(
        'axeGradeSync.a11y.test.ts',
        ['UD-006'],
        'The outcome of a retry on «Poeng til Canvas» is announced',
        'an activity page in the portal',
      ),
      suiteCheck(
        'axeInsight.a11y.test.ts',
        ['UD-006'],
        'Adding a question to «Ta opp i samlinga» is said',
        'an activity page in the portal',
      ),
      testCheck(['UD-006'], 'Status messages are heard every time', { contains: ['status', 'announce'] }),
    ],
    protocol: ['J1.9', 'J1.10', 'J2.3', 'J3.3', 'J4.3', 'J4.4'],
  },
};
