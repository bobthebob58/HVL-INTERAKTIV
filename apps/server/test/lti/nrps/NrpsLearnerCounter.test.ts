/**
 * Unit tests for when the NRPS learner count does not run at all: a launch without the Names and Roles claim, and a
 * launch whose course cannot form D-103's key. Neither claims the hour, asks NRPS or throws (LTI-008: "if the launch
 * includes the Names and Roles claim").
 *
 * Spec: LTI-008
 */
import { describe, expect, it, vi } from 'vitest';
import { NrpsLearnerCounter, type NrpsLaunch } from '../../../src/lti/nrps/NrpsLearnerCounter.js';

const PLATFORM_ID = '0192f6a8-7c1e-7a35-9d1f-000000000001';

/** A counter on stand-ins, and a launch whose NRPS claim is present or not. */
function counterWith(available: boolean) {
  const store = {
    claimRefresh: vi.fn(async () => true),
    retrySoon: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
  };
  const warn = vi.fn();
  const counter = new NrpsLearnerCounter({
    store,
    logger: { info: vi.fn(), warn },
    maxPages: 1,
    forgetToken: async () => undefined,
  });
  const getMembers = vi.fn(async () => ({ members: [] }));
  const launch: NrpsLaunch = {
    platform: { url: 'https://canvas.example', clientId: '10000000000001' },
    namesAndRoles: { isAvailable: () => available, getMembers },
  };
  return { counter, launch, store, getMembers, warn };
}

describe('[LTI-008] launches the NRPS learner count leaves alone', () => {
  it('[LTI-008] a launch without the Names and Roles claim is not counted: no hour is claimed and NRPS is not asked', async () => {
    // Arrange
    const { counter, launch, store, getMembers, warn } = counterWith(false);
    // Act
    const outcome = await counter.refresh(launch, { platformId: PLATFORM_ID, contextId: 'course-1' });
    // Assert
    expect(outcome).toBe('unavailable');
    expect(store.claimRefresh).not.toHaveBeenCalled();
    expect(getMembers).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['no course', ''],
    ['a context ID too long for D-103’s key', 'c'.repeat(256)],
  ])('[LTI-008] a launch with %s is not counted and nothing throws', async (_case, contextId) => {
    // Arrange
    const { counter, launch, store, getMembers } = counterWith(true);
    // Act
    const outcome = await counter.refresh(launch, { platformId: PLATFORM_ID, contextId });
    // Assert
    expect(outcome).toBe('unavailable');
    expect(store.claimRefresh).not.toHaveBeenCalled();
    expect(getMembers).not.toHaveBeenCalled();
  });

  it('[LTI-008] with the claim and a course, the hour is claimed under D-103’s key and the roster is read', async () => {
    // Arrange
    const { counter, launch, store, getMembers } = counterWith(true);
    // Act
    const outcome = await counter.refresh(launch, { platformId: PLATFORM_ID, contextId: 'course-1' });
    // Assert
    expect(outcome).toBe('counted');
    expect(store.claimRefresh).toHaveBeenCalledExactlyOnceWith(`${PLATFORM_ID}:course-1`);
    expect(getMembers).toHaveBeenCalledOnce();
    expect(store.save).toHaveBeenCalledWith(`${PLATFORM_ID}:course-1`, 0, expect.any(Date));
  });
});
