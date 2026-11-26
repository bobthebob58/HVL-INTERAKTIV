/**
 * Tests that a pedagogisk mappe reads and checks its activities' parameters one activity at a time (D-128): the
 * selected activities are listed without their parameters, and each activity's parameters are read and checked
 * before the next one's are read; an activity that has gone in between is `hvl:activity-unavailable`.
 *
 * Spec: MAPPE-001, MAPPE-002
 */
import { describe, expect, it } from 'vitest';
import type { Database } from '../../../src/infra/prismaClient.js';
import { MappeRenderer } from '../../../src/learningDesign/mappe/MappeRenderer.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import type { ValidationInput } from '../../../src/validation/types.js';
import { BENCH_NOW, benchContent } from './mappeRenderBench.js';

const IDS = ['a', 'b', 'c'].map((letter, n) =>
  `0192f0c4-0000-7000-8000-00000000000${String(n + 1)}${letter}`.slice(0, 36),
);
const ME = 'user-1';

/** A database that answers the mappe's reads from memory and notes them, with the validator's checks, in order. */
function recording(gone: ReadonlySet<string> = new Set()) {
  const events: string[] = [];
  const listed: unknown[] = [];
  const row = (id: string) => ({
    id,
    title: `Aktivitet ${id.at(-1) ?? ''}`,
    mainLibrary: 'H5P.MultiChoice',
    metadata: {},
    status: 'draft',
    createdAt: BENCH_NOW,
    updatedAt: BENCH_NOW,
    publishedAt: null,
    ownerUserId: ME,
    _count: { collaborators: 0 },
    learningDesign: null,
    acknowledgements: [],
  });
  const db = {
    user: { findUnique: async () => ({ displayName: 'Aud Forfattar' }) },
    h5PContent: {
      findMany: async (query: { select: unknown }) => {
        listed.push(query.select);
        return IDS.map(row);
      },
      findUnique: async (query: { where: { id: string } }) => {
        events.push(`read ${query.where.id}`);
        return gone.has(query.where.id) ? null : { params: { question: query.where.id } };
      },
    },
  } as unknown as Database;
  const validator = (input: ValidationInput) => {
    events.push(`check ${(input.params as { question: string }).question}`);
    return [];
  };
  const renderer = new MappeRenderer({
    db,
    content: benchContent(),
    validator,
    results: { learnerSummaries: async () => undefined },
    groupSize: minimumGroupSize(5),
    publicBaseUrl: 'https://hvl-interaktiv.example',
  });
  const render = () => renderer.render({ userId: ME, contentIds: IDS, locale: 'nn', now: BENCH_NOW });
  return { events, listed, render };
}

describe('[MAPPE-001] a mappe reads its activities one at a time', () => {
  it('[MAPPE-001] the selected activities are listed without their parameters', async () => {
    // Arrange
    const { listed, render } = recording();
    // Act
    await render();
    // Assert
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: true, title: true, metadata: true });
    expect(listed[0]).not.toHaveProperty('params');
  });

  it('[MAPPE-002] each activity’s parameters are read and checked before the next one’s are read', async () => {
    // Arrange
    const { events, render } = recording();
    // Act
    const portfolio = await render();
    // Assert
    expect(events).toEqual(IDS.flatMap((id) => [`read ${id}`, `check ${id}`]));
    expect(portfolio.markdown).toContain('Aktivitet');
  });

  it('[MAPPE-001] an activity that has gone since it was listed is answered as unavailable', async () => {
    // Arrange
    const { events, render } = recording(new Set([IDS[1] ?? '']));
    // Act
    const refused = await render().catch((error: unknown) => error);
    // Assert
    expect(refused).toMatchObject({ status: 404, errorCode: 'hvl:activity-unavailable' });
    expect(events).toEqual([`read ${IDS[0] ?? ''}`, `check ${IDS[0] ?? ''}`, `read ${IDS[1] ?? ''}`]);
  });
});
