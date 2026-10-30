/**
 * guideFixture — the test fixture guide (apps/server/test/fixtures/studio-content/guide-fixture/) loaded as the
 * server loads the guide, copies of it with edits for the loader tests, and the real studio content with the
 * fixture's guide (and, optionally, the fixture pattern), for the route and page tests.
 *
 * Why: the real guide text is ALU's and may not exist yet (D-082), so tests never assert it. One fixture guide, which
 *      uses every node the tree allows, keeps the loader, route and page tests independent of ALU's edits (PED-002).
 * Spec: PED-002, PED-011
 * Invariants:
 *   - The fixture folder holds only `laeringsdesign/references.yaml` and the three `guide.*.md`; it is read with
 *     `loadGuideContent`, never `loadStudioContent`, so the other sections' files need no copies here.
 *   - Edited copies live in fresh temporary folders, removed by `removeGuideFixtureCopies`.
 *   - `studioContentWithFixtures` is the real content with the fixture's guide, frozen like the real content; its
 *     references add the fixtures' own, so every citation resolves.
 * Collaborators: ../../src/learningDesign/content/guideContent.ts, ../../src/learningDesign/content/
 *   loadStudioContent.ts, ./fixturePattern.ts, ../fixtures/studio-content/README.md.
 * Tests: apps/server/test/learningDesign/content/guideContent.test.ts and the other users of this file.
 */
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepFreeze } from '../../src/learningDesign/content/deepFreeze.js';
import { loadGuideContent, type GuideContent } from '../../src/learningDesign/content/guideContent.js';
import { loadStudioContent, type StudioContent } from '../../src/learningDesign/content/loadStudioContent.js';
import { loadReferencesContent } from '../../src/learningDesign/content/referencesContent.js';
import type { ContentLoadResult } from '../../src/learningDesign/content/yamlContentFile.js';
import { fixturePatterns, PATTERN_FIXTURE_ROOT } from './fixturePattern.js';

/** The fixture's content folder. */
export const GUIDE_FIXTURE_ROOT = fileURLToPath(
  new URL('../fixtures/studio-content/guide-fixture/', import.meta.url),
);

const copies: string[] = [];

/**
 * Loads the guide of a content folder laid out like the fixture, as `loadStudioContent` would.
 * @param root - The content folder; the fixture by default.
 * @returns The guide, or every problem.
 */
export function loadFixtureGuide(root: string = GUIDE_FIXTURE_ROOT): ContentLoadResult<GuideContent> {
  const references = loadReferencesContent(root);
  return loadGuideContent({
    root,
    phases: undefined,
    references: references.ok ? references.value : undefined,
  });
}

/**
 * The fixture's guide, loaded and frozen.
 * @returns The guide with its three documents.
 * @throws Error when the fixture does not load (a broken fixture, not a test result).
 */
export function fixtureGuide(): GuideContent {
  const loaded = loadFixtureGuide();
  if (!loaded.ok) throw new Error(`The guide fixture does not load: ${JSON.stringify(loaded.problems)}`);
  return deepFreeze(loaded.value);
}

/**
 * A copy of the fixture in a new temporary folder, with files replaced, edited or removed.
 * @param edits - File (relative to the content folder, e.g. `laeringsdesign/guide.nb.md`) → its new text, or null
 *   to remove it.
 * @returns The copy's content folder.
 */
export function editedGuideFixture(edits: Readonly<Record<string, string | null>>): string {
  const root = mkdtempSync(join(tmpdir(), 'hvli-guide-'));
  copies.push(root);
  cpSync(GUIDE_FIXTURE_ROOT, root, { recursive: true });
  for (const [file, text] of Object.entries(edits)) {
    const path = join(root, ...file.split('/'));
    if (text === null) rmSync(path, { force: true });
    else writeFileSync(path, text);
  }
  return root;
}

/** Removes every copy `editedGuideFixture` made. */
export function removeGuideFixtureCopies(): void {
  for (const root of copies.splice(0)) rmSync(root, { recursive: true, force: true });
}

/**
 * The repository's studio content with the fixture guide and, when asked, the fixture pattern added to the real ones.
 * @param options - `pattern`: add the fixture pattern `fixture-check` to the catalogue.
 * @returns Frozen content as `loadStudioContent()` gives it, with the fixtures' guide, references and patterns.
 */
export function studioContentWithFixtures(options: { readonly pattern?: boolean } = {}): StudioContent {
  const real = loadStudioContent();
  const extra = [GUIDE_FIXTURE_ROOT, ...(options.pattern ? [PATTERN_FIXTURE_ROOT] : [])].flatMap((root) => {
    const loaded = loadReferencesContent(root);
    return loaded.ok ? loaded.value.references : [];
  });
  // WHY: the loader returns patterns sorted by ID, and the catalogue keeps that order.
  const patterns = options.pattern
    ? [...real.patterns.patterns, ...fixturePatterns().patterns].sort((a, b) => a.id.localeCompare(b.id))
    : real.patterns.patterns;
  return deepFreeze({
    ...real,
    references: { ...real.references, references: [...real.references.references, ...extra] },
    guide: fixtureGuide(),
    patterns: { ...real.patterns, patterns },
  });
}
