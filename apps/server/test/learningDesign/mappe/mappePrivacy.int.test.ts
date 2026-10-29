/**
 * Integration tests for privacy in the pedagogisk mappe (MAPPE-003, D-095): a 4-learner group is suppressed; a larger
 * group shows only aggregates, with the completion rate suppressed on both sides; no learner identifier, free-text
 * answer or individual score reaches the export, whatever the results source holds; and making the export writes no
 * row, no storage object and no audit event.
 *
 * Spec: MAPPE-003, INS-006
 */
import { S3Client } from '@aws-sdk/client-s3';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { Database } from '../../../src/infra/prismaClient.js';
import type {
  ActivityResultsSource,
  LearnerAttemptSummary,
} from '../../../src/learningDesign/mappe/activityResults.js';
import { MappeRenderer } from '../../../src/learningDesign/mappe/MappeRenderer.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { studioContentWithMappe } from '../../support/mappeFixture.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';

/** One learner as a results source might hold them, with what must never reach an export. */
const learner = (n: number, completed: boolean): LearnerAttemptSummary & Record<string, unknown> => ({
  learnerKey: `learner-key-${n}-qx7`,
  response: `Fritekstsvar nummer ${n} om blodtrykk`,
  attempts: n % 3 === 0 ? 3 : 1,
  completed,
  // WHY: odd thousandths, so every individual score written as a percentage has a decimal no aggregate shares.
  firstScore: (113 + 2 * n) / 1000,
  lastScore: (877 - 2 * n) / 1000,
});

const WRITES = /^(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)$/;

/** The database, with every write recorded and refused. */
function readOnly(db: Database, writes: string[]): Database {
  return new Proxy(db, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof property === 'string' && /^\$(execute|transaction)/.test(property)) {
        return (...args: unknown[]) => {
          writes.push(property);
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      if (typeof value !== 'object' || value === null) return value;
      return new Proxy(value, {
        get(model, method, modelReceiver) {
          const fn: unknown = Reflect.get(model, method, modelReceiver);
          if (typeof method === 'string' && WRITES.test(method)) writes.push(`${String(property)}.${method}`);
          return typeof fn === 'function' ? fn.bind(model) : fn;
        },
      });
    },
  });
}

describeWithServices('[MAPPE-003] privacy in the pedagogisk mappe', () => {
  const content = studioContentWithMappe();
  const tb = openApiTestbed({ studioContent: content });
  let author: TestPrincipal;
  let small: string;
  let large: string;
  const writes: string[] = [];
  const groups = new Map<string, (LearnerAttemptSummary & Record<string, unknown>)[]>();
  const source: ActivityResultsSource = {
    learnerSummaries: async (ids) => new Map(ids.map((id) => [id, groups.get(id) ?? []])),
  };
  const renderer = () =>
    new MappeRenderer({
      db: readOnly(tb.db, writes),
      content,
      validator: () => [],
      results: source,
      groupSize: minimumGroupSize(5),
      publicBaseUrl: 'https://hvl-interaktiv.example',
    });

  beforeAll(async () => {
    author = await tb.principal('author');
    small = await tb.content(author.principal.userId, { title: 'Liten gruppe' });
    large = await tb.content(author.principal.userId, { title: 'Stor gruppe' });
    groups.set(
      small,
      [1, 2, 3, 4].map((n) => learner(n, true)),
    );
    groups.set(
      large,
      Array.from({ length: 12 }, (_, n) => learner(n + 10, n < 6)),
    );
  });
  afterAll(() => tb.close());

  it('[MAPPE-003] a 4-learner group is suppressed: one sentence and no figure at all', async () => {
    // Act
    const { markdown } = await renderer().render({
      userId: author.principal.userId,
      contentIds: [small],
      locale: 'nn',
      now: new Date(),
    });
    // Assert
    expect(markdown).toContain(
      '**Anonymisert resultat (formativt):** Færre enn 5 deltakarar, så resultata blir ikkje viste.',
    );
    expect(markdown).toContain('**Tal:** ikkje vist; ikkje vist; ikkje vist; ikkje vist');
    expect(markdown).not.toMatch(/\b4 deltakarar/);
  });

  it('[MAPPE-003] a larger group shows aggregates only, and no identifier, free text or individual score anywhere', async () => {
    // Act
    const { markdown } = await renderer().render({
      userId: author.principal.userId,
      contentIds: [small, large],
      locale: 'nn',
      now: new Date(),
    });
    // Assert
    expect(markdown).toMatch(
      /12 deltakarar, fullført: 50\s%, median 1 forsøk, endring frå første til siste forsøk: \+\d/u,
    );
    for (const summary of [...(groups.get(small) ?? []), ...(groups.get(large) ?? [])]) {
      expect(markdown).not.toContain(String(summary.learnerKey));
      expect(markdown).not.toContain(String(summary.response));
      for (const score of [summary.firstScore, summary.lastScore] as number[]) {
        const percent = Math.round(score * 1000) / 10;
        for (const written of [String(score), String(percent), String(percent).replace('.', ',')]) {
          expect(markdown, written).not.toContain(written);
        }
      }
    }
  });

  it('[MAPPE-003] making the export writes no row, sends nothing to storage and leaves no audit event', async () => {
    // Arrange
    const send = vi.spyOn(S3Client.prototype, 'send');
    writes.length = 0;
    // Act
    await renderer().render({
      userId: author.principal.userId,
      contentIds: [small, large],
      locale: 'en',
      now: new Date(),
    });
    const viaRoute = await requestAs(tb.app, author, 'post', '/api/mappe/export?format=md').send({
      contentIds: [small, large],
      locale: 'nn',
    });
    // Assert
    expect(viaRoute.status).toBe(200);
    expect(writes).toEqual([]);
    // WHY: the recorder itself works: a write that changes nothing is recorded.
    const probe: string[] = [];
    await readOnly(tb.db, probe).user.deleteMany({ where: { id: { in: [] } } });
    expect(probe).toEqual(['user.deleteMany']);
    expect(send).not.toHaveBeenCalled();
    expect(await tb.db.auditEvent.count({ where: { actorUserId: author.principal.userId } })).toBe(0);
  });
});
