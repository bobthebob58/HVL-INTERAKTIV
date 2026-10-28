/**
 * patternContent — the patterns' slot in the studio content: will load every folder under
 * `content/laeringsdesign/patterns/<id>/` (`pattern.yaml` and its skeleton JSON, D-084).
 *
 * Why: a new pattern needs no code change (PED-010, PED-011, D-082). `loadStudioContent` calls this loader with the
 *      loaded phases and references, so the pattern workstream (W2) fills in only this module and its own files.
 * Spec: PED-010, PED-011
 * Invariants:
 *   - Its part of the `npm run content:check` summary comes from `describePatternContent` here, so no workstream
 *     edits ./runContentCheck.ts for it; undefined leaves the part out.
 *   - For now it reads no file and returns no patterns, so the studio content loads before the patterns exist.
 *   - When filled in: `pattern.yaml` is read with `readYamlContentFile` and a strict schema; texts use
 *     `localisedContentText`; phases are `PHASE_KEYS`; cited keys are checked with `unresolvedCitationProblems`;
 *     every problem names the file and the line or key (`ContentProblem`).
 * Collaborators: ./loadStudioContent.ts (calls it), ./runContentCheck.ts (the summary), ./studioContentContext.ts,
 *   ./yamlContentFile.ts, ./contentText.ts, ./referencesContent.ts.
 * Tests: apps/server/test/learningDesign/content/loadStudioContent.test.ts
 */
import type { StudioContentContext } from './studioContentContext.js';
import type { ContentLoadResult } from './yamlContentFile.js';

/** The loaded patterns; empty until the pattern workstream defines their shape (PED-010). */
export type PatternContent = Readonly<Record<string, never>>;

const NO_PATTERNS: PatternContent = Object.freeze({});

/**
 * Loads and checks every pattern folder.
 * @param _context - The content folder and the loaded phases and references.
 * @returns The patterns, or every problem in their files.
 * @spec PED-011
 */
export function loadPatternContent(_context: StudioContentContext): ContentLoadResult<PatternContent> {
  return { ok: true, value: NO_PATTERNS };
}

/**
 * This section's part of the one-line `npm run content:check` summary.
 * @param _patterns - The loaded content of this section.
 * @returns A short phrase, e.g. `9 patterns`; undefined while the section has no files.
 * @spec PED-011
 */
export function describePatternContent(_patterns: PatternContent): string | undefined {
  return undefined;
}
