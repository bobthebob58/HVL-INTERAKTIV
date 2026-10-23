/**
 * Tests for linking an author's Canvas and Feide identities (D-063): every case of the decision, and reading
 * `feide_login` only for authors.
 *
 * Spec: AUTH-005
 */
import { describe, expect, it } from 'vitest';
import {
  decideLink,
  feideLoginFromLaunch,
  type LinkDecision,
  type LinkSituation,
} from '../../../src/auth/identity/linkDecision.js';
import type { Role } from '../../../src/auth/Principal.js';

const CUSTOM = 'https://purl.imsglobal.org/spec/lti/claim/custom';
const L = 'acc-lti';
const F = 'acc-feide';

describe('[AUTH-005] link decision (D-063)', () => {
  it.each<[string, LinkSituation, LinkDecision]>([
    ['neither identity exists', { lti: undefined, feide: undefined }, { kind: 'no-feide-account' }],
    [
      'only the Feide identity exists',
      { lti: undefined, feide: { accountId: F } },
      { kind: 'link-new', feideAccountId: F },
    ],
    [
      'only the LTI identity exists (no Feide ID is ever claimed from Canvas)',
      { lti: { accountId: L, ownsAnything: false }, feide: undefined },
      { kind: 'no-feide-account' },
    ],
    [
      'both are in one account',
      { lti: { accountId: F, ownsAnything: true }, feide: { accountId: F } },
      { kind: 'already-linked', accountId: F },
    ],
    [
      'both differ and the LTI account owns nothing',
      { lti: { accountId: L, ownsAnything: false }, feide: { accountId: F } },
      { kind: 'move-lti-to-feide', fromAccountId: L, toAccountId: F },
    ],
    [
      'both differ and the LTI account owns content',
      { lti: { accountId: L, ownsAnything: true }, feide: { accountId: F } },
      { kind: 'conflict', ltiAccountId: L, feideAccountId: F },
    ],
  ])('[AUTH-005] %s', (_case, situation, expected) => {
    expect(decideLink(situation)).toEqual(expected);
  });

  it('[AUTH-005] never moves an identity away from content it owns', () => {
    // Arrange: every situation in which the LTI account owns something.
    const owning = [undefined, { accountId: F }, { accountId: L }].map((feide) => ({
      lti: { accountId: L, ownsAnything: true },
      feide,
    }));
    // Act
    const kinds = owning.map((situation) => decideLink(situation).kind);
    // Assert
    expect(kinds).not.toContain('move-lti-to-feide');
    expect(kinds).toEqual(['no-feide-account', 'conflict', 'already-linked']);
  });
});

describe('[AUTH-005] feide_login from a Deep Linking launch', () => {
  const launch = (feideLogin: unknown) => ({ [CUSTOM]: { contentId: 'c1', feide_login: feideLogin } });

  it.each([
    ['a Feide ID', 'ola@hvl.no', 'ola@hvl.no'],
    ['a Feide ID with blanks and capitals', '  Ola.Nordmann@HVL.no ', 'ola.nordmann@hvl.no'],
  ])('[AUTH-005] reads %s for an author', (_case, value, expected) => {
    expect(feideLoginFromLaunch(launch(value), ['author'])).toBe(expected);
  });

  it.each<[string, Role[]]>([
    ['a learner', ['learner']],
    ['no roles', []],
  ])('[AUTH-005] ignores feide_login for %s, so learner identities are never linked', (_case, roles) => {
    expect(feideLoginFromLaunch(launch('ola@hvl.no'), roles)).toBeUndefined();
  });

  it.each([
    ['the unexpanded Canvas variable', '$Canvas.user.loginId'],
    ['an unexpanded variable after blanks', '  $Canvas.user.loginId'],
    ['a login ID that is not a Feide ID', 'ola'],
    ['a login ID with a comma', 'ola,kari@hvl.no'],
    ['an empty value', ''],
    ['a value that is not text', ['ola@hvl.no']],
    ['a missing value', undefined],
  ])('[AUTH-005] ignores %s', (_case, value) => {
    expect(feideLoginFromLaunch(launch(value), ['author'])).toBeUndefined();
  });

  it.each([
    ['no custom claim', {}],
    ['a custom claim that is not an object', { [CUSTOM]: 'feide_login=ola@hvl.no' }],
    ['feide_login outside the custom claim', { feide_login: 'ola@hvl.no' }],
  ])('[AUTH-005] finds nothing with %s', (_case, claims) => {
    expect(feideLoginFromLaunch(claims, ['author'])).toBeUndefined();
  });
});
