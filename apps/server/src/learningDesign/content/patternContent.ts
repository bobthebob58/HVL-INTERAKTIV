/**
 * patternContent — the patterns' part of the studio content: loads every folder under
 * `content/laeringsdesign/patterns/<id>/` (`pattern.yaml` and its skeletons, D-084) and says what was checked.
 *
 * Why: a new pattern needs no code change (PED-010, PED-011, D-082). `loadStudioContent` calls this loader with the
 *      loaded phases and references; `npm run content:check` adds the installed libraries, so a skeleton that names
 *      a version the editor would refuse fails before it is merged.
 * Spec: PED-010, PED-011
 * Invariants:
 *   - No folder, or an empty one, is no patterns, not a problem. Entries whose names start with a dot and a
 *     `README.md` are not patterns; any other file directly under `patterns/` is a problem.
 *   - Patterns are returned sorted by ID, each fully checked (./patternFolder.ts); every problem names its file and
 *     its line or key (`ContentProblem`).
 *   - Missing installed libraries (`content:check` on a machine without `npm run h5p:fetch-libraries`) are reported
 *     once, as one problem only when the check must have them (CI) and there is a pattern to check; otherwise the
 *     summary says what was not checked.
 *   - Its part of the `npm run content:check` summary comes from `describePatternContent` here.
 * Collaborators: ./loadStudioContent.ts (calls it), ./runContentCheck.ts (the summary), ./patternFolder.ts,
 *   ./installedLibraries.ts, ./studioContentContext.ts, ./patternAccessors.ts.
 * Tests: apps/server/test/learningDesign/content/patternContent.test.ts,
 *   apps/server/test/learningDesign/content/patternLibraryChecks.test.ts
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { contentDisplayPath, type ContentProblem } from './contentProblem.js';
import { loadPatternFolder, PATTERNS_DIR, type StudioPattern } from './patternFolder.js';
import type { StudioContentContext } from './studioContentContext.js';
import { contentLoadFailed, type ContentLoadResult } from './yamlContentFile.js';

export type { StudioPattern, StudioPatternSkeleton } from './patternFolder.js';

/** Whether the skeletons were checked against the installed libraries. */
export type PatternLibraryCheck = 'checked' | 'libraries-missing' | 'not-requested';

/** The loaded patterns. */
export interface PatternContent {
  /** Every pattern, sorted by ID. */
  readonly patterns: readonly StudioPattern[];
  /** `checked` in `content:check` with the libraries installed; `not-requested` at the server's start-up. */
  readonly libraryCheck: PatternLibraryCheck;
}

const NOT_PATTERNS = new Set(['README.md']);

function patternFolders(root: string): { names: string[]; problems: ContentProblem[] } {
  const folder = join(root, ...PATTERNS_DIR.split('/'));
  if (!existsSync(folder)) return { names: [], problems: [] };
  const entries = readdirSync(folder, { withFileTypes: true }).filter(
    (entry) => !entry.name.startsWith('.') && !NOT_PATTERNS.has(entry.name),
  );
  const problems = entries
    .filter((entry) => !entry.isDirectory())
    .map((entry) => ({
      file: contentDisplayPath(join(folder, entry.name)),
      message: 'is not a pattern folder: each pattern is a folder named by its ID, with pattern.yaml inside',
    }));
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  return { names: names.sort(), problems };
}

/**
 * Loads and checks every pattern folder.
 * @param context - The content folder, the loaded phases and references, and (from `content:check`) the installed
 *   libraries.
 * @returns The patterns, or every problem in their files.
 * @spec PED-011
 */
export function loadPatternContent(context: StudioContentContext): ContentLoadResult<PatternContent> {
  const { names, problems } = patternFolders(context.root);
  const patterns: StudioPattern[] = [];
  for (const name of names) {
    const loaded = loadPatternFolder(context, name);
    if (loaded.ok) patterns.push(loaded.value);
    else problems.push(...loaded.problems);
  }
  const libraries = context.installedLibraries;
  if (libraries?.kind === 'missing' && libraries.required && names.length > 0)
    problems.push({
      file: contentDisplayPath(libraries.folder),
      message:
        'the installed H5P libraries are missing, so the skeletons cannot be checked against them; run ' +
        'npm run h5p:fetch-libraries first',
    });
  if (problems.length > 0) return contentLoadFailed(problems);
  const libraryCheck: PatternLibraryCheck =
    libraries === undefined
      ? 'not-requested'
      : libraries.kind === 'installed'
        ? 'checked'
        : 'libraries-missing';
  return { ok: true, value: { patterns, libraryCheck } };
}

/**
 * This section's part of the one-line `npm run content:check` summary.
 * @param content - The loaded patterns.
 * @returns e.g. `9 patterns`, with a note when the library versions, keys and field limits could not be checked.
 * @spec PED-011
 */
export function describePatternContent(content: PatternContent): string | undefined {
  const count = content.patterns.length;
  const counted = `${count} pattern${count === 1 ? '' : 's'}`;
  if (content.libraryCheck !== 'libraries-missing' || count === 0) return counted;
  return `${counted} (library versions, keys and field limits not checked: run npm run h5p:fetch-libraries)`;
}
