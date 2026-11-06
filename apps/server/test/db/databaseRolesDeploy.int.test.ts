/**
 * Integration tests of the deployment's migrate step with D-109's roles: `views-down`, the migration, `grants`. Once
 * the analytics views stand, PostgreSQL refuses a migration that retypes or drops a column they read, so the step drops
 * them first and builds them again after (D-109's amendment of 2026-11-05).
 *
 * Spec: DATA-010
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyDatabaseRoleScript,
  DATABASE_ROLE_SCRIPTS,
  databaseRoleStepOf,
} from '../../src/infra/databaseRolesCli.js';
import { openRoleDatabase, sqlStateOf, type RoleDatabase } from '../support/roleDatabase.js';
import { describeWithServices } from '../support/services.js';

const RETYPE = 'ALTER TABLE "InsightSnapshot" ALTER COLUMN "k" TYPE bigint';
const VIEWS = [{ name: 'insight_snapshot' }];

describe('[DATA-010] the role runner’s arguments', () => {
  it('[DATA-010] takes exactly one step name and nothing else', () => {
    // Act
    const steps = Object.keys(DATABASE_ROLE_SCRIPTS).map((step) => databaseRoleStepOf([step]));
    const refused = [[], ['grants', 'roles'], ['toString'], ['GRANTS'], ['00-views-down.sql']].map((argv) =>
      databaseRoleStepOf(argv),
    );
    // Assert
    expect(steps).toEqual(['roles', 'views-down', 'grants']);
    expect(refused).toEqual(Array(5).fill(undefined));
  });
});

describeWithServices('[DATA-010] the migrate step with the analytics views', () => {
  let rdb: RoleDatabase;
  const views = () => rdb.admin.$queryRaw<{ name: string }[]>`
    SELECT c.relname::text AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'analytics' AND c.relkind = 'v' ORDER BY 1`;
  beforeAll(async () => {
    rdb = await openRoleDatabase();
  }, 120_000);
  afterAll(() => rdb?.close());

  it('[DATA-010] a migration that retypes or drops a column a view reads fails while the views stand', async () => {
    // Act
    const states = [
      await sqlStateOf(rdb.migrator.$executeRawUnsafe(RETYPE)),
      await sqlStateOf(
        rdb.migrator.$executeRawUnsafe('ALTER TABLE "InsightSnapshot" DROP COLUMN "contextId"'),
      ),
    ];
    // Assert
    expect(states).toEqual(['0A000', '2BP01']);
  });

  it('[DATA-010] views-down refuses any user but the migration role, dropping nothing', async () => {
    await expect(applyDatabaseRoleScript(rdb.admin, 'views-down')).rejects.toThrow(
      '00-views-down.sql must run as hvli_migrator, not as',
    );
    expect(await views()).toEqual(VIEWS);
  });

  it('[DATA-010] views-down, the migration, then grants: the migration runs and analytics reads the view again', async () => {
    // Arrange: a table in schema analytics, which views-down must leave alone.
    await rdb.migrator.$executeRawUnsafe('CREATE TABLE analytics.zz_kept (id int)');
    // Act
    await applyDatabaseRoleScript(rdb.migrator, 'views-down');
    const between = await views();
    const migrated = await sqlStateOf(rdb.migrator.$executeRawUnsafe(RETYPE));
    await applyDatabaseRoleScript(rdb.migrator, 'views-down');
    await applyDatabaseRoleScript(rdb.migrator, 'grants');
    const read = await sqlStateOf(rdb.analytics.$queryRawUnsafe('SELECT k FROM analytics.insight_snapshot'));
    const kept = await rdb.admin.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'analytics' AND tablename = 'zz_kept'`;
    // Assert: the second views-down found nothing to drop; the grants step built the view again.
    expect([between, migrated, read, kept[0]?.n]).toEqual([[], 'ok', 'ok', 1]);
    expect(await views()).toEqual(VIEWS);
    await rdb.migrator.$executeRawUnsafe('DROP TABLE analytics.zz_kept');
  });
});
