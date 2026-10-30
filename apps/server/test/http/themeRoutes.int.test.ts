/**
 * Integration tests for the theme route of the H5P router: HVL's H5P theme files and the xAPI bridge's scripts are
 * public, served by exact name with the right type and nosniff, long-cached only for their current version, and nothing
 * else is reachable there.
 *
 * Spec: UD-011, SEC-004, LTI-010
 */
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { HVL_THEME_FILES, XAPI_BRIDGE_FILES } from '../../src/h5p/h5pAssets.js';
import { openHttpTestbed, type HttpTestbed } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('the H5P theme route', () => {
  let tb: HttpTestbed;
  beforeAll(async () => {
    tb = await openHttpTestbed();
  }, 60_000);
  afterAll(() => tb.close());

  it.each(HVL_THEME_FILES.map((file) => [file.name, file] as const))(
    '[UD-011] serves %s without a session, typed, nosniff and long-cached for its version',
    async (name, file) => {
      const res = await request(tb.app).get(`/h5p/theme/${name}?version=${file.version}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(name.endsWith('.js') ? /^text\/javascript/ : /^text\/css/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(res.text).toBe(readFileSync(file.path, 'utf8'));
    },
  );

  it.each(XAPI_BRIDGE_FILES.map((file) => [file.name, file] as const))(
    '[LTI-010] serves the bridge script %s like the theme: public, typed, nosniff, versioned, with no token in it',
    async (name, file) => {
      const res = await request(tb.app).get(`/h5p/theme/${name}?version=${file.version}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^text\/javascript/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(res.text).toBe(readFileSync(file.path, 'utf8'));
    },
  );

  it('[UD-011] revalidates a theme file requested without its current version', async () => {
    for (const query of ['', '?version=000000000000']) {
      const res = await request(tb.app).get(`/h5p/theme/hvl-h5p-theme.css${query}`);
      expect(res.status, query).toBe(200);
      expect(res.headers['cache-control'], query).toBe('no-cache');
    }
  });

  it.each([
    '/h5p/theme/no-such-file.css',
    '/h5p/theme/tokens.json',
    '/h5p/theme/README.md',
    '/h5p/theme/..%2F..%2Fpackage.json',
    '/h5p/theme/%2E%2E%2Ftokens.css',
    '/h5p/theme/',
  ])('[SEC-004] answers 404 for %s, outside the allowlist', async (path) => {
    const res = await request(tb.app).get(path);
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
  });
});
