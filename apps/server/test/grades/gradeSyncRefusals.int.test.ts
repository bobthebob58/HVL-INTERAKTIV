/**
 * Integration tests for the sends the grade worker refuses before any request (D-104's amendments of 2026-11-04): a
 * line item URL whose origin is neither `CANVAS_ORIGINS` nor the platform's own, or plain http where https is
 * required, fails the job as `line-item-url` with no token asked for and no score posted; a URL on a configured
 * Canvas origin is sent to; and a job with no stored result left fails as `no-result`.
 *
 * Spec: LTI-012, DATA-002
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { runGradeSync } from '../../src/grades/gradeSyncRun.js';
import type { LineItemUrlRules } from '../../src/grades/lineItemUrlPolicy.js';
import { describeWithServices } from '../support/services.js';
import { at, openGradeBench, type BenchPlacement, type GradeBench } from './support/gradeBench.js';

describeWithServices('[LTI-012] grade sends refused before any request', () => {
  let bench: GradeBench;
  beforeAll(async () => {
    bench = await openGradeBench();
  }, 60_000);
  afterAll(() => bench.close());

  const canvas = () => bench.bed.mock.canvas;
  /** A placement with one queued result of 0.6 at minute 0, its line item moved to `lineItemUrl` if given. */
  async function queued(lineItemUrl?: string): Promise<BenchPlacement> {
    const { placement, learners } = await bench.placement();
    await bench.result(placement, learners[0]!, 1, 0.6, 0);
    if (lineItemUrl === undefined) return placement;
    await bench.bed.db.ltiPlacement.update({ where: { id: placement.id }, data: { lineItemUrl } });
    return { ...placement, lineItemUrl };
  }
  const run = (placement: BenchPlacement, lineItemRules?: LineItemUrlRules) =>
    runGradeSync(
      { ...bench.runDeps, ...(lineItemRules ? { lineItemRules } : {}), placementIds: [placement.id] },
      at(1),
    );

  it.each([
    ['another host', 'https://internal.example/api/lti/courses/1/line_items/1', undefined],
    ['a cloud metadata address', 'http://169.254.169.254/latest/meta-data/', undefined],
    ['the mock Canvas over http where https is required', undefined, { requireHttps: true }],
  ] as const)(
    '[LTI-012] fails the job as line-item-url, with no token or score request, for %s',
    async (_name, lineItemUrl, rules) => {
      // Arrange: a URL stored before the rule, or a server whose rules have changed since
      const placement = await queued(lineItemUrl);
      const tokens = canvas().tokens.requests.length;
      const posts = canvas().ags.scorePosts.length;
      // Act
      const counts = await run(placement, rules);
      // Assert: SECURITY: neither the token nor the learner's sub goes anywhere
      expect(counts).toMatchObject({ claimed: 1, failed: 1, sent: 0 });
      expect((await bench.jobs(placement))[0]).toMatchObject({
        status: 'failed',
        lastError: 'line-item-url',
      });
      expect(canvas().tokens.requests.length).toBe(tokens);
      expect(canvas().ags.scorePosts.length).toBe(posts);
    },
  );

  it('[LTI-012] sends to a line item on a configured Canvas origin', async () => {
    // Arrange: the mock Canvas is the platform's own origin; CANVAS_ORIGINS names it too
    const placement = await queued();
    const origin = new URL(placement.lineItemUrl).origin;
    // Act
    const counts = await run(placement, { origins: [origin] });
    // Assert
    expect(counts).toMatchObject({ sent: 1, succeeded: 1 });
  });

  it('[LTI-012] fails a job with no stored result left as no-result, unsent', async () => {
    // Arrange: a data-subject erasure removed the learner's statements after the job was written
    const placement = await queued();
    const [job] = await bench.jobs(placement);
    await bench.bed.db.xapiStatement.deleteMany({ where: { learnerKey: job!.learnerKey } });
    const posts = canvas().ags.scorePosts.length;
    // Act
    const counts = await run(placement);
    // Assert
    expect(counts).toMatchObject({ failed: 1, sent: 0 });
    expect((await bench.jobs(placement))[0]).toMatchObject({ status: 'failed', lastError: 'no-result' });
    expect(canvas().ags.scorePosts.length).toBe(posts);
  });
});
