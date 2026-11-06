/**
 * Tests that ltijs 7.0.7's own service clients and the mock Canvas's services understand each other: the client
 * assertion ltijs signs, its NRPS paging, and its AGS score and line-item calls, from a launch context.
 *
 * Spec: LTI-008, LTI-012
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANVAS_USERS, LTI_ROLE, LTI_SCOPE } from '../mockPlatform.mjs';
import { startLtijsTool } from './ltijsTool.mjs';

let tool;
let canvas;

beforeAll(async () => {
  tool = await startLtijsTool((provider, _mock, contexts) => {
    provider.onResourceLink(async (context, _request, response) => {
      contexts.push(context);
      context.redirect(response, '/lti/play');
    });
  });
  ({ canvas } = tool);
});
afterAll(() => tool.close());

/** The ltijs launch context of a resource-link launch. */
const contextOf = async (spec) => {
  await tool.launch(spec);
  return tool.handled.at(-1);
};

describe('[LTI-008] ltijs NRPS against the mock Canvas', () => {
  it("[LTI-008] gets a token with ltijs's own assertion and follows every page of learners", async () => {
    // Arrange
    const learners = Array.from({ length: 23 }, (_, i) => ({ user_id: `l-${i}`, roles: [LTI_ROLE.learner] }));
    canvas.nrps.setMembers('course-ltijs', [...learners, { user_id: 'ta', roles: [LTI_ROLE.instructor] }]);
    const context = await contextOf({ user: CANVAS_USERS.teacher, course: { id: 'course-ltijs' } });
    // Act
    const result = await context.namesAndRoles.getMembers({
      role: LTI_ROLE.learner,
      limit: 10,
      pages: false,
    });
    // Assert
    expect(result.members.map((member) => member.userId)).toEqual(learners.map((learner) => learner.user_id));
    expect(canvas.tokens.requests.at(-1)).toMatchObject({
      ok: true,
      problems: [],
      scopes: [LTI_SCOPE.contextMembershipReadonly],
    });
  });
});

describe('[LTI-012] ltijs AGS against the mock Canvas', () => {
  it("[LTI-012] accepts ltijs's score post for the launch's line item, and serves its line-item read", async () => {
    // Arrange
    const spec = {
      user: CANVAS_USERS.student,
      course: { id: 'course-ltijs-ags' },
      resourceLinkId: 'rl-9',
      lineItem: '9',
    };
    const context = await contextOf(spec);
    const lineItemUrl = context.idToken.services.assignmentAndGrades.lineItemId;
    // Act
    await context.grading.submitScore(lineItemUrl, {
      scoreGiven: 9,
      scoreMaximum: 10,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
    });
    const lineItem = await context.grading.getLineItemById(lineItemUrl);
    // Assert
    expect(canvas.ags.scores.at(-1)).toMatchObject({
      lineItemUrl,
      score: {
        userId: CANVAS_USERS.student.sub,
        scoreGiven: 9,
        scoreMaximum: 10,
        timestamp: expect.any(String),
      },
    });
    expect(lineItem).toMatchObject({ id: lineItemUrl, label: 'Mock activity', resourceLinkId: 'rl-9' });
  });
});
