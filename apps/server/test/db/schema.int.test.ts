/**
 * Integration tests for the database schema: the migrations are applied, the learner rule is enforced, and the
 * S5 learning-design columns (migration `s5_learning_design`) exist with their limits, indexes and foreign key.
 *
 * Spec: DATA-002, DATA-001, PROD-007
 */
import { afterAll, expect, it } from 'vitest';
import { createPrismaClient } from '../../src/infra/prismaClient.js';
import { describeWithServices, serviceEnv } from '../support/services.js';

describeWithServices('[DATA-002] database enforces pseudonymous learners', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  afterAll(() => db.$disconnect());

  it('[DATA-001] has every table of the data model (spec 05 §4 plus AuthAuditEvent from spec 02 §7)', async () => {
    // Act
    const rows = await db.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'`;
    // Assert
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
        'LtiDeployment',
        'LtiIdToken',
        'LtiNonce',
        'LtiPlacement',
        'LtiPlatform',
        'NoticeDismissal',
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

/** One column the S5 migration adds: table, column, SQL type and character limit (null when none). */
type S5Column = [table: string, column: string, dataType: string, maxLength: number | null];

const S5_COLUMNS: S5Column[] = [
  ['H5PContent', 'bankListedAt', 'timestamp without time zone', null],
  ['H5PContent', 'sourceAuthorUserId', 'uuid', null],
  ['LearningDesignMetadata', 'learnerPurpose', 'character varying', 200],
  ['LearningDesignMetadata', 'patternId', 'character varying', 64],
  ['LtiPlacement', 'contextLabel', 'character varying', 255],
  ['User', 'coAuthorSearchableAt', 'timestamp without time zone', null],
];

describeWithServices('[DATA-001] S5 learning-design columns (D-087, D-090, D-091, D-092)', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  afterAll(() => db.$disconnect());

  it('[DATA-001] adds each S5 column as nullable, with its type and length limit', async () => {
    // Arrange
    const keys = S5_COLUMNS.map(([table, column]) => `${table}.${column}`);
    // Act
    const rows = await db.$queryRaw<
      {
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        max_length: number | null;
      }[]
    >`
      SELECT table_name, column_name, data_type, is_nullable, character_maximum_length::int AS max_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND (table_name || '.' || column_name) = ANY(${keys})`;
    // Assert: every column exists, and none is required, so existing rows stay valid
    const found = rows
      .map((r): S5Column => [r.table_name, r.column_name, r.data_type, r.max_length])
      .sort((a, b) => `${a[0]}.${a[1]}`.localeCompare(`${b[0]}.${b[1]}`));
    expect(found).toEqual(S5_COLUMNS);
    expect(rows.every((r) => r.is_nullable === 'YES')).toBe(true);
  });

  it('[DATA-001] indexes the bank listing and co-author eligibility for their list queries', async () => {
    // Act
    const rows = await db.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname IN ('H5PContent_bankListedAt_idx', 'User_coAuthorSearchableAt_idx')
      ORDER BY indexname`;
    // Assert
    expect(rows.map((r) => r.indexname)).toEqual([
      'H5PContent_bankListedAt_idx',
      'User_coAuthorSearchableAt_idx',
    ]);
    expect(rows[0]?.indexdef).toContain('("bankListedAt")');
    expect(rows[1]?.indexdef).toContain('("coAuthorSearchableAt")');
  });

  it('[PROD-007] keeps a copy and empties its source author when that account is deleted', async () => {
    // Arrange: a copy that credits another staff member as its source author (D-092)
    const owner = await db.user.create({ data: { kind: 'staff' } });
    const sourceAuthor = await db.user.create({ data: { kind: 'staff' } });
    const copy = await db.h5PContent.create({
      data: {
        mainLibrary: 'H5P.MultiChoice',
        title: 'Kopi',
        params: {},
        metadata: {},
        ownerUserId: owner.id,
        sourceAuthorUserId: sourceAuthor.id,
      },
    });
    try {
      // Act
      await db.user.delete({ where: { id: sourceAuthor.id } });
      // Assert: the copy itself survives (no cascade); only the attribution is emptied
      const after = await db.h5PContent.findUnique({ where: { id: copy.id } });
      expect(after).toMatchObject({ id: copy.id, ownerUserId: owner.id, sourceAuthorUserId: null });
    } finally {
      await db.h5PContent.deleteMany({ where: { id: copy.id } });
      await db.user.deleteMany({ where: { id: { in: [owner.id, sourceAuthor.id] } } });
    }
  });
});
