/**
 * Unit tests for when the NRPS learner count does not run at all: a launch without the Names and Roles claim, a
 * launch whose course cannot form D-103's key, and a launch whose roster URL D-104's line-item rule refuses (D-106's
 * amendment of 2026-11-04). None claims the hour, asks NRPS or throws (LTI-008: "if the launch includes the Names and
 * Roles claim"). And the server's builder hands `CANVAS_ORIGINS` on to the counter, so an institution's roster is read.
 *
 * Spec: LTI-008
 */
import { describe, expect, it, vi } from 'vitest';
import type { LineItemUrlRules } from '../../../src/grades/lineItemUrlPolicy.js';
import type { Database } from '../../../src/infra/prismaClient.js';
import type { Redis } from '../../../src/infra/redisClient.js';
import { NrpsLearnerCounter, type NrpsCountedLaunch } from '../../../src/lti/nrps/NrpsLearnerCounter.js';
import { createNrpsServices } from '../../../src/lti/nrps/nrpsServices.js';
import { NRPS_CLAIM } from '../../../src/lti/nrps/nrpsServiceUrl.js';

const PLATFORM_ID = '0192f6a8-7c1e-7a35-9d1f-000000000001';
const ROSTER = 'https://canvas.example/api/lti/courses/1/names_and_roles';

/** A counter on stand-ins, and a launch whose NRPS claim is present or not, naming `roster` as its URL. */
function counterWith(available: boolean, roster: string | null = ROSTER, urlRules?: LineItemUrlRules) {
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
    ...(urlRules ? { urlRules } : {}),
  });
  const getMembers = vi.fn(async () => ({ members: [] }));
  const launch: NrpsCountedLaunch = {
    platform: {
      url: 'https://canvas.example',
      clientId: '10000000000001',
      authenticationEndpoint: 'https://sso.canvaslms.example/api/lti/authorize_redirect',
      accessTokenEndpoint: 'https://sso.canvaslms.example/login/oauth2/token',
    },
    rawIdToken: roster === null ? {} : { [NRPS_CLAIM]: { context_memberships_url: roster } },
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

describe('[LTI-008] the roster URL a launch names (D-104’s line-item rule, D-106 amendment)', () => {
  const course = { platformId: PLATFORM_ID, contextId: 'course-1' };

  it.each([
    [
      'another origin',
      'https://evil.example/api/lti/courses/1/names_and_roles',
      'origin',
      'https://evil.example',
    ],
    [
      'a user name in it',
      'https://canvas.example@evil.example/roster',
      'credentials',
      'https://evil.example',
    ],
    ['no URL in the claim', null, 'invalid', undefined],
    ['no http(s) URL', 'ftp://canvas.example/roster', 'invalid', undefined],
  ])(
    '[LTI-008] %s: no hour is claimed, NRPS is not asked, and the log names the origin only',
    async (_c, url, reason, origin) => {
      // Arrange
      const { counter, launch, store, getMembers, warn } = counterWith(true, url);
      // Act
      const outcome = await counter.refresh(launch, course);
      // Assert
      expect(outcome).toBe('refused');
      expect(store.claimRefresh).not.toHaveBeenCalled();
      expect(getMembers).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        { event: 'nrps.url-refused', platformId: PLATFORM_ID, reason, origin },
        expect.any(String),
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain('names_and_roles');
    },
  );

  it('[LTI-008] an institution’s Canvas origin in CANVAS_ORIGINS is read; over http in production it is refused', async () => {
    // Arrange: Instructure-hosted Canvas serves NRPS on the institution's domain, not on the issuer's
    const hosted = 'https://hvl.instructure.com/api/lti/courses/1/names_and_roles';
    const allowed = counterWith(true, hosted, {
      origins: ['https://hvl.instructure.com'],
      requireHttps: true,
    });
    const plain = counterWith(true, hosted.replace('https:', 'http:'), {
      origins: ['http://hvl.instructure.com'],
      requireHttps: true,
    });
    // Act
    const outcomes = [
      await allowed.counter.refresh(allowed.launch, course),
      await plain.counter.refresh(plain.launch, course),
    ];
    // Assert
    expect(outcomes).toEqual(['counted', 'refused']);
    expect(plain.getMembers).not.toHaveBeenCalled();
  });
});

describe('[LTI-008] the server’s builder of the count (D-106 amendment)', () => {
  it('[LTI-008] createNrpsServices hands CANVAS_ORIGINS to the counter: with them a roster on the institution’s domain is read', async () => {
    // Arrange: a Redis whose hourly mark is always taken, so an allowed URL stops at the claim ('fresh')
    const redis = { set: vi.fn(async () => null) } as unknown as Redis;
    const logger = { info: vi.fn(), warn: vi.fn() };
    const hosted = 'https://hvl.instructure.com/api/lti/courses/1/names_and_roles';
    const build = (urlRules?: LineItemUrlRules) =>
      createNrpsServices({
        db: {} as Database,
        redis,
        logger,
        maxPages: 1,
        ...(urlRules ? { urlRules } : {}),
      });
    const { launch } = counterWith(true, hosted);
    const course = { platformId: PLATFORM_ID, contextId: 'course-1' };
    // Act
    const withRules = await build({
      origins: ['https://hvl.instructure.com'],
      requireHttps: true,
    }).counter.refresh(launch, course);
    const without = await build().counter.refresh(launch, course);
    // Assert
    expect([withRules, without]).toEqual(['fresh', 'refused']);
    expect(redis.set).toHaveBeenCalledOnce();
  });
});
