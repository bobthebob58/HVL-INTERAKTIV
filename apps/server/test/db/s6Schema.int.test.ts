/**
 * Integration tests for migration `s6_grade_bridge_insight`: the academic year every purged table stores, the
 * platform-scoped course context the database enforces, the grade worker's columns and index, and the snapshot's
 * content version.
 *
 * Spec: DATA-003, DATA-012, LTI-012, PROD-013
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createPrismaClient } from '../../src/infra/prismaClient.js';
import { academicYearOf } from '../../src/privacy/academicYear.js';
import { describeWithServices, serviceEnv } from '../support/services.js';

const PURGED_TABLES = ['GradeSyncJob', 'H5PUserData', 'XapiStatement'];
const PLATFORM = '0192f0c4-0000-7000-8000-00000000aaaa';

type ColumnRow = {
  table_name: string;
  column_name: string;
  is_nullable: string;
  column_default: string | null;
};

describeWithServices('[DATA-003] migration s6_grade_bridge_insight', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  let owner: string;
  let contentId: string;
  const columns = (keys: string[]) => db.$queryRaw<ColumnRow[]>`
    SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND (table_name || '.' || column_name) = ANY(${keys})
    ORDER BY table_name, column_name`;

  beforeAll(async () => {
    owner = (await db.user.create({ data: { kind: 'staff' } })).id;
    const content = {
      mainLibrary: 'H5P.MultiChoice',
      title: 'S6',
      params: {},
      metadata: {},
      ownerUserId: owner,
    };
    contentId = (await db.h5PContent.create({ data: content })).id;
  });
  afterAll(async () => {
    await db.h5PContent.deleteMany({ where: { id: contentId } });
    await db.user.deleteMany({ where: { id: owner } });
    await db.$disconnect();
  });

  it('[DATA-003] every purged table has a required academic year whose default follows the server’s Oslo rule', async () => {
    // Arrange: the instants around the year boundary (1 August 00:00 Oslo time is 31 July 22:00 UTC in summer)
    const instants = ['2026-07-31T21:59:59.999Z', '2026-07-31T22:00:00.000Z', '2027-01-01T00:00:00.000Z'];
    // Act
    const rows = await columns(PURGED_TABLES.map((table) => `${table}.academicYear`));
    const years = await Promise.all(
      rows.flatMap((row) =>
        instants.map(async (at) => {
          // WHY: the default comes from the migration, not from input; `now()` is replaced by a fixed instant.
          const expression = (row.column_default ?? '').replace('now()', `'${at}'::timestamptz`);
          const [result] = await db.$queryRawUnsafe<{ year: number }[]>(`SELECT ${expression} AS year`);
          return result?.year;
        }),
      ),
    );
    // Assert
    expect(rows.map((row) => [row.table_name, row.is_nullable])).toEqual(PURGED_TABLES.map((t) => [t, 'NO']));
    expect(rows.every((row) => row.column_default?.includes('now()'))).toBe(true);
    const expected = instants.map((at) => academicYearOf(new Date(at)));
    expect(expected).toEqual([2025, 2026, 2026]);
    expect(years).toEqual([...expected, ...expected, ...expected]);
  });

  it('[DATA-003] a row written without a year gets the current academic year', async () => {
    // Act
    const row = await db.h5PUserData.create({
      data: { contentId, dataType: 'state', learnerKey: `k-${randomUUID()}`, data: {} },
    });
    // Assert
    expect(row.academicYear).toBe(academicYearOf(new Date()));
  });

  it('[DATA-012] a stored course context must be `<platformId>:<contextId>`; a bare Canvas ID is refused', async () => {
    // Arrange
    const statement = (contextId: string | null) =>
      db.xapiStatement.create({
        data: {
          contentId,
          contentVersion: 1,
          contextId,
          learnerKey: `k-${randomUUID()}`,
          verb: 'answered',
          attemptId: `${randomUUID()}:1`,
          timestamp: new Date(),
        },
      });
    const snapshot = (contextId: string) =>
      db.insightSnapshot.create({
        data: {
          contentId,
          contextId,
          contentVersion: 2,
          periodStart: new Date(),
          periodEnd: new Date(),
          k: 5,
          aggregates: {},
        },
      });
    // Act and assert
    await expect(statement(`${PLATFORM}:course-1`)).resolves.toMatchObject({
      contextId: `${PLATFORM}:course-1`,
    });
    await expect(statement(null)).resolves.toMatchObject({ contextId: null });
    await expect(statement('course-1')).rejects.toThrow(/XapiStatement_contextId_platform_scoped/);
    await expect(statement(`${PLATFORM}:`)).rejects.toThrow(/XapiStatement_contextId_platform_scoped/);
    await expect(snapshot(`${PLATFORM}:course-1`)).resolves.toMatchObject({ contentVersion: 2 });
    await expect(snapshot('course-1')).rejects.toThrow(/InsightSnapshot_contextId_platform_scoped/);
  });

  it('[LTI-012] a grade job has its attempt, result time, due time and stop time, and may be orphaned', async () => {
    // Arrange
    const platform = await db.ltiPlatform.create({
      data: {
        url: `https://canvas.s6.test/${randomUUID()}`,
        clientId: 'client',
        name: 'Test Canvas',
        authenticationEndpoint: 'https://canvas.s6.test/auth',
        accessTokenEndpoint: 'https://canvas.s6.test/token',
        idTokenValidationMethod: 'JWK_SET',
        idTokenValidationKey: 'https://canvas.s6.test/jwks',
        publicKey: 'public',
        privateKeyEncrypted: Buffer.from('encrypted'),
      },
    });
    try {
      const placement = await db.ltiPlacement.create({
        data: { platformId: platform.id, contextId: 'course-1', resourceLinkId: 'link-1', contentId },
      });
      const attemptId = `${randomUUID()}:1`;
      // Act
      const job = await db.gradeSyncJob.create({
        data: {
          placementId: placement.id,
          learnerKey: 'k',
          attemptId,
          scoreGiven: 80,
          resultAt: new Date(),
          idempotencyKey: `${placement.id}:k:${attemptId}`,
        },
      });
      const orphaned = await db.gradeSyncJob.update({
        where: { id: job.id },
        data: { status: 'orphaned', nextAttemptAt: null, terminalAt: new Date() },
      });
      // Assert: a new job is pending and due at once; an orphaned one is due never
      expect(job).toMatchObject({
        status: 'pending',
        attempts: 0,
        terminalAt: null,
        academicYear: academicYearOf(),
      });
      expect(job.nextAttemptAt).toBeInstanceOf(Date);
      expect(orphaned).toMatchObject({ status: 'orphaned', nextAttemptAt: null });
    } finally {
      await db.ltiPlatform.delete({ where: { id: platform.id } });
    }
  });

  it('[LTI-012] the worker’s due-job claim and the per-placement counts have indexes', async () => {
    // Act
    const rows = await db.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'GradeSyncJob'`;
    const definitions = Object.fromEntries(rows.map((row) => [row.indexname, row.indexdef]));
    // Assert: PostgreSQL quotes only the camel-case column names
    expect(definitions['GradeSyncJob_status_nextAttemptAt_idx']).toContain('(status, "nextAttemptAt")');
    expect(definitions['GradeSyncJob_placementId_learnerKey_idx']).toContain('("placementId", "learnerKey")');
    expect(definitions['GradeSyncJob_placementId_status_idx']).toContain('("placementId", status)');
    expect(definitions['GradeSyncJob_terminalAt_idx']).toContain('("terminalAt")');
    expect(definitions['GradeSyncJob_academicYear_idx']).toContain('("academicYear")');
  });

  it('[PROD-013] the new grade and snapshot columns are required where a job or a snapshot cannot do without them', async () => {
    // Act
    const rows = await columns([
      'GradeSyncJob.attemptId',
      'GradeSyncJob.resultAt',
      'GradeSyncJob.nextAttemptAt',
      'GradeSyncJob.terminalAt',
      'InsightSnapshot.contentVersion',
    ]);
    // Assert
    expect(rows.map((row) => [`${row.table_name}.${row.column_name}`, row.is_nullable])).toEqual([
      ['GradeSyncJob.attemptId', 'NO'],
      ['GradeSyncJob.nextAttemptAt', 'YES'],
      ['GradeSyncJob.resultAt', 'NO'],
      ['GradeSyncJob.terminalAt', 'YES'],
      ['InsightSnapshot.contentVersion', 'NO'],
    ]);
  });
});
