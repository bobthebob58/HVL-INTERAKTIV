/**
 * Integration tests of the insight view gate through the API, on PostgreSQL: while every place is taken a second
 * view waits its turn, and when the line is full too the view and its CSV answer 503 `insight.busy` with
 * `Retry-After`, read nothing and are not audited.
 *
 * Spec: INS-001, INS-009, NFR-002
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Principal } from '../../../src/auth/Principal.js';
import { PrismaContentStorage } from '../../../src/h5p/storage/PrismaContentStorage.js';
import type { S3ContentFileStore } from '../../../src/h5p/storage/S3ContentFileStore.js';
import { InsightService } from '../../../src/insight/InsightService.js';
import type { GateLimits } from '../../../src/infra/BoundedGate.js';
import { InsightViewGate } from '../../../src/insight/InsightViewGate.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { NO_LIMIT } from '../../grades/status/support/gradeSyncApp.js';
import { describeWithServices } from '../../support/services.js';
import { FIXTURE_NOW } from '../fixtures/thirtyLearners.js';
import { OWN_PAGE_FETCH } from '../../support/ownPageFetch.js';
import { openInsightHttpBench, portalPrincipal, type InsightHttpBench } from './support/insightHttpBench.js';

describeWithServices('[INS-001] insight views past the gate', () => {
  let bench: InsightHttpBench;
  let owner: Principal;
  /** Lets the views that are being built go on; until then each holds its place. */
  let release: () => void = () => undefined;
  /** How many views have started to read. */
  let reading = 0;
  /** The insight core with its own gate, whose builds wait at the content store until `release` is called. */
  const servicesWith = (limits: GateLimits) => {
    const held = new Promise<void>((resolve) => (release = resolve));
    const storage = new PrismaContentStorage(bench.db, {} as S3ContentFileStore);
    const content = {
      getMetadata: (id: string) => storage.getMetadata(id),
      getParameters: async (id: string) => {
        reading += 1;
        await held;
        return storage.getParameters(id);
      },
    };
    const insight = new InsightService({
      db: bench.db,
      content,
      groupSize: minimumGroupSize(5),
      clock: () => FIXTURE_NOW,
      gate: new InsightViewGate(limits),
    });
    return { insight, limit: NO_LIMIT };
  };
  const until = async (check: () => boolean): Promise<void> => {
    for (let i = 0; i < 200 && !check(); i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    expect(check()).toBe(true);
  };
  beforeAll(async () => {
    bench = await openInsightHttpBench();
    owner = portalPrincipal(bench.ownerId);
  });
  afterAll(() => bench.close());

  it('[INS-009] with every place and the line taken, the view and its CSV answer 503 `insight.busy` with Retry-After', async () => {
    // Arrange: one place, nobody may wait; the first view holds the place
    reading = 0;
    const app = bench.appAs(owner, { services: servicesWith({ atOnce: 1, waiting: 0 }) });
    const get = (path: string) =>
      request(app).get(`/api/content/${bench.contentId}/insight${path}`).set(OWN_PAGE_FETCH);
    await bench.db.auditEvent.deleteMany({ where: { targetId: bench.contentId } });
    const first = get('?context=portal').then((res) => res);
    await until(() => reading === 1);
    // Act
    const view = await get('?context=portal');
    const csv = await get('/export?context=portal');
    release();
    const served = await first;
    // Assert: refused in the person's language, with the time to wait, and nothing read or audited for them
    expect([view.status, csv.status]).toEqual([503, 503]);
    expect(view.body).toMatchObject({ errorCode: 'insight.busy', httpStatusCode: 503 });
    expect(view.body.message).toContain('Vent litt og prøv igjen');
    expect([view.headers['retry-after'], csv.headers['retry-after']]).toEqual(['5', '5']);
    expect(csv.headers['content-type']).toContain('application/json');
    expect(reading).toBe(1);
    // Assert: the view that had the place is served, and the one audit entry is its
    expect(served.status).toBe(200);
    expect(await bench.db.auditEvent.count({ where: { targetId: bench.contentId } })).toBe(1);
  });

  it('[INS-001] a view that finds every place taken waits its turn and is then served', async () => {
    // Arrange: one place, one may wait
    reading = 0;
    const app = bench.appAs(owner, { services: servicesWith({ atOnce: 1, waiting: 1 }) });
    const get = () =>
      request(app).get(`/api/content/${bench.contentId}/insight?context=portal`).set(OWN_PAGE_FETCH);
    const first = get().then((res) => res);
    await until(() => reading === 1);
    const second = get().then((res) => res);
    // Act: the second view has not started to read while the first holds the place
    await new Promise((resolve) => setTimeout(resolve, 100));
    const readingWhileHeld = reading;
    release();
    const answers = await Promise.all([first, second]);
    // Assert
    expect(readingWhileHeld).toBe(1);
    expect(answers.map((res) => res.status)).toEqual([200, 200]);
    expect(answers[1]?.body).toEqual(answers[0]?.body);
    expect(reading).toBe(2);
  });
});
