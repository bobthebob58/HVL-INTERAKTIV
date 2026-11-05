/**
 * Content test for what the DPIA input says about HVL employees who are learners in a Canvas course: only the
 * launch's LTI roles decide whether a play is captured (D-102), and of the institution roles only Administrator counts
 * (D-059), so an employee whom a course enrols as a student is a learner there, and DPIA-INPUT.md's O4 and its residual
 * R40 must say so to the DPO. A change on either side fails
 * until both agree again, as apps/web/test/features/privacyNoticeColleagues.test.ts does for the privacy notice.
 *
 * Spec: DATA-005, LTI-004
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { LaunchContext } from 'ltijs';
import { describe, expect, it } from 'vitest';
import { highestRole } from '../../src/auth/Principal.js';
import type { LaunchFacts } from '../../src/lti/launchFacts.js';
import { principalOfLaunch } from '../../src/lti/ltikPrincipal.js';

const DPIA = readFileSync(
  fileURLToPath(new URL('../../../../docs/privacy/DPIA-INPUT.md', import.meta.url)),
  'utf8',
);
const LIS = 'http://purl.imsglobal.org/vocab/lis/v2/';
const LEARNER = `${LIS}membership#Learner`;

/** The DPIA input's table row whose first cell is `id` (for example `O4` or `R40`); '' when there is none. */
const rowOf = (id: string): string => DPIA.split('\n').find((line) => line.startsWith(`| ${id} |`)) ?? '';

/** A resource-link launch in a staff course (for example ALU's university pedagogy) with the given roles. */
const launchWith = (roles: readonly string[]): LaunchFacts => ({
  issuer: 'https://canvas.example',
  subject: 'opaque-canvas-sub',
  platformId: 'platform-1',
  deploymentId: 'deployment-1',
  messageType: 'LtiResourceLinkRequest',
  contextId: 'staff-pedagogy-course',
  resourceLinkId: 'link-1',
  roles,
  testUser: false,
});

describe('[DATA-005] the DPIA input says that employees enrolled as students are captured', () => {
  it.each([
    ['an institution Instructor', `${LIS}institution/person#Instructor`],
    ['institution Faculty', `${LIS}institution/person#Faculty`],
    ['institution Staff', `${LIS}institution/person#Staff`],
  ])(
    '[DATA-005] an HVL employee (%s) launched as a course Learner is a learner, whose batches are stored (D-102)',
    (_case, institutionRole) => {
      // Arrange
      const context = { rawIdToken: {} } as unknown as LaunchContext;
      // WHY: the account carries no kind, so an account an earlier teacher launch created changes nothing.
      const account = { userId: 'account-of-a-lecturer', learnerKey: 'key', learnerKeyYear: 2026 };
      // Act
      const principal = principalOfLaunch(context, launchWith([LEARNER, institutionRole]), account);
      // Assert: XapiIngest stores a batch exactly when the highest role is `learner`.
      expect(highestRole(principal.roles)).toBe('learner');
    },
  );

  it('[DATA-005] a Canvas account administrator launched as a course Learner is an author, as R40 says (D-059)', () => {
    // Arrange
    const context = { rawIdToken: {} } as unknown as LaunchContext;
    const account = { userId: 'account-of-an-administrator', learnerKey: 'key', learnerKeyYear: 2026 };
    // Act
    const principal = principalOfLaunch(
      context,
      launchWith([LEARNER, `${LIS}institution/person#Administrator`]),
      account,
    );
    // Assert: the one institution role the mapping reads; XapiIngest stores nothing for an author.
    expect(highestRole(principal.roles)).toBe('author');
  });

  it('[DATA-005] O4 does not say staff are never captured, and R40 names employees as learners for the DPO', () => {
    // Arrange
    const o4 = rowOf('O4');
    const r40 = rowOf('R40');
    // Act
    const residualCells = r40.split('|').slice(1, -1);
    // Assert
    expect(o4).not.toMatch(/staff (are|is) never captured/i);
    expect(o4).toMatch(/employee/);
    expect(o4).toContain('R40');
    expect(residualCells).toHaveLength(6);
    expect(r40).toMatch(/Employees as learners/);
    expect(r40).toContain('`mapLtiRoles`');
    expect(r40).not.toMatch(/cannot tell/);
    expect(r40).toMatch(/ignores every institution role but Administrator/);
    expect(r40).toMatch(/mappe of the activity's owner and co-authors/);
    expect(r40).toMatch(/colleagues who teach the course/);
  });
});
