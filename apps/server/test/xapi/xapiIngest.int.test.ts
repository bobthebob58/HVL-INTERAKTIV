/**
 * Integration tests of the xAPI ingestion on PostgreSQL: a learner's statements stored once each with the server's
 * facts (context, version, academic year), non-learners storing nothing, and the listener after commit.
 *
 * Spec: LTI-011, DATA-012, LTI-012
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithServices } from '../support/services.js';
import { fixturePlay, rowLine } from './support/xapiBridgeItems.js';
import { openXapiBench, type XapiBench } from './support/xapiBench.js';

const PLATFORM = '0192f0c4-6666-7000-8000-0000000000aa';
const MC = 'H5P.MultiChoice 1.16';

describeWithServices('[LTI-011] storing xAPI statements', () => {
  let bench: XapiBench;
  beforeAll(async () => {
    bench = await openXapiBench();
  });
  afterAll(() => bench.close());

  const post = (header: [string, string], body: unknown) =>
    request(bench.app)
      .post('/api/h5p/xapi')
      .set(...header)
      .send(body as object);
  const batch = (contentId: string, statements: unknown[], contentVersion = 1) => ({
    contentId,
    contentVersion,
    statements,
  });

  it('[LTI-011] answers 202 with no body and stores a portal learner’s statements with no context', async () => {
    // Arrange
    const contentId = await bench.activity(MC);
    const { header, principal } = await bench.principal('learner', { learnerKeyYear: 2026 });
    const view = fixturePlay('H5P.MultiChoice', contentId).views[0];
    // Act
    const res = await post(header, batch(contentId, view?.statements ?? []));
    // Assert
    const rows = await bench.rowsOf(contentId);
    expect([res.status, res.text]).toEqual([202, '']);
    expect(rows.map(rowLine)).toEqual(['attempted root #1', 'answered root 1/1 #1']);
    expect(rows.every((row) => row.contextId === null && row.learnerKey === principal.learnerKey)).toBe(true);
  });

  it('[DATA-012] stores an LTI learner’s statements under the platform-scoped course of the launch (D-103)', async () => {
    // Arrange
    const contentId = await bench.activity(MC);
    const lti = { platformId: PLATFORM, deploymentId: 'd', contextId: 'course-42', contentId };
    const { header, principal } = await bench.principal('learner', {
      mode: 'lti',
      hvlMember: false,
      feideAuthenticated: false,
      lti: { ...lti, messageType: 'LtiResourceLinkRequest' },
    });
    const statements = fixturePlay('H5P.MultiChoice', contentId).views[0]?.statements ?? [];
    const before = bench.calls.length;
    // Act
    await post(header, batch(contentId, statements));
    // Assert
    const rows = await bench.rowsOf(contentId);
    expect(rows.map((row) => row.contextId)).toEqual([`${PLATFORM}:course-42`, `${PLATFORM}:course-42`]);
    // PRIVACY: the `sub` reaches the grade enqueuer beside the rows, never inside them (D-104).
    expect(bench.calls[before]?.request.ltiSubject).toBe(`sub-of-${principal.userId}`);
    expect(JSON.stringify(rows)).not.toContain('sub-of-');
  });

  it('[DATA-012] stamps rows with the server’s time and the year of the session’s key, not the day’s (D-107)', async () => {
    // Arrange
    const contentId = await bench.activity(MC);
    const { header } = await bench.principal('learner', { learnerKeyYear: 2025 });
    bench.now = new Date('2026-08-01T06:00:00.000Z');
    const statements = fixturePlay('H5P.MultiChoice', contentId).views[0]?.statements ?? [];
    // Act
    await post(header, batch(contentId, statements));
    bench.now = undefined;
    // Assert
    const rows = await bench.rowsOf(contentId);
    expect(rows.map((row) => row.academicYear)).toEqual([2025, 2025]);
    expect(rows.map((row) => row.timestamp.toISOString())).toEqual([
      '2026-08-01T06:00:00.000Z',
      '2026-08-01T06:00:00.002Z',
    ]);
  });

  it('[DATA-012] labels the statements with the version the page was rendered with, up to the current one', async () => {
    // Arrange
    const contentId = await bench.activity(MC, { version: 3 });
    const { header } = await bench.principal('learner');
    const [first, , second] = fixturePlay('H5P.MultiChoice', contentId).views[0]?.statements ?? [];
    // Act
    const older = await post(header, batch(contentId, [first], 2));
    const future = await post(header, batch(contentId, [second], 4));
    // Assert
    expect([older.status, future.status]).toEqual([202, 400]);
    expect((await bench.rowsOf(contentId)).map((row) => row.contentVersion)).toEqual([2]);
  });

  it('[LTI-011] stores each statement once when a batch is resent, and tells the listener only once', async () => {
    // Arrange
    const contentId = await bench.activity('H5P.QuestionSet 1.21');
    const { header, principal } = await bench.principal('learner');
    const statements =
      fixturePlay('H5P.QuestionSet', contentId, { bridgeOnly: true }).views[0]?.statements ?? [];
    const before = bench.calls.length;
    // Act
    const first = await post(header, batch(contentId, statements));
    const resent = await post(header, batch(contentId, statements));
    // Assert
    const calls = bench.calls.slice(before);
    expect([first.status, resent.status]).toEqual([202, 202]);
    expect(await bench.rowsOf(contentId)).toHaveLength(6);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.rows.map(rowLine)).toEqual((await bench.rowsOf(contentId)).map(rowLine));
    expect(calls[0]?.committed).toBe(6);
    expect(calls[0]?.principal.learnerKey).toBe(principal.learnerKey);
    expect(calls[0]?.request.ltiSubject).toBeUndefined();
  });

  it.each(['author', 'admin'] as const)(
    '[LTI-011] answers an %s’s batch 202 like a learner’s and stores nothing (D-102)',
    async (role) => {
      // Arrange
      const contentId = await bench.activity(MC);
      const { header } = await bench.principal(role);
      const before = bench.calls.length;
      // Act
      const res = await post(
        header,
        batch(contentId, fixturePlay('H5P.MultiChoice', contentId).views[0]?.statements ?? []),
      );
      // Assert
      expect([res.status, res.text]).toEqual([202, '']);
      expect(await bench.rowsOf(contentId)).toEqual([]);
      expect(bench.calls.length).toBe(before);
    },
  );

  it('[LTI-012] keeps the batch stored when the listener fails, and logs the failure without the learner', async () => {
    // Arrange
    const contentId = await bench.activity(MC);
    const { header, principal } = await bench.principal('learner');
    bench.listenerFails = true;
    // Act
    const res = await post(
      header,
      batch(contentId, fixturePlay('H5P.MultiChoice', contentId).views[0]?.statements ?? []),
    );
    bench.listenerFails = false;
    // Assert
    expect(res.status).toBe(202);
    expect(await bench.rowsOf(contentId)).toHaveLength(2);
    expect(bench.logs.some((line) => line.includes('xapi.listener.failed'))).toBe(true);
    expect(bench.logs.join('\n')).not.toContain(principal.learnerKey);
  });

  it('[LTI-011] refuses an activity the learner may not view, a draft and an unknown one alike with 403', async () => {
    // Arrange
    const draft = await bench.activity(MC, { status: 'draft' });
    const { header } = await bench.principal('learner');
    const statements = fixturePlay('H5P.MultiChoice', draft).views[0]?.statements ?? [];
    // Act
    const res = await post(header, batch(draft, statements));
    const unknown = await post(header, batch(randomUUID(), statements));
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([403, 'error.forbidden']);
    expect([unknown.status, unknown.body.errorCode]).toEqual([403, 'error.forbidden']);
    expect(await bench.rowsOf(draft)).toEqual([]);
  });
});
