/**
 * Browser integration tests of a Branching Scenario's choices in the real player (full Chromium, the real
 * BranchingScenario 1.10 example): what the library itself does at a choice (pinned, since the bridge relies on
 * it), and that the bridge sends each choice once, cut down, in order, through a loop, the back button, a reload
 * and a restart, and never an old choice again.
 *
 * Spec: INS-004, LTI-010, DATA-012
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithFullChromium } from '../support/fullChromium.js';
import type { TestActor } from '../support/httpTestbed.js';
import { describeWithRealPackages } from '../support/realPackages.js';
import { openRealTypesServer, type RealTypesServer } from '../support/realTypesPlayer.js';
import { describeWithServices } from '../support/services.js';
import {
  DECISIONS,
  lines,
  movesOf,
  scenarioSteps,
  waitForSavedState,
  watchMoves,
} from './support/branchingScenarioPlay.js';
import {
  itemsFrom,
  recordXapiBatches,
  waitForStatements,
  type ReceivedBatch,
} from './support/xapiBridgeEndpoint.js';
import { openXapiPlay } from './support/xapiCapture.js';
import { rootSent } from './support/xapiLearnerQuestions.js';
import { subContentIdOf, verbOf } from './support/xapiStatementShape.js';

const PLAY_MS = 120_000;
describeWithServices('[INS-004] the choices of a Branching Scenario in the real player', () => {
  describeWithRealPackages('[INS-004] with the real BranchingScenario', () => {
    let server: RealTypesServer;
    let received: ReceivedBatch[];
    beforeAll(async () => {
      server = await openRealTypesServer();
      received = recordXapiBatches(server);
    }, 180_000);
    afterAll(() => server?.close());
    const scenario = () => server.ids.get('H5P.BranchingScenario') ?? '';
    const learnerOf = (): Promise<TestActor> =>
      server.tb.actor('learner', { urlToken: { name: 'csrf', value: 'csrf-token-of-the-test-session' } });

    describeWithFullChromium('[INS-004] played in full Chromium', (browser) => {
      it(
        'upstream pin: BranchingScenario 1.10 dispatches no answer for a choice, but has kept the question’s `answered` when `navigated` fires with the index',
        async () => {
          // Arrange
          const play = await openXapiPlay(browser(), server, scenario(), await learnerOf());
          try {
            const steps = scenarioSteps(play);
            await watchMoves(play.frame());
            // Act: the first decision's option 1 (a feedback screen), the loop back, then on to the last decision,
            // whose option 2 ends the scenario
            await steps.start();
            await steps.goOn();
            await steps.choose(1, true);
            await steps.goOn();
            await steps.choose(0, true);
            await steps.goOn();
            await steps.choose(2, false);
            await play.until('root completed', rootSent(play, 'completed'));
            // Assert: the bridge (../../../../packages/hvl-h5p-theme/src/xapiBranchingChoices.js) goes when this fails
            const choices = (await movesOf(play.frame())).filter((move) => move.chosen !== undefined);
            const made = (id: string, chosen: number) => ({
              chosen,
              reverse: false,
              resuming: false,
              kept: {
                verb: 'answered',
                category: 'H5P.BranchingQuestion-1.0',
                type: 'choice',
                id,
                response: chosen,
              },
            });
            expect(choices).toEqual([made(DECISIONS[0], 1), made(DECISIONS[0], 0), made(DECISIONS[1], 2)]);
            const dispatched = play.statements.map((s) => s.statement);
            expect(dispatched.filter((s) => verbOf(s) === 'answered')).toEqual([]);
            expect(dispatched.filter((s) => verbOf(s) === 'interacted').map(subContentIdOf)).toEqual([
              DECISIONS[0],
              DECISIONS[0],
            ]);
            expect(play.errors).toEqual([]);
          } finally {
            await play.close();
          }
        },
        PLAY_MS,
      );

      it(
        '[INS-004] each choice arrives once, cut down, in the attempt it was made in: a loop and the last decision',
        async () => {
          // Arrange
          const learner = await learnerOf();
          const play = await openXapiPlay(browser(), server, scenario(), learner);
          try {
            const steps = scenarioSteps(play);
            // Act: option 1, the loop back, option 0, then the last decision's option 1, which ends the scenario
            await steps.start();
            await steps.goOn();
            await steps.choose(1, true);
            await steps.goOn();
            await steps.choose(0, true);
            await steps.goOn();
            await steps.choose(1, false);
            await waitForStatements(received, learner, 5);
            // Assert
            const items = itemsFrom(received, learner);
            expect(lines(items, scenario()).sort()).toEqual(
              [
                'attempted root 1',
                'answered 02=1 1',
                'answered 02=0 1',
                'answered 05=1 1',
                'completed root 1',
              ].sort(),
            );
            expect(lines(items, scenario()).filter((line) => line.startsWith('answered 02'))).toEqual([
              'answered 02=1 1',
              'answered 02=0 1',
            ]);
            expect(new Set(items.map((item) => item.statementId)).size).toBe(5);
            expect(JSON.stringify(items)).not.toMatch(/actor|mailto|en-US|samlinga|description|choices/i);
            expect(items.find((item) => lines([item], scenario())[0] === 'answered 05=1 1')).toMatchObject({
              object: {
                id: `${scenario()}?subContentId=${DECISIONS[1]}`,
                definition: { interactionType: 'choice' },
              },
              result: { completion: true, response: '1' },
            });
          } finally {
            await play.close();
          }
        },
        PLAY_MS,
      );

      it(
        '[INS-004] the back button, a reload and «Start på nytt» send each new choice and no earlier one again',
        async () => {
          // Arrange
          const learner = await learnerOf();
          const play = await openXapiPlay(browser(), server, scenario(), learner);
          try {
            // Act: option 0, back to the decision, option 1; a reload, which resumes on node 3; the loop back and
            // option 0, on to the last decision's option 2; then a new run with option 1
            let steps = scenarioSteps(play);
            await steps.start();
            await steps.goOn();
            await steps.choose(0, true);
            await steps.back();
            await steps.choose(1, true);
            await waitForStatements(received, learner, 3);
            await waitForSavedState(play, server, learner);
            await play.reload();
            steps = scenarioSteps(play);
            await steps.goOn();
            await steps.choose(0, true);
            await steps.goOn();
            await steps.choose(2, false);
            await steps.restart();
            await steps.goOn();
            await steps.choose(1, true);
            await waitForStatements(received, learner, 8);
            // Assert: two page loads, each with its own first `attempted`; the second run is the second attempt
            const sent = lines(itemsFrom(received, learner), scenario());
            expect(sent.filter((line) => line.startsWith('answered'))).toEqual([
              'answered 02=0 1',
              'answered 02=1 1',
              'answered 02=0 1',
              'answered 05=2 1',
              'answered 02=1 2',
            ]);
            expect(sent.filter((line) => !line.startsWith('answered')).sort()).toEqual([
              'attempted root 1',
              'attempted root 1',
              'completed root 1',
            ]);
            expect(play.errors).toEqual([]);
          } finally {
            await play.close();
          }
        },
        PLAY_MS,
      );
    });
  });
});
