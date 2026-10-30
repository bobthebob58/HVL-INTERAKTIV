/**
 * Integration tests of what the people search never does with its query (D-090 as amended, DATA-009): log it, audit
 * it or put it into an error; and its per-person rate limit, which answers 429 with `Retry-After`.
 *
 * Spec: PROD-007, DATA-009, DATA-007
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Database } from '../../../src/infra/prismaClient.js';
import { PeopleDirectory } from '../../../src/learningDesign/collaboration/PeopleDirectory.js';
import {
  PEOPLE_SEARCH_KEY_PREFIX,
  PEOPLE_SEARCH_LIMIT,
  PEOPLE_SEARCH_WINDOW_SECONDS,
} from '../../../src/learningDesign/collaboration/PeopleSearchRateLimit.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { capturedLogger } from '../../support/capturedLogger.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';
import { personNamed, runToken } from './collaborationFixtures.js';

const TOKEN = runToken();

describeWithServices('[PROD-007] the people search keeps its query to itself', () => {
  const captured = capturedLogger('debug');
  const tb = openApiTestbed({ logger: captured.logger });
  let asker: TestPrincipal;
  const search = (who: TestPrincipal, q: string) =>
    requestAs(tb.app, who, 'get', `/api/people?q=${encodeURIComponent(q)}`);

  beforeAll(async () => {
    asker = await personNamed(tb, `Spør ${TOKEN} Kollega`);
  });
  afterAll(async () => {
    await tb.redis.del(PEOPLE_SEARCH_KEY_PREFIX + asker.principal.userId);
    await tb.close();
  });

  it('[PROD-007] after the limit, a search is 429 with Retry-After within the window', async () => {
    // Arrange: a person of their own, so no other test counts against them
    const searcher = await personNamed(tb, `Rate ${TOKEN} Kollega`);
    // Act
    const answers = [];
    for (let n = 0; n <= PEOPLE_SEARCH_LIMIT; n += 1)
      answers.push(await search(searcher, `Kari ${TOKEN} ${n}`));
    // Assert: every search up to the limit is answered; the next one is refused with a time to wait
    await tb.redis.del(PEOPLE_SEARCH_KEY_PREFIX + searcher.principal.userId);
    expect(answers.slice(0, PEOPLE_SEARCH_LIMIT).every((res) => res.status === 200)).toBe(true);
    const limited = answers[PEOPLE_SEARCH_LIMIT];
    expect([limited?.status, limited?.body.errorCode]).toEqual([429, 'hvl:rate-limited']);
    const retryAfter = Number(limited?.headers['retry-after']);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(PEOPLE_SEARCH_WINDOW_SECONDS);
    expect(JSON.stringify(limited?.body)).not.toContain(TOKEN);
  });

  it('[PROD-007] the query is in no log line and no audit event, also when the search is refused', async () => {
    // Arrange
    const query = `Hemmeleg ${TOKEN}`;
    const audits = () => tb.db.auditEvent.count({ where: { actorUserId: asker.principal.userId } });
    const before = await audits();
    captured.lines.length = 0;
    // Act: a search, a refused (too long) one and a Feide-ID lookup
    const answers = [
      await search(asker, query),
      await search(asker, `${query}${'x'.repeat(100)}`),
      await search(asker, `hemmeleg.${TOKEN}@hvl.no`),
    ];
    // Assert
    expect(answers.map((res) => res.status)).toEqual([200, 400, 200]);
    expect(captured.lines.join('\n')).not.toContain(TOKEN);
    expect(await audits()).toBe(before);
  });

  it('[PROD-007] a failing database never puts the query into the error that is logged', async () => {
    // Arrange: a database whose error quotes the query, as Prisma's validation errors do
    const failing = {
      user: {
        findMany: (args: unknown) => Promise.reject(new Error(`Invalid invocation: ${JSON.stringify(args)}`)),
      },
    } as unknown as Database;
    const directory = new PeopleDirectory({
      db: failing,
      hasher: new IdentityHasher(serviceEnv().IDENTITY_HASH_KEYS),
      redis: tb.redis,
    });
    // Act
    const error = await directory
      .search(asker.principal.userId, `Løynd ${TOKEN}`, new Date())
      .catch((e: unknown) => e);
    // Assert: a plain error that names nothing, with no cause that could be logged
    expect(error).toBeInstanceOf(Error);
    expect(String((error as Error).message)).toBe('people search failed');
    expect((error as Error).cause).toBeUndefined();
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain(TOKEN);
  });
});
