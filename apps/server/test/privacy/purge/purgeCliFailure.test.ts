/**
 * Tests for what `npm run privacy:purge` prints when a run fails (DATA-003, D-107; DATA-009): a real Prisma error,
 * whose message renders the call's arguments, by its name and code only, as the data-subject CLI does; a configuration
 * problem by its own value-free message; another error by its message with credential shapes masked. The last test
 * runs the npm script against an unreachable database, so the CLI's own `main` is shown to print that line.
 *
 * Spec: DATA-003, DATA-009
 */
import { afterAll, describe, expect, it } from 'vitest';
import { InvalidEnvironmentError } from '../../../src/config/env.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { purgeFailureLine } from '../../../src/privacy/purge/purgeCli.js';
import { VALID_ENV } from '../../support/authEnv.js';
import { runServerCli } from '../../support/serverCli.js';

const KEY = 'kari-learner-key-purge-000000000000000000000';
const PASSWORD = 'n0t-a-real-db-Passw0rd';
// WHY: nothing listens on port 1, so a query fails as an unreachable database does, without any test service.
const UNREACHABLE_URL = `postgresql://hvli_app:${PASSWORD}@127.0.0.1:1/none`;
const unreachable = createPrismaClient(UNREACHABLE_URL);

const thrownBy = (call: () => Promise<unknown>): Promise<unknown> =>
  call().then(
    () => Promise.reject(new Error('the call did not fail')),
    (error: unknown) => error,
  );

/** A Prisma client's name and optional database code: nothing else. */
const PRISMA_LINE = /^(?:PrismaClient\w+|DriverAdapterError)(?: [\w.-]+)?$/;

describe('[DATA-003] the purge CLI’s failure line', () => {
  afterAll(() => unreachable.$disconnect());

  it('[DATA-003][DATA-009] a real Prisma error is printed by name and code, never by its message', async () => {
    // Arrange: a validation error renders the call's arguments, here a learnerKey, into its message
    const where = { learnerKey: { in: [KEY] } };
    const invalid = await thrownBy(() =>
      unreachable.xapiStatement.deleteMany({ where: { ...where, bogus: 1 } as never }),
    );
    const lost = await thrownBy(() => unreachable.xapiStatement.deleteMany({ where }));
    // Act
    const lines = [purgeFailureLine(invalid), purgeFailureLine(lost)];
    // Assert
    expect((invalid as Error).message).toContain(KEY);
    for (const line of lines) {
      expect(line).toMatch(PRISMA_LINE);
      expect(line).not.toContain(KEY);
    }
  });

  it('[DATA-003] a configuration problem keeps its message, which names variables; others mask credentials', () => {
    const config = new InvalidEnvironmentError(['PURGE_RUN_DATE: must be a day from 08-31 to 12-31']);
    const other = new Error(`could not reach ${UNREACHABLE_URL}`);
    expect(purgeFailureLine(config)).toBe(config.message);
    expect(purgeFailureLine(other)).not.toContain(PASSWORD);
    expect(purgeFailureLine('not an error')).toBe('Error');
  });

  it('[DATA-003][DATA-009] npm run privacy:purge prints that line and exits 1 when the database fails', async () => {
    // Act
    const run = await runServerCli('privacy:purge', ['--dry-run'], {
      ...VALID_ENV,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: UNREACHABLE_URL,
    });
    // Assert
    expect(run.code).toBe(1);
    const [line, ...rest] = run.stderr.split('\n').filter(Boolean);
    expect(rest).toEqual([]);
    expect(line?.replace('retention purge failed: ', '')).toMatch(PRISMA_LINE);
    expect(`${run.stdout}${run.stderr}`).not.toContain(PASSWORD);
  }, 60_000);
});
