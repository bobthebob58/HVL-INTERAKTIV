/**
 * Tests that every place that names a Canvas user derives the same text from the same registration and `sub`: the
 * launch (account and learnerKey), account linking's identity source, and the data-subject tool reading an
 * operator's input (D-129).
 *
 * Spec: DATA-002, DATA-008, LTI-001
 */
import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { identitySource } from '../../../src/auth/identity/subjectSources.js';
import { LtiAccounts, type LtiIdentity } from '../../../src/lti/launch/ltiAccount.js';
import { parseDataSubject } from '../../../src/privacy/dsr/dataSubject.js';
import { deriveSubjectKeys } from '../../../src/privacy/dsr/subjectKeys.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';

const ISSUER = 'https://canvas.instructure.com';
const SUB = 'a6d5c443-1f51-4783-ba1a-7686ffe3b54a';
const secrets = new Map([[2026, randomBytes(32)]]);
const hasher = new IdentityHasher(parseKeyring(`a=${randomBytes(32).toString('base64')}`));
const launchOf = (clientId: string): LtiIdentity => ({
  issuer: ISSUER,
  clientId,
  subject: SUB,
  platformId: `platform-of-${clientId}`,
  roles: ['learner'],
});

/** The launch's account step with a resolver that only records the source text it is given. */
const launching = () => {
  const resolve = vi.fn(async (_input: { source: string }) => ({ userId: 'u' }));
  const accounts = new LtiAccounts({
    accounts: { resolve } as never,
    secrets,
    now: () => new Date('2026-10-23T10:00:00Z'),
  });
  return { accounts, sourceGiven: () => resolve.mock.calls[0]?.[0].source ?? '' };
};

describe('[DATA-002] one text for a Canvas user, wherever it is derived', () => {
  it('[DATA-002] the launch, account linking and the data-subject tool agree on the account and the pseudonym', async () => {
    // Arrange
    const { accounts, sourceGiven } = launching();
    const operatorInput = JSON.stringify({ lti: [{ issuer: ISSUER, clientId: 'key-1', sub: SUB }] });
    // Act
    const account = await accounts.atLaunch(launchOf('key-1'));
    const linkingSource = identitySource({ kind: 'lti', issuer: ISSUER, clientId: 'key-1', subject: SUB });
    const tool = deriveSubjectKeys(parseDataSubject(operatorInput), secrets, hasher);
    // Assert
    expect(sourceGiven()).toBe(`lti|${ISSUER}|key-1|${SUB}`);
    expect(linkingSource).toBe(sourceGiven());
    expect(tool.identityHashes.lti).toEqual([hasher.hash('identity-subject', sourceGiven()).hash]);
    expect(tool.learnerKeys).toEqual([account.learnerKey]);
  });

  it('[DATA-008] the tool finds nothing of the same sub under another registration of the same issuer', async () => {
    // Arrange
    const { accounts, sourceGiven } = launching();
    const operatorInput = JSON.stringify({ lti: [{ issuer: ISSUER, clientId: 'key-2', sub: SUB }] });
    // Act
    const account = await accounts.atLaunch(launchOf('key-1'));
    const tool = deriveSubjectKeys(parseDataSubject(operatorInput), secrets, hasher);
    // Assert
    expect(tool.learnerKeys).not.toContain(account.learnerKey);
    expect(tool.identityHashes.lti).not.toContain(hasher.hash('identity-subject', sourceGiven()).hash);
  });
});
