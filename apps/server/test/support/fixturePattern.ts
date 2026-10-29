/**
 * fixturePattern — the test fixture pattern `fixture-check` (apps/server/test/fixtures/studio-content/pattern-fixture/)
 * loaded as the server loads patterns, copies of it with one mistake each for the loader tests, and the real studio
 * content with the fixture's patterns, for the creation tests.
 *
 * Why: PED-011 asks that a new pattern folder needs no code change, and the loader must name the file and the key of
 *      every mistake (PED-010, D-082). One fixture pattern, edited per test, keeps each test to the mistake it is
 *      about; the real `content/` stays out of the assertions, because ALU edits it (and may have no patterns yet).
 * Spec: PED-010, PED-011
 * Invariants:
 *   - The fixture folder holds only `laeringsdesign/references.yaml` and `laeringsdesign/patterns/`; it is read with
 *     `loadPatternContent`, never `loadStudioContent`, so the other sections' files need no copies here.
 *   - Edited copies live in fresh temporary folders, removed by `removePatternFixtureCopies`.
 *   - `studioContentWithPatterns` is the real content with only `patterns` replaced, frozen like the real content.
 * Collaborators: ../../src/learningDesign/content/patternContent.ts, ../../src/learningDesign/content/
 *   referencesContent.ts, ../../src/learningDesign/content/loadStudioContent.ts, ../fixtures/studio-content/README.md.
 * Tests: apps/server/test/learningDesign/content/patternContent.test.ts and the other users of this file.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepFreeze } from '../../src/learningDesign/content/deepFreeze.js';
import { loadStudioContent, type StudioContent } from '../../src/learningDesign/content/loadStudioContent.js';
import { loadPatternContent, type PatternContent } from '../../src/learningDesign/content/patternContent.js';
import { loadReferencesContent } from '../../src/learningDesign/content/referencesContent.js';
import type { StudioContentInputs } from '../../src/learningDesign/content/studioContentContext.js';
import type { ContentLoadResult } from '../../src/learningDesign/content/yamlContentFile.js';

/** The fixture's content folder. */
export const PATTERN_FIXTURE_ROOT = fileURLToPath(
  new URL('../fixtures/studio-content/pattern-fixture/', import.meta.url),
);

/** The fixture pattern's ID and folder name. */
export const FIXTURE_PATTERN_ID = 'fixture-check';

/** The fixture pattern's folder, relative to a content folder. */
export const FIXTURE_PATTERN_DIR = `laeringsdesign/patterns/${FIXTURE_PATTERN_ID}`;

const copies: string[] = [];

/**
 * Loads the patterns of a content folder laid out like the fixture, as `loadStudioContent` would.
 * @param root - The content folder; the fixture by default.
 * @param inputs - Further loader inputs, e.g. the installed libraries.
 * @returns The patterns, or every problem.
 */
export function loadFixturePatterns(
  root: string = PATTERN_FIXTURE_ROOT,
  inputs: StudioContentInputs = {},
): ContentLoadResult<PatternContent> {
  const references = loadReferencesContent(root);
  // WHY: the pattern loader does not read the phases; references come from the fixture, which cites its own key.
  return loadPatternContent({
    ...inputs,
    root,
    phases: undefined,
    references: references.ok ? references.value : undefined,
  });
}

/**
 * The fixture's patterns, loaded and frozen.
 * @param root - The content folder; the fixture by default.
 * @returns The patterns.
 * @throws Error when the folder does not load (a broken fixture, not a test result).
 */
export function fixturePatterns(root: string = PATTERN_FIXTURE_ROOT): PatternContent {
  const loaded = loadFixturePatterns(root);
  if (!loaded.ok) throw new Error(`The pattern fixture does not load: ${JSON.stringify(loaded.problems)}`);
  return deepFreeze(loaded.value);
}

/**
 * The repository's studio content with other patterns, for an app that should offer them.
 * @param patterns - The patterns to offer.
 * @returns Frozen content as `loadStudioContent()` gives it, except `patterns`.
 */
export function studioContentWithPatterns(patterns: PatternContent): StudioContent {
  return deepFreeze({ ...loadStudioContent(), patterns });
}

/**
 * A copy of the fixture in a new temporary folder, with edits applied to its files.
 * @param edits - File (relative to the content folder) → a function from its text (empty for a new file) to the
 *   new text.
 * @param renames - Folder renames inside `laeringsdesign/patterns/`, old name → new name.
 * @returns The copy's content folder.
 */
export function editedPatternFixture(
  edits: Readonly<Record<string, (text: string) => string>>,
  renames: Readonly<Record<string, string>> = {},
): string {
  const root = mkdtempSync(join(tmpdir(), 'hvli-pattern-'));
  copies.push(root);
  cpSync(PATTERN_FIXTURE_ROOT, root, { recursive: true });
  for (const [file, edit] of Object.entries(edits)) {
    const path = join(root, ...file.split('/'));
    // WHY: an edit of a file the fixture lacks adds it (a stray file in a pattern folder).
    writeFileSync(path, edit(existsSync(path) ? readFileSync(path, 'utf8') : ''));
  }
  for (const [from, to] of Object.entries(renames)) {
    const patterns = join(root, 'laeringsdesign', 'patterns');
    cpSync(join(patterns, from), join(patterns, to), { recursive: true });
    rmSync(join(patterns, from), { recursive: true, force: true });
  }
  return root;
}

/** Removes every copy `editedPatternFixture` made. */
export function removePatternFixtureCopies(): void {
  for (const root of copies.splice(0)) rmSync(root, { recursive: true, force: true });
}
