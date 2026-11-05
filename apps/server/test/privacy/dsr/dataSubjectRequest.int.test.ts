/**
 * Integration tests for data-subject export and refusals on PostgreSQL (DATA-008 as D-108 and its amendment of
 * 2026-11-04 build it): an export finds a learner's rows in two academic years under both pseudonym variants and
 * nothing of another learner, leaves out the encrypted sub and every identifier the request gave, and is audited with
 * the operator and counts under a random request ID; a non-admin is refused before any learner row is read; without
 * pseudonym secrets nothing runs.
 *
 * Spec: DATA-008, DATA-007, DATA-002
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Database } from '../../../src/infra/prismaClient.js';
import { runDataSubjectRequest } from '../../../src/privacy/dsr/dataSubjectRequest.js';
import { DSR_EXPORT_ACTION, DSR_TARGET_TYPE } from '../../../src/privacy/dsr/dsrAudit.js';
import { NoPseudonymSecretsError, deriveSubjectKeys } from '../../../src/privacy/dsr/subjectKeys.js';
import { describeWithServices } from '../../support/services.js';
import { openDsrFixture, type DsrFixture } from './support/dsrFixture.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The database, except that any learner table throws when touched; `seen` collects every identity query's args. */
const withoutLearnerTables = (db: Database, seen: unknown[]): Database =>
  new Proxy(db, {
    get(target, prop) {
      if (['xapiStatement', 'h5PUserData', 'gradeSyncJob'].includes(String(prop))) {
        throw new Error(`learner table ${String(prop)} was touched`);
      }
      if (prop === 'identity') {
        return new Proxy(target.identity, {
          get: (identities, method) => {
            const call: unknown = Reflect.get(identities, method);
            if (typeof call !== 'function') return call;
            return (...args: unknown[]) => (
              seen.push(args),
              Reflect.apply(call, identities, args) as unknown
            );
          },
        });
      }
      const value: unknown = Reflect.get(target, prop);
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });

describeWithServices('[DATA-008] data-subject export and refusals on PostgreSQL', () => {
  let fx: DsrFixture;
  beforeAll(async () => {
    fx = await openDsrFixture();
  });
  afterAll(() => fx.close());

  const exportKari = () =>
    runDataSubjectRequest(fx.deps, {
      action: 'export',
      operatorFeideId: fx.operator.feideId,
      confirm: false,
      subject: fx.kari,
    });

  it('[DATA-008] an export finds the learner’s rows in both years under both variants, and none of another learner', async () => {
    // Act
    const result = await exportKari();
    // Assert: Kari's Canvas identity is under the ring's older key and is found too (D-055).
    if (result.outcome !== 'completed' || !result.document) throw new Error('export did not complete');
    const doc = result.document;
    expect(result.summary.counts).toEqual({
      xapiStatements: 5,
      h5pUserData: 3,
      gradeSyncJobs: 2,
      learnerIdentities: 2,
      learnerUsers: 2,
      authEvents: 1,
    });
    expect(doc.pseudonyms.map((p) => [p.academicYear, p.variant])).toEqual([
      [2040, 'feide'],
      [2040, 'lti'],
      [2041, 'feide'],
      [2041, 'lti'],
    ]);
    const kariKeys = new Set(doc.pseudonyms.map((p) => p.learnerKey));
    const rows = [...doc.xapiStatements, ...doc.h5pUserData, ...doc.gradeSyncJobs] as {
      learnerKey: string;
    }[];
    expect(rows.every((row) => kariKeys.has(row.learnerKey))).toBe(true);
    expect(new Set((doc.xapiStatements as { academicYear: number }[]).map((s) => s.academicYear))).toEqual(
      new Set([2040, 2041]),
    );
    expect((doc.accounts as { id: string }[]).map((a) => a.id).sort()).toEqual([...fx.kariAccounts].sort());
    expect(await fx.rowsOf(fx.ola)).toEqual({ xapiStatements: 4, h5pUserData: 2, gradeSyncJobs: 1 });
  });

  it('[DATA-008] the export leaves out the encrypted sub, names the course as D-103’s string and holds no identifier the request gave', async () => {
    // Act
    const result = await exportKari();
    // Assert
    if (result.outcome !== 'completed' || !result.document) throw new Error('export did not complete');
    const jobs = result.document.gradeSyncJobs as Record<string, unknown>[];
    const shown = jobs.map((job) => [job.course, job.ltiSubStored, 'ltiSubEncrypted' in job]);
    expect(shown.sort((a, b) => Number(b[1]) - Number(a[1]))).toEqual([
      [fx.course, true, false],
      [fx.course, false, false],
    ]);
    const text = JSON.stringify(result.document);
    for (const value of [
      fx.kari.feideId ?? '',
      fx.kari.lti[0]?.subject ?? '',
      fx.kari.lti[0]?.issuer ?? '',
    ]) {
      expect(text).not.toContain(value);
    }
  });

  it('[DATA-008] an export is audited with the operator, the action and counts only, under a random request ID', async () => {
    // Act
    const result = await exportKari();
    // Assert
    if (result.outcome !== 'completed' || !result.document) throw new Error('export did not complete');
    const event = await fx.db.auditEvent.findFirstOrThrow({ where: { targetId: result.summary.requestId } });
    expect(event).toMatchObject({
      actorUserId: fx.operator.userId,
      action: DSR_EXPORT_ACTION,
      targetType: DSR_TARGET_TYPE,
    });
    expect(event.targetId).toMatch(UUID);
    expect(event.details).toEqual({
      dryRun: true,
      outcome: 'completed',
      years: [2040, 2041],
      identifiers: { feide: 1, lti: 1 },
      counts: result.summary.counts,
      // One stored row of each of these years, one per table, and no secret for them.
      unreachableYears: expect.arrayContaining([2037, 2038, 2039]) as unknown,
    });
    expect((event.details as { unreachableYears: number[] }).unreachableYears).not.toContain(2040);
    const stored = JSON.stringify(event);
    const secrets = [fx.kari.feideId ?? '', fx.kari.lti[0]?.subject ?? ''];
    for (const value of [...secrets, ...result.document.pseudonyms.map((p) => p.learnerKey)]) {
      expect(stored).not.toContain(value);
    }
  });

  it.each([
    ['someone who is not in ADMIN_FEIDE_IDS', () => 'not-listed@hvl.no', 'not-an-admin'],
    ['a listed admin without a staff account', () => fx.deps.adminFeideIds[1] ?? '', 'no-staff-account'],
    ['a listed Feide ID whose account is a learner’s', () => fx.kari.feideId ?? '', 'no-staff-account'],
  ])(
    '[DATA-008] a request by %s is refused, audited without an actor, and reads no learner row',
    async (_, who, reason) => {
      // Arrange: Kari is listed too, but her Feide identity belongs to a learner account, not a staff one.
      const adminFeideIds = [...fx.deps.adminFeideIds, fx.kari.feideId ?? ''];
      const seen: unknown[] = [];
      // Act
      const result = await runDataSubjectRequest(
        { ...fx.deps, adminFeideIds, db: withoutLearnerTables(fx.db, seen) },
        { action: 'erase', operatorFeideId: who(), confirm: true, subject: fx.kari },
      );
      // Assert: no identity query carried her Canvas identity's hashes (an operator is a Feide ID, never a Canvas one).
      const canvasHashes = deriveSubjectKeys(fx.kari, fx.deps.secrets, fx.deps.hasher).identityHashes.lti;
      for (const hash of canvasHashes) expect(JSON.stringify(seen)).not.toContain(hash);
      expect(result).toEqual({
        outcome: 'refused',
        requestId: expect.stringMatching(UUID) as unknown,
        reason,
      });
      if (result.outcome !== 'refused') return;
      const event = await fx.db.auditEvent.findFirstOrThrow({ where: { targetId: result.requestId } });
      expect(event.actorUserId).toBeNull();
      expect(event.details).toMatchObject({ dryRun: false, outcome: 'refused', counts: {} });
      expect(await fx.rowsOf(fx.kari)).toEqual({ xapiStatements: 5, h5pUserData: 3, gradeSyncJobs: 2 });
    },
  );

  it('[DATA-008] without a configured pseudonym secret the request refuses before the database is touched', async () => {
    // Arrange
    const untouchable = new Proxy({} as Database, {
      get: () => {
        throw new Error('the database was touched');
      },
    });
    // Act
    const run = runDataSubjectRequest(
      { ...fx.deps, db: untouchable, secrets: new Map() },
      { action: 'export', operatorFeideId: fx.operator.feideId, confirm: false, subject: fx.kari },
    );
    // Assert
    await expect(run).rejects.toBeInstanceOf(NoPseudonymSecretsError);
  });
});
