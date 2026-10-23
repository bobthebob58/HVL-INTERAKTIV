/**
 * Tests for content-file grants: format, the hourly expiry, tampering with each part, the expiry boundary, key
 * rotation and removal, and grants for another activity (D-058).
 *
 * Spec: H5P-007, SEC-004
 */
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ContentFileGrants,
  GRANT_CLOCK_SKEW_SECONDS,
  GRANT_LIFETIME_SECONDS,
} from '../../src/h5p/contentFileGrants.js';
import { parseKeyring, purposeKey, type KeyPurpose } from '../../src/security/keys/keyring.js';
import { randomKey } from '../support/authEnv.js';

const CONTENT = '0192f0c4-1111-7000-8000-000000000001';
const OTHER = '0192f0c4-2222-7000-8000-000000000002';
const ISSUED = new Date('2026-10-23T10:20:30.400Z');
const HOUR_AFTER = Date.parse('2026-10-23T11:00:00Z') / 1000;
const ring = (raw = `k1=${randomKey(1)}`) => parseKeyring(raw);
const at = (seconds: number) => new Date(seconds * 1000);

/** Signs like the module, but with any purpose and expiry, to forge grants a key holder could make. */
function forge(raw: string, expiry: number, contentId = CONTENT, purpose: KeyPurpose = 'content-file-url') {
  const key = ring(raw).current;
  const mac = createHmac('sha256', purposeKey(key, purpose))
    .update(`${contentId}|${expiry}`)
    .digest('base64url');
  return `${key.id}.${expiry}.${mac}`;
}

describe('[H5P-007] content-file grants', () => {
  it('[H5P-007] names the current key and an expiry on the next whole hour plus 12 hours, and verifies', () => {
    // Arrange
    const grants = new ContentFileGrants(ring(`new=${randomKey(2)},old=${randomKey(1)}`));
    // Act
    const grant = grants.issueGrant(CONTENT, ISSUED);
    // Assert
    const [keyId, expiry, signature] = grant.split('.');
    expect(keyId).toBe('new');
    expect(Number(expiry)).toBe(HOUR_AFTER + GRANT_LIFETIME_SECONDS);
    expect(signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(grants.verifyGrant(grant, CONTENT, ISSUED)).toEqual({ valid: true, expiresAt: Number(expiry) });
  });

  it('[H5P-007] stays the same within an hour, so file URLs can be cached, and changes after it', () => {
    const grants = new ContentFileGrants(ring());
    const first = grants.issueGrant(CONTENT, at(HOUR_AFTER - 3599));
    expect(grants.issueGrant(CONTENT, at(HOUR_AFTER))).toBe(first);
    expect(grants.issueGrant(CONTENT, ISSUED)).toBe(first);
    expect(grants.issueGrant(CONTENT, at(HOUR_AFTER + 1))).not.toBe(first);
  });

  it('[H5P-007] is valid until one second before its expiry and refused from the expiry on', () => {
    // Arrange
    const grants = new ContentFileGrants(ring());
    const grant = grants.issueGrant(CONTENT, ISSUED);
    const expiry = HOUR_AFTER + GRANT_LIFETIME_SECONDS;
    // Act and assert
    expect(grants.verifyGrant(grant, CONTENT, new Date(expiry * 1000 - 1)).valid).toBe(true);
    expect(grants.verifyGrant(grant, CONTENT, at(expiry))).toEqual({ valid: false, reason: 'expired' });
    expect(grants.verifyGrant(grant, CONTENT, at(expiry + 86_400))).toMatchObject({ reason: 'expired' });
  });

  it('[H5P-007] refuses a grant for another activity', () => {
    const grants = new ContentFileGrants(ring());
    const grant = grants.issueGrant(CONTENT, ISSUED);
    expect(grants.verifyGrant(grant, OTHER, ISSUED)).toEqual({ valid: false, reason: 'wrong-signature' });
    expect(grants.verifyGrant(grant, CONTENT.toUpperCase(), ISSUED)).toMatchObject({ valid: false });
  });

  it('[H5P-007] refuses a change to the key ID, the expiry or any character of the signature', () => {
    // Arrange
    const grants = new ContentFileGrants(ring(`k1=${randomKey(1)},k2=${randomKey(2)}`));
    const grant = grants.issueGrant(CONTENT, ISSUED);
    const [keyId = '', expiry = '', signature = ''] = grant.split('.');
    const check = (changed: string) => grants.verifyGrant(changed, CONTENT, ISSUED);
    // Act and assert: another key of the ring, an unknown key, a shorter (still plausible) expiry.
    expect(check(`k2.${expiry}.${signature}`)).toMatchObject({ reason: 'wrong-signature' });
    expect(check(`k3.${expiry}.${signature}`)).toMatchObject({ reason: 'unknown-key' });
    expect(check(`${keyId}.${Number(expiry) - 3600}.${signature}`)).toMatchObject({
      reason: 'wrong-signature',
    });
    // Act and assert: every character of the signature, each replaced by another base64url character.
    for (let i = 0; i < signature.length; i += 1) {
      const swapped = signature[i] === 'A' ? 'B' : 'A';
      const changed = `${keyId}.${expiry}.${signature.slice(0, i)}${swapped}${signature.slice(i + 1)}`;
      expect(check(changed), `character ${i}`).toEqual({ valid: false, reason: 'wrong-signature' });
    }
  });

  it('[H5P-007] refuses every grant that is not in the one canonical form', () => {
    // Arrange
    const grants = new ContentFileGrants(ring());
    const grant = grants.issueGrant(CONTENT, ISSUED);
    const [keyId = '', expiry = '', signature = ''] = grant.split('.');
    const malformed = [
      '',
      grant.slice(0, -1),
      `${grant}A`,
      `${grant}=`,
      `${grant}.`,
      `.${grant}`,
      `${keyId}.${expiry}`,
      `${keyId}.0${expiry}.${signature}`,
      `${keyId}.+${expiry}.${signature}`,
      `${keyId}.${expiry}.${signature.slice(0, 42)}+`,
      `${keyId}.${expiry}.${Buffer.from(signature, 'base64url').toString('base64')}`,
      `${keyId}.9999999999999.${signature}`,
      `${'k'.repeat(33)}.${expiry}.${signature}`,
      `${keyId} .${expiry}.${signature}`,
      grant.replace(/\./g, '/'),
    ];
    // Act and assert
    for (const value of malformed) {
      expect(grants.verifyGrant(value, CONTENT, ISSUED), value).toEqual({
        valid: false,
        reason: 'malformed',
      });
    }
  });

  it('[H5P-007] refuses a correctly signed expiry further ahead than any grant it issues', () => {
    // Arrange: the latest expiry issued now is the next hour plus 12 hours; nodes may differ by the clock skew.
    const raw = `k1=${randomKey(1)}`;
    const grants = new ContentFileGrants(ring(raw));
    const now = HOUR_AFTER - 1;
    const latest = now + 3600 + GRANT_LIFETIME_SECONDS + GRANT_CLOCK_SKEW_SECONDS;
    // Act and assert
    expect(grants.verifyGrant(forge(raw, latest), CONTENT, at(now)).valid).toBe(true);
    expect(grants.verifyGrant(forge(raw, latest + 1), CONTENT, at(now))).toEqual({
      valid: false,
      reason: 'too-far-ahead',
    });
    expect(grants.verifyGrant(forge(raw, now + 365 * 86_400), CONTENT, at(now))).toMatchObject({
      reason: 'too-far-ahead',
    });
  });

  it('[H5P-007] accepts a grant from a node whose clock runs a few minutes ahead', () => {
    const grants = new ContentFileGrants(ring());
    const grant = grants.issueGrant(CONTENT, at(HOUR_AFTER + 120));
    expect(grants.verifyGrant(grant, CONTENT, at(HOUR_AFTER - 60)).valid).toBe(true);
  });

  it('[H5P-007] binds the signature to the content-file purpose of the key', () => {
    const raw = `k1=${randomKey(1)}`;
    const grants = new ContentFileGrants(ring(raw));
    const expiry = HOUR_AFTER + GRANT_LIFETIME_SECONDS;
    expect(grants.verifyGrant(forge(raw, expiry), CONTENT, ISSUED).valid).toBe(true);
    expect(grants.verifyGrant(forge(raw, expiry, CONTENT, 'identity-subject'), CONTENT, ISSUED)).toEqual({
      valid: false,
      reason: 'wrong-signature',
    });
  });

  it('[H5P-007] keeps grants of an older key valid after rotation, and refuses them once the key is removed', () => {
    // Arrange
    const oldGrant = new ContentFileGrants(ring(`old=${randomKey(1)}`)).issueGrant(CONTENT, ISSUED);
    const rotated = new ContentFileGrants(ring(`new=${randomKey(2)},old=${randomKey(1)}`));
    const removed = new ContentFileGrants(ring(`new=${randomKey(2)}`));
    // Act and assert
    expect(rotated.verifyGrant(oldGrant, CONTENT, ISSUED).valid).toBe(true);
    expect(rotated.issueGrant(CONTENT, ISSUED)).toMatch(/^new\./);
    expect(removed.verifyGrant(oldGrant, CONTENT, ISSUED)).toEqual({ valid: false, reason: 'unknown-key' });
    expect(removed.verifyGrant(rotated.issueGrant(CONTENT, ISSUED), CONTENT, ISSUED).valid).toBe(true);
  });

  it('[H5P-007] a grant from another installation with the same key ID is refused', () => {
    const ours = new ContentFileGrants(ring(`k1=${randomKey(1)}`));
    const theirs = new ContentFileGrants(ring(`k1=${randomKey(3)}`)).issueGrant(CONTENT, ISSUED);
    expect(ours.verifyGrant(theirs, CONTENT, ISSUED)).toEqual({ valid: false, reason: 'wrong-signature' });
  });
});
