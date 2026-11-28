/**
 * branchingScenarioPlay — a learner's steps through the real BranchingScenario example (start, go on, choose, back,
 * restart), each waiting for the scenario itself, and a recorder of the scenario's own `navigated` events.
 *
 * Why: the tests of a scenario's choices (INS-004, D-154) play loops, the back button, a reload and a restart. The
 *      scenario ignores a press while a screen slides in (`navigating`), so a step that pressed on a timer passed on
 *      a fast machine and failed on a slow one; here every press waits until the scenario takes presses and then
 *      until it has moved.
 * Spec: INS-004, LTI-010
 * Invariants:
 *   - A step presses once, when the scenario takes presses (`navigating === false` on a page, the options shown on
 *     a decision), and returns when `userPath` has changed. No fixed waits.
 *   - `watchMoves` only adds a listener; it reads `xAPIData` and changes nothing in the scenario.
 *   - The example: node 1 is the first decision (option 0 → node 2, option 1 → node 3, which loops back to it),
 *     node 4 the last (each option ends the scenario); every option of the first decision has a feedback screen.
 * Collaborators: ./xapiCapture.ts, ./xapiBridgeEndpoint.ts, ../../support/realTypesPlayer.ts,
 *   tools/h5p-libraries/examples/H5P.BranchingScenario.json.
 * Tests: apps/server/test/h5p/xapiBranchingChoices.browser.int.test.ts,
 *   apps/server/e2e/branchingInsight.e2e.test.ts
 */
import type { Frame } from 'playwright-core';
import { expect } from 'vitest';
import type { TestActor } from '../../support/httpTestbed.js';
import type { RealTypesServer } from '../../support/realTypesPlayer.js';
import type { SentItem } from './xapiBridgeEndpoint.js';
import type { XapiPlay } from './xapiCapture.js';

/** The example's two decisions (`subContentId`s of nodes 1 and 4). */
export const DECISIONS = [
  'b3a7c1d2-4e5f-4a6b-8c7d-9e0f1a2b3c02',
  'b3a7c1d2-4e5f-4a6b-8c7d-9e0f1a2b3c05',
] as const;

/**
 * Each item the bridge sent, as `<verb> <root | the decision's last two characters=the index> <attempt number>`.
 * @param items - Sent items, in arrival order.
 * @param contentId - The activity.
 * @returns One line per item.
 */
export const lines = (items: readonly SentItem[], contentId: string): string[] =>
  items.map((item) => {
    const verb = String((item.verb as { id: string }).id)
      .split('/')
      .pop();
    const id = (item.object as { id: string }).id;
    const response = (item.result as { response?: unknown } | undefined)?.response;
    const what = id === contentId ? 'root' : `${id.slice(-2)}=${String(response)}`;
    return `${verb} ${what} ${item.attemptId.split(':')[1]}`;
  });

/** One `navigated` event as the scenario raised it, and the last statement it had kept by then. */
export interface ScenarioMove {
  readonly chosen?: number;
  readonly reverse: boolean;
  readonly resuming: boolean;
  readonly kept: { verb: string; category: string; type: string; id: string; response: unknown } | null;
}

interface Scenario {
  navigating?: boolean;
  userPath: number[];
  xAPIData: { statement: Record<string, never> }[];
  on(type: string, listener: (event: { data?: Record<string, unknown> }) => void): void;
  getCurrentState(): unknown;
}
type Player = { H5P: { instances: Scenario[] }; hvlMoves?: ScenarioMove[] };
const MOVE_MS = 20_000;

/** Starts recording the scenario's moves in the player document; `movesOf` reads them. */
export async function watchMoves(frame: Frame): Promise<void> {
  await frame.evaluate(() => {
    const w = window as unknown as Player;
    const scenario = w.H5P.instances[0]!;
    w.hvlMoves = [];
    scenario.on('navigated', (event) => {
      const data = event.data ?? {};
      const last = scenario.xAPIData.at(-1)?.statement as
        | {
            verb: { id: string };
            object: { id: string; definition: { interactionType: string } };
            context: { contextActivities: { category: { id: string }[] } };
            result: { response: unknown };
          }
        | undefined;
      w.hvlMoves?.push({
        ...(typeof data.chosenAlternative === 'number' ? { chosen: data.chosenAlternative } : {}),
        reverse: data.reverse === true,
        resuming: data.isResuming === true,
        kept: last
          ? {
              verb: last.verb.id.split('/').pop() ?? '',
              category: last.context.contextActivities.category[0]?.id.split('/').pop() ?? '',
              type: last.object.definition.interactionType,
              id: last.object.id.split('subContentId=')[1] ?? '',
              response: last.result.response,
            }
          : null,
      });
    });
  });
}

/** The moves recorded since `watchMoves`. */
export const movesOf = (frame: Frame): Promise<ScenarioMove[]> =>
  frame.evaluate(() => (window as unknown as Player).hvlMoves ?? []);

/**
 * The learner's steps in the current player document.
 * @param play - The session, or anything that gives the player document; read at each step, so a reload is fine.
 * @returns `start`, `goOn`, `choose` (with the option's feedback screen passed when `feedback`), `pick` and
 *   `passFeedback` for the two halves of such a choice, `back`, `restart`.
 */
export function scenarioSteps(play: Pick<XapiPlay, 'frame'>) {
  const path = () =>
    play.frame().evaluate(() => JSON.stringify((window as unknown as Player).H5P.instances[0]?.userPath));
  // WHY: a page takes a press only when `navigating` is false; a decision takes one as soon as its options show
  // (the scenario leaves `navigating` true there).
  const ready = () =>
    play
      .frame()
      .waitForFunction(
        () =>
          (window as unknown as Player).H5P.instances[0]?.navigating === false ||
          [...document.querySelectorAll<HTMLElement>('.h5p-branching-question-alternative')].some(
            (option) => option.offsetParent !== null,
          ),
        null,
        { timeout: MOVE_MS },
      );
  /** Presses once the scenario takes presses, and waits until it has moved. */
  const move = async (press: () => Promise<void>) => {
    await ready();
    const before = await path();
    await press();
    await expect.poll(path, { timeout: MOVE_MS, message: 'the scenario did not move' }).not.toBe(before);
  };
  const visible = (selector: string) => play.frame().locator(selector).filter({ visible: true });
  const alternatives = () => visible('.h5p-branching-question-alternative');
  const feedbackOn = () =>
    play.frame().getByRole('dialog').getByRole('button', { name: 'Gå vidare' }).click();
  return {
    start: () => play.frame().getByRole('button', { name: 'Start scenarioet' }).click(),
    goOn: () => move(() => visible('.h5p-proceed-button').first().click()),
    /** Chooses option `index` of the decision on screen; `feedback`: its feedback screen follows, and is passed. */
    choose: (index: number, feedback: boolean) =>
      move(async () => {
        await alternatives().nth(index).click();
        if (feedback) await feedbackOn();
      }),
    /** Picks option `index` and stays on its feedback screen. */
    pick: (index: number) => alternatives().nth(index).click(),
    /** Goes on from a feedback screen that is showing, also one H5P showed again after a reload. */
    passFeedback: async () => {
      const before = await path();
      await feedbackOn();
      await expect.poll(path, { timeout: MOVE_MS, message: 'the scenario did not move' }).not.toBe(before);
    },
    // WHY: on a decision the scenario shows a back button of the overlay over the page's own; the last one is on top.
    back: () => move(() => visible('.h5p-back-button').last().click()),
    restart: async () => {
      await play.frame().getByRole('button', { name: 'Start på nytt' }).click();
      await play.frame().getByRole('button', { name: 'Start scenarioet' }).click();
    },
  };
}

/**
 * Waits until H5P's autosave (every 5 s, D-037) has stored the scenario's current state, so a reload resumes it.
 * @param play - The session.
 * @param server - Its server, whose database holds the state.
 * @param learner - Who plays.
 */
export async function waitForSavedState(
  play: XapiPlay,
  server: RealTypesServer,
  learner: TestActor,
): Promise<void> {
  const state = await play
    .frame()
    .evaluate(() => JSON.stringify((window as unknown as Player).H5P.instances[0]?.getCurrentState()));
  const where = { contentId: play.contentId, dataType: 'state', learnerKey: learner.actor.learnerKey };
  const stored = async () => {
    const row = await server.tb.db.h5PUserData.findFirst({ where, select: { data: true } });
    return typeof row?.data === 'string' ? row.data : JSON.stringify(row?.data);
  };
  await expect.poll(stored, { timeout: 20_000, message: 'H5P never autosaved the state' }).toBe(state);
}
