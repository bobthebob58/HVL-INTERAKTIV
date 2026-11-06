/**
 * Unit tests for deriving a data subject's pseudonyms (DATA-008, DATA-002, D-108): one learnerKey per configured year
 * and identifier, equal to the key a login or launch in that year made; identity hashes under every identity key;
 * a refusal without secrets.
 *
 * Spec: DATA-008, DATA-002
 */
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { identitySource } from '../../../src/auth/identity/subjectSources.js';
import { deriveLearnerKey } from '../../../src/privacy/deriveLearnerKey.js';
import {
  NoPseudonymSecretsError,
  deriveSubjectKeys,
  momentInAcademicYear,
} from '../../../src/privacy/dsr/subjectKeys.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';

const ISS = 'https://canvas.instructure.com';
const secrets = new Map([
  [2026, randomBytes(32)],
  [2025, randomBytes(32)],
]);
const ring = parseKeyring(`b=${randomBytes(32).toString('base64')},a=${randomBytes(32).toString('base64')}`);
const hasher = new IdentityHasher(ring);
const subject = { feideId: 'kari@hvl.no', lti: [{ issuer: ISS, subject: 's-1' }] };

describe('[DATA-008] deriveSubjectKeys', () => {
  it('[DATA-008] derives one key per configured year and identifier, the key a login or launch in that year made', () => {
    // Arrange: a portal login on 1 August 2025 at 00:00 in Oslo, and a Canvas launch in May 2027.
    const login2025 = deriveLearnerKey(
      { kind: 'feide', feideId: 'kari@hvl.no' },
      secrets,
      new Date('2025-07-31T22:00:00Z'),
    );
    const launch2026 = deriveLearnerKey(
      { kind: 'lti', issuer: ISS, subject: 's-1' },
      secrets,
      new Date('2027-05-02T08:00:00Z'),
    );
    // Act
    const keys = deriveSubjectKeys(subject, secrets, hasher);
    // Assert
    expect(keys.years).toEqual([2025, 2026]);
    expect(keys.pseudonyms.map((p) => [p.academicYear, p.variant, p.ltiIndex])).toEqual([
      [2025, 'feide', undefined],
      [2025, 'lti', 1],
      [2026, 'feide', undefined],
      [2026, 'lti', 1],
    ]);
    expect(keys.pseudonyms[0]?.learnerKey).toBe(login2025);
    expect(keys.pseudonyms[3]?.learnerKey).toBe(launch2026);
    expect(new Set(keys.learnerKeys).size).toBe(4);
    expect(keys.identifiers).toEqual({ feide: 1, lti: 1 });
  });

  it('[DATA-008] hashes each identifier under every identity key, so an identity from before a rotation is found', () => {
    // Arrange
    const older = new IdentityHasher(parseKeyring(`a=${ring.keys[1]?.secret.toString('base64') ?? ''}`));
    const source = identitySource({ kind: 'lti', issuer: ISS, subject: 's-1' });
    // Act
    const keys = deriveSubjectKeys(subject, secrets, hasher);
    // Assert
    expect(keys.identityHashes.lti).toHaveLength(2);
    expect(keys.identityHashes.lti).toContain(older.hash('identity-subject', source).hash);
    expect(keys.identityHashes.feide).toEqual(
      hasher.candidates('identity-subject', 'feide|kari@hvl.no').map((c) => c.hash),
    );
  });

  it('[DATA-008] refuses to derive anything without a configured pseudonym secret', () => {
    // Act and assert
    expect(() => deriveSubjectKeys(subject, new Map(), hasher)).toThrow(NoPseudonymSecretsError);
  });

  it('[DATA-008] picks a moment inside the named academic year, whatever the server’s time zone', () => {
    // Act and assert
    expect(momentInAcademicYear(2040).toISOString()).toBe('2041-01-15T12:00:00.000Z');
  });
});
