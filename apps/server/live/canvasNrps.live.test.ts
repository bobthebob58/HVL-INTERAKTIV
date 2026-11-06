/**
 * Live-contract checks of Canvas's Names and Role Provisioning Service, as the learner count (LTI-008, insight's
 * denominator) relies on it: the media type, the full Learner role URI against the short name, members without names
 * or e-mail addresses under `privacy_level` `anonymous` (DATA-002), paging links, the count by the server's own rule,
 * and 401 for a token without the NRPS scope. What the mock assumes is in tools/mock-platform/canvasMemberships.mjs
 * and canvasServiceHttp.mjs. Runs only when asked (apps/server/live/README.md); the course needs two test students.
 * PRIVACY: an assertion here compares counts and booleans only, never a member, a name or a `user_id`, because a
 * failing assertion prints what it was given (DATA-009) — and the check for personal fields fails exactly when
 * Canvas sends them.
 *
 * Spec: LTI-008, DATA-002
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LTI_MEDIA_TYPE, LTI_SCOPE } from '../../../tools/mock-platform/mockPlatform.mjs';
import { AGS_TOKEN_SCOPE } from '../src/grades/agsVocabulary.js';
import { activeLearnerCount, LEARNER_ROLE_URI } from '../src/lti/nrps/activeLearners.js';
import { NRPS_PAGE_SIZE } from '../src/lti/nrps/nrpsRosterRead.js';
import { openCanvasTarget, type CanvasTarget } from './canvasTarget.js';
import { accessToken, serviceRequest, type ServiceAnswer } from './canvasRequests.js';
import { livePlanOf, runsCanvas } from './liveConfig.js';

const plan = livePlanOf(process.env);
const MOCK = 'the mock assumes this (tools/mock-platform/canvasMemberships.mjs)';
/** Claims Canvas adds to a member only above `privacy_level` `anonymous` (canvas-platform-values.md §6). */
const PERSONAL_FIELDS = [
  'name',
  'given_name',
  'family_name',
  'middle_name',
  'email',
  'picture',
  'lis_person_sourcedid',
];
const MAX_PAGES = 20;

/** An NRPS member as Canvas lists it. */
interface Member {
  readonly user_id: string;
  readonly status?: string;
  readonly roles: readonly string[];
  readonly [field: string]: unknown;
}

const membersOf = (answer: ServiceAnswer): Member[] =>
  ((answer.json as { members?: Member[] } | undefined)?.members ?? []) as Member[];

describe.runIf(runsCanvas(plan))('LTI-008 Names and Roles, as the mock Canvas assumes it', () => {
  let target: CanvasTarget;
  let token: string;
  const roster = (query: string, bearer = token) =>
    serviceRequest(target, `${target.membershipsUrl}?${query}`, bearer, {
      accept: LTI_MEDIA_TYPE.membershipContainer,
    });
  const learnerRole = `role=${encodeURIComponent(LEARNER_ROLE_URI)}`;

  beforeAll(async () => {
    target = await openCanvasTarget(plan);
    token = await accessToken(target, LTI_SCOPE.contextMembershipReadonly);
  }, 120_000);
  afterAll(() => target?.close());

  it('[LTI-008] lists learners for the full Learner role URI, with no names or e-mail addresses', async () => {
    // Act
    const answer = await roster(learnerRole);
    // Assert: the container type, only learners, and nothing personal beyond the opaque user_id
    expect(answer.status, MOCK).toBe(200);
    expect(answer.mediaType, MOCK).toBe(LTI_MEDIA_TYPE.membershipContainer);
    const members = membersOf(answer);
    expect(members.length, 'the test course needs test students').toBeGreaterThan(0);
    const count = (test: (member: Member) => boolean) => members.filter(test).length;
    expect(
      count((m) => typeof m.user_id !== 'string'),
      'members without a user_id',
    ).toBe(0);
    expect(
      count((m) => !m.roles.includes(LEARNER_ROLE_URI)),
      `${MOCK}: members without the role`,
    ).toBe(0);
    for (const field of PERSONAL_FIELDS) {
      expect(
        count((m) => field in m),
        `members with "${field}": privacy_level must be anonymous`,
      ).toBe(0);
    }
  });

  it('[LTI-008] lists nobody for the short role name, so the server always sends the full URI', async () => {
    // Act
    const answer = await roster('role=Learner');
    // Assert
    expect(answer.status, MOCK).toBe(200);
    expect(membersOf(answer).length, MOCK).toBe(0);
  });

  it('[LTI-008] pages with a next link that keeps the page size in per_page and drops limit', async () => {
    // Act
    const first = await roster(`${learnerRole}&limit=1`);
    const next = first.next === undefined ? undefined : new URL(first.next);
    const second =
      next &&
      (await serviceRequest(target, next.href, token, { accept: LTI_MEDIA_TYPE.membershipContainer }));
    // Assert: ltijs follows the link as given, so its page size decides how many requests a count takes
    expect(membersOf(first).length, MOCK).toBe(1);
    expect(next === undefined, 'a next page needs two test students in the course').toBe(false);
    expect(next?.searchParams.has('limit'), MOCK).toBe(false);
    expect(next?.searchParams.get('per_page'), MOCK).toBe('1');
    expect(second?.status).toBe(200);
    const firstId = membersOf(first)[0]?.user_id;
    const repeated = membersOf(second as ServiceAnswer).some((m) => m.user_id === firstId);
    expect(repeated, 'the next page repeats the first page’s member').toBe(false);
  });

  it('[LTI-008] counts the course’s active learners by the server’s own rule, the test student among them', async () => {
    // Arrange
    const members: Member[] = [];
    let url: string | undefined = `${target.membershipsUrl}?${learnerRole}&limit=${NRPS_PAGE_SIZE}`;
    // Act: every page, as ltijs reads them
    for (let page = 0; url !== undefined && page < MAX_PAGES; page += 1) {
      const answer: ServiceAnswer = await serviceRequest(target, url, token, {
        accept: LTI_MEDIA_TYPE.membershipContainer,
      });
      members.push(...membersOf(answer));
      url = answer.next;
    }
    const count = activeLearnerCount(
      members.map((m) => ({ userId: m.user_id, status: m.status, roles: m.roles })),
    );
    // Assert
    expect(url, `more than ${MAX_PAGES} pages`).toBeUndefined();
    expect(count, 'the test course needs two active test students').toBeGreaterThanOrEqual(2);
    if (target.studentSub) {
      const listed = members.some((m) => m.user_id === target.studentSub);
      expect(listed, 'LIVE_CANVAS_STUDENT_SUB is among the course’s learners').toBe(true);
    }
  });

  it('[LTI-008] answers 401 to a token without the Names and Roles scope', async () => {
    // Arrange
    const agsOnly = await accessToken(target, AGS_TOKEN_SCOPE);
    // Act
    const answer = await roster(learnerRole, agsOnly);
    // Assert: nrpsRosterRead.ts tries one new token after a 401, then gives up
    expect(answer.status, MOCK).toBe(401);
  });
});
