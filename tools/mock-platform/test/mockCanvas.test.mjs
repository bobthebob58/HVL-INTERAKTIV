/**
 * Tests for the mock Canvas's keys, platform configuration, login initiations and launch claims.
 *
 * Spec: LTI-001, LTI-004, LTI-005, LTI-006, AUTH-005
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { CANVAS_USERS, LTI_CLAIM, LTI_ROLE, MESSAGE_TYPE, startMockCanvas } from '../mockPlatform.mjs';

const TOOL = 'http://localhost:3999';
let canvas;

beforeAll(async () => {
  canvas = await startMockCanvas({ toolUrl: `${TOOL}/` });
});
afterAll(() => canvas.close());

const deepLinking = (overrides = {}) => ({
  messageType: MESSAGE_TYPE.deepLinking,
  user: CANVAS_USERS.teacher,
  ...overrides,
});

describe('[LTI-001] mock Canvas keys and platform configuration', () => {
  it('[LTI-001] serves its RS256 key as a JWKS, and the ID tokens it signs verify against it', async () => {
    // Arrange
    const claims = canvas.idTokenClaims({ user: CANVAS_USERS.student }, 'nonce-1');
    // Act
    const token = await canvas.signIdToken(claims);
    const { payload, protectedHeader } = await jwtVerify(token, createRemoteJWKSet(new URL(canvas.jwksUrl)), {
      issuer: canvas.issuer,
      audience: canvas.clientId,
    });
    // Assert
    expect(protectedHeader).toEqual({ alg: 'RS256', typ: 'JWT', kid: canvas.publicJwk.kid });
    expect(payload).toMatchObject({ nonce: 'nonce-1', sub: CANVAS_USERS.student.sub, azp: canvas.clientId });
    expect(payload.exp - payload.iat).toBe(3600);
    expect(canvas.publicJwk).not.toHaveProperty('d');
  });

  it('[LTI-001] signs with the foreign key under the platform kid, so only the signature is wrong', async () => {
    const token = await canvas.signIdToken(canvas.idTokenClaims({}, 'n'), { key: 'foreign' });
    await expect(jwtVerify(token, createRemoteJWKSet(new URL(canvas.jwksUrl)))).rejects.toMatchObject({
      code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
    });
  });

  it('[LTI-001] describes itself as one LTI platform with one deployment, on 127.0.0.1', () => {
    // Act and assert
    expect(canvas.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(canvas.toolUrl).toBe(TOOL);
    expect(canvas.platformConfig).toEqual({
      name: 'Mock Canvas',
      issuer: canvas.origin,
      clientId: canvas.clientId,
      authEndpoint: `${canvas.origin}/api/lti/authorize_redirect`,
      tokenEndpoint: `${canvas.origin}/login/oauth2/token`,
      jwksUrl: `${canvas.origin}/api/lti/security/jwks`,
      deployments: [canvas.deploymentId],
    });
  });

  it('[LTI-001] builds a third-party-initiated login, with lti_storage_target only for Platform Storage', () => {
    // Act
    const plain = canvas.loginInitiation({ user: CANVAS_USERS.student });
    const stored = canvas.loginInitiation({ user: CANVAS_USERS.student, platformStorage: true });
    // Assert
    expect(plain).toEqual({
      iss: canvas.issuer,
      login_hint: CANVAS_USERS.student.sub,
      target_link_uri: `${TOOL}/lti/launch`,
      lti_message_hint: expect.stringMatching(/^[\w-]{32}$/),
      client_id: canvas.clientId,
      lti_deployment_id: canvas.deploymentId,
    });
    expect(stored.lti_storage_target).toBe('post_message_forwarding');
    expect(stored.lti_message_hint).not.toBe(plain.lti_message_hint);
  });

  it('[LTI-001] refuses a message type it cannot launch', () => {
    expect(() => canvas.loginInitiation({ messageType: 'LtiSubmissionReviewRequest' })).toThrow(TypeError);
  });
});

describe('[LTI-006] resource-link launch claims', () => {
  it('[LTI-006] carry the custom contentId, course context, resource link, roles, deployment and line item', () => {
    // Arrange
    const spec = {
      user: CANVAS_USERS.student,
      course: { id: 'course-a', title: 'Spel i undervisninga' },
      resourceLinkId: 'link-1',
      custom: { contentId: 'content-1' },
      lineItem: '7',
    };
    // Act
    const claims = canvas.idTokenClaims(spec, 'nonce-2');
    // Assert
    expect(claims).toMatchObject({
      iss: canvas.issuer,
      aud: canvas.clientId,
      locale: 'nn',
      [LTI_CLAIM.messageType]: 'LtiResourceLinkRequest',
      [LTI_CLAIM.version]: '1.3.0',
      [LTI_CLAIM.deploymentId]: canvas.deploymentId,
      [LTI_CLAIM.targetLinkUri]: `${TOOL}/lti/launch`,
      [LTI_CLAIM.roles]: [LTI_ROLE.institutionStudent, LTI_ROLE.learner, LTI_ROLE.systemUser],
      [LTI_CLAIM.context]: { id: 'course-a', title: 'Spel i undervisninga' },
      [LTI_CLAIM.resourceLink]: { id: 'link-1' },
      [LTI_CLAIM.custom]: { contentId: 'content-1' },
    });
    expect(claims[LTI_CLAIM.agsEndpoint].lineitem).toBe(
      `${canvas.origin}/api/lti/courses/course-a/line_items/7`,
    );
    expect(claims).not.toHaveProperty([LTI_CLAIM.deepLinkingSettings]);
    expect(claims).not.toHaveProperty([LTI_CLAIM.placement]);
  });

  it('[LTI-001] send name and email only when the launch user has them (privacy levels above anonymous)', () => {
    const anonymous = canvas.idTokenClaims({ user: CANVAS_USERS.student }, 'n');
    const named = canvas.idTokenClaims(
      { user: { ...CANVAS_USERS.student, name: 'Kari', email: 'k@x.no' } },
      'n',
    );
    expect(anonymous).not.toHaveProperty('name');
    expect(anonymous).not.toHaveProperty('email');
    expect(named).toMatchObject({ name: 'Kari', email: 'k@x.no' });
  });

  it('[LTI-004] pass a forged role list through unchanged, as the platform sent it', () => {
    const user = { sub: 'forged', roles: [LTI_ROLE.administrator, 'http://example.test/admin'] };
    expect(canvas.idTokenClaims({ user }, 'n')[LTI_CLAIM.roles]).toEqual(user.roles);
  });

  it('[LTI-004] keep the demo users and their role lists frozen, so one test cannot change the next', () => {
    const shared = [CANVAS_USERS.teacher, CANVAS_USERS.teacher.roles, CANVAS_USERS.student.roles];
    expect(shared.every((value) => Object.isFrozen(value))).toBe(true);
  });
});

describe('[LTI-005] Deep Linking launch claims', () => {
  it('[LTI-005] carry the placement claim and settings with the return URL and fresh data', () => {
    // Act
    const first = canvas.idTokenClaims(deepLinking({ placement: 'link_selection' }), 'n');
    const second = canvas.idTokenClaims(deepLinking({ placement: 'link_selection' }), 'n');
    // Assert
    expect(first[LTI_CLAIM.placement]).toBe('link_selection');
    expect(first[LTI_CLAIM.deepLinkingSettings]).toEqual({
      deep_link_return_url: `${canvas.origin}/deep_linking_response`,
      accept_types: ['ltiResourceLink'],
      accept_presentation_document_targets: ['iframe', 'window'],
      accept_media_types: 'application/vnd.ims.lti.v1.ltilink',
      accept_multiple: true,
      auto_create: false,
      data: expect.any(String),
    });
    expect(second[LTI_CLAIM.deepLinkingSettings].data).not.toBe(first[LTI_CLAIM.deepLinkingSettings].data);
    expect(first).not.toHaveProperty([LTI_CLAIM.resourceLink]);
  });

  it.each([
    ['assignment_selection', undefined, false],
    ['link_selection', undefined, true],
    ['assignment_selection', true, true],
    [undefined, false, false],
  ])('[LTI-005] for placement %s and acceptMultiple %s send accept_multiple %s', (placement, given, sent) => {
    const claims = canvas.idTokenClaims(deepLinking({ placement, acceptMultiple: given }), 'n');
    expect(claims[LTI_CLAIM.deepLinkingSettings].accept_multiple).toBe(sent);
  });

  it('[LTI-005] accept the item types Canvas accepts from editor_button', () => {
    const settings = canvas.idTokenClaims(deepLinking({ placement: 'editor_button' }), 'n')[
      LTI_CLAIM.deepLinkingSettings
    ];
    expect(settings.accept_types).toEqual(['link', 'file', 'html', 'ltiResourceLink', 'image']);
  });
});

describe('[AUTH-005] custom variable substitution', () => {
  it("[AUTH-005] replaces $Canvas.user.loginId with the user's login ID and keeps the literal without one", () => {
    // Arrange
    const custom = { feide_login: '$Canvas.user.loginId', hvl_placement: 'link_selection' };
    // Act
    const teacher = canvas.idTokenClaims(deepLinking({ custom }), 'n')[LTI_CLAIM.custom];
    const student = canvas.idTokenClaims(deepLinking({ custom, user: CANVAS_USERS.student }), 'n')[
      LTI_CLAIM.custom
    ];
    // Assert
    expect(teacher).toEqual({ feide_login: 'author@hvl.no', hvl_placement: 'link_selection' });
    expect(student.feide_login).toBe('$Canvas.user.loginId');
  });
});
