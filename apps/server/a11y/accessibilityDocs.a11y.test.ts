/**
 * The manual side of accessibility stays consistent with the automated one: the protocol scripts J1 to J4 for the
 * five set-ups UD-031 names, the matrix covers every browser and screen reader of NFR-003 and names only suites
 * that exist, and every file in the results folder is a dated result. These are checks of documents, so they run
 * without a browser or services.
 *
 * Spec: UD-031, NFR-003
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DOCS = fileURLToPath(new URL('../../../docs/accessibility/', import.meta.url));
const SUITES = fileURLToPath(new URL('./', import.meta.url));
const read = (name: string) => readFileSync(`${DOCS}${name}`, 'utf8');

describe('[UD-031] the manual accessibility documents', () => {
  it('[UD-031] the protocol scripts J1 to J4 for NVDA + Firefox, JAWS + Chrome, VoiceOver + iOS, keyboard and 400 %', () => {
    // Arrange
    const protocol = read('manual-test-protocol.md');
    // Act
    const setUps = [...protocol.matchAll(/^\| \*\*(AT-\d|KB|Z400)\*\* \| ([^|]+) \| ([^|]+) \|/gm)].map(
      (m) => `${m[1]}: ${m[2]?.trim()} / ${m[3]?.trim()}`,
    );
    // Assert
    expect(setUps).toEqual([
      'AT-1: NVDA (current release) / Firefox on Windows 11',
      'AT-2: JAWS (current release) / Chrome on Windows 11',
      'AT-3: VoiceOver / Safari on iOS (current release)',
      'KB: Keyboard only, no pointer / Edge or Chrome on Windows, Firefox on macOS',
      'Z400: Browser zoom 400 % / Chrome or Edge on a 1280 × 1024 window',
    ]);
    for (const journey of ['J1', 'J2', 'J3', 'J4'])
      expect(protocol).toMatch(new RegExp(`^### ${journey} — `, 'm'));
  });

  it('[UD-031] every file in the results folder is a dated result of a known set-up', () => {
    // Arrange
    const files = readdirSync(`${DOCS}results`).filter((name) => name !== 'README.md');
    // Act
    const undated = files.filter(
      (name) => !/^\d{4}-\d{2}-\d{2}-[\w.-]+-(AT-\d|KB|Z400|[A-Z][\w-]*)\.md$/.test(name),
    );
    // Assert
    expect(read('results/README.md')).toContain('YYYY-MM-DD-<release>-<set-up>.md');
    expect(undated).toEqual([]);
  });

  it('[NFR-003] the matrix covers every browser and screen reader and names only suites that exist', () => {
    // Arrange
    const matrix = read('nfr-003-matrix.md');
    // Act
    const suites = [...matrix.matchAll(/`(\w+\.a11y\.test\.ts)`/g)].map((m) => m[1] ?? '');
    // Assert
    for (const name of [
      'Chrome',
      'Edge',
      'Firefox',
      'Safari',
      'iOS',
      'Android',
      'NVDA',
      'JAWS',
      'VoiceOver',
    ]) {
      expect(matrix).toContain(name);
    }
    expect(suites.length).toBeGreaterThan(8);
    expect(suites.filter((name) => !existsSync(`${SUITES}${name}`))).toEqual([]);
  });
});
