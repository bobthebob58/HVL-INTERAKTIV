/**
 * Tests for reading Feide claims: the Feide ID as the Feide subject (D-054), and data minimisation of name and
 * e-mail (authors and admins only; the national identity number never read).
 *
 * Spec: AUTH-004, AUTH-002
 */
import { describe, expect, it } from 'vitest';
import {
  authorProfile,
  FEIDE_ID_CLAIM,
  FEIDE_USERID_SEC_CLAIM,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
  readFeideIdentity,
} from '../../../src/auth/feide/feideClaims.js';
import type { Role } from '../../../src/auth/Principal.js';

const NIN_CLAIM = 'https://n.feide.no/claims/nin';

/** Claims as Feide releases them with every attribute group of AUTH-001 authorised. */
const CLAIMS: Record<string, unknown> = {
  iss: 'https://auth.dataporten.no',
  sub: '76a7a061-3c55-430d-8ee0-6f82ec42501f',
  name: 'Ola Nordmann',
  email: 'ola.nordmann@hvl.no',
  email_verified: false,
  [FEIDE_ID_CLAIM]: 'ola@hvl.no',
  [FEIDE_USERID_SEC_CLAIM]: ['feide:ola@hvl.no'],
};

/** Records which claims a function reads, and fails the test if it reads the national identity number. */
function watched(claims: Record<string, unknown>): { claims: Record<string, unknown>; read: string[] } {
  const read: string[] = [];
  const proxy = new Proxy(claims, {
    get(target, key, receiver) {
      if (typeof key === 'string') read.push(key);
      if (key === NIN_CLAIM) throw new Error('the nin claim was read');
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
  return { claims: proxy, read };
}

describe('[AUTH-002] Feide ID from the claims (D-054)', () => {
  it.each([
    ['eduPersonPrincipalName', { [FEIDE_ID_CLAIM]: 'ola@hvl.no' }, 'ola@hvl.no'],
    [
      'eduPersonPrincipalName, trimmed and lower-cased',
      { [FEIDE_ID_CLAIM]: '  Ola.Nordmann@HVL.no ' },
      'ola.nordmann@hvl.no',
    ],
    [
      'the feide: entry of userid_sec when eduPersonPrincipalName is missing',
      { [FEIDE_USERID_SEC_CLAIM]: ['nin:01017012345', 'feide:Kari@hvl.no'] },
      'kari@hvl.no',
    ],
    [
      'userid_sec entries that all name the same Feide ID',
      { [FEIDE_USERID_SEC_CLAIM]: ['feide:ola@hvl.no', 'nin:01017012345', 'feide:OLA@hvl.no'] },
      'ola@hvl.no',
    ],
    [
      'eduPersonPrincipalName over a different userid_sec entry',
      { [FEIDE_ID_CLAIM]: 'ola@hvl.no', [FEIDE_USERID_SEC_CLAIM]: ['feide:kari@hvl.no'] },
      'ola@hvl.no',
    ],
  ])('[AUTH-002] reads %s', (_case, claims, feideId) => {
    expect(readFeideIdentity(claims)).toEqual({ feideId, realm: 'hvl.no' });
  });

  it.each([
    ['no Feide ID claim at all (a guest or eduGAIN login)', { sub: 'x', name: 'Guest' }],
    [
      'a userid_sec without a feide: entry',
      { [FEIDE_USERID_SEC_CLAIM]: ['nin:01017012345', 'eduGAIN:x@uni.example'] },
    ],
    ['a userid_sec that is not a list', { [FEIDE_USERID_SEC_CLAIM]: 'feide:ola@hvl.no' }],
    ['a malformed ID', { [FEIDE_ID_CLAIM]: 'ola@hvl' }],
    ['an ID with a comma (it would split ADMIN_FEIDE_IDS)', { [FEIDE_ID_CLAIM]: 'ola,kari@hvl.no' }],
    ['an ID that is not text', { [FEIDE_ID_CLAIM]: ['ola@hvl.no'] }],
    [
      'a malformed eduPersonPrincipalName next to a valid userid_sec (no fallback)',
      { [FEIDE_ID_CLAIM]: 'ola', [FEIDE_USERID_SEC_CLAIM]: ['feide:ola@hvl.no'] },
    ],
    [
      'an eduPersonPrincipalName that is null',
      { [FEIDE_ID_CLAIM]: null, [FEIDE_USERID_SEC_CLAIM]: ['feide:ola@hvl.no'] },
    ],
    [
      'two different Feide IDs in userid_sec',
      { [FEIDE_USERID_SEC_CLAIM]: ['feide:ola@hvl.no', 'feide:kari@hvl.no'] },
    ],
    [
      'a malformed feide: entry before a valid one',
      { [FEIDE_USERID_SEC_CLAIM]: ['feide:ola', 'feide:kari@hvl.no'] },
    ],
  ])('[AUTH-002] finds no Feide ID for %s', (_case, claims) => {
    expect(readFeideIdentity(claims)).toBeUndefined();
  });

  it('[AUTH-004] reads only the two Feide ID claims: never sub, name, e-mail or the nin claim', () => {
    // Arrange
    const { [FEIDE_ID_CLAIM]: _absent, ...withoutPrincipalName } = CLAIMS;
    const { claims, read } = watched({ ...withoutPrincipalName, [NIN_CLAIM]: '01017012345' });
    // Act
    const identity = readFeideIdentity(claims);
    // Assert
    expect(identity).toEqual({ feideId: 'ola@hvl.no', realm: 'hvl.no' });
    expect(new Set(read)).toEqual(new Set([FEIDE_ID_CLAIM, FEIDE_USERID_SEC_CLAIM]));
  });
});

describe('[AUTH-004] name and e-mail kept for authors and admins only', () => {
  it.each<[string, Role[]]>([
    ['author', ['author']],
    ['admin', ['learner', 'admin']],
  ])('[AUTH-004] keeps the display name and e-mail of an %s', (_case, roles) => {
    expect(authorProfile(CLAIMS, roles)).toEqual({
      displayName: 'Ola Nordmann',
      email: 'ola.nordmann@hvl.no',
    });
  });

  it('[AUTH-004] drops name and e-mail for a learner and reads neither', () => {
    // Arrange
    const { claims, read } = watched({ ...CLAIMS, [NIN_CLAIM]: '01017012345' });
    // Act
    const profile = authorProfile(claims, ['learner']);
    // Assert
    expect(profile).toEqual({});
    expect(read).toEqual([]);
  });

  it('[AUTH-004] never reads the nin claim for an author either', () => {
    const { claims, read } = watched({ ...CLAIMS, [NIN_CLAIM]: '01017012345' });
    authorProfile(claims, ['author']);
    expect(read).not.toContain(NIN_CLAIM);
  });

  it.each([
    ['blank', '   ', 'ola@hvl.no', { email: 'ola@hvl.no' }],
    ['too long', 'x'.repeat(MAX_DISPLAY_NAME_LENGTH + 1), 'ola@hvl.no', { email: 'ola@hvl.no' }],
    [
      'at the limit',
      'x'.repeat(MAX_DISPLAY_NAME_LENGTH),
      undefined,
      { displayName: 'x'.repeat(MAX_DISPLAY_NAME_LENGTH) },
    ],
    ['with a line break', 'Ola\nNordmann', undefined, {}],
    ['not text', ['Ola'], 42, {}],
  ])('[AUTH-004] leaves out a name that is %s', (_case, name, email, expected) => {
    expect(authorProfile({ name, email }, ['author'])).toEqual(expected);
  });

  it.each([
    ['without an @', 'ola.hvl.no'],
    ['with a space', 'ola nordmann@hvl.no'],
    ['too long', `${'o'.repeat(MAX_EMAIL_LENGTH)}@hvl.no`],
    ['with a control character', 'ola@hvl.no\r\nBcc: x@evil.example'],
  ])('[AUTH-004] leaves out an e-mail address %s', (_case, email) => {
    expect(authorProfile({ name: 'Ola', email }, ['author'])).toEqual({ displayName: 'Ola' });
  });

  it('[AUTH-004] trims the stored values and returns a frozen profile', () => {
    const profile = authorProfile({ name: '  Ola  ', email: ' ola@hvl.no ' }, ['author']);
    expect(profile).toEqual({ displayName: 'Ola', email: 'ola@hvl.no' });
    expect(Object.isFrozen(profile)).toBe(true);
  });
});
