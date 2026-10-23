/**
 * Tests that every failure on an LTI route becomes a friendly page (or JSON for API calls) with the LTI headers,
 * and that failed launches are audited with a fixed reason.
 *
 * Spec: LTI-001, LTI-003, PROD-004
 */
import { Writable } from 'node:stream';
import express from 'express';
import { LtijsError } from 'ltijs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AuthAuditInput } from '../../../src/auth/audit/AuthAuditRecorder.js';
import { authError } from '../../../src/http/authErrors.js';
import { classifyLtiError, ltiErrorPages } from '../../../src/lti/http/ltiErrorPages.js';
import { createLogger } from '../../../src/logging/logger.js';

const ltijs = (code: string) => new LtijsError(code);
const jwt = (name: string) => Object.assign(new Error('invalid signature'), { name });

const appThrowing = (error: unknown) => {
  const audited: AuthAuditInput[] = [];
  const logger = createLogger({
    level: 'silent',
    destination: new Writable({ write: (_c, _e, done) => done() }),
  });
  const app = express();
  app.post('/lti/launch', () => {
    throw error;
  });
  app.get('/lti/play', () => {
    throw error;
  });
  app.use(
    ltiErrorPages({
      canvasOrigins: ['https://hvl.instructure.com'],
      logger,
      audit: { record: async (e) => void audited.push(e) },
    }),
  );
  return { app, audited };
};

describe('[LTI-001] LTI error pages', () => {
  it('[LTI-001] classifies ltijs codes, jsonwebtoken errors and our refusals', () => {
    // Act and assert
    expect(classifyLtiError(ltijs('INVALID_NONCE_RECEIVED'))).toMatchObject({
      status: 400,
      reason: 'nonce-invalid',
    });
    expect(classifyLtiError(ltijs('UNREGISTERED_PLATFORM'))).toMatchObject({ reason: 'platform-unknown' });
    expect(classifyLtiError(ltijs('PLATFORM_NOT_ACTIVATED'))).toMatchObject({
      status: 403,
      reason: 'platform-inactive',
    });
    expect(classifyLtiError(jwt('JsonWebTokenError'))).toMatchObject({ reason: 'token-invalid' });
    expect(classifyLtiError(jwt('TokenExpiredError'))).toMatchObject({ reason: 'token-invalid' });
    expect(classifyLtiError(authError('hvl:deployment-not-allowed'))).toMatchObject({
      status: 403,
      reason: 'deployment-not-allowed',
    });
    expect(classifyLtiError(new Error('boom'))).toBeUndefined();
  });

  it('[LTI-001] a refused launch is a friendly page with the LTI headers, audited with its reason', async () => {
    // Arrange
    const { app, audited } = appThrowing(ltijs('INVALID_NONCE_RECEIVED'));
    // Act
    const res = await request(app).post('/lti/launch').set('X-Forwarded-For', '203.0.113.9');
    // Assert
    expect(res.status).toBe(400);
    expect(res.text).toContain('<h1>Noko gjekk gale</h1>');
    expect(res.text).toContain('Aktiviteten kunne ikkje opnast frå Canvas.');
    expect(res.text).not.toContain('INVALID_NONCE');
    expect(res.headers).toMatchObject({ 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' });
    expect(res.headers['content-security-policy']).toContain('frame-ancestors https://hvl.instructure.com');
    expect(audited).toEqual([
      expect.objectContaining({ event: 'launch.lti.failed', reason: 'nonce-invalid' }),
    ]);
  });

  it('[LTI-003] an invalid ltik asks the person to reopen the activity from Canvas, without an audit entry', async () => {
    const { app, audited } = appThrowing(ltijs('INVALID_LTIK'));
    const res = await request(app).get('/lti/play');
    expect(res.status).toBe(401);
    expect(res.text).toContain('<h1>Opne aktiviteten på nytt</h1>');
    expect(audited).toEqual([]);
  });

  it('[PROD-004] an unavailable activity is the one 404 page', async () => {
    const res = await request(appThrowing(authError('hvl:activity-unavailable')).app).get('/lti/play');
    expect(res.status).toBe(404);
    expect(res.text).toContain('<h1>Ikkje tilgjengeleg</h1>');
  });

  it('[LTI-001] an unexpected error is a 500 page that reveals nothing, and API calls get JSON', async () => {
    // Arrange
    const { app } = appThrowing(new Error('connect ECONNREFUSED db:5432'));
    // Act
    const page = await request(app).get('/lti/play');
    const api = await request(appThrowing(authError('hvl:deep-link-draft')).app)
      .get('/lti/play')
      .set('Accept', 'application/json');
    // Assert
    expect(page.status).toBe(500);
    expect(page.text).not.toContain('ECONNREFUSED');
    expect(api.status).toBe(409);
    expect(api.body).toMatchObject({ success: false, errorCode: 'hvl:deep-link-draft' });
  });
});
