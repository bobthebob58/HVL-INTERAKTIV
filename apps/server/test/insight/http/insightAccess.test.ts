/**
 * Unit tests of insight's access rules (INS-007 as D-106 amends it) as a table: who is a reader of an activity, which
 * contexts each reader may choose from, and which context a view covers.
 *
 * Spec: INS-007, LTI-006, LTI-007
 */
import { describe, expect, it } from 'vitest';
import type { Principal } from '../../../src/auth/Principal.js';
import { insightReader, readerContexts, viewContext } from '../../../src/insight/http/insightAccess.js';
import { canvasPrincipal, portalPrincipal } from '../../grades/status/support/gradeSyncApp.js';

const PLATFORM = '0192f0c4-0000-7000-8000-00000000aaaa';
const COURSE_A = `${PLATFORM}:A`;
const COURSE_B = `${PLATFORM}:B`;
const FACTS = { ownerUserId: 'owner', coAuthorIds: ['co-author'] };
const CONTEXTS = [
  { key: 'portal', label: null },
  { key: COURSE_A, label: 'SYK110' },
  { key: COURSE_B, label: null },
];
const inCourse = (userId: string, contextId: string, roles: Principal['roles'] = ['author']) =>
  canvasPrincipal(userId, { platformId: PLATFORM, contextId }, [...roles]);

describe('[INS-007] who reads an activity’s insight', () => {
  it.each([
    ['the owner in the portal', portalPrincipal('owner'), { kind: 'editor' }],
    ['a co-author in the portal', portalPrincipal('co-author'), { kind: 'editor' }],
    ['an admin who owns it', portalPrincipal('owner', ['author', 'admin']), { kind: 'editor' }],
    ['a Canvas teacher of course A', inCourse('stranger', 'A'), { kind: 'course', contextKey: COURSE_A }],
    ['the owner launched from course B', inCourse('owner', 'B'), { kind: 'course', contextKey: COURSE_B }],
    ['a colleague in the portal', portalPrincipal('colleague'), undefined],
    ['an admin who neither owns nor co-authors it', portalPrincipal('admin', ['author', 'admin']), undefined],
    ['a portal learner who owns it', portalPrincipal('owner', ['learner']), undefined],
    ['a Canvas learner', inCourse('owner', 'A', ['learner']), undefined],
    ['a Canvas launch without a storable course', inCourse('stranger', 'x'.repeat(256)), undefined],
  ] as const)('[INS-007] %s', (_who, principal, expected) => {
    // Act and assert
    expect(insightReader(principal, FACTS)).toEqual(expected);
  });

  it('[INS-007] an owner or co-author may choose every context; a Canvas teacher only the launch’s course', () => {
    // Act and assert
    expect(readerContexts({ kind: 'editor' }, CONTEXTS)).toEqual(CONTEXTS);
    expect(readerContexts({ kind: 'course', contextKey: COURSE_A }, CONTEXTS)).toEqual([CONTEXTS[1]]);
  });

  it('[INS-007] the portal is the default view; a course the activity lacks is 400', async () => {
    // Arrange
    const all = () => Promise.resolve(CONTEXTS);
    // Act and assert
    await expect(viewContext({ kind: 'editor' }, undefined, all)).resolves.toBe('portal');
    await expect(viewContext({ kind: 'editor' }, COURSE_B, all)).resolves.toBe(COURSE_B);
    await expect(viewContext({ kind: 'editor' }, `${PLATFORM}:C`, all)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('[LTI-007] in Canvas the launch fixes the context: naming it is fine, naming another is 403', async () => {
    // Arrange
    const reader = { kind: 'course', contextKey: COURSE_A } as const;
    const unused = () => Promise.reject(new Error('the contexts are not read in Canvas'));
    // Act and assert
    await expect(viewContext(reader, undefined, unused)).resolves.toBe(COURSE_A);
    await expect(viewContext(reader, COURSE_A, unused)).resolves.toBe(COURSE_A);
    for (const other of ['portal', COURSE_B])
      await expect(viewContext(reader, other, unused)).rejects.toMatchObject({ status: 403 });
  });
});
