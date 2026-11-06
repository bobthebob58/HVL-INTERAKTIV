/**
 * mockCanvasTarget — the live-contract checks' Canvas target on the mock Canvas (`LIVE_TARGET=mock`): the whole app
 * with its mock platform, and a test course set up as the README asks the students to set up ALU's.
 *
 * Why: a check that has never passed anywhere proves nothing when it fails against Canvas. Running the same checks
 *      against the mock first shows that each one works and states exactly what the mock assumes, so a failure against
 *      the test Canvas points at a mock assumption, not at the check (D-101's amendment of 2026-11-05).
 * Spec: LTI-012, LTI-008, LTI-005
 * Invariants:
 *   - The tool key is read from the test bed's database through `readPlatform`, the same path as a Canvas run.
 *   - The course holds the demo teacher, the demo student and two more learners, so NRPS has pages to follow.
 *   - Its one graded line item is the one our own `buildDeepLinkItems` makes for `assignment_selection` in `suffix`
 *     mode, as a Deep Linking return would create it, so the checks meet the shape the tool really sends.
 *   - `close` closes the test bed, which removes everything it made.
 * Collaborators: ./canvasTarget.ts, ../test/support/appTestbed.ts, ../src/lti/deepLinking/deepLinkItems.ts,
 *   tools/mock-platform (the mock Canvas's AGS and NRPS controls).
 * Tests: apps/server/live/canvasToken.live.test.ts, apps/server/live/canvasAgs.live.test.ts,
 *   apps/server/live/canvasNrps.live.test.ts
 */
import { CANVAS_USERS, LTI_ROLE } from '../../../tools/mock-platform/mockPlatform.mjs';
import { buildDeepLinkItems } from '../src/lti/deepLinking/deepLinkItems.js';
import { openAppTestbed } from '../test/support/appTestbed.js';
import { canvasTargetOf, readPlatform, type CanvasTarget } from './canvasTarget.js';

/** The mock test course's ID. */
export const MOCK_COURSE_ID = 'live-contract-course';
/** The activity the mock's graded line item names, as Deep Linking would name it. */
export const MOCK_ACTIVITY = Object.freeze({ id: '00000000-0000-4000-8000-00000000c0de', title: 'Brøkar' });

/** Two more learners than the demo student, so NRPS lists three learners over several pages of one. */
const EXTRA_LEARNERS = ['live-contract-learner-1', 'live-contract-learner-2'];

/** The line item a Deep Linking return from `assignment_selection` creates for `MOCK_ACTIVITY`. */
function graded(publicBaseUrl: string) {
  const [item] = buildDeepLinkItems({
    activities: [MOCK_ACTIVITY],
    placement: 'assignment_selection',
    publicBaseUrl,
    settings: { accept_types: ['ltiResourceLink'], accept_multiple: false },
  });
  if (item?.lineItem === undefined) throw new Error('assignment_selection made no line item');
  return item.lineItem;
}

/**
 * Starts the app and the mock platform and sets up the test course.
 * @returns The target; `close` stops everything and removes what the test bed made.
 * @throws Error when the local services are not running (see apps/server/README.md).
 */
export async function openMockCanvasTarget(): Promise<CanvasTarget> {
  const bed = await openAppTestbed();
  try {
    const canvas = bed.mock.canvas;
    const learner = (sub: string) => ({ user_id: sub, roles: [LTI_ROLE.learner] });
    canvas.nrps.setMembers(MOCK_COURSE_ID, [
      { user_id: CANVAS_USERS.teacher.sub, roles: [LTI_ROLE.instructor] },
      learner(CANVAS_USERS.student.sub),
      ...EXTRA_LEARNERS.map(learner),
    ]);
    canvas.ags.addLineItem({ courseId: MOCK_COURSE_ID, ...graded(bed.toolUrl) });
    const record = await readPlatform(bed.db, bed.env.DATA_ENCRYPTION_KEYS, { id: bed.platformId });
    if (!record) throw new Error('the mock Canvas is not registered');
    const course = {
      apiOrigin: canvas.origin,
      courseId: MOCK_COURSE_ID,
      studentSub: CANVAS_USERS.student.sub,
      labelMode: 'suffix' as const,
    };
    return canvasTargetOf(record, course, 'the mock Canvas', () => bed.close());
  } catch (error) {
    await bed.close();
    throw error;
  }
}
