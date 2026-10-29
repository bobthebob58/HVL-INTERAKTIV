/**
 * mappeFixture — the test fixture of the pedagogisk mappe (apps/server/test/fixtures/studio-content/mappe-fixture/)
 * loaded as the server loads it, copies of it with edits for the loader tests, and the real studio content with the
 * fixture's template and criteria, for the renderer, route and page tests.
 *
 * Why: the real template and criteria are ALU's and may not exist yet (D-082), so tests never assert their texts.
 *      One fixture with two criteria sets (so switching sets is testable, MAPPE-002) keeps the tests independent of
 *      ALU's edits.
 * Spec: MAPPE-002
 * Invariants:
 *   - The fixture folder holds only `mappe/`, read with `loadMappeContent`, never with `loadStudioContent`.
 *   - Edited copies live in fresh temporary folders, removed by `removeMappeFixtureCopies`.
 *   - `studioContentWithMappe` is the real content with the fixture's mappe, frozen like the real content.
 * Collaborators: ../../src/learningDesign/content/mappeContent.ts, ../../src/learningDesign/content/
 *   loadStudioContent.ts, ../fixtures/studio-content/README.md.
 * Tests: apps/server/test/learningDesign/content/mappeCriteria.test.ts and the other users of this file.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepFreeze } from '../../src/learningDesign/content/deepFreeze.js';
import { loadMappeContent, type MappeContent } from '../../src/learningDesign/content/mappeContent.js';
import { loadStudioContent, type StudioContent } from '../../src/learningDesign/content/loadStudioContent.js';
import type { ContentLoadResult } from '../../src/learningDesign/content/yamlContentFile.js';

/** The fixture's content folder. */
export const MAPPE_FIXTURE_ROOT = fileURLToPath(
  new URL('../fixtures/studio-content/mappe-fixture/', import.meta.url),
);

/** The fixture's two criteria sets: the default one and the one a request switches to. */
export const FIXTURE_SETS = { default: 'hvl-merittering-2025', other: 'fixture-2027' } as const;

const copies: string[] = [];

/**
 * Loads the mappe of a content folder laid out like the fixture, as `loadStudioContent` would.
 * @param root - The content folder; the fixture by default.
 * @returns The mappe content, or every problem.
 */
export const loadFixtureMappe = (root: string = MAPPE_FIXTURE_ROOT): ContentLoadResult<MappeContent> =>
  loadMappeContent({ root, phases: undefined, references: undefined });

/**
 * The fixture's mappe, loaded and frozen.
 * @returns The mappe content with its portfolio.
 * @throws Error when the fixture does not load (a broken fixture, not a test result).
 */
export function fixtureMappe(): MappeContent {
  const loaded = loadFixtureMappe();
  if (!loaded.ok) throw new Error(`The mappe fixture does not load: ${JSON.stringify(loaded.problems)}`);
  return deepFreeze(loaded.value);
}

/**
 * A fixture file's text.
 * @param file - Relative to the content folder, e.g. `mappe/template.nn.md`.
 * @returns Its text.
 */
export const mappeFixtureText = (file: string): string =>
  readFileSync(join(MAPPE_FIXTURE_ROOT, ...file.split('/')), 'utf8');

/**
 * A copy of the fixture in a new temporary folder, with files replaced or removed.
 * @param edits - File (relative to the content folder) → its new text, a function of its old text, or null to remove.
 * @returns The copy's content folder.
 */
export function editedMappeFixture(
  edits: Readonly<Record<string, string | ((text: string) => string) | null>>,
): string {
  const root = mkdtempSync(join(tmpdir(), 'hvli-mappe-'));
  copies.push(root);
  cpSync(MAPPE_FIXTURE_ROOT, root, { recursive: true });
  for (const [file, edit] of Object.entries(edits)) {
    const path = join(root, ...file.split('/'));
    if (edit === null) rmSync(path, { force: true });
    else writeFileSync(path, typeof edit === 'string' ? edit : edit(readFileSync(path, 'utf8')));
  }
  return root;
}

/** Removes every copy `editedMappeFixture` made. */
export function removeMappeFixtureCopies(): void {
  for (const root of copies.splice(0)) rmSync(root, { recursive: true, force: true });
}

/**
 * The repository's studio content with the fixture's mappe in place of the real one.
 * @param base - The content to start from; the real `content/` by default.
 * @returns Frozen content as `loadStudioContent()` gives it, with the fixture's template and criteria.
 */
export function studioContentWithMappe(base: StudioContent = loadStudioContent()): StudioContent {
  return deepFreeze({ ...base, mappe: fixtureMappe() });
}
