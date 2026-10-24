/**
 * Tests that the validator stays pure: no file under src/validation imports an I/O module or reads the clock,
 * randomness or the environment (D-073).
 *
 * Spec: UD-020
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const VALIDATION_DIR = fileURLToPath(new URL('../../src/validation', import.meta.url));

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => !entry.isDirectory() && entry.name.endsWith('.ts'))
    .map((entry) => join(entry.parentPath, entry.name));

/** Module specifiers a value import may use: the folder itself, its locale files and htmlparser2 (D-073). */
const allowed = (file: string, specifier: string): boolean => {
  if (specifier === 'htmlparser2') return true;
  if (!specifier.startsWith('.')) return false;
  const target = relative(VALIDATION_DIR, join(file, '..', specifier));
  return !target.startsWith('..');
};

/** The value imports of a file (type-only imports are erased and never run). */
const valueImports = (source: string): string[] => [
  ...[...source.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1] ?? ''),
  ...[...source.matchAll(/^import\s+'([^']+)'/gm)].map((m) => m[1] ?? ''),
  ...[...source.matchAll(/\b(?:import|require)\s*\(\s*['"`]([^'"`]+)/g)].map((m) => m[1] ?? ''),
];

const FORBIDDEN_GLOBALS =
  /\b(?:process\.|fetch\(|Date\.now\(|new Date\(|Math\.random\(|setTimeout\(|setInterval\()/;

describe('[UD-020] validator purity', () => {
  const files = sourceFiles(VALIDATION_DIR);

  it('[UD-020] finds the validator sources to check', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(files.map((file) => [relative(VALIDATION_DIR, file), file]))(
    '[UD-020] %s imports nothing that does I/O',
    (_, file) => {
      // Arrange
      const source = readFileSync(file, 'utf8');
      // Act
      const outside = valueImports(source).filter((specifier) => !allowed(file, specifier));
      // Assert
      expect(outside).toEqual([]);
      expect(source).not.toMatch(FORBIDDEN_GLOBALS);
    },
  );

  it('[UD-020] the import scan would catch an I/O import', () => {
    const file = join(VALIDATION_DIR, 'example.ts');
    const found = valueImports(
      "import { readFileSync } from 'node:fs';\nimport type { X } from '../config/env.js';",
    );
    expect(found.filter((specifier) => !allowed(file, specifier))).toEqual(['node:fs']);
  });
});
