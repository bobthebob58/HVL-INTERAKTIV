/**
 * Tests for reading launch facts from ltijs's ID token, including the contextId trap and the custom field check.
 *
 * Spec: LTI-001, LTI-006
 */
import type { IdToken } from 'ltijs';
import { describe, expect, it } from 'vitest';
import { launchFactsOf } from '../../src/lti/launchFacts.js';

const CONTENT = '0192f1a2-3b4c-7d5e-8f60-718293a4b5c6';
const token = (launch: Partial<IdToken['launch']> = {}, lineItemId?: string): IdToken =>
  ({
    id: 'record-id',
    ltiVersion: '1.3.0',
    user: { id: 'sub-1', roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'] },
    platform: { id: 'platform-1', url: 'https://canvas.example', clientId: 'c', deploymentId: '1:abc' },
    launch: {
      type: 'LtiResourceLinkRequest',
      context: { id: 'course-9' },
      resource: { id: 'link-3' },
      custom: { contentId: CONTENT },
      ...launch,
    },
    services: {
      namesAndRoles: { available: false },
      assignmentAndGrades: { available: lineItemId !== undefined, ...(lineItemId ? { lineItemId } : {}) },
      deepLinking: { available: false },
    },
  }) as unknown as IdToken;

describe('[LTI-006] launch facts', () => {
  it('[LTI-006] reads platform, deployment, course, link, activity and line item', () => {
    expect(launchFactsOf(token({}, 'https://canvas.example/li/1'))).toEqual({
      issuer: 'https://canvas.example',
      subject: 'sub-1',
      platformId: 'platform-1',
      deploymentId: '1:abc',
      messageType: 'LtiResourceLinkRequest',
      contextId: 'course-9',
      resourceLinkId: 'link-3',
      contentId: CONTENT,
      lineItemUrl: 'https://canvas.example/li/1',
      roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    });
  });

  it('[LTI-001] takes the course from launch.context.id, never the token record ID', () => {
    expect(launchFactsOf(token()).contextId).toBe('course-9');
    expect(launchFactsOf(token({ context: undefined })).contextId).toBe('');
  });

  it('[LTI-006] treats a custom contentId that is not a UUID as missing', () => {
    for (const contentId of ['', '$Canvas.foo', '../etc', 42, `${CONTENT}x`]) {
      expect(launchFactsOf(token({ custom: { contentId } })).contentId, String(contentId)).toBeUndefined();
    }
    expect(launchFactsOf(token({ custom: { contentId: CONTENT.toUpperCase() } })).contentId).toBe(CONTENT);
  });
});
