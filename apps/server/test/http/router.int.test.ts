/**
 * Integration tests for the H5P router: which routes are public, 401 without a signed-in person, static file
 * headers, and error answers that never leak internal messages.
 *
 * Spec: H5P-004, H5P-006, SEC-004
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { t } from '../../src/i18n/translate.js';
import { openHttpTestbed, type HttpTestbed } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('H5P router', () => {
  let tb: HttpTestbed;
  beforeAll(async () => {
    tb = await openHttpTestbed();
  }, 60_000);
  afterAll(() => tb.close());

  const id = randomUUID();
  const ACTOR_ROUTES: [string, string][] = [
    ['get', '/h5p/ajax?action=content-type-cache'],
    ['post', '/h5p/ajax?action=libraries'],
    ['get', `/h5p/content/${id}/images/a.png`],
    ['get', '/h5p/temp-files/a.png'],
    ['get', `/h5p/contentUserData/${id}/state/0`],
    ['post', `/h5p/contentUserData/${id}/state/0`],
    ['get', `/h5p/params/${id}`],
    ['post', '/h5p/content'],
    ['put', `/h5p/content/${id}`],
    ['delete', `/h5p/content/${id}`],
    ['get', `/h5p/download/${id}`],
    ['get', `/h5p/play/${id}`],
  ];

  it.each(ACTOR_ROUTES)('[H5P-006] %s %s answers 401 without a signed-in person', async (method, path) => {
    const res = await (request(tb.app) as unknown as Record<string, (p: string) => request.Test>)[method]!(
      path,
    );
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      errorCode: 'error.unauthenticated',
      httpStatusCode: 401,
      message: t('error.unauthenticated', {}, 'nn'),
    });
  });

  it('[SEC-004] core and editor client files are public, long-cached and never sniffed', async () => {
    for (const path of [
      '/h5p/core/js/h5p.js',
      '/h5p/core/styles/h5p.css',
      '/h5p/editor/scripts/h5peditor.js',
    ]) {
      const res = await request(tb.app).get(path);
      expect(res.status, path).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toMatch(/max-age=31536000/);
    }
  });

  it('[SEC-004] the core folder serves no PHP, documents or dotfiles', async () => {
    for (const path of [
      '/h5p/core/h5p.classes.php',
      '/h5p/core/README.txt',
      '/h5p/core/.gitignore',
      '/h5p/core/',
    ]) {
      const res = await request(tb.app).get(path);
      expect(res.status, path).toBe(404);
      expect(res.text).not.toContain('<?php');
    }
  });

  it('[SEC-004] library files are public and nosniff; an SVG library file gets the sandbox CSP', async () => {
    const js = await request(tb.app).get('/h5p/libraries/H5P.MultiChoice-1.16/js/main.js');
    expect(js.status).toBe(200);
    expect(js.headers['x-content-type-options']).toBe('nosniff');
    const svg = await request(tb.app).get('/h5p/libraries/H5P.MultiChoice-1.16/images/icon.svg');
    expect(svg.status).toBe(200);
    expect(svg.headers['content-security-policy']).toMatch(/^sandbox/);
    const php = await request(tb.app).get('/h5p/libraries/H5P.MultiChoice-1.16/library.php');
    expect(php.status).toBe(404);
  });

  it('[H5P-006] a refused request gets a translated message and no internal detail', async () => {
    const author = await tb.actor('author', { locale: 'en' });
    const res = await request(tb.app)
      .get(`/h5p/params/${randomUUID()}`)
      .set(...author.header);
    expect(res.status).toBe(403);
    expect((res.body as { message: string }).message).toBe(t('error.forbidden', {}, 'en'));
    expect(Object.keys(res.body as object).sort()).toEqual([
      'errorCode',
      'httpStatusCode',
      'message',
      'success',
    ]);
    expect(res.text).not.toMatch(/Error:|\bat \w|node_modules|\/home\//);
  });

  it('[PROD-012] malformed JSON, a missing client file and an unsafe file name are 4xx, not server faults', async () => {
    const author = await tb.actor('author');
    const json = await request(tb.app)
      .post('/h5p/content')
      .set(...author.header)
      .set('Content-Type', 'application/json')
      .send('{"library": ');
    expect(json.status).toBe(400);
    expect((await request(tb.app).get('/h5p/core/js/no-such-file.js')).status).toBe(404);
    const unsafe = await request(tb.app)
      .get('/h5p/temp-files/..%2F..%2Fsecret.png')
      .set(...author.header);
    expect(unsafe.status).toBeGreaterThanOrEqual(400);
    expect(unsafe.status).toBeLessThan(500);
  });

  it('[H5P-006] a path that is not a route answers 404 in the actor’s language, also to learners', async () => {
    const learner = await tb.actor('learner', { locale: 'nb' });
    const res = await request(tb.app)
      .get('/h5p/no-such-route')
      .set(...learner.header);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ errorCode: 'error.notFound', message: t('error.notFound', {}, 'nb') });
  });
});
