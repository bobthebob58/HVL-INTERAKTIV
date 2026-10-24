/**
 * Tests for the portal's friendly pages: a first-party policy on every message, error and start page (DATA-011),
 * also when an H5P route set its own policy first, and the Hjelp header whenever the web app runs, except inside
 * our own chrome's frame (UD-013).
 *
 * Spec: DATA-011, PROD-004, UD-013
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../../../src/http/HttpError.js';
import { offerHelpLink } from '../../../src/http/pages/helpLink.js';
import { portalHomeRoutes, portalNotFound } from '../../../src/http/pages/portalHomeRoutes.js';
import { portalPageCsp, sendPortalError, sendPortalPage } from '../../../src/http/pages/portalPages.js';
import { h5pPageCsp } from '../../../src/http/h5pPageCsp.js';
import { createLogger } from '../../../src/logging/logger.js';

const logger = createLogger({ level: 'silent' });
const directives = (csp: string | undefined) =>
  new Map(
    (csp ?? '').split('; ').map((d) => [d.split(' ')[0] ?? '', d.split(' ').slice(1).join(' ')] as const),
  );

/** A portal app: an H5P route that answers "not available", an error, the start page and the 404. */
function portalApp(options: { webApp: boolean }) {
  const app = express();
  if (options.webApp) app.use(offerHelpLink());
  app.get('/h5p/play/:id', (_req, res) => {
    // Like playerRoutes: the H5P policy is set first, then the activity turns out to be unavailable.
    res.set(
      'Content-Security-Policy',
      h5pPageCsp({ scriptHashes: [], externalMediaOrigins: [] }, ["'self'"]),
    );
    sendPortalPage(res, 404, {
      locale: 'nn',
      titleKey: 'page.notAvailable.title',
      bodyKey: 'page.notAvailable.body',
    });
  });
  app.get('/boom', () => {
    throw new HttpError(503, 'error.generic');
  });
  app.use(portalHomeRoutes());
  app.use(portalNotFound());
  app.use(((error, _req, res, _next) =>
    sendPortalError(res, error, logger)) satisfies express.ErrorRequestHandler);
  return app;
}

describe('[DATA-011] portal page policy', () => {
  it('[DATA-011] the not-available, error and 404 pages load our own files only and are framed by us only', async () => {
    // Arrange
    const app = portalApp({ webApp: false });
    // Act
    const pages = await Promise.all(
      ['/h5p/play/x', '/boom', '/no-such-page'].map((path) => request(app).get(path)),
    );
    // Assert
    expect(pages.map((res) => res.status)).toEqual([404, 503, 404]);
    for (const res of pages) {
      expect(res.headers['content-security-policy']).toBe(portalPageCsp());
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['cache-control']).toBe('no-store');
    }
    const csp = directives(portalPageCsp());
    expect(csp.get('default-src')).toBe("'none'");
    expect(csp.get('script-src')).toBe("'self'");
    expect(csp.get('style-src')).toBe("'self'");
    // PROD-006: a page script asks /auth/session for the CSRF token, on our own origin only.
    expect(csp.get('connect-src')).toBe("'self'");
    expect(csp.get('form-action')).toBe("'self'");
    expect(csp.get('frame-ancestors')).toBe("'self'");
  });

  it('[DATA-011] the start page has the same sources, without form-action for the logout redirect to Feide', async () => {
    const res = await request(portalApp({ webApp: false })).get('/');
    expect(res.headers['content-security-policy']).toBe(portalPageCsp({ formAction: false }));
    expect(directives(res.headers['content-security-policy']).has('form-action')).toBe(false);
    expect(directives(res.headers['content-security-policy']).get('script-src')).toBe("'self'");
    expect(directives(res.headers['content-security-policy']).get('connect-src')).toBe("'self'");
  });
});

describe('[UD-013] portal pages and Hjelp', () => {
  it('[UD-013] with the web app, every portal page has the Hjelp header in the whole window', async () => {
    const app = portalApp({ webApp: true });
    for (const path of ['/h5p/play/x', '/boom', '/no-such-page']) {
      expect((await request(app).get(path)).text, path).toContain('<a href="/hjelp" target="_top">Hjelp</a>');
    }
  });

  it('[UD-013] inside our own chrome (a same-origin frame) there is no second header; a top-level page keeps it', async () => {
    // Arrange: /aktivitet frames /h5p/play/:id under its own header with Hjelp
    const app = portalApp({ webApp: true });
    const asFrame = (site: string) =>
      request(app).get('/h5p/play/x').set('Sec-Fetch-Dest', 'iframe').set('Sec-Fetch-Site', site);
    // Act
    const inOurChrome = await asFrame('same-origin');
    const elsewhere = await asFrame('cross-site');
    const topLevel = await request(app).get('/h5p/play/x').set('Sec-Fetch-Dest', 'document');
    // Assert
    expect(inOurChrome.text).not.toContain('/hjelp');
    expect(inOurChrome.text).not.toContain('hvl-site-header');
    expect(inOurChrome.text).toContain('<main id="main"');
    for (const res of [elsewhere, topLevel]) expect(res.text).toContain('<a href="/hjelp" target="_top">');
  });

  it('[UD-013] without the web app there is no link to a help page that does not exist', async () => {
    expect((await request(portalApp({ webApp: false })).get('/no-such-page')).text).not.toContain('/hjelp');
  });
});
