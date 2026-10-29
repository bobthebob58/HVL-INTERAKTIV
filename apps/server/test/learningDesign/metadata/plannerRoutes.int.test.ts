/**
 * Integration tests for the alignment planner route (D-088): who may ask, which activities it holds (own and
 * co-authored, drafts included, a stranger's never), the order of rows and columns, the gaps and the untagged list.
 *
 * Spec: PED-031, AUTH-003
 */
import { plannerSchema, type LearningOutcome } from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { REFUSED_CALLERS, storeMetadata } from './metadataFixtures.js';

const PATH = '/api/learning-design/planner?courseCode=SYK110';
const K1: LearningOutcome = { text: 'Forklare blodtrykk', category: 'kunnskap' };
const F1: LearningOutcome = { text: 'Måle puls', category: 'ferdigheiter' };
const F2: LearningOutcome = { text: 'Dokumentere', category: 'ferdigheiter' };
const G1: LearningOutcome = { text: 'Reflektere', category: 'generell-kompetanse' };

describeWithServices('[PED-031] the alignment planner route', () => {
  const tb = openApiTestbed();
  let author: TestPrincipal;
  const ids = new Map<string, string>();

  beforeAll(async () => {
    author = await tb.principal('author');
    const colleague = await tb.principal('author');
    const stranger = await tb.principal('author');
    const me = author.principal.userId;
    const activity = async (title: string, owner: string, extra: Parameters<typeof tb.content>[1] = {}) => {
      const id = await tb.content(owner, { title, ...extra });
      ids.set(title, id);
      return id;
    };
    await storeMetadata(tb.db, await activity('Alfa', me), {
      courseCode: 'SYK110',
      phase: 'forarbeid',
      outcomes: [K1, F1],
    });
    await storeMetadata(tb.db, await activity('Beta', me, { status: 'published' }), {
      courseCode: 'SYK110',
      phase: 'etterarbeid',
      outcomes: [K1],
    });
    await storeMetadata(tb.db, await activity('Gamma', colleague.principal.userId, { coAuthors: [me] }), {
      courseCode: 'SYK110',
      phase: 'forarbeid',
      outcomes: [G1],
    });
    await storeMetadata(tb.db, await activity('Delta', me), { courseCode: 'SYK110', outcomes: [F2] });
    await storeMetadata(tb.db, await activity('Epsilon', me), { courseCode: 'SYK110', phase: 'forarbeid' });
    await storeMetadata(tb.db, await activity('Zeta', me), { courseCode: 'SYK110' });
    await storeMetadata(tb.db, await activity('Annan emne', me), {
      courseCode: 'PED3001',
      phase: 'underveis',
      outcomes: [K1],
    });
    // WHY: the stranger's activity is published to all of HVL, so the author may view it, but it is not theirs.
    await storeMetadata(
      tb.db,
      await activity('Framand', stranger.principal.userId, {
        status: 'published',
        visibility: 'organisation',
      }),
      { courseCode: 'SYK110', phase: 'underveis', outcomes: [{ text: 'Hemmeleg', category: 'kunnskap' }] },
    );
  });
  afterAll(() => tb.close());

  describe('[AUTH-003] who may ask', () => {
    it.each(REFUSED_CALLERS)(
      '[AUTH-003] $who: $status $errorCode',
      async ({ role, overrides, status, errorCode }) => {
        // Arrange
        const caller = role ? await tb.principal(role, overrides) : undefined;
        // Act
        const res = caller ? await requestAs(tb.app, caller, 'get', PATH) : await request(tb.app).get(PATH);
        // Assert
        expect([res.status, res.body.errorCode]).toEqual([status, errorCode]);
      },
    );
  });

  it('[PED-031] holds the author’s own and co-authored activities of the course, drafts included, a stranger’s never', async () => {
    // Act
    const res = await requestAs(tb.app, author, 'get', PATH);
    // Assert
    expect(res.status).toBe(200);
    const planner = plannerSchema.parse(res.body);
    expect(planner.courseCode).toBe('SYK110');
    expect(planner.phases).toEqual(tb.studio.content.phases.phases.map((phase) => phase.key));
    const placed = planner.rows.flatMap((row) => row.cells.flatMap((cell) => cell.activities));
    expect(new Set(placed.map((a) => a.title))).toEqual(new Set(['Alfa', 'Beta', 'Gamma']));
    expect(placed.find((a) => a.title === 'Alfa')?.status).toBe('draft');
    expect(placed.find((a) => a.title === 'Beta')?.status).toBe('published');
    expect(res.text).not.toMatch(/Framand|Hemmeleg|Annan emne/);
  });

  it('[PED-031] rows by category then text, cells per phase, the two gap rules and the untagged list', async () => {
    // Act
    const planner = plannerSchema.parse((await requestAs(tb.app, author, 'get', PATH)).body);
    // Assert
    expect(planner.rows.map((row) => row.outcome)).toEqual([K1, F2, F1, G1]);
    const grid = planner.rows.map((row) => row.cells.map((cell) => cell.activities.map((a) => a.title)));
    expect(grid).toEqual([
      [['Alfa'], [], ['Beta']],
      [[], [], []],
      [['Alfa'], [], []],
      [['Gamma'], [], []],
    ]);
    expect(planner.gaps).toEqual([
      { kind: 'no-etterarbeid', outcome: F2 },
      { kind: 'no-etterarbeid', outcome: F1 },
      { kind: 'no-etterarbeid', outcome: G1 },
      { kind: 'empty-phase', phase: 'underveis' },
    ]);
    expect(planner.untagged.map((u) => [u.title, u.missing, u.contentId])).toEqual([
      ['Delta', ['phase'], ids.get('Delta')],
      ['Epsilon', ['outcomes'], ids.get('Epsilon')],
      ['Zeta', ['phase', 'outcomes'], ids.get('Zeta')],
    ]);
  });

  it('[PED-031] an admin’s planner holds only their own activities, and a course code is normalised', async () => {
    // Arrange
    const admin = await tb.principal('admin');
    // Act
    const res = await requestAs(tb.app, admin, 'get', '/api/learning-design/planner?courseCode=%20syk110');
    // Assert
    expect(res.status).toBe(200);
    expect(plannerSchema.parse(res.body)).toMatchObject({ courseCode: 'SYK110', rows: [], untagged: [] });
  });

  it('[PED-031] a missing or invalid course code is a 400', async () => {
    // Act
    const answers = await Promise.all(
      ['', '?courseCode=S', '?courseCode=SYK110%21'].map((query) =>
        requestAs(tb.app, author, 'get', `/api/learning-design/planner${query}`),
      ),
    );
    // Assert
    expect(answers.map((res) => [res.status, res.body.errorCode])).toEqual(
      answers.map(() => [400, 'error.badRequest']),
    );
  });
});
