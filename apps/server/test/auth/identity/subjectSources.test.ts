/**
 * Tests for the identity-hash and learnerKey sources: one checked subject, in the DATA-002 format, for both.
 *
 * Spec: DATA-002
 */
import { describe, expect, it } from 'vitest';
import {
  identitySource,
  learnerSourceOf,
  type IdentitySubject,
} from '../../../src/auth/identity/subjectSources.js';
import { pseudonymSource } from '../../../src/privacy/deriveLearnerKey.js';

const FEIDE: IdentitySubject = { kind: 'feide', feideId: 'ola@hvl.no' };
const LTI = {
  kind: 'lti',
  issuer: 'https://canvas.instructure.com',
  subject: 'a6d5c443-1f51-4783-ba1a-7686ffe3b54a',
} as const satisfies IdentitySubject;

describe('[DATA-002] identity and learnerKey sources', () => {
  it.each([
    ['a Feide ID', FEIDE, 'feide|ola@hvl.no'],
    [
      'an LTI issuer and subject',
      LTI,
      'lti|https://canvas.instructure.com|a6d5c443-1f51-4783-ba1a-7686ffe3b54a',
    ],
    [
      'an LTI subject containing "|" (kept unambiguous by the issuer rule)',
      { ...LTI, subject: 'a|b' },
      'lti|https://canvas.instructure.com|a|b',
    ],
  ])('[DATA-002] hashes %s in the documented format', (_case, subject, expected) => {
    expect(identitySource(subject)).toBe(expected);
  });

  it.each([FEIDE, LTI])(
    '[DATA-002] gives the learnerKey exactly the text the identity hash uses (%j)',
    (subject) => {
      // Act
      const learnerSource = learnerSourceOf(subject);
      // Assert
      expect(pseudonymSource(learnerSource)).toBe(identitySource(subject));
      expect(learnerSource).toEqual(subject);
      expect(learnerSource).not.toBe(subject);
    },
  );

  it('[DATA-002] keeps the LTI subject exactly, because LTI subjects are case-sensitive', () => {
    expect(identitySource({ ...LTI, subject: 'AbC' })).not.toBe(identitySource({ ...LTI, subject: 'abc' }));
  });

  it.each([
    ['upper case', 'Ola@hvl.no'],
    ['surrounding blanks', ' ola@hvl.no'],
    ['no realm', 'ola'],
    ['an empty string', ''],
  ])('[DATA-002] refuses a Feide ID with %s, without echoing it', (_case, feideId) => {
    const subject: IdentitySubject = { kind: 'feide', feideId };
    expect(() => identitySource(subject)).toThrow(/^the Feide subject must be a normalised Feide ID$/);
    expect(() => learnerSourceOf(subject)).toThrow(/^the Feide subject must be a normalised Feide ID$/);
  });

  it.each([
    ['an empty issuer', { ...LTI, issuer: '' }, 'LTI issuer and subject are required'],
    ['an empty subject', { ...LTI, subject: '' }, 'LTI issuer and subject are required'],
    [
      'an issuer containing "|"',
      { ...LTI, issuer: 'https://evil.example|x' },
      'LTI issuer must not contain "|"',
    ],
  ])('[DATA-002] refuses %s', (_case, subject, message) => {
    expect(() => identitySource(subject)).toThrow(message);
    expect(() => learnerSourceOf(subject)).toThrow(message);
  });
});
