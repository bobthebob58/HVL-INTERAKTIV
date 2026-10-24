/**
 * Tests that every failure on an LTI route becomes a friendly page (or JSON for API calls) with the LTI headers,
 * in the launch's language once it is known, and that failed launches are audited with a fixed reason.
 *
 * Spec: LTI-001, LTI-003, PROD-004, PROD-012, UD-013
 */
import express from 'express';
import { LtijsError } from 'ltijs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AuthAuditInput } from '../../../src/auth/audit/AuthAuditRecorder.js';
import { authError } from '../../../src/http/authErrors.js';
import { offerHelpLink } from '../../../src/http/pages/helpLink.js';
import { t } from '../../../src/i18n/translate.js';
import {
  classifyLtiError,
  ltiErrorPages,
  setLtiPageLocale,
  withLaunchLocale,
} from '../../../src/lti/http/ltiErrorPages.js';
import { createLogger } from '../../../src/logging/logger.js';

const ltijs = (code: string) => new LtijsError(code);
const jwt = (name: string) => Object.assign(new Error('invalid signature'), { name });

const appThrowing = (error: unknown, options: { webApp?: boolean } = {}) => {
  const audited: AuthAuditInput[] = [];
  const logger = createLogger({ level: 'silent' });
  const app = express();
  if (options.webApp) app.use(offerHelpLink());
  app.post('/lti/launch', () => {
    throw error;
  });
  app.get(['/lti/play', '/lti/edit'], () => {
    throw error;
  });
  app.get('/lti/deeplink', (_req, res) => {
    // Like the route: the ltik resolved, so the launch's language is known before the refusal.
    setLtiPageLocale(res, 'en');
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

  it('[LTI-006][PROD-004] an unavailable activity is the one 404 page', async () => {
    const res = await request(appThrowing(authError('hvl:activity-unavailable')).app).get('/lti/play');
    expect(res.status).toBe(404);
    expect(res.text).toContain('<h1>Ikkje tilgjengeleg</h1>');
  });

  it('[LTI-003] the 401 and 404 pages of /lti/play and /lti/edit may be framed by our /app/play chrome and Canvas', async () => {
    // Arrange
    const reopen = appThrowing(ltijs('INVALID_LTIK')).app;
    const unavailable = appThrowing(authError('hvl:activity-unavailable')).app;
    // Act
    const pages = await Promise.all(
      [reopen, unavailable].flatMap((app) =>
        ['/lti/play', '/lti/edit'].map((path) => request(app).get(path)),
      ),
    );
    // Assert
    expect(pages.map((res) => res.status)).toEqual([401, 401, 404, 404]);
    for (const res of pages) {
      expect(res.headers['content-security-policy']).toMatch(
        /; frame-ancestors 'self' https:\/\/hvl\.instructure\.com$/,
      );
      expect(res.headers['x-frame-options']).toBeUndefined();
    }
  });

  it('[LTI-003] launch and Deep Linking error pages stay framed by Canvas only', async () => {
    const { app } = appThrowing(ltijs('INVALID_LTIK'));
    for (const res of [await request(app).post('/lti/launch'), await request(app).get('/lti/deeplink')]) {
      expect(res.headers['content-security-policy']).toMatch(
        /; frame-ancestors https:\/\/hvl\.instructure\.com$/,
      );
    }
  });

  it('[UD-013] with the web app, the page has the Hjelp header, opening a new tab so the launch is kept', async () => {
    const withWeb = await request(appThrowing(ltijs('INVALID_LTIK'), { webApp: true }).app).get('/lti/play');
    const without = await request(appThrowing(ltijs('INVALID_LTIK')).app).get('/lti/play');
    expect(withWeb.text).toContain(
      '<a href="/hjelp?lang=nn" target="_blank" rel="noopener noreferrer">Hjelp',
    );
    expect(without.text).not.toContain('/hjelp');
  });

  it('[UD-013] inside our /app/play chrome (a same-origin frame) the page has no second header; in Canvas it has', async () => {
    // Arrange: /app/play frames /lti/play under the header that already shows Hjelp
    const { app } = appThrowing(ltijs('INVALID_LTIK'), { webApp: true });
    const asFrame = (path: string, site: string) =>
      request(app).get(path).set('Sec-Fetch-Dest', 'iframe').set('Sec-Fetch-Site', site);
    // Act
    const inOurChrome = await Promise.all(['/lti/play', '/lti/edit'].map((p) => asFrame(p, 'same-origin')));
    const inCanvas = await asFrame('/lti/play', 'cross-site');
    // Assert
    for (const res of inOurChrome) {
      expect(res.status).toBe(401);
      expect(res.text).not.toContain('/hjelp');
      expect(res.text).not.toContain('hvl-site-header');
    }
    expect(inCanvas.text).toContain(
      '<a href="/hjelp?lang=nn" target="_blank" rel="noopener noreferrer">Hjelp',
    );
  });

  it('[PROD-012] once a route has resolved the ltik (setLtiPageLocale), the page and the JSON are in the launch’s language', async () => {
    const { app } = appThrowing(authError('hvl:activity-unavailable'));
    const page = await request(app).get('/lti/deeplink');
    const json = await request(app).get('/lti/deeplink').set('Accept', 'application/json');
    expect(page.text).toContain(`<h1>${t('page.notAvailable.title', {}, 'en')}</h1>`);
    expect(page.text).toContain('<html lang="en">');
    expect(json.body.message).toBe(t('error.activityUnavailable', {}, 'en'));
  });

  it('[PROD-012] a launch handler’s refusal tagged with withLaunchLocale is shown in the launch’s language', async () => {
    const tagged = withLaunchLocale(authError('hvl:activity-unavailable'), 'nb');
    const page = await request(appThrowing(tagged).app).post('/lti/launch');
    const untagged = await request(appThrowing(authError('hvl:activity-unavailable')).app).post(
      '/lti/launch',
    );
    expect(page.text).toContain('<html lang="nb">');
    expect(page.text).toContain(`<h1>${t('page.notAvailable.title', {}, 'nb')}</h1>`);
    expect(untagged.text).toContain('<html lang="nn">');
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
