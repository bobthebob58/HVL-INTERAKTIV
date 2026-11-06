/**
 * Tests for the mock Canvas's Names and Role Provisioning Service: the membership container, rosters from launches,
 * Canvas's role filter (full role URIs only), paging with Canvas's Link header, scopes and injected faults.
 *
 * Spec: LTI-008
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CANVAS_USERS, LTI_CLAIM, LTI_MEDIA_TYPE, LTI_ROLE, LTI_SCOPE } from '../mockPlatform.mjs';
import { linkOf, startServiceBench } from './serviceBench.mjs';

let bench;
let token;

beforeAll(async () => {
  bench = await startServiceBench();
  token = await bench.token(LTI_SCOPE.contextMembershipReadonly);
});
afterAll(() => bench.close());
afterEach(() => bench.canvas.clearFaults());

const rosterUrl = (courseId) => `${bench.canvas.origin}/api/lti/courses/${courseId}/names_and_roles`;
const learners = (count, prefix = 'learner') =>
  Array.from({ length: count }, (_, i) => ({ user_id: `${prefix}-${i}`, roles: [LTI_ROLE.learner] }));

/** Every member over all pages, following Link rel="next". */
async function allPages(url) {
  const pages = [];
  for (let next = url; next;) {
    const response = await bench.get(next, token);
    pages.push((await response.json()).members);
    next = linkOf(response);
  }
  return pages;
}

describe('[LTI-008] mock Canvas NRPS', () => {
  it('[LTI-008] answers the launch claim URL with a membership container, without names or e-mails', async () => {
    // Arrange
    const user = {
      ...CANVAS_USERS.student,
      sub: 'named-learner',
      name: 'Kari Nordmann',
      email: 'kari@example.test',
    };
    const claims = await bench.launch({ user, course: { id: 'course-nrps', title: 'Spel i undervisninga' } });
    const url = claims[LTI_CLAIM.namesRoleService].context_memberships_url;
    // Act
    const response = await bench.get(url, token);
    const body = await response.json();
    // Assert
    expect(response.headers.get('content-type')).toBe(LTI_MEDIA_TYPE.membershipContainer);
    expect(body).toEqual({
      id: url,
      context: { id: 'course-nrps', label: 'course-nrps', title: 'Spel i undervisninga' },
      members: [
        { status: 'Active', user_id: CANVAS_USERS.teacher.sub, roles: [LTI_ROLE.instructor] },
        { status: 'Active', user_id: CANVAS_USERS.student.sub, roles: [LTI_ROLE.learner] },
        { status: 'Active', user_id: 'named-learner', roles: [LTI_ROLE.learner] },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(/Kari|example\.test/);
  });

  it('[LTI-008] filters by a full role URI only, as Canvas does, lists inactive members and never deleted ones', async () => {
    // Arrange
    bench.canvas.nrps.setMembers('course-roles', [
      ...learners(3),
      { user_id: 'gone', roles: [LTI_ROLE.learner], status: 'Inactive' },
      { user_id: 'deleted', roles: [LTI_ROLE.learner], status: 'Deleted' },
      { user_id: 'teacher-1', roles: [LTI_ROLE.instructor] },
    ]);
    const ids = async (query) =>
      (await (await bench.get(`${rosterUrl('course-roles')}${query}`, token)).json()).members.map(
        (m) => m.user_id,
      );
    const byRole = (role) => ids(`?role=${encodeURIComponent(role)}`);
    // Act and assert
    expect(await byRole(LTI_ROLE.learner)).toEqual(['learner-0', 'learner-1', 'learner-2', 'gone']);
    expect(await byRole(LTI_ROLE.instructor)).toEqual(['teacher-1']);
    expect([await byRole('Learner'), await byRole(LTI_ROLE.institutionStudent)]).toEqual([[], []]);
    expect(await ids('')).toHaveLength(5);
  });

  it("[LTI-008] pages with limit, keeping the role filter in Canvas's links (per_page, no limit), to the last page", async () => {
    // Arrange
    bench.canvas.nrps.setMembers('course-paged', [
      ...learners(26),
      { user_id: 't', roles: [LTI_ROLE.instructor] },
    ]);
    bench.canvas.nrps.setMembers('course-even', learners(20));
    const query = `?role=${encodeURIComponent(LTI_ROLE.learner)}&limit=10`;
    // Act
    const pages = await allPages(`${rosterUrl('course-paged')}${query}`);
    const even = await allPages(`${rosterUrl('course-even')}${query}`);
    const first = await bench.get(`${rosterUrl('course-paged')}${query}`, token);
    // Assert
    expect([pages.map((page) => page.length), even.map((page) => page.length)]).toEqual([
      [10, 10, 6],
      [10, 10],
    ]);
    expect(new Set(pages.flat().map((member) => member.user_id)).size).toBe(26);
    expect([...new URL(linkOf(first)).searchParams]).toEqual([
      ['role', LTI_ROLE.learner],
      ['page', '2'],
      ['per_page', '10'],
    ]);
    expect(
      ['current', 'first', 'last'].map((rel) => new URL(linkOf(first, rel)).searchParams.get('page')),
    ).toEqual(['1', '1', '3']);
  });

  it("[LTI-008] uses Canvas's 50 members a page without limit, and at most 50", async () => {
    bench.canvas.nrps.setMembers('course-big', learners(60));
    const size = async (query) =>
      (await (await bench.get(`${rosterUrl('course-big')}${query}`, token)).json()).members.length;
    expect([await size(''), await size('?limit=500'), await size('?limit=5')]).toEqual([50, 50, 5]);
  });

  it('[LTI-008] answers an injected fault before any other check, then needs the NRPS scope', async () => {
    // Arrange
    const scoreOnly = await bench.token(LTI_SCOPE.score);
    bench.canvas.nrps.failNext({ status: 503 });
    // Act
    const statuses = [];
    for (const accessToken of [scoreOnly, scoreOnly, token]) {
      statuses.push((await bench.get(rosterUrl('mock-course-1'), accessToken)).status);
    }
    // Assert
    expect(statuses).toEqual([503, 401, 200]);
  });

  it('[LTI-008] refuses a roster member without user_id or with an unknown status', () => {
    expect(() => bench.canvas.nrps.setMembers('c', [{ roles: [] }])).toThrow(TypeError);
    expect(() => bench.canvas.nrps.setMembers('c', [{ user_id: 'x', roles: [], status: 'Away' }])).toThrow(
      TypeError,
    );
  });
});
