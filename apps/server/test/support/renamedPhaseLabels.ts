/**
 * renamedPhaseLabels — the repository's studio content with the phases of the `renamed-label` fixture, for tests that
 * show a renamed phase label reaching the guide, the catalogue, the planner or the portfolio without a code change.
 *
 * Why: PED-001 asks that renaming a label in phases.yaml changes it everywhere. A fixture folder that had to load in
 *      full would need every workstream's guide, pattern and portfolio files copied into it, and would break each
 *      time one of them changes. Swapping only the phases keeps each test independent of the other sections' files.
 * Spec: PED-001
 * Invariants:
 *   - Only `phases` differs from `loadStudioContent()`; the result is frozen like the real content.
 *   - The fixture renames the `forarbeid` label to `RENAMED_FORARBEID_LABEL`; the other labels are the usual ones.
 * Collaborators: ../../src/learningDesign/content/loadStudioContent.ts,
 *   ../../src/learningDesign/content/phasesContent.ts, ../fixtures/studio-content/renamed-label/ (see its README.md).
 * Tests: apps/server/test/learningDesign/content/phasesContent.test.ts
 */
import { fileURLToPath } from 'node:url';
import type { LocalisedText } from '../../src/learningDesign/content/contentText.js';
import { deepFreeze } from '../../src/learningDesign/content/deepFreeze.js';
import { loadStudioContent, type StudioContent } from '../../src/learningDesign/content/loadStudioContent.js';
import { loadPhasesContent } from '../../src/learningDesign/content/phasesContent.js';

/** The content folder whose phases.yaml renames the `forarbeid` label. */
export const RENAMED_LABEL_ROOT = fileURLToPath(
  new URL('../fixtures/studio-content/renamed-label/', import.meta.url),
);

/** The `forarbeid` label in that fixture. */
export const RENAMED_FORARBEID_LABEL: LocalisedText = Object.freeze({
  nn: 'Førebuing',
  nb: 'Forberedelse',
  en: 'Preparation',
});

/**
 * The real studio content with the fixture's renamed phases.
 * @returns Frozen content as `loadStudioContent()` gives it, except `phases`.
 * @throws Error when the fixture itself does not load (a broken fixture, not a test result).
 */
export function studioContentWithRenamedLabel(): StudioContent {
  const phases = loadPhasesContent(RENAMED_LABEL_ROOT);
  if (!phases.ok) {
    throw new Error(`The renamed-label fixture does not load: ${JSON.stringify(phases.problems)}`);
  }
  return deepFreeze({ ...loadStudioContent(), phases: phases.value });
}
