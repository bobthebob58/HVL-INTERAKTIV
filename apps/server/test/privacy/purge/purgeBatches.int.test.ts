/**
 * Integration tests for the yearly purge's batches on PostgreSQL (D-107's amendment of 2026-11-04, step 5 review), in
 * the academic years 2007 (ended) and 2008: a table larger than one batch is deleted to its last row, also when
 * another writer (an activity deleted with its statements, a second run) takes a batch's rows first; a batch that can
 * delete nothing fails the run instead of looping or ending it as if it were done.
 *
 * Spec: DATA-003
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createPrismaClient, type Database } from '../../../src/infra/prismaClient.js';
import { purgeScopeAt } from '../../../src/privacy/purge/purgeCalendar.js';
import {
  PURGE_BATCH_SIZE,
  deletePurgeRows,
  emptyTableCounts,
} from '../../../src/privacy/purge/purgeTables.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';
import { clearPurgeYears } from './support/purgeFixture.js';
import { withStatementDeletes } from './support/statementDeletes.js';

/** More than two batches. */
const ROWS = 2 * PURGE_BATCH_SIZE + 500;
/** Midnight in Oslo on 31 August 2008. */
const RUNS_AT = new Date('2008-08-30T22:00:00.000Z');

describeWithServices('[DATA-003] the yearly purge’s batches', () => {
  let db: Database;
  let ownerId: string;
  let contentId: string;
  beforeAll(async () => {
    db = createPrismaClient(serviceEnv().DATABASE_URL);
    await clearPurgeYears(db, 2008);
    ownerId = (await db.user.create({ data: { kind: 'staff' } })).id;
    const content = await db.h5PContent.create({
      data: {
        mainLibrary: 'H5P.MultiChoice',
        title: 'Batches',
        params: {},
        metadata: {},
        ownerUserId: ownerId,
      },
    });
    contentId = content.id;
  });
  beforeEach(async () => {
    await db.xapiStatement.deleteMany({ where: { contentId } });
    await db.xapiStatement.createMany({
      data: Array.from({ length: ROWS }, (_, i) => ({
        contentId,
        contentVersion: 1,
        learnerKey: `batches-${i}`,
        verb: 'attempted',
        attemptId: `${randomUUID()}:1`,
        timestamp: new Date(Date.UTC(2007, 9, 1, 8, 0, i)),
        academicYear: 2007,
      })),
    });
  });
  afterAll(async () => {
    await clearPurgeYears(db, 2008);
    await db.h5PContent.deleteMany({ where: { id: contentId } });
    await db.user.deleteMany({ where: { id: ownerId } });
    await db.$disconnect();
  });

  const left = () => db.xapiStatement.count({ where: { academicYear: 2007 } });

  it('[DATA-003] deletes every row of a table larger than one batch, when another writer takes a batch first', async () => {
    // Arrange: the first batch's rows are deleted by someone else just before the purge's own delete of them.
    let calls = 0;
    const contended = withStatementDeletes(db, async (args, real) => {
      calls += 1;
      if (calls === 1) await real(args);
      return real(args);
    });
    const tally = emptyTableCounts();
    // Act
    await deletePurgeRows(contended, purgeScopeAt(RUNS_AT), tally);
    // Assert: the batch that deleted nothing did not end the table.
    expect(await left()).toBe(0);
    expect(tally.xapiStatements).toBe(ROWS - PURGE_BATCH_SIZE);
  });

  it('[DATA-003] fails, rather than loops or stops as if done, when a full batch can delete nothing', async () => {
    // Arrange
    const stuck = withStatementDeletes(db, () => Promise.resolve({ count: 0 }));
    // Act
    const run = deletePurgeRows(stuck, purgeScopeAt(RUNS_AT), emptyTableCounts());
    // Assert
    await expect(run).rejects.toThrow('the yearly purge made no progress on a table');
    expect(await left()).toBe(ROWS);
  });
});
