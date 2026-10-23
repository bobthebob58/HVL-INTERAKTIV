/**
 * Tests that the request and response schemas accept what the contract promises and refuse everything else.
 *
 * Spec: DATA-002, PROD-011, PROD-003, UD-022, PROD-006
 */
import { describe, expect, it } from 'vitest';
import {
  contentDetailSchema,
  contentSummarySchema,
  findingsResponseSchema,
  meSchema,
  noticeDismissalRequestSchema,
  noticeIdSchema,
  publishBlockedBodySchema,
  publishRequestSchema,
  REASON_MAX_LENGTH,
  sharingRequestSchema,
} from '../src/index.js';

const at = '2026-10-23T12:00:00.000Z';
const summary = {
  id: '0192f0c4-0000-7000-8000-000000000001',
  title: 'Quiz',
  mainLibrary: 'H5P.MultiChoice',
  status: 'draft',
  visibility: 'private',
  updatedAt: at,
  publishedAt: null,
  role: 'owner',
} as const;
const finding = {
  ruleId: 'V-IMG-ALT',
  severity: 'error',
  requirement: 'UD-021',
  path: 'media.params.alt',
  message: 'Skriv ein alternativ tekst.',
} as const;

describe('[DATA-002] who is signed in', () => {
  it('[DATA-002] me carries mode, language, roles and notices, and refuses a name, e-mail or ID', () => {
    // Arrange
    const me = { kind: 'portal', locale: 'nn', roles: ['author'], dismissedNotices: [] };
    // Act and assert
    expect(Object.keys(meSchema.shape).sort()).toEqual(['dismissedNotices', 'kind', 'locale', 'roles']);
    expect(meSchema.safeParse(me).success).toBe(true);
    for (const extra of [{ displayName: 'Kari' }, { email: 'k@hvl.no' }, { userId: summary.id }]) {
      expect(meSchema.safeParse({ ...me, ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
  });

  it('[PROD-011] a dismissal names an allowlisted notice and a whole version of at least 1', () => {
    expect(noticeIdSchema.safeParse('formative-use').success).toBe(true);
    expect(noticeIdSchema.safeParse('privacy').success).toBe(false);
    expect(noticeDismissalRequestSchema.safeParse({ version: 2 }).success).toBe(true);
    for (const version of [0, -1, 1.5, '1', null]) {
      expect(noticeDismissalRequestSchema.safeParse({ version }).success, String(version)).toBe(false);
    }
  });
});

describe('[PROD-003] activities and publishing', () => {
  it('[PROD-003] a summary has ISO dates and a detail adds what the person may do', () => {
    expect(contentSummarySchema.safeParse(summary).success).toBe(true);
    expect(contentSummarySchema.safeParse({ ...summary, updatedAt: 'yesterday' }).success).toBe(false);
    expect(contentSummarySchema.safeParse({ ...summary, role: null }).success).toBe(false);
    const detail = { ...summary, role: null, mayEdit: false, mayPublish: false };
    expect(contentDetailSchema.safeParse(detail).success).toBe(true);
  });

  it('[UD-022] a reason is trimmed and must hold 1 to 500 characters', () => {
    // Arrange
    const request = (reason: string) => ({
      updatedAt: at,
      acknowledgements: [{ ruleId: 'V-VID-CAPTIONS', path: '', reason }],
    });
    // Act
    const trimmed = publishRequestSchema.parse(request('  Teksting kjem frå Panopto.  '));
    // Assert
    expect(trimmed.acknowledgements[0]?.reason).toBe('Teksting kjem frå Panopto.');
    expect(publishRequestSchema.safeParse(request('   ')).success).toBe(false);
    expect(publishRequestSchema.safeParse(request('x'.repeat(REASON_MAX_LENGTH))).success).toBe(true);
    expect(publishRequestSchema.safeParse(request('x'.repeat(REASON_MAX_LENGTH + 1))).success).toBe(false);
  });

  it('[PROD-003] a publish request needs the checked updatedAt and takes no findings from the client', () => {
    expect(publishRequestSchema.safeParse({ updatedAt: at, acknowledgements: [] }).success).toBe(true);
    expect(publishRequestSchema.safeParse({ acknowledgements: [] }).success).toBe(false);
    expect(
      publishRequestSchema.safeParse({ updatedAt: at, acknowledgements: [], findings: [finding] }).success,
    ).toBe(false);
  });

  it('[UD-022] findings carry their acknowledgement, and a blocked answer carries the findings', () => {
    // Arrange
    const acknowledged = {
      ...finding,
      acknowledgement: { reason: 'Kjem.', at, expiresAt: '2026-11-06T12:00:00.000Z' },
    };
    // Act and assert
    expect(findingsResponseSchema.safeParse({ updatedAt: at, findings: [acknowledged] }).success).toBe(true);
    expect(findingsResponseSchema.safeParse({ updatedAt: at, findings: [finding] }).success).toBe(false);
    const blocked = {
      success: false,
      errorCode: 'hvl:publish-blocked',
      httpStatusCode: 409,
      message: 'Rett feila.',
      findings: [{ ...finding, acknowledgement: null }],
    };
    expect(publishBlockedBodySchema.safeParse(blocked).success).toBe(true);
  });

  it('[PROD-006] a sharing request changes visibility only', () => {
    expect(sharingRequestSchema.safeParse({ visibility: 'feide' }).success).toBe(true);
    expect(sharingRequestSchema.safeParse({ visibility: 'public' }).success).toBe(false);
    expect(sharingRequestSchema.safeParse({ visibility: 'feide', status: 'published' }).success).toBe(false);
  });
});
