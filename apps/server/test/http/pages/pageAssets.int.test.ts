/**
 * Integration tests for the server pages' stylesheet route: the file is served with nosniff, nothing else is, and
 * the stylesheet uses design tokens only.
 *
 * Spec: UD-001, LTI-003
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { pageAssetRoutes, SERVER_PAGES_STYLESHEET } from '../../../src/http/pages/pageAssetRoutes.js';

const app = express().use(pageAssetRoutes());

describe('[UD-001] server pages stylesheet', () => {
  it('[UD-001] is served as CSS with nosniff', async () => {
    const res = await request(app).get(SERVER_PAGES_STYLESHEET);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/css/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('[LTI-003] serves no other file, directory listing or dotfile', async () => {
    for (const path of ['/static/pages/', '/static/pages/.env', '/static/pages/../pageAssetRoutes.ts']) {
      expect((await request(app).get(path)).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('[UD-001] names colours only through design tokens', () => {
    const css = readFileSync(
      fileURLToPath(new URL('../../../src/http/pages/assets/serverPages.css', import.meta.url)),
      'utf8',
    );
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(css).toContain('var(--hvl-primary-dark)');
  });
});
