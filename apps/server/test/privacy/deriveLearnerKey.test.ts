/**
 * Tests for learner pseudonyms: derivation, the academic-year boundary, missing secrets, and that a Canvas user's
 * pseudonym belongs to one platform registration (D-129).
 *
 * Spec: DATA-002
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { academicYearOf } from '../../src/privacy/academicYear.js';
import {
  MissingPseudonymSecretError,
  deriveLearnerKey,
  pseudonymSource,
} from '../../src/privacy/deriveLearnerKey.js';
import { parsePseudonymSecrets } from '../../src/privacy/pseudonymSecrets.js';

const key2025 = Buffer.alloc(32, 1);
const key2026 = Buffer.alloc(32, 2);
const SECRETS = parsePseudonymSecrets(
  `2025=${key2025.toString('base64')},2026=${key2026.toString('base64')}`,
);
const AUTUMN_2026 = new Date('2026-10-21T12:00:00Z');
const LTI = {
  kind: 'lti',
  issuer: 'https://canvas.instructure.com',
  clientId: '10000000000001',
  subject: 'a6d5c443-1f51-4783',
} as const;

describe('[DATA-002] academic year boundary', () => {
  it('[DATA-002] starts the academic year on 1 August, Oslo time', () => {
    expect(academicYearOf(new Date('2026-07-31T21:59:59Z'))).toBe(2025); // 23:59:59 CEST, 31 July
    expect(academicYearOf(new Date('2026-07-31T22:00:00Z'))).toBe(2026); // 00:00 CEST, 1 August
    expect(academicYearOf(new Date('2027-01-15T12:00:00Z'))).toBe(2026);
    expect(academicYearOf(new Date('2027-08-01T00:00:00Z'))).toBe(2027);
  });
});

describe('[DATA-002] learner key derivation', () => {
  it('[DATA-002] is HMAC-SHA256 of the documented source string with the year secret', () => {
    const expected = createHmac('sha256', key2026)
      .update('lti|https://canvas.instructure.com|10000000000001|a6d5c443-1f51-4783')
      .digest('base64url');
    expect(deriveLearnerKey(LTI, SECRETS, AUTUMN_2026)).toBe(expected);
    expect(expected).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('[DATA-002] is stable within a year and different across years and sources', () => {
    const a = deriveLearnerKey(LTI, SECRETS, AUTUMN_2026);
    expect(deriveLearnerKey(LTI, SECRETS, new Date('2027-03-01T08:00:00Z'))).toBe(a);
    expect(deriveLearnerKey(LTI, SECRETS, new Date('2026-03-01T08:00:00Z'))).not.toBe(a);
    expect(deriveLearnerKey({ ...LTI, subject: 'other' }, SECRETS, AUTUMN_2026)).not.toBe(a);
    expect(deriveLearnerKey({ kind: 'feide', feideId: 'kari@hvl.no' }, SECRETS, AUTUMN_2026)).not.toBe(a);
  });

  it('[DATA-002] the same sub under two registrations of one issuer gives two keys', () => {
    // Arrange: every hosted Canvas sends this issuer; the client ID tells the registrations apart
    const other = { ...LTI, clientId: '10000000000002' };
    // Act
    const keys = [deriveLearnerKey(LTI, SECRETS, AUTUMN_2026), deriveLearnerKey(other, SECRETS, AUTUMN_2026)];
    // Assert
    expect(keys[0]).not.toBe(keys[1]);
    expect(pseudonymSource(other)).toBe(
      'lti|https://canvas.instructure.com|10000000000002|a6d5c443-1f51-4783',
    );
  });

  it("[DATA-002] no sub of one registration gives the text of another registration's user", () => {
    // Arrange: a sub written to look like another registration's client ID and sub
    const crafted = { ...LTI, clientId: '1', subject: '10000000000001|a6d5c443-1f51-4783' };
    // Act
    const sources = [pseudonymSource(crafted), pseudonymSource(LTI)];
    // Assert
    expect(sources[0]).not.toBe(sources[1]);
  });

  it('[DATA-002] never contains the raw identity', () => {
    const key = deriveLearnerKey({ kind: 'feide', feideId: 'kari@hvl.no' }, SECRETS, AUTUMN_2026);
    expect(key).not.toContain('kari');
    expect(pseudonymSource({ kind: 'feide', feideId: 'kari@hvl.no' })).toBe('feide|kari@hvl.no');
  });

  it('[DATA-002] refuses ambiguous or empty sources', () => {
    expect(() => pseudonymSource({ ...LTI, issuer: 'https://a|b' })).toThrow('must not contain');
    expect(() => pseudonymSource({ ...LTI, clientId: '1|2' })).toThrow('must not contain');
    expect(() => pseudonymSource({ ...LTI, issuer: '' })).toThrow('required');
    expect(() => pseudonymSource({ ...LTI, clientId: '' })).toThrow('required');
    expect(() => pseudonymSource({ ...LTI, subject: '' })).toThrow('required');
    expect(() => pseudonymSource({ kind: 'feide', feideId: '' })).toThrow('empty');
  });

  it('[DATA-002] fails with MissingPseudonymSecretError when the year has no secret', () => {
    const at = new Date('2027-09-01T10:00:00Z');
    expect(() => deriveLearnerKey(LTI, SECRETS, at)).toThrow(MissingPseudonymSecretError);
    expect(() => deriveLearnerKey(LTI, SECRETS, at)).toThrow('add "2027=<base64>" to PSEUDONYM_SECRETS');
  });
});
