/**
 * Integration tests for replacing an activity's learning-design metadata (D-087): the limits, the full replace with
 * its `updatedAt` precondition (409 when stale, also when two saves race), the stored `patternId` kept, the outcomes'
 * order kept and the course code normalised.
 *
 * Spec: PED-030
 */
import { learningDesignSchema, type LearningDesign } from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { storeMetadata } from './metadataFixtures.js';

const outcome = (text: string) => ({ text, category: 'kunnskap' as const });

describeWithServices('[PED-030] replacing the learning-design metadata', () => {
  const tb = openApiTestbed();
  let owner: TestPrincipal;
  const path = (contentId: string) => `/api/content/${contentId}/learning-design`;
  const put = (contentId: string, body: object) =>
    requestAs(tb.app, owner, 'put', path(contentId)).send(body);
  const get = async (contentId: string): Promise<LearningDesign> =>
    learningDesignSchema.parse((await requestAs(tb.app, owner, 'get', path(contentId))).body);

  beforeAll(async () => {
    owner = await tb.principal('author');
  });
  afterAll(() => tb.close());

  it.each([
    ['21 outcomes', { outcomes: Array.from({ length: 21 }, (_, i) => outcome(`Utbyte ${i}`)) }],
    ['an outcome of 301 characters', { outcomes: [outcome('x'.repeat(301))] }],
    ['an empty outcome', { outcomes: [outcome('   ')] }],
    [
      'the database form of a category',
      { outcomes: [{ text: 'Reflektere', category: 'generell_kompetanse' }] },
    ],
    ['a rationale of 1 001 characters', { rationale: 'x'.repeat(1001) }],
    ['0 minutes', { estimatedStudentMinutes: 0 }],
    ['601 minutes', { estimatedStudentMinutes: 601 }],
    ['a learner purpose of 201 characters', { learnerPurpose: 'x'.repeat(201) }],
    ['a learner purpose on two lines', { learnerPurpose: 'Første linje\nAndre linje' }],
    ['a course code with an underscore', { courseCode: 'SYK_110' }],
    ['a pattern ID, which is read only', { patternId: 'fa-video' }],
    ['an unknown field', { colour: 'blue' }],
  ])('[PED-030] refuses %s with 400 and stores nothing', async (_what, patch) => {
    // Arrange
    const contentId = await tb.content(owner.principal.userId);
    // Act
    const res = await put(contentId, { updatedAt: null, outcomes: [], ...patch });
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([400, 'error.badRequest']);
    expect(await get(contentId)).toEqual({ outcomes: [], updatedAt: null });
  });

  it('[PED-030] accepts every limit, keeps the outcomes in order and normalises the course code', async () => {
    // Arrange
    const contentId = await tb.content(owner.principal.userId);
    const outcomes = Array.from({ length: 20 }, (_, i) => outcome(`${20 - i} ${'x'.repeat(290)}`));
    const body = {
      updatedAt: null,
      phase: 'etterarbeid',
      courseCode: ' syk 110 ',
      outcomes,
      rationale: 'r'.repeat(1000),
      estimatedStudentMinutes: 600,
      learnerPurpose: `  ${'p'.repeat(200)}  `,
    };
    // Act
    const res = await put(contentId, body);
    // Assert
    expect(res.status).toBe(200);
    const stored = await get(contentId);
    expect(stored).toEqual(learningDesignSchema.parse(res.body));
    expect(stored).toMatchObject({
      courseCode: 'SYK110',
      learnerPurpose: 'p'.repeat(200),
      phase: 'etterarbeid',
    });
    expect(stored.outcomes).toEqual(outcomes);
  });

  it('[PED-030] a stale updatedAt answers 409 and changes nothing; the fresh one replaces everything', async () => {
    // Arrange
    const contentId = await tb.content(owner.principal.userId);
    const first = await put(contentId, { updatedAt: null, outcomes: [outcome('A')], phase: 'forarbeid' });
    const read = first.body.updatedAt as string;
    // Act
    const again = await put(contentId, { updatedAt: null, outcomes: [] });
    const second = await put(contentId, { updatedAt: read, outcomes: [outcome('B')], rationale: 'Ny' });
    const stale = await put(contentId, { updatedAt: read, outcomes: [outcome('C')] });
    // Assert
    expect([again.status, again.body.errorCode]).toEqual([409, 'hvl:learning-design-conflict']);
    expect(stale.status).toBe(409);
    expect(second.status).toBe(200);
    expect(Date.parse(second.body.updatedAt as string)).toBeGreaterThan(Date.parse(read));
    // WHY: a full replace: the phase left out of the second save is cleared.
    expect(await get(contentId)).toEqual({
      outcomes: [outcome('B')],
      rationale: 'Ny',
      updatedAt: second.body.updatedAt,
    });
  });

  it('[PED-030] of two saves from the same read, one is stored and the other answers 409', async () => {
    // Arrange
    const contentId = await tb.content(owner.principal.userId);
    const updatedAt = (await put(contentId, { updatedAt: null, outcomes: [] })).body.updatedAt as string;
    // Act
    const answers = await Promise.all(
      ['Fyrste', 'Andre'].map((text) => put(contentId, { updatedAt, outcomes: [outcome(text)] })),
    );
    // Assert
    expect(answers.map((res) => res.status).sort()).toEqual([200, 409]);
    const winner = answers.find((res) => res.status === 200);
    expect((await get(contentId)).outcomes).toEqual(winner?.body.outcomes);
  });

  it('[PED-030] keeps the pattern the activity was created from; a PUT cannot change or clear it', async () => {
    // Arrange
    const contentId = await tb.content(owner.principal.userId);
    const updatedAt = await storeMetadata(tb.db, contentId, { patternId: 'fa-video', phase: 'forarbeid' });
    // Act
    const read = await get(contentId);
    const res = await put(contentId, { updatedAt, outcomes: [], phase: 'underveis' });
    // Assert
    expect(read).toMatchObject({ patternId: 'fa-video', phase: 'forarbeid' });
    expect(res.status).toBe(200);
    expect(await get(contentId)).toMatchObject({ patternId: 'fa-video', phase: 'underveis' });
  });

  it('[PED-030] an empty replace keeps the row with every field cleared and a new updatedAt', async () => {
    // Arrange
    const contentId = await tb.content(owner.principal.userId);
    const updatedAt = await storeMetadata(tb.db, contentId, {
      courseCode: 'SYK110',
      outcomes: [outcome('A')],
      estimatedStudentMinutes: 10,
    });
    // Act
    const res = await put(contentId, { updatedAt, outcomes: [] });
    // Assert
    expect(res.status).toBe(200);
    expect(await get(contentId)).toEqual({ outcomes: [], updatedAt: res.body.updatedAt });
    expect(res.body.updatedAt).not.toBe(updatedAt);
  });
});
