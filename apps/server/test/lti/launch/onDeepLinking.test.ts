/**
 * Unit tests for the Deep Linking launch handler with fakes: which account a linking outcome is audited on, that a
 * link already written is audited even when the launch then fails, and that a learner is refused before linking.
 *
 * Spec: AUTH-005, LTI-005, LTI-004
 */
import type { IdToken, LaunchContext } from 'ltijs';
import { describe, expect, it, vi } from 'vitest';
import type { AuthAuditInput } from '../../../src/auth/audit/AuthAuditRecorder.js';
import type { LinkOutcome } from '../../../src/auth/identity/accountLinking.js';
import { onDeepLinking } from '../../../src/lti/launch/onDeepLinking.js';

const LIS = 'http://purl.imsglobal.org/vocab/lis/v2/membership#';

/** A Deep Linking launch context with the given LTI role. */
const contextAs = (role: string) => {
  const redirect = vi.fn();
  const idToken = {
    user: { id: 'sub-1', roles: [`${LIS}${role}`] },
    platform: { id: 'platform-1', url: 'https://canvas.example', clientId: 'c', deploymentId: '1:abc' },
    launch: { type: 'LtiDeepLinkingRequest', context: { id: 'course-1' }, custom: {} },
    services: { assignmentAndGrades: { available: false } },
  } as unknown as IdToken;
  const context = {
    idToken,
    rawIdToken: {},
    platform: { clientId: 'c' },
    redirect,
  } as unknown as LaunchContext;
  return { context, redirect };
};

/** The handler with a linker that answers `linked` and an account step that may fail. */
const handlerWith = (linked: LinkOutcome | undefined, atLaunch: () => Promise<{ userId: string }>) => {
  const audited: AuthAuditInput[] = [];
  const link = vi.fn(async () => linked);
  const handler = onDeepLinking({
    accounts: { atLaunch: vi.fn(atLaunch) as never },
    audit: { record: async (input) => void audited.push(input) },
    link,
  });
  return { handler, audited, link };
};
const run = (handler: ReturnType<typeof onDeepLinking>, context: LaunchContext) =>
  handler(context, {} as never, {} as never);

describe('[AUTH-005] the Deep Linking launch handler', () => {
  it('[AUTH-005] audits the launch and then the link on the account the launch uses, and opens the picker', async () => {
    // Arrange
    const joined: LinkOutcome = { event: 'link.feide-lti', reason: 'link-joined' };
    const { handler, audited } = handlerWith(joined, async () => ({ userId: 'feide-account' }));
    const { context, redirect } = contextAs('Instructor');
    // Act
    await run(handler, context);
    // Assert
    expect(audited).toEqual([
      { event: 'launch.lti.author', actorUserId: 'feide-account' },
      { ...joined, actorUserId: 'feide-account' },
    ]);
    expect(redirect).toHaveBeenCalledWith(expect.anything(), '/lti/deeplink');
  });

  it('[AUTH-005] a link already written is audited without an actor when the launch then fails', async () => {
    // Arrange
    const joined: LinkOutcome = { event: 'link.feide-lti', reason: 'link-joined' };
    const { handler, audited } = handlerWith(joined, async () => Promise.reject(new Error('db down')));
    // Act
    const launch = run(handler, contextAs('Instructor').context);
    // Assert
    await expect(launch).rejects.toThrow('db down');
    expect(audited).toEqual([joined]);
  });

  it('[LTI-004][LTI-005] a learner is refused before anything is linked or audited', async () => {
    const { handler, audited, link } = handlerWith(undefined, async () => ({ userId: 'u' }));
    await expect(run(handler, contextAs('Learner').context)).rejects.toMatchObject({
      errorCode: 'hvl:deep-link-not-allowed',
    });
    expect(link).not.toHaveBeenCalled();
    expect(audited).toEqual([]);
  });
});
