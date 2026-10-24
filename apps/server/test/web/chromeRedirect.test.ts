/**
 * Tests for the redirect of top-level navigations from H5P pages to their web-app chrome page (D-067).
 *
 * Spec: DATA-006, UD-013
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { chromeRedirect } from '../../src/web/chromeRedirect.js';

const app = express()
  .use(chromeRedirect())
  .use((_req, res) => {
    res.send('h5p page');
  });

const NAVIGATION = { 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' };
const ID = '0192f0c4-0000-7000-8000-000000000042';

describe('[DATA-006] H5P pages opened on their own go to their chrome page', () => {
  it.each([
    [`/h5p/play/${ID}`, `/aktivitet/${ID}`],
    [`/h5p/edit/${ID}`, `/aktivitet/${ID}`],
    ['/h5p/new', '/aktivitet/ny'],
    ['/lti/play?ltik=a.b.c&other=x', '/app/play?ltik=a.b.c'],
    ['/lti/edit?ltik=a.b.c', '/app/play?ltik=a.b.c'],
    ['/lti/play', '/app/play'],
    // Express routes these spellings to the same pages (no strict routing, no case sensitivity).
    [`/H5P/Play/${ID}/`, `/aktivitet/${ID}`],
    ['/h5p/NEW/', '/aktivitet/ny'],
    ['/lti/play/?ltik=a.b.c', '/app/play?ltik=a.b.c'],
    ['/LTI/Edit', '/app/play'],
  ])('[DATA-006][UD-013] a top-level navigation to %s goes to %s, never cached', async (path, target) => {
    const res = await request(app).get(path).set(NAVIGATION);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(target);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it.each([
    ['a frame', { 'Sec-Fetch-Dest': 'iframe', 'Sec-Fetch-Mode': 'navigate' }],
    ['a fetch', { 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors' }],
    ['a client without fetch metadata', {}],
  ])('[DATA-006] %s gets the H5P page itself', async (_case, headers) => {
    const res = await request(app).get(`/h5p/play/${ID}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.text).toBe('h5p page');
  });

  it.each([`/h5p/play/${ID}/extra`, '/h5p/play/%3Cx%3E', '/h5p/ajax', '/lti/deeplink', '/h5p/content/x'])(
    '[DATA-006] %s is not an H5P page and is left alone',
    async (path) => {
      const res = await request(app).get(path).set(NAVIGATION);
      expect(res.status).toBe(200);
    },
  );

  it('[DATA-006] a POST is never redirected', async () => {
    const res = await request(app).post(`/h5p/edit/${ID}`).set(NAVIGATION);
    expect(res.status).toBe(200);
  });
});
