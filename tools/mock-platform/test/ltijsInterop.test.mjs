/**
 * Tests that ltijs 7.0.7, the tool's LTI library, and the mock Canvas understand each other: a resource-link launch
 * and a Deep Linking round trip through ltijs's own route handlers, with both JWKS fetched over HTTP.
 *
 * Spec: LTI-001, LTI-005
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANVAS_USERS, MESSAGE_TYPE } from '../mockPlatform.mjs';
import { startLtijsTool } from './ltijsTool.mjs';

let tool;
let canvas;
let handled;
let launch;

beforeAll(async () => {
  tool = await startLtijsTool((provider, mock, contexts) => {
    provider.onResourceLink(async (context, _request, response) => {
      contexts.push(context);
      context.redirect(response, '/lti/play');
    });
    provider.onDeepLinking(async (context, _request, response) => {
      contexts.push(context);
      const item = {
        type: 'ltiResourceLink',
        title: 'Brettspel',
        url: `${mock.toolUrl}/lti/launch`,
        custom: { contentId: 'c-1' },
      };
      response.html(await context.deepLinking.createDeepLinkingMessage([item, { ...item, title: 'Second' }]));
    });
  });
  ({ canvas, handled, launch } = tool);
});
afterAll(() => tool.close());

describe('[LTI-001] ltijs 7.0.7 against the mock Canvas', () => {
  it("[LTI-001] completes a resource-link launch, verifying the mock's ID token against its JWKS", async () => {
    // Act
    const { auth, sent } = await launch({ user: CANVAS_USERS.student, custom: { contentId: 'c-1' } });
    // Assert
    expect(auth.action).toBe(`${canvas.toolUrl}/lti/launch`);
    expect(sent.redirect).toMatch(/^\/lti\/play\?ltik=[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(handled.at(-1).idToken).toMatchObject({
      user: { id: CANVAS_USERS.student.sub, roles: CANVAS_USERS.student.roles },
      platform: { url: canvas.issuer, clientId: canvas.clientId, deploymentId: canvas.deploymentId },
      launch: {
        type: MESSAGE_TYPE.resourceLink,
        custom: { contentId: 'c-1' },
        context: { id: 'mock-course-1' },
      },
    });
  });

  it('[LTI-001] lets ltijs refuse an ID token the mock signed with its foreign key', async () => {
    const spec = { user: CANVAS_USERS.student };
    const forged = (nonce) => canvas.signIdToken(canvas.idTokenClaims(spec, nonce), { key: 'foreign' });
    await expect(launch(spec, forged)).rejects.toMatchObject({
      name: 'JsonWebTokenError',
      message: 'invalid signature',
    });
  });
});

describe('[LTI-005] ltijs 7.0.7 Deep Linking against the mock Canvas', () => {
  it("[LTI-005] ltijs's signed response passes every check, with one item where accept_multiple is false", async () => {
    // Act
    const spec = {
      messageType: MESSAGE_TYPE.deepLinking,
      user: CANVAS_USERS.teacher,
      placement: 'assignment_selection',
    };
    const { sent } = await launch(spec);
    const record = await canvas.verifyDeepLinkResponse(sent.html);
    // Assert
    expect(handled.at(-1).idToken.services.deepLinking).toMatchObject({
      available: true,
      acceptMultiple: false,
    });
    expect(record).toMatchObject({
      ok: true,
      problems: [],
      lifetime: 60,
      request: { placement: 'assignment_selection' },
    });
    expect(record.items.map((item) => item.title)).toEqual(['Brettspel']);
  });
});
