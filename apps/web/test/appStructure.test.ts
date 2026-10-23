/**
 * Tests that the web app stays a rendering layer: no route handlers, server actions, middleware or API routes, so
 * every data request goes through Express's checks (D-068); no inline script or style, no third-party address and no
 * browser storage in its sources (D-070, DATA-011, LTI-003); and every page S4 promises exists.
 *
 * Spec: AUTH-003, LTI-003, DATA-011, UD-006
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

describe('[DATA-011] the web app’s sources stay first-party and nonce-safe', () => {
  // WHY: comments may cite documentation or name what the code avoids; only code and styles are checked.
  const sources = filesUnder(SOURCES)
    .filter((file) => /\.(tsx?|css)$/.test(file))
    .map((file) => ({
      file: relative(ROOT, file),
      text: readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''),
    }));
  const matching = (pattern: RegExp) =>
    sources.filter(({ text }) => pattern.test(text)).map(({ file }) => file);

  it('[UD-006] every page S4 promises exists, each in the right chrome', () => {
    // Act
    const pages = filesUnder(join(SOURCES, 'app'))
      .map((file) => relative(SOURCES, file))
      .filter((file) => file.endsWith('page.tsx'))
      .sort();
    // Assert
    expect(pages).toEqual([
      'app/(portal)/aktivitet/[id]/page.tsx',
      'app/(portal)/aktivitet/ny/page.tsx',
      'app/(portal)/hjelp/page.tsx',
      'app/(portal)/page.tsx',
      'app/(portal)/personvern/page.tsx',
      'app/app/play/page.tsx',
    ]);
  });

  it('[DATA-011] names no address on another site in code or styles', () => {
    expect(matching(/\bhttps?:\/\/|url\(\s*['"]?\/\//)).toEqual([]);
  });

  it('[DATA-011] writes no inline script, raw HTML or style attribute', () => {
    expect(matching(/<script\b|dangerouslySetInnerHTML|\bstyle=\{/)).toEqual([]);
  });

  it('[LTI-003] never touches browser storage or cookies, where an ltik could be kept', () => {
    expect(matching(/\b(localStorage|sessionStorage|indexedDB)\b|document\.cookie/)).toEqual([]);
  });

  it('[UD-006] frames H5P pages only through the titled H5pFrame component', () => {
    expect(matching(/<iframe\b/)).toEqual(['src/components/H5pFrame.tsx']);
  });
});
