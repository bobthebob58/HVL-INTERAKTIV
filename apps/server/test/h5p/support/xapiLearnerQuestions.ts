/**
 * xapiLearnerQuestions — what the learner does in the question types (MultiChoice, Blanks, DragText, QuestionSet,
 * Column) for the xAPI probe test: answer, then press «Sjekk» or «Avslutt», waiting for H5P's statement each time.
 *
 * Why: probe P1 (D-102) must be repeatable in a few seconds per type, so each script is the shortest path from load
 *      to the type's gradable statement, and answers a known mix of right, wrong and empty so scores and response
 *      formats are fixed (finding F8). DragText is also reloaded: its resume sends restore events without context,
 *      which step 3's root rule must not count as the activity's own statements.
 * Spec: H5P-009
 * Invariants:
 *   - Button names and answers are the Nynorsk texts of the package examples (D-078).
 *   - Every step that should make H5P send something waits for that statement, never for a fixed time.
 * Collaborators: ./xapiCapture.ts (the session), ./xapiLearnerContainers.ts (the other five types).
 * Tests: ../xapiQuestionTypes.browser.int.test.ts, ../xapiContainerTypes.browser.int.test.ts
 */
import type { Frame, Locator } from 'playwright-core';
import { expect } from 'vitest';
import type { RealTypesServer } from '../../support/realTypesPlayer.js';
import type { CapturedStatement, XapiPlay } from './xapiCapture.js';
import { subContentIdOf, verbOf } from './xapiStatementShape.js';

/** What a learner does in one type, and the words a fixture uses for it. */
export interface LearnerScript {
  readonly actions: readonly string[];
  /** Plays from the loaded page; returns what it observed besides statements. */
  readonly play: (p: XapiPlay, server: RealTypesServer) => Promise<Record<string, unknown> | void>;
}

/** H5P.Question's check button: JoubelUI in most types, the Daylight theme's in DragText. */
export const CHECK = '.h5p-question-check-answer:visible, .h5p-theme-check:visible';

/**
 * Matches a statement about the activity itself (no subContentId) with `verb`.
 * @param p - The session.
 * @param verb - For example `answered`.
 * @returns The predicate.
 */
export const rootSent =
  (p: XapiPlay, verb: string) =>
  (s: CapturedStatement): boolean =>
    verbOf(s.statement) === verb && s.statement.object.id === p.contentId && !subContentIdOf(s.statement);

/**
 * Matches a statement about a sub-content item with `verb`.
 * @param verb - For example `answered`.
 * @returns The predicate.
 */
export const subSent =
  (verb: string) =>
  (s: CapturedStatement): boolean =>
    verbOf(s.statement) === verb && subContentIdOf(s.statement) !== undefined;

/**
 * Waits until H5P's autosave (every 5 s, D-037) has stored the instance's current state, so a reload resumes it.
 * @param p - The session.
 * @param server - Its server, whose database holds the state.
 */
export async function waitForAutosave(p: XapiPlay, server: RealTypesServer): Promise<void> {
  type Main = { H5P: { instances: { getCurrentState(): unknown }[] } };
  const state = await p
    .frame()
    .evaluate(() => JSON.stringify((window as unknown as Main).H5P.instances[0]?.getCurrentState()));
  const where = { contentId: p.contentId, dataType: 'state', learnerKey: server.learner.actor.learnerKey };
  const stored = async () => {
    const row = await server.tb.db.h5PUserData.findFirst({ where, select: { data: true } });
    return typeof row?.data === 'string' ? row.data : JSON.stringify(row?.data);
  };
  await expect.poll(stored, { timeout: 20_000, message: 'H5P never autosaved the state' }).toBe(state);
}

/** Drags a word to a zone with the keyboard, as DragText offers it (Space to pick up and to drop). */
async function keyboardDrop(frame: Frame, scope: Locator | Frame, word: string, zone: number): Promise<void> {
  await scope.locator('.h5p-draggable', { hasText: word }).first().focus();
  await frame.page().keyboard.press('Space');
  await scope.locator('[aria-dropeffect]').nth(zone).focus();
  await frame.page().keyboard.press('Space');
}

/** The first right word of each Blanks gap in the example. */
const BLANKS_WORDS = ['quiz', 'samtale', 'refleksjon', 'formativ', 'vidare', 'teksting'];
/** The DragText example's words in zone order. */
const DRAG_WORDS = ['læringsaktivitetar', 'samlinga', 'undervegsvurdering'];

/** The scripts of the question types, by main library name. */
export const QUESTION_SCRIPTS: Record<string, LearnerScript> = {
  'H5P.MultiChoice': {
    actions: ['answer: picks the first option, the right one', 'check: presses «Sjekk»'],
    play: async (p) => {
      p.step('answer');
      await p.frame().locator('.h5p-answer').nth(0).click();
      await p.until('root interacted', rootSent(p, 'interacted'));
      p.step('check');
      await p.frame().locator(CHECK).first().click();
      await p.until('root answered', rootSent(p, 'answered'));
    },
  },
  'H5P.Blanks': {
    actions: [
      'answer: fills six of the seven gaps right and leaves the last empty',
      'check: presses «Sjekk»',
    ],
    play: async (p) => {
      p.step('answer');
      const gaps = p.frame().locator('.h5p-text-input');
      for (const [i, word] of BLANKS_WORDS.entries()) await gaps.nth(i).fill(word);
      await gaps.nth(BLANKS_WORDS.length - 1).press('Tab');
      await p.until('root interacted', rootSent(p, 'interacted'));
      p.step('check');
      await p.frame().locator(CHECK).first().click();
      await p.until('root answered', rootSent(p, 'answered'));
    },
  },
  'H5P.DragText': {
    actions: [
      'answer: drops three of the four words right, with the keyboard',
      'check: presses «Sjekk»',
      'reload: waits for the autosave and reloads the page, which restores the dropped words',
    ],
    play: async (p, server) => {
      p.step('answer');
      for (const [zone, word] of DRAG_WORDS.entries()) await keyboardDrop(p.frame(), p.frame(), word, zone);
      await p.until('root interacted', rootSent(p, 'interacted'));
      p.step('check');
      await p.frame().locator(CHECK).first().click();
      await p.until('root answered', rootSent(p, 'answered'));
      await waitForAutosave(p, server);
      await p.reload();
      await p.until('root attempted on resume', rootSent(p, 'attempted'));
    },
  },
  'H5P.QuestionSet': {
    actions: [
      'start: presses «Start»',
      'q1: picks the right option, checks and goes on',
      'q2: fills two of the three gaps right, checks and goes on',
      'q3: drops one right and one wrong word, checks and goes on',
      'q4: picks both right options and checks',
      'finish: presses «Avslutt»',
    ],
    play: async (p) => {
      const f = p.frame();
      const question = f.locator('.question-container:visible');
      const check = async (n: number) => {
        await question.locator(CHECK).first().click();
        await p.until(`question ${n} answered`, subSent('answered'));
      };
      const next = () => f.locator('.h5p-theme-next:visible, .h5p-question-next:visible').first().click();
      p.step('start');
      await f.getByRole('button', { name: 'Start' }).click();
      p.step('q1');
      await question.locator('.h5p-answer').nth(0).click();
      await check(1);
      await next();
      p.step('q2');
      const gaps = question.locator('.h5p-text-input');
      for (const [i, word] of ['undervegsvurdering', 'framover', 'zzz'].entries())
        await gaps.nth(i).fill(word);
      await check(2);
      await next();
      p.step('q3');
      await keyboardDrop(f, question, 'teksting', 0);
      await keyboardDrop(f, question, 'lydspor', 1);
      await check(3);
      await next();
      p.step('q4');
      await question.locator('.h5p-answer').nth(0).click();
      await question.locator('.h5p-answer').nth(1).click();
      await check(4);
      p.step('finish');
      await f.getByRole('button', { name: 'Avslutt' }).filter({ visible: true }).first().click();
      await p.until('root completed', rootSent(p, 'completed'));
    },
  },
  'H5P.Column': {
    actions: [
      'task1: picks the right option in the first MultiChoice and checks',
      'task2: picks a wrong option in the second MultiChoice and checks',
    ],
    play: async (p) => {
      const task = (n: number) => p.frame().locator('.h5p-multichoice').nth(n);
      p.step('task1');
      await task(0).locator('.h5p-answer').nth(0).click();
      await task(0).locator(CHECK).first().click();
      await p.until('task 1 answered', subSent('answered'));
      await p.quiet();
      p.step('task2');
      await task(1).locator('.h5p-answer').nth(1).click();
      await task(1).locator(CHECK).first().click();
      await p.until('root completed', rootSent(p, 'completed'));
    },
  },
};
