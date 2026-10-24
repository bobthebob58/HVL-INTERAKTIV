/**
 * Integration tests for the server pages' stylesheet route: the files are served with nosniff, nothing else is, and
 * the stylesheets use design tokens only.
 *
 * Spec: UD-001, LTI-003
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  pageAssetRoutes,
  SERVER_CHROME_STYLESHEET,
  SERVER_PAGES_STYLESHEET,
} from '../../../src/http/pages/pageAssetRoutes.js';

const app = express().use(pageAssetRoutes());

describe('[UD-001] server pages stylesheet', () => {
  it('[UD-001] is served as CSS with nosniff, as is the header stylesheet', async () => {
    for (const path of [SERVER_PAGES_STYLESHEET, SERVER_CHROME_STYLESHEET]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^text\/css/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    }
  });

  it('[LTI-003] serves no other file, directory listing or dotfile', async () => {
    for (const path of ['/static/pages/', '/static/pages/.env', '/static/pages/../pageAssetRoutes.ts']) {
      expect((await request(app).get(path)).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('[UD-001] names colours only through design tokens', () => {
    for (const file of ['serverPages.css', 'serverChrome.css']) {
      const css = readFileSync(
        fileURLToPath(new URL(`../../../src/http/pages/assets/${file}`, import.meta.url)),
        'utf8',
      );
      expect(css, file).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      expect(css, file).toContain('var(--hvl-primary-dark)');
    }
  });
});
