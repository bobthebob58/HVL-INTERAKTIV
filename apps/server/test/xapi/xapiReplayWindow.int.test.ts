/**
 * Integration test of the replay history as a bounded read (D-121): however many rows one learner stored for a
 * page load, the ingestion reads at most the window, and the replay rule still gets the latest facts right.
 *
 * Spec: DATA-012
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ReplayState } from '../../src/xapi/xapiReplayRule.js';
import { REPLAY_WINDOW_ROWS, XapiStatementStore } from '../../src/xapi/XapiStatementStore.js';
import { describeWithServices } from '../support/services.js';
import { openXapiBench, type XapiBench } from './support/xapiBench.js';

describeWithServices('[DATA-012] the replay history is a bounded read', () => {
  let bench: XapiBench;
  beforeAll(async () => {
    bench = await openXapiBench();
  });
  afterAll(() => bench.close());

  it('[DATA-012] reads at most the window of a learner’s rows, and the rule still sees the latest result and answer', async () => {
    // Arrange: 5 000 answers of one page load, then a root result, then one more answer
    const contentId = await bench.activity('H5P.QuestionSet 1.21');
    const [learnerKey, view, part] = [`learner-${randomUUID()}`, randomUUID(), randomUUID()];
    const start = Date.now() - 60 * 60 * 1000;
    const row = (n: number, verb: string, subContentId: string | null, scoreRaw: number | null = null) => ({
      contentId,
      contentVersion: 1,
      contextId: null,
      learnerKey,
      attemptId: `${view}:1`,
      timestamp: new Date(start + n),
      verb,
      subContentId,
      scoreRaw,
      scoreMax: scoreRaw === null ? null : 10,
    });
    const answers = Array.from({ length: 5000 }, (_, n) => row(n, 'answered', part));
    await bench.db.xapiStatement.createMany({
      data: [...answers, row(5000, 'completed', null, 7), row(5001, 'answered', part)],
    });
    const scope = { learnerKey, contentId, contextId: null, contentVersion: 1 };
    // Act
    const started = performance.now();
    const history = await new XapiStatementStore(bench.db).replayHistory(scope, [view]);
    const elapsed = performance.now() - started;
    const sameScoreAgain = {
      attemptId: `${view}:1`,
      verb: 'completed',
      subContentId: null,
      scoreRaw: 7,
      scoreMax: 10,
    };
    // Assert
    expect(history.viewRows.length).toBeLessThanOrEqual(REPLAY_WINDOW_ROWS);
    expect(history.latestResult).toEqual({ scoreRaw: 7, scoreMax: 10 });
    expect(history.viewRows.at(-1)).toMatchObject({ verb: 'answered', subContentId: part });
    expect(new ReplayState(history).isReplay(sameScoreAgain)).toBe(false);
    expect(elapsed).toBeLessThan(1000);
    expect(REPLAY_WINDOW_ROWS).toBe(500);
  });
});
