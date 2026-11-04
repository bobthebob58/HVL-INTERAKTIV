/**
 * Unit tests for reading a course roster through ltijs's `namesAndRoles`, on a stand-in launch: what is asked for
 * (the full Learner role URI, pages of 50, the page limit), when the roster is incomplete, the one new token after a
 * 401 and no other retry, and the time limit.
 *
 * Spec: LTI-008
 */
import { describe, expect, it, vi } from 'vitest';
import { LEARNER_ROLE_URI } from '../../../src/lti/nrps/activeLearners.js';
import {
  httpStatusOf,
  NRPS_PAGE_SIZE,
  readLearnerRoster,
  type NrpsLaunch,
} from '../../../src/lti/nrps/nrpsRosterRead.js';

const PLATFORM = { url: 'https://canvas.example', clientId: '10000000000001' };
const MEMBERS = [{ userId: 'a', roles: [LEARNER_ROLE_URI] }];
/** An error as ltijs's request handler throws it for an HTTP status. */
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

/** A launch whose `getMembers` answers each call in turn. */
function launchAnswering(...answers: (Error | { next?: string })[]) {
  const getMembers = vi.fn(async () => {
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    return { members: MEMBERS, ...answer };
  });
  const launch: NrpsLaunch = { platform: PLATFORM, namesAndRoles: { isAvailable: () => true, getMembers } };
  return { launch, getMembers };
}

describe('[LTI-008] reading a roster from NRPS', () => {
  it('[LTI-008] asks for the full Learner role URI in pages of 50, up to the page limit', async () => {
    // Arrange
    const { launch, getMembers } = launchAnswering({});
    const forgetToken = vi.fn(async () => undefined);
    // Act
    const roster = await readLearnerRoster(launch, { maxPages: 7, forgetToken });
    // Assert
    expect(getMembers).toHaveBeenCalledWith({ role: LEARNER_ROLE_URI, limit: NRPS_PAGE_SIZE, pages: 7 });
    expect(NRPS_PAGE_SIZE).toBe(50);
    expect(roster).toEqual({ members: MEMBERS, complete: true });
    expect(forgetToken).not.toHaveBeenCalled();
  });

  it('[LTI-008] a roster with a page left after the limit is incomplete', async () => {
    const { launch } = launchAnswering({
      next: 'https://canvas.example/api/lti/courses/1/names_and_roles?page=3',
    });
    const roster = await readLearnerRoster(launch, { maxPages: 2, forgetToken: async () => undefined });
    expect(roster.complete).toBe(false);
  });

  it('[LTI-008] after a 401 the cached token is dropped and the roster is read once more', async () => {
    // Arrange
    const { launch, getMembers } = launchAnswering(httpError(401), {});
    const forgetToken = vi.fn(async () => undefined);
    // Act
    const roster = await readLearnerRoster(launch, { maxPages: 1, forgetToken });
    // Assert
    expect(roster.complete).toBe(true);
    expect(forgetToken).toHaveBeenCalledExactlyOnceWith(PLATFORM);
    expect(getMembers).toHaveBeenCalledTimes(2);
  });

  it('[LTI-008] a second 401 is thrown, with no third try', async () => {
    // Arrange
    const { launch, getMembers } = launchAnswering(httpError(401), httpError(401), {});
    // Act
    const read = readLearnerRoster(launch, { maxPages: 1, forgetToken: async () => undefined });
    // Assert
    await expect(read).rejects.toMatchObject({ status: 401 });
    expect(getMembers).toHaveBeenCalledTimes(2);
  });

  it.each([403, 404, 429, 500, 503])(
    '[LTI-008] an answer %i is thrown at once: retries are decided on the status, and only 401 has one',
    async (status) => {
      // Arrange
      const { launch, getMembers } = launchAnswering(httpError(status), {});
      const forgetToken = vi.fn(async () => undefined);
      // Act
      const read = readLearnerRoster(launch, { maxPages: 1, forgetToken });
      // Assert
      await expect(read).rejects.toMatchObject({ status });
      expect(getMembers).toHaveBeenCalledTimes(1);
      expect(forgetToken).not.toHaveBeenCalled();
    },
  );

  it('[LTI-008] a read that takes longer than the time limit fails', async () => {
    // Arrange
    const launch: NrpsLaunch = {
      platform: PLATFORM,
      namesAndRoles: { isAvailable: () => true, getMembers: () => new Promise(() => undefined) },
    };
    // Act
    const read = readLearnerRoster(launch, {
      maxPages: 1,
      forgetToken: async () => undefined,
      timeoutMs: 20,
    });
    // Assert
    await expect(read).rejects.toThrow('NRPS timeout');
  });

  it('[LTI-008] only a numeric status counts as an HTTP status', () => {
    expect(httpStatusOf(httpError(503))).toBe(503);
    expect(httpStatusOf(Object.assign(new Error('x'), { status: '401' }))).toBeUndefined();
    expect(httpStatusOf(new Error('network'))).toBeUndefined();
    expect(httpStatusOf(null)).toBeUndefined();
  });
});
