/**
 * Unit tests of the DATA-012 mapper's caps and parsed fields: the answer kept per interaction type with D-115's caps,
 * the duration read from ISO 8601, and the platform-scoped context key (D-103).
 *
 * Spec: DATA-012
 */
import { randomUUID } from 'node:crypto';
import { xapiStatementItemSchema } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { sealPrincipal } from '../../src/auth/Principal.js';
import {
  parsePlatformContextKey,
  platformContextKey,
  principalContextKey,
} from '../../src/xapi/platformContextKey.js';
import { durationMsOf } from '../../src/xapi/xapiDuration.js';
import { xapiStatementRow, type XapiBatchFacts } from '../../src/xapi/xapiStatementRow.js';

const C = '0192f0c4-3333-7000-8000-00000000c0de';
const PLATFORM = '0192f0c4-4444-7000-8000-0000000000aa';
const FACTS: XapiBatchFacts = {
  contentId: C,
  contentVersion: 2,
  contextId: null,
  learnerKey: 'lk',
  academicYear: 2026,
  mainCategory: undefined,
};

/** The stored answer of an `answered` with this response and interaction type. */
const storedResponse = (response: string | number, interactionType?: string) =>
  xapiStatementRow(
    xapiStatementItemSchema.parse({
      statementId: randomUUID(),
      attemptId: `${randomUUID()}:1`,
      verb: { id: 'http://adlnet.gov/expapi/verbs/answered' },
      object: { id: C, definition: interactionType ? { interactionType } : {} },
      result: { response },
    }),
    FACTS,
    new Date(),
  ).response;

describe('[DATA-012] the stored answer (D-115 caps)', () => {
  it('[DATA-012] keeps choice indices and gap text, and a BranchingScenario-style number as text', () => {
    expect(storedResponse('0[,]2', 'choice')).toBe('0[,]2');
    expect(storedResponse('a[,][,]c', 'fill-in')).toBe('a[,][,]c');
    expect(storedResponse(3, 'choice')).toBe('3');
  });

  it('[DATA-012] keeps no answer of any other interaction type, or without one', () => {
    expect(storedResponse('a long reflection', 'long-fill-in')).toBeNull();
    expect(storedResponse('0', 'matching')).toBeNull();
    expect(storedResponse('0')).toBeNull();
  });

  it('[DATA-012] cuts each gap to 100 characters, counted in code points, and keeps the gaps in place', () => {
    const long = '😀'.repeat(150);
    expect(storedResponse(`${long}[,]b`, 'fill-in')).toBe(`${'😀'.repeat(100)}[,]b`);
  });

  it('[DATA-012] stores no answer still over 1 000 characters after the gaps are cut', () => {
    const gaps = Array.from({ length: 10 }, () => 'x'.repeat(100));
    expect(storedResponse(gaps.join('[,]'), 'fill-in')).toBeNull();
    expect(storedResponse(gaps.slice(0, 9).join('[,]'), 'fill-in')).toHaveLength(9 * 100 + 8 * 3);
  });
});

describe('[DATA-012] the stored duration', () => {
  it.each([
    ['PT0.95S', 950],
    ['PT1.2345S', 1235],
    ['PT1M2.5S', 62_500],
    ['PT2H', 7_200_000],
    ['P1D', 86_400_000],
    ['PT0S', 0],
  ])('[DATA-012] reads %s as %d ms', (duration, ms) => {
    expect(durationMsOf(duration)).toBe(ms);
  });

  it.each([undefined, '', 'P', 'PT', 'PT1H2', '3.5', 'P1W', '-PT1S', 'PT1.S', 'P1DT0.001S', 'PT25H'])(
    '[DATA-012] stores no duration for %s (absent, unreadable or over 24 hours)',
    (duration) => {
      expect(durationMsOf(duration)).toBeNull();
    },
  );
});

describe('[DATA-012] the platform-scoped context (D-103)', () => {
  it('[DATA-012] joins the platform and the launch’s context, and splits at the first colon', () => {
    const key = platformContextKey(PLATFORM, 'course:with:colons');
    expect(key).toBe(`${PLATFORM}:course:with:colons`);
    expect(parsePlatformContextKey(key)).toEqual({ platformId: PLATFORM, contextId: 'course:with:colons' });
    expect(parsePlatformContextKey('portal')).toBeUndefined();
  });

  it.each([
    ['an upper-case platform ID', PLATFORM.toUpperCase(), 'c'],
    ['a platform ID that is not a UUID', 'canvas', 'c'],
    ['a platform ID with more after it', `${PLATFORM}:x`, 'c'],
    ['an empty context', PLATFORM, ''],
    ['a context over 255 characters', PLATFORM, 'c'.repeat(256)],
  ])('[DATA-012] refuses to build a key from %s', (_case, platformId, contextId) => {
    expect(() => platformContextKey(platformId, contextId)).toThrow();
  });

  it('[DATA-012] gives an LTI principal its launch’s course and a portal principal none', () => {
    // Arrange
    const lti = sealPrincipal({
      userId: 'u',
      learnerKey: 'lk',
      roles: ['learner'],
      mode: 'lti',
      locale: 'nn',
      hvlMember: false,
      feideAuthenticated: false,
      studentAuthor: false,
      lti: {
        platformId: PLATFORM,
        deploymentId: 'd',
        contextId: 'SYK110-H26',
        messageType: 'LtiResourceLinkRequest',
      },
    });
    // Act
    const [canvas, portal] = [principalContextKey(lti), principalContextKey({})];
    // Assert
    expect(canvas).toBe(`${PLATFORM}:SYK110-H26`);
    expect(portal).toBeNull();
  });
});
