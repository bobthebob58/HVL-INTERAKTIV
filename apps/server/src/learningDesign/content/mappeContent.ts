/**
 * mappeContent — the pedagogisk mappe's slot in the studio content: will load `content/mappe/template.{nn,nb,en}.md`
 * and `content/mappe/criteria.{nn,nb,en}.yaml` (D-094).
 *
 * Why: the portfolio's headings and criteria live in files ALU edits without code (MAPPE-002, D-082).
 *      `loadStudioContent` calls this loader, so the portfolio workstream (W6) fills in only this module and its own
 *      files.
 * Spec: MAPPE-002
 * Invariants:
 *   - Its part of the `npm run content:check` summary comes from `describeMappeContent` here, so no workstream
 *     edits ./runContentCheck.ts for it; undefined leaves the part out.
 *   - For now it reads no file and returns the empty portfolio content, so the studio content loads before the
 *     template and the criteria exist.
 *   - When filled in: the criteria files are read with `readYamlContentFile` and a strict schema; the three
 *     templates have the same variables and the three criteria files the same criteria IDs (D-082); every problem
 *     names the file and the line or key (`ContentProblem`).
 * Collaborators: ./loadStudioContent.ts (calls it), ./runContentCheck.ts (the summary), ./studioContentContext.ts,
 *   ./yamlContentFile.ts, ../mappe/markdownEscape.ts.
 * Tests: apps/server/test/learningDesign/content/loadStudioContent.test.ts
 */
import type { StudioContentContext } from './studioContentContext.js';
import type { ContentLoadResult } from './yamlContentFile.js';

/** The loaded portfolio template and criteria; empty until the portfolio workstream defines their shape (D-094). */
export type MappeContent = Readonly<Record<string, never>>;

const EMPTY_MAPPE: MappeContent = Object.freeze({});

/**
 * Loads and checks the portfolio template and criteria.
 * @param _context - The content folder and the loaded phases.
 * @returns The portfolio content, or every problem in its files.
 * @spec MAPPE-002
 */
export function loadMappeContent(_context: StudioContentContext): ContentLoadResult<MappeContent> {
  return { ok: true, value: EMPTY_MAPPE };
}

/**
 * This section's part of the one-line `npm run content:check` summary.
 * @param _mappe - The loaded content of this section.
 * @returns A short phrase, e.g. `mappe template and 1 criteria set in nn, nb and en`; undefined while the
 *   section has no files.
 * @spec MAPPE-002
 */
export function describeMappeContent(_mappe: MappeContent): string | undefined {
  return undefined;
}
