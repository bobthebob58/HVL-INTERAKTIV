/**
 * Unit tests for where a resource-link launch starts the NRPS learner count: only after the redirect, with the
 * launch's own context and course, never for a refused launch, and never in a way that holds up or fails the launch.
 *
 * Spec: LTI-008, LTI-006
 */
import type { HttpRequestParameters, HttpResponse, LaunchContext } from 'ltijs';
import { describe, expect, it, vi } from 'vitest';
import type { ContentFacts } from '../../../src/h5p/permissions/ContentAccessRepository.js';
import { onResourceLink } from '../../../src/lti/launch/onResourceLink.js';
import { NrpsLearnerCounter } from '../../../src/lti/nrps/NrpsLearnerCounter.js';

const PLATFORM_ID = '0192f6a8-7c1e-7a35-9d1f-000000000001';
const CONTENT_ID = '0192f6a8-7c1e-7a35-9d1f-3b0c8e2a4f11';
const LEARNER = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';
const PUBLISHED: ContentFacts = {
  contentId: CONTENT_ID,
  ownerUserId: 'owner',
  coAuthorIds: [],
  status: 'published',
  visibility: 'organisation',
  bankListed: false,
};

/** A launch context as ltijs hands it to `onResourceLink`, reduced to what the handler reads. */
function launchContext(order: string[]): LaunchContext {
  const idToken = {
    platform: { url: 'https://canvas.example', id: PLATFORM_ID, deploymentId: 'deployment-1' },
    user: { id: 'sub-1', roles: [LEARNER] },
    launch: {
      type: 'LtiResourceLinkRequest',
      custom: { contentId: CONTENT_ID },
      resource: { id: 'link-1' },
      context: { id: 'course-1', label: 'MAT101' },
    },
    services: { assignmentAndGrades: {} },
  };
  const redirect = () => void order.push('redirect');
  return { idToken, rawIdToken: {}, redirect } as unknown as LaunchContext;
}

/** The handler with stand-in collaborators, recording the order of what happens. */
function handlerWith(order: string[], facts: ContentFacts | undefined = PUBLISHED) {
  const refreshInBackground = vi.fn(() => void order.push('nrps'));
  const handler = onResourceLink({
    accounts: { atLaunch: async () => ({ userId: 'user-1', learnerKey: 'key-1', learnerKeyYear: 2026 }) },
    access: { factsFor: async () => facts },
    placements: { record: async () => (order.push('placement'), 'placement-1') },
    audit: { record: async () => undefined },
    nrps: { refreshInBackground },
  });
  const run = (context: LaunchContext) => handler(context, {} as HttpRequestParameters, {} as HttpResponse);
  return { run, refreshInBackground };
}

describe('[LTI-008] the launch hook for the NRPS learner count', () => {
  it('[LTI-008] starts the count after the redirect, with the launch’s context and its own course', async () => {
    // Arrange
    const order: string[] = [];
    const { run, refreshInBackground } = handlerWith(order);
    const context = launchContext(order);
    // Act
    await run(context);
    // Assert
    expect(order).toEqual(['placement', 'redirect', 'nrps']);
    expect(refreshInBackground).toHaveBeenCalledExactlyOnceWith(
      context,
      expect.objectContaining({ platformId: PLATFORM_ID, contextId: 'course-1' }),
    );
  });

  it('[LTI-008] a refused launch (an activity the learner may not view) starts no count', async () => {
    // Arrange
    const order: string[] = [];
    const { run, refreshInBackground } = handlerWith(order, { ...PUBLISHED, status: 'draft' });
    // Act
    const launch = run(launchContext(order));
    // Assert
    await expect(launch).rejects.toMatchObject({ status: 404 });
    expect(refreshInBackground).not.toHaveBeenCalled();
  });

  it('[LTI-008] the launch neither waits for the roster nor fails when the count does', async () => {
    // Arrange: a real counter whose store never answers, then fails
    const order: string[] = [];
    let failClaim: (error: Error) => void = () => undefined;
    const claim = new Promise<boolean>((_resolve, reject) => (failClaim = reject));
    const warn = vi.fn();
    const counter = new NrpsLearnerCounter({
      store: { claimRefresh: () => claim, retrySoon: async () => undefined, save: async () => undefined },
      logger: { info: () => undefined, warn },
      maxPages: 1,
      forgetToken: async () => undefined,
    });
    const handler = onResourceLink({
      accounts: { atLaunch: async () => ({ userId: 'user-1', learnerKey: 'key-1', learnerKeyYear: 2026 }) },
      access: { factsFor: async () => PUBLISHED },
      placements: { record: async () => 'placement-1' },
      audit: { record: async () => undefined },
      nrps: counter,
    });
    const context = launchContext(order);
    Object.assign(context, { namesAndRoles: { isAvailable: () => true, getMembers: vi.fn() } });
    // Act: the handler resolves while the count still waits; only then does the count fail
    await handler(context, {} as HttpRequestParameters, {} as HttpResponse);
    failClaim(new Error('redis down'));
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    // Assert
    expect(order).toEqual(['redirect']);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'nrps.count-failed' }),
      expect.any(String),
    );
  });
});
