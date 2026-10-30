/**
 * contentProblem — one mistake found in a file under `content/`, located by file, line and key path, and the two
 * ways it is written out: with the file (`content:check`, the studio's start-up error) and under a header that
 * already names the file (the validator's thresholds).
 *
 * Why: ALU edits the studio's texts and settings without code (PED-001, PED-020, D-073, D-082). A mistake must stop
 *      the start with a message an editor can act on: which file, which line and which key, in plain words.
 * Spec: PED-001, PED-020
 * Invariants:
 *   - `file` is relative to the repository root with `/` separators; a file outside the repository (a test's
 *     temporary file) keeps its absolute path.
 *   - `line` is 1-based; it is absent when the problem concerns the whole file or the file cannot be read.
 *   - `key` is a path such as `phases[underveis].label.nb` (see ./yamlKeyPaths.ts); absent for a whole-file problem.
 * Collaborators: ./yamlContentFile.ts (makes them), ./StudioContentError.ts, ./runContentCheck.ts,
 *   ../../config/validationContext.ts.
 * Tests: apps/server/test/learningDesign/content/yamlContentFile.test.ts
 */
import { isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository's root folder, from this file's place in `apps/server/src/learningDesign/content/`. */
export const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));

/** One problem in a content file. */
export interface ContentProblem {
  /** The file, relative to the repository root, e.g. `content/laeringsdesign/phases.yaml`. */
  readonly file: string;
  /** The 1-based line, when the problem has one. */
  readonly line?: number;
  /** The key path inside the file, e.g. `phases[underveis].label.nb`; absent for the whole file. */
  readonly key?: string;
  /** What is wrong, in plain English, e.g. `the nb text is missing (every text needs nn, nb and en)`. */
  readonly message: string;
}

/**
 * The path shown for a file in problems and summaries.
 * @param absolutePath - The file or folder on disk.
 * @returns The path relative to the repository root with `/` separators, or the absolute path when it lies outside.
 */
export function contentDisplayPath(absolutePath: string): string {
  const inRepository = relative(REPOSITORY_ROOT, absolutePath);
  if (inRepository === '' || inRepository.startsWith('..') || isAbsolute(inRepository)) return absolutePath;
  return inRepository.split(sep).join('/');
}

/**
 * Writes a problem on one line, starting with the file and line, as compilers do.
 * @param problem - The problem.
 * @returns e.g. `content/laeringsdesign/phases.yaml:41: phases[underveis].label.nb: the nb text is missing …`.
 */
export function formatContentProblem(problem: ContentProblem): string {
  const where = problem.line === undefined ? problem.file : `${problem.file}:${problem.line}`;
  return problem.key === undefined
    ? `${where}: ${problem.message}`
    : `${where}: ${problem.key}: ${problem.message}`;
}

/**
 * Writes a problem on one line without the file, for a message whose header already names it; the key comes first.
 * @param problem - The problem.
 * @returns e.g. `maxVideoMinutes: Too big: expected number to be <=180 (line 14)`.
 */
export function formatKeyedContentProblem(problem: ContentProblem): string {
  const text = problem.key === undefined ? problem.message : `${problem.key}: ${problem.message}`;
  return problem.line === undefined ? text : `${text} (line ${problem.line})`;
}

/**
 * Orders problems by file, then line, so a long list reads from the top of each file down.
 * @param problems - Problems in any order.
 * @returns A new array; problems without a line come first in their file.
 */
export function sortContentProblems(problems: readonly ContentProblem[]): ContentProblem[] {
  return [...problems].sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0));
}
