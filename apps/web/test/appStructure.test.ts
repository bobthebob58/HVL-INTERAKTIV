/**
 * Tests that the web app stays a rendering layer: no route handlers, server actions, middleware or API routes, so
 * every data request goes through Express's checks (D-068).
 *
 * Spec: AUTH-003, LTI-003
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const SOURCES = join(ROOT, 'src');

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  );

describe('[AUTH-003] the web app has no server endpoints of its own', () => {
  const files = filesUnder(SOURCES).map((file) => relative(ROOT, file));

  it('[AUTH-003] no route handlers, API routes, middleware, proxy or instrumentation files', () => {
    const endpoints = files.filter((file) =>
      /(^|\/)(route|middleware|proxy|instrumentation)\.[cm]?[jt]sx?$|(^|\/)pages\/api\//.test(file),
    );
    expect(endpoints).toEqual([]);
  });

  it('[LTI-003] no server actions', () => {
    const actions = files.filter((file) => /['"]use server['"]/.test(readFileSync(join(ROOT, file), 'utf8')));
    expect(actions).toEqual([]);
  });

  it('[AUTH-003] the sources the checks walk exist', () => {
    expect(files).toContain('src/app/layout.tsx');
  });
});
