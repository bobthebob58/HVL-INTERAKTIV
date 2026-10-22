/**
 * Integration tests for the database schema: the migration is applied and enforces the learner rule.
 *
 * Spec: DATA-002, DATA-001
 */
import { afterAll, expect, it } from 'vitest';
import { createPrismaClient } from '../../src/infra/prismaClient.js';
import { describeWithServices, serviceEnv } from '../support/services.js';

describeWithServices('[DATA-002] database enforces pseudonymous learners', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  afterAll(() => db.$disconnect());

  it('[DATA-001] has every table of the data model (spec 05 §4 plus AuthAuditEvent from spec 02 §7)', async () => {
    const rows = await db.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'`;
    expect(rows.map((r) => r.table_name).sort()).toEqual(
      [
        'AuditEvent',
        'AuthAuditEvent',
        'ContentCollaborator',
        'GradeSyncJob',
        'H5PContent',
        'H5PContentFile',
        'H5PUserData',
        'Identity',
        'InsightSnapshot',
        'LearningDesignMetadata',
        'LearningOutcome',
        'LibraryAuditEvent',
        'LtiAccessToken',
        'LtiIdToken',
        'LtiNonce',
        'LtiPlacement',
        'LtiPlatform',
        'User',
        'ValidationAcknowledgement',
        'XapiStatement',
      ].sort(),
    );
  });

  it('[DATA-002] accepts staff with a name and learners without one', async () => {
    const staff = await db.user.create({
      data: { kind: 'staff', displayName: 'Test Author', email: 'author@example.org' },
    });
    const learner = await db.user.create({ data: { kind: 'learner' } });
    await db.user.deleteMany({ where: { id: { in: [staff.id, learner.id] } } });
  });

  it('[DATA-002] rejects a learner row with a name or an e-mail address', async () => {
    await expect(db.user.create({ data: { kind: 'learner', displayName: 'Kari' } })).rejects.toThrow(
      /User_learner_has_no_personal_data/,
    );
    await expect(db.user.create({ data: { kind: 'learner', email: 'kari@example.org' } })).rejects.toThrow(
      /User_learner_has_no_personal_data/,
    );
  });
});
