/**
 * Integration tests for a learner who floods the grade queue (the step-3 security review, finding 1; D-104's
 * amendment of 2026-11-04): 120 made-up results a minute, each its own attempt, stay one job, whose send reads them
 * all, so another learner's score still goes in the same run; and a learner who keeps posting while scores are sent
 * goes to the back of the queue, behind every learner who was waiting.
 *
 * Spec: LTI-012
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { AgsScoreRequest } from '../../src/grades/AgsScoreClient.js';
import { runGradeSync } from '../../src/grades/gradeSyncRun.js';
import { describeWithServices } from '../support/services.js';
import { at, openGradeBench, type BenchPlacement, type GradeBench } from './support/gradeBench.js';

describeWithServices('[LTI-012] a learner who floods the grade queue', () => {
  let bench: GradeBench;
  beforeAll(async () => {
    bench = await openGradeBench();
  }, 60_000);
  afterAll(() => bench.close());

  const sentTo = (placement: BenchPlacement) =>
    bench.bed.mock.canvas.ags.scores
      .filter((score) => score.lineItemUrl === placement.lineItemUrl)
      .map((score) => [score.score.userId, score.score.scoreGiven]);

  it('[LTI-012] keeps 120 results of one learner in a minute as one job and sends another learner’s score in the same run', async () => {
    // Arrange: Kari stores LTI-011's 120 statements a minute as made-up results, each a new attempt; Ola one, after
    const { placement, learners } = await bench.placement({ learners: 2 });
    const [kari, ola] = learners;
    for (let i = 0; i < 120; i += 1) await bench.result(placement, kari!, i + 1, (i % 10) / 10, i / 120);
    await bench.result(placement, ola!, 1, 0.7, 0.75);
    // Act: a run that may claim only two jobs
    const counts = await runGradeSync(
      { ...bench.runDeps, claimLimit: 2, placementIds: [placement.id] },
      at(1),
    );
    // Assert: one job each; Kari's best of all 120 is sent, and Ola is not held back
    expect(await bench.jobs(placement)).toHaveLength(2);
    expect(counts).toMatchObject({ claimed: 2, sent: 2, succeeded: 2 });
    expect(sentTo(placement)).toEqual(
      expect.arrayContaining([
        [kari!.sub, 90],
        [ola!.sub, 70],
      ]),
    );
  });

  it('[LTI-012] sends a learner who keeps posting during the sends after everyone who was waiting', async () => {
    // Arrange: one claim a run; Kari's job is the oldest, and she stores a new result while her score is sent
    const { placement, learners } = await bench.placement({ learners: 3, policy: 'latest' });
    const [kari, ola, per] = learners;
    await bench.result(placement, kari!, 1, 0.1, 0);
    await bench.result(placement, ola!, 1, 0.5, 0.2);
    await bench.result(placement, per!, 1, 0.6, 0.6);
    const sender = bench.runDeps.sender;
    let attempt = 1;
    const flooding = {
      postScore: async (request: AgsScoreRequest) => {
        if (request.userId === kari!.sub) await bench.result(placement, kari!, (attempt += 1), 1, 1);
        return sender.postScore(request);
      },
    };
    const run = (minute: number) =>
      runGradeSync(
        { ...bench.runDeps, sender: flooding, claimLimit: 1, placementIds: [placement.id] },
        at(minute),
      );
    // Act
    const runs = [await run(1), await run(2), await run(3), await run(4)];
    // Assert: Kari first (the oldest), then Ola and Per, who were waiting, then Kari's new results
    expect(runs.map((counts) => counts.claimed)).toEqual([1, 1, 1, 1]);
    expect(sentTo(placement)).toEqual([
      [kari!.sub, 10],
      [ola!.sub, 50],
      [per!.sub, 60],
      [kari!.sub, 100],
    ]);
  });
});
