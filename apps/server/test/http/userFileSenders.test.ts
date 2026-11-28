/**
 * Tests that only the files origin can send a user file, read from the server's own source: `sendUserFile` is
 * imported by the two grant-checked route modules alone, those are mounted by the files origin's router alone, and
 * that router is built for the files host alone. A new route that sends an uploaded file from the app's own origin
 * would have to break one of these (D-153).
 *
 * Spec: SEC-004
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = new URL('../../src/', import.meta.url);
const files = (readdirSync(SRC, { recursive: true }) as string[])
  .map((name) => name.replaceAll('\\', '/'))
  .filter((name) => name.endsWith('.ts') && !name.startsWith('generated/'));
const sources = new Map(files.map((name) => [name, readFileSync(new URL(name, SRC), 'utf8')]));

/** The source files whose code (not comments) matches `pattern`, sorted. */
const filesWith = (pattern: RegExp): string[] =>
  [...sources]
    .filter(([, text]) => pattern.test(text.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '')))
    .map(([name]) => name)
    .sort();

describe('[SEC-004] which server code can send a user file', () => {
  it('[SEC-004] only the two grant-checked route modules import sendUserFile', () => {
    // Act
    const importers = filesWith(/from '[^']*\/sendUserFile\.js'/);
    // Assert
    expect(files.length).toBeGreaterThan(100);
    expect(importers).toEqual(['http/routes/signedFileRoutes.ts', 'http/routes/signedUploadRoutes.ts']);
  });

  it('[SEC-004] only the files origin’s router mounts them, and only the files host gets that router', () => {
    // Act
    const mounting = filesWith(/from '[^']*\/signed(File|Upload)Routes\.js'/);
    const building = filesWith(/\b(grantedFileRoutes|filesOriginRouter)\(/);
    const hosting = filesWith(/\bcreateFilesHostRouter\(/);
    // Assert: `createFilesHostRouter` wraps the router in `routeFilesHost`, which answers the files host only
    expect(mounting).toEqual(['http/filesOriginRouter.ts']);
    expect(building).toEqual(['http/createH5pRouter.ts', 'http/filesOriginRouter.ts']);
    expect(hosting).toEqual(['http/createH5pRouter.ts', 'server/createApp.ts']);
    expect(sources.get('http/createH5pRouter.ts')).toMatch(
      /return routeFilesHost\(filesOriginOf\(settings\), router\);/,
    );
  });
});
