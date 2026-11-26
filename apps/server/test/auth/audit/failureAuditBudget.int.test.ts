/**
 * Integration tests of the bound on audit rows for failures (D-141), on Redis and PostgreSQL: a few rows a minute
 * for one address, a ceiling for all addresses, every other event always recorded, what is past the bound counted
 * in the log without an address, and the row written when Redis cannot be reached.
 *
 * Spec: DATA-007, LTI-001, AUTH-001
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { AuthAuditRecorder } from '../../../src/auth/audit/AuthAuditRecorder.js';
import {
  FAILURE_ROWS_PER_ADDRESS,
  FAILURE_ROWS_PER_MINUTE,
  failureAuditBudget,
  isFailureEvent,
} from '../../../src/auth/audit/failureAuditBudget.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { capturedLogger } from '../../support/capturedLogger.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

describeWithServices('[DATA-007] the bound on audit rows for failures', () => {
  const env = serviceEnv();
  const db = createPrismaClient(env.DATABASE_URL);
  const hasher = new IdentityHasher(env.IDENTITY_HASH_KEYS);
  let redis: Redis;
  beforeAll(async () => {
    redis = await connectRedis(env.REDIS_URL);
  });
  afterAll(async () => {
    await redis.quit();
    await db.$disconnect();
  });

  /** A budget of this test alone: its own key prefix, so no other test's failures count against it. */
  const budget = (perAddress: number, overall: number) =>
    failureAuditBudget(redis, { perAddress, overall }, `hvli:test:${uniqueName('audit')}`);
  const address = () => `2001:db8::${uniqueName('a')}`;
  const rowsOf = (ipHash: string) => db.authAuditEvent.findMany({ where: { ipHash } });
  const hashOf = (ip: string) => hasher.hash('auth-audit-ip', ip).hash;

  it('[DATA-007] the numbers are 10 rows a minute for one address and 300 for all', () => {
    expect([FAILURE_ROWS_PER_ADDRESS, FAILURE_ROWS_PER_MINUTE]).toEqual([10, 300]);
    expect(['login.feide.failed', 'launch.lti.failed'].map(isFailureEvent)).toEqual([true, true]);
    expect(['login.feide', 'logout', 'launch.lti.author', 'link.conflict'].map(isFailureEvent)).toEqual(
      Array.from({ length: 4 }, () => false),
    );
  });

  it('[LTI-001] failures of one address write its rows for the minute and no more; another address still writes', async () => {
    // Arrange
    const { logger, lines } = capturedLogger('warn');
    const recorder = new AuthAuditRecorder({ db, hasher, logger, failures: budget(3, 100) });
    const [loud, quiet] = [address(), address()];
    // Act: seven failed launches from one address, then one from another
    for (let n = 0; n < 7; n += 1) {
      await recorder.record({ event: 'launch.lti.failed', reason: 'token-invalid', ip: loud });
    }
    await recorder.record({ event: 'login.feide.failed', reason: 'state-invalid', ip: quiet });
    // Assert: three rows, one row; the log has a count and neither address nor fingerprint
    expect(await rowsOf(hashOf(loud))).toHaveLength(3);
    expect(await rowsOf(hashOf(quiet))).toHaveLength(1);
    const said = lines.filter((line) => line.includes('failures past the rows for a minute'));
    expect(said).toHaveLength(1);
    expect(JSON.parse(said[0] ?? '{}')).toMatchObject({ skipped: 1 });
    expect(lines.join('')).not.toContain(loud);
    expect(lines.join('')).not.toContain(hashOf(loud));
    await db.authAuditEvent.deleteMany({ where: { ipHash: { in: [hashOf(loud), hashOf(quiet)] } } });
  });

  it('[DATA-007] all addresses together write at most the ceiling; an address past its own rows uses none of it', async () => {
    // Arrange: two rows per address, four in all
    const failures = budget(2, 4);
    const taken = async (fingerprint: string, times: number) => {
      const answers: boolean[] = [];
      for (let n = 0; n < times; n += 1) answers.push(await failures.take(fingerprint));
      return answers;
    };
    // Act
    const first = await taken(uniqueName('f'), 5);
    const second = await taken(uniqueName('f'), 2);
    const third = await taken(uniqueName('f'), 2);
    // Assert: the first address had two rows and its three refusals cost the others nothing
    expect(first).toEqual([true, true, false, false, false]);
    expect(second).toEqual([true, true]);
    expect(third).toEqual([false, false]);
    expect(await failures.take(undefined)).toBe(false);
  });

  it('[AUTH-001] an event that is no failure is always recorded, whatever the failures have used', async () => {
    // Arrange: a budget with no rows left for anyone
    const recorder = new AuthAuditRecorder({
      db,
      hasher,
      logger: capturedLogger('warn').logger,
      failures: budget(0, 0),
    });
    const ip = address();
    // Act
    await recorder.record({ event: 'launch.lti.failed', reason: 'state-invalid', ip });
    await recorder.record({ event: 'logout', ip });
    // Assert
    expect((await rowsOf(hashOf(ip))).map((row) => row.event)).toEqual(['logout']);
    await db.authAuditEvent.deleteMany({ where: { ipHash: hashOf(ip) } });
  });

  it('[DATA-007] with Redis unreachable the failure is recorded: the audit is worth more than its bound', async () => {
    // Arrange: a client whose every command fails
    const broken = {
      multi: () => {
        throw new Error('redis down');
      },
    } as unknown as Redis;
    const failures = failureAuditBudget(broken, { perAddress: 1, overall: 1 });
    // Act + Assert
    expect([await failures.take('x'), await failures.take('x'), await failures.take('x')]).toEqual([
      true,
      true,
      true,
    ]);
  });
});
