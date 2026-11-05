/**
 * Integration tests for data-subject erasure on PostgreSQL (DATA-008 as D-108 and its amendment of 2026-11-04 build
 * it): the dry run counts and deletes nothing; a run that fails part-way is audited with what it deleted; the confirmed
 * erasure deletes the learner's rows in both academic years, H5P state through our own storage, her learner identities
 * and accounts, and leaves the other learner, the year without a secret and the operator's staff account alone; a
 * second run finds nothing.
 *
 * Spec: DATA-008, DATA-007, H5P-005
 */
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { PrismaContentUserDataStorage } from '../../../src/h5p/storage/PrismaContentUserDataStorage.js';
import type { Database } from '../../../src/infra/prismaClient.js';
import { runDataSubjectRequest, type DsrResult } from '../../../src/privacy/dsr/dataSubjectRequest.js';
import { DSR_ERASE_ACTION } from '../../../src/privacy/dsr/dsrAudit.js';
import type { DataSubject } from '../../../src/privacy/dsr/dataSubject.js';
import { describeWithServices } from '../../support/services.js';
import { openDsrFixture, type DsrFixture } from './support/dsrFixture.js';

const KARI_ROWS = { xapiStatements: 5, h5pUserData: 3, gradeSyncJobs: 2 };
const OLA_ROWS = { xapiStatements: 4, h5pUserData: 2, gradeSyncJobs: 1 };
const NOTHING = {
  gradeSyncJobs: 0,
  xapiStatements: 0,
  h5pUserData: 0,
  learnerIdentities: 0,
  learnerUsers: 0,
};

/** The database, except that deleting statements fails, as a lost connection would. */
const failingAtStatementDeletes = (db: Database): Database =>
  new Proxy(db, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop);
      if (prop !== 'xapiStatement') {
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      }
      return new Proxy(target.xapiStatement, {
        get: (statements, method) =>
          method === 'deleteMany'
            ? () => Promise.reject(new Error('connection lost'))
            : (Reflect.get(statements, method) as unknown),
      });
    },
  });

/** The summary of a completed run. */
const summaryOf = (result: DsrResult) => {
  if (result.outcome !== 'completed') throw new Error(`the run was ${result.outcome}`);
  return result.summary;
};

describeWithServices('[DATA-008] data-subject erasure on PostgreSQL', () => {
  let fx: DsrFixture;
  beforeAll(async () => {
    fx = await openDsrFixture();
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => fx.close());

  const erase = (subject: DataSubject, confirm: boolean, db: Database = fx.db) =>
    runDataSubjectRequest(
      { ...fx.deps, db },
      { action: 'erase', operatorFeideId: fx.operator.feideId, confirm, subject },
    );
  const accountsLeft = () => fx.db.user.count({ where: { id: { in: [...fx.kariAccounts] } } });

  it('[DATA-008] an erasure without --confirm counts what it would delete and deletes nothing', async () => {
    // Act
    const summary = summaryOf(await erase(fx.kari, false));
    // Assert
    expect(summary).toMatchObject({ action: 'erase', dryRun: true, staffAccounts: 0, otherIdentities: 1 });
    expect(summary.counts).toEqual({ ...KARI_ROWS, learnerIdentities: 2, learnerUsers: 1 });
    expect(await fx.rowsOf(fx.kari)).toEqual(KARI_ROWS);
    expect(await accountsLeft()).toBe(2);
  });

  it('[DATA-008] an erasure that fails part-way is audited as failed with what it deleted, then rethrows', async () => {
    // Act
    const run = erase(fx.kari, true, failingAtStatementDeletes(fx.db));
    // Assert
    await expect(run).rejects.toThrow('connection lost');
    const requestId = fx.requestIds.at(-1) ?? '';
    const event = await fx.db.auditEvent.findFirstOrThrow({ where: { targetId: requestId } });
    expect(event).toMatchObject({ action: DSR_ERASE_ACTION, actorUserId: fx.operator.userId });
    expect(event.details).toMatchObject({
      dryRun: false,
      outcome: 'failed',
      counts: { ...NOTHING, gradeSyncJobs: 2 },
    });
    expect(await fx.rowsOf(fx.kari)).toEqual({ ...KARI_ROWS, gradeSyncJobs: 0 });
  });

  it('[DATA-008] a confirmed erasure deletes the rest of her rows in both years, through our storage, and her identities', async () => {
    // Arrange
    const storageDeletes = vi.spyOn(PrismaContentUserDataStorage.prototype, 'deleteAllContentUserDataByUser');
    // Act
    const summary = summaryOf(await erase(fx.kari, true));
    // Assert
    expect(summary).toMatchObject({ dryRun: false, remaining: NOTHING });
    expect(summary.counts).toEqual({ ...KARI_ROWS, gradeSyncJobs: 0, learnerIdentities: 2, learnerUsers: 1 });
    expect(await fx.rowsOf(fx.kari)).toEqual({ xapiStatements: 0, h5pUserData: 0, gradeSyncJobs: 0 });
    // The Canvas account keeps the identity the request did not name, so it stays (D-034); the Feide account goes.
    expect(await accountsLeft()).toBe(1);
    expect(await fx.db.identity.count({ where: { userId: fx.kariAccounts[0] } })).toBe(1);
    // H5P state went through PrismaContentUserDataStorage with each key's state view, never Lumi's manager (D-108).
    const viewed = storageDeletes.mock.calls.map(([user]) => [
      user.id.length,
      (user as { view?: string }).view,
    ]);
    expect(viewed).toEqual(Array(3).fill([43, 'state']));
    const event = await fx.db.auditEvent.findFirstOrThrow({ where: { targetId: summary.requestId } });
    expect(event.details).toMatchObject({ outcome: 'completed', counts: summary.counts, remaining: NOTHING });
  });

  it('[DATA-008] the other learner, the year without a secret and the operator’s own account stay', async () => {
    // Act
    const left = {
      ola: await fx.rowsOf(fx.ola),
      olaAccount: await fx.db.user.count({ where: { id: fx.olaAccount } }),
      of2039: await fx.db.xapiStatement.count({ where: { contentId: fx.contentId, academicYear: 2039 } }),
      operator: await fx.db.user.count({ where: { id: fx.operator.userId, kind: 'staff' } }),
    };
    // Assert
    expect(left).toEqual({ ola: OLA_ROWS, olaAccount: 1, of2039: 1, operator: 1 });
  });

  it('[DATA-008] a second erasure finds nothing, and is audited like the first', async () => {
    // Act
    const summary = summaryOf(await erase(fx.kari, true));
    // Assert
    expect(summary.counts).toEqual(NOTHING);
    expect(
      await fx.db.auditEvent.count({ where: { targetId: summary.requestId, action: DSR_ERASE_ACTION } }),
    ).toBe(1);
  });

  it('[DATA-008] a staff member’s own account is out of scope: counted, never exported or deleted', async () => {
    // Arrange
    const staff = { feideId: fx.operator.feideId, lti: [] };
    // Act
    const erased = summaryOf(await erase(staff, true));
    const exported = await runDataSubjectRequest(fx.deps, {
      action: 'export',
      operatorFeideId: fx.operator.feideId,
      confirm: false,
      subject: staff,
    });
    // Assert
    expect(erased).toMatchObject({ staffAccounts: 1, counts: NOTHING });
    expect(await fx.db.identity.count({ where: { userId: fx.operator.userId } })).toBe(1);
    if (exported.outcome !== 'completed' || !exported.document) throw new Error('export did not complete');
    expect([exported.document.identities, exported.document.accounts, exported.document.authEvents]).toEqual([
      [],
      [],
      [],
    ]);
  });
});
