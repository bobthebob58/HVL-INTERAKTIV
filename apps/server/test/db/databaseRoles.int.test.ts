/**
 * Integration tests of D-109's database roles against PostgreSQL: a throwaway database gets the three roles, is
 * migrated as `hvli_migrator` and granted, and then each role logs in and runs what it may and may not.
 *
 * Spec: DATA-010, DATA-007, INS-006
 */
import { readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyDatabaseRoleScript } from '../../src/infra/databaseRolesCli.js';
import {
  DATABASE_ROLES,
  isLocalDatabaseServer,
  openRoleDatabase,
  REFUSED,
  sqlStateOf,
  type RoleDatabase,
} from '../support/roleDatabase.js';
import { describeWithServices } from '../support/services.js';

const MIGRATIONS = readdirSync(new URL('../../prisma/migrations/', import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const READ_ONLY = '25006';

describe('[DATA-010] the role test’s own guard', () => {
  it('[DATA-010] runs only against a server on this machine, as node-postgres reads the URL', () => {
    const local = [
      'localhost:5432/db',
      '127.0.0.1/db',
      '[::1]:5432/db',
      'db.hvl.no/db?host=/var/run/postgresql',
    ];
    const remote = ['db.hvl.no:5432/db', '10.0.0.5/db', 'localhost/db?host=db.hvl.no', 'localhost.hvl.no/db'];
    const url = (rest: string) => `postgresql://u:p@${rest}`;
    expect(local.filter((rest) => !isLocalDatabaseServer(url(rest)))).toEqual([]);
    expect(remote.filter((rest) => isLocalDatabaseServer(url(rest)))).toEqual([]);
  });
});

describeWithServices('[DATA-010] database roles', () => {
  let rdb: RoleDatabase;
  beforeAll(async () => {
    rdb = await openRoleDatabase();
  }, 120_000);
  afterAll(() => rdb?.close());

  it('[DATA-010] the migration role ran every migration and owns every table and view; the scripts run again', async () => {
    // Act
    await applyDatabaseRoleScript(rdb.admin, 'roles');
    await applyDatabaseRoleScript(rdb.migrator, 'grants');
    // Assert
    const owners = await rdb.admin.$queryRaw<{ owner: string }[]>`
      SELECT DISTINCT c.relowner::regrole::text AS owner FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'analytics') AND c.relkind IN ('r', 'v', 'S')`;
    const applied = await rdb.admin.$queryRaw<{ name: string }[]>`
      SELECT migration_name AS name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY 1`;
    expect(owners).toEqual([{ owner: 'hvli_migrator' }]);
    expect(applied.map((row) => row.name)).toEqual([...MIGRATIONS].sort());
  });

  it('[DATA-010] no role may become a superuser, create databases or roles, or bypass row security', async () => {
    const roles = await rdb.admin.$queryRaw<Record<string, unknown>[]>`
      SELECT rolname::text AS name, rolcanlogin AS login, rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication
        OR rolbypassrls AS powers FROM pg_roles
      WHERE rolname IN ('hvli_migrator', 'hvli_app', 'hvli_analytics') ORDER BY 1`;
    expect(roles).toEqual([...DATABASE_ROLES].sort().map((name) => ({ name, login: true, powers: false })));
  });

  it('[DATA-010] refuses 02-grants.sql to any user but the migration role, applying none of it', async () => {
    await expect(applyDatabaseRoleScript(rdb.admin, 'grants')).rejects.toThrow(
      '02-grants.sql must run as hvli_migrator, not as',
    );
  });

  it('[DATA-010] the app role reads and writes rows through the server’s client', async () => {
    // Act
    const user = await rdb.app.user.create({ data: { kind: 'staff' } });
    const renamed = await rdb.app.user.update({ where: { id: user.id }, data: { displayName: 'Testar' } });
    const removed = await rdb.app.user.deleteMany({ where: { id: user.id } });
    // Assert
    expect([renamed.displayName, removed.count]).toEqual(['Testar', 1]);
  });

  it.each([
    ['create a table', 'CREATE TABLE public.zz_app (id int)'],
    ['change a table', 'ALTER TABLE "User" ADD COLUMN zz int'],
    ['drop a table', 'DROP TABLE "LtiNonce"'],
    ['empty a table', 'TRUNCATE "XapiStatement"'],
    ['create a schema', 'CREATE SCHEMA zz_app'],
    ['create a temporary table', 'CREATE TEMP TABLE zz_tmp (id int)'],
    ['read the migration history', 'SELECT 1 FROM "_prisma_migrations"'],
    ['read the analytics views', 'SELECT 1 FROM analytics.insight_snapshot'],
  ])('[DATA-010] the app role may not %s', async (_what, sql) => {
    expect(await sqlStateOf(rdb.app.$executeRawUnsafe(sql))).toBe(REFUSED);
  });

  it('[DATA-007] the app role adds and reads audit rows but can neither change nor delete them', async () => {
    // Act
    const row = await rdb.app.auditEvent.create({
      data: { action: 'test.roles', targetType: 'Test', targetId: '1' },
    });
    const refused = [
      await sqlStateOf(rdb.app.auditEvent.updateMany({ where: { id: row.id }, data: { action: 'x' } })),
      await sqlStateOf(rdb.app.auditEvent.deleteMany({ where: { id: row.id } })),
      await sqlStateOf(rdb.app.authAuditEvent.updateMany({ data: { event: 'x' } })),
      await sqlStateOf(rdb.app.authAuditEvent.deleteMany({})),
      await sqlStateOf(rdb.app.libraryAuditEvent.deleteMany({})),
      await sqlStateOf(rdb.app.$executeRawUnsafe('TRUNCATE "AuditEvent"')),
    ];
    // Assert
    expect(await rdb.app.auditEvent.count({ where: { id: row.id } })).toBe(1);
    expect(refused).toEqual(Array(6).fill(REFUSED));
  });

  it('[DATA-010] a table a later migration adds is the app’s to use at once, and never analytics’s', async () => {
    // Arrange
    await rdb.migrator.$executeRawUnsafe('CREATE TABLE public.zz_later (id int)');
    // Act
    const inserted = await rdb.app.$executeRawUnsafe('INSERT INTO public.zz_later VALUES (1)');
    const analytics = await sqlStateOf(rdb.analytics.$queryRawUnsafe('SELECT 1 FROM public.zz_later'));
    // Assert
    expect([inserted, analytics]).toEqual([1, REFUSED]);
    await rdb.migrator.$executeRawUnsafe('DROP TABLE public.zz_later');
  });

  it('[INS-006] the analytics role reads the k-suppressed snapshots with their content type', async () => {
    // Arrange: an activity and a snapshot, written as the server writes them.
    const owner = await rdb.app.user.create({ data: { kind: 'staff' } });
    const content = await rdb.app.h5PContent.create({
      data: {
        mainLibrary: 'H5P.MultiChoice',
        title: 'Quiz',
        params: {},
        metadata: {},
        ownerUserId: owner.id,
      },
    });
    const period = {
      periodStart: new Date('2025-08-01T00:00:00Z'),
      periodEnd: new Date('2026-08-01T00:00:00Z'),
    };
    await rdb.app.insightSnapshot.create({
      data: { contentId: content.id, contentVersion: 1, ...period, k: 5, aggregates: { started: 12 } },
    });
    // Act
    const rows = await rdb.analytics.$queryRaw<Record<string, unknown>[]>`
      SELECT content_id, content_type, content_version, k, aggregates FROM analytics.insight_snapshot`;
    // Assert
    expect(rows).toEqual([
      {
        content_id: content.id,
        content_type: 'H5P.MultiChoice',
        content_version: 1,
        k: 5,
        aggregates: { started: 12 },
      },
    ]);
  });

  it('[DATA-010] the analytics role can read no table at all, not one learner row', async () => {
    // Arrange
    const tables = await rdb.admin.$queryRaw<{ name: string; usage: boolean }[]>`
      SELECT tablename::text AS name, has_schema_privilege('hvli_analytics', 'public', 'USAGE') AS usage
      FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`;
    // Act
    const states = await Promise.all(
      tables.map(({ name }) =>
        sqlStateOf(rdb.analytics.$queryRawUnsafe(`SELECT 1 FROM public."${name}" LIMIT 1`)),
      ),
    );
    // Assert
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        'XapiStatement',
        'H5PUserData',
        'GradeSyncJob',
        'Identity',
        'User',
        'InsightSnapshot',
      ]),
    );
    expect(new Set(states)).toEqual(new Set([REFUSED]));
    expect(tables.some((table) => table.usage)).toBe(false);
  });

  it('[DATA-010] the analytics role cannot write or change the schema, even with its read-only default off', async () => {
    // Arrange
    const readWrite = rdb.as('hvli_analytics', { readWrite: true });
    // Act
    const states = [
      await sqlStateOf(rdb.analytics.$executeRawUnsafe('CREATE TABLE analytics.zz (id int)')),
      await sqlStateOf(readWrite.$executeRawUnsafe('CREATE TABLE analytics.zz (id int)')),
      await sqlStateOf(readWrite.$executeRawUnsafe('CREATE TABLE public.zz (id int)')),
      await sqlStateOf(readWrite.$executeRawUnsafe('DROP VIEW analytics.insight_snapshot')),
    ];
    // Assert
    expect(states).toEqual([READ_ONLY, REFUSED, REFUSED, REFUSED]);
  });
});
