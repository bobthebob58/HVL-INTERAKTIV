/**
 * runContentCheck — what `npm run content:check` does: loads the studio content as the server would at start-up and
 * prints either a one-line summary or every problem, returning the exit code.
 *
 * Why: ALU and developers must learn that a content file is broken before the server refuses to start (D-082). CI
 *      runs this check, and lint-staged runs it when a file under `content/` is committed.
 * Spec: PED-001
 * Invariants:
 *   - Exit code 0 only when `loadStudioContent` succeeds; 1 for any problem, unknown argument or unexpected error.
 *   - Prints paths relative to the repository root, line numbers, keys and descriptions; never a stack trace for a
 *     content problem, and never anything but content (DATA-009: content files hold no personal data).
 *   - The only argument is `--root=<content folder>`, resolved from the folder the command was started in.
 * Collaborators: ./contentCheckCli.ts (the command), ./loadStudioContent.ts, ./StudioContentError.ts,
 *   ./contentProblem.ts; the summary parts of ./guideContent.ts, ./patternContent.ts and ./mappeContent.ts.
 * Tests: apps/server/test/learningDesign/content/runContentCheck.test.ts
 */
import { resolve } from 'node:path';
import { contentDisplayPath, formatContentProblem } from './contentProblem.js';
import { describeGuideContent } from './guideContent.js';
import { loadStudioContent, STUDIO_CONTENT_ROOT, type StudioContent } from './loadStudioContent.js';
import { describeMappeContent } from './mappeContent.js';
import { describePatternContent } from './patternContent.js';
import type { StudioContentInputs } from './studioContentContext.js';
import { StudioContentError } from './StudioContentError.js';

/** Where the check writes: `console` in the command, a recorder in tests. */
export interface ContentCheckOutput {
  /** Writes a line of the success summary (stdout in the CLI). */
  readonly log: (line: string) => void;
  /** Writes a line of the problem list (stderr in the CLI). */
  readonly error: (line: string) => void;
}

/** How the check runs; every field has a default. */
export interface ContentCheckOptions {
  /** Defaults to `console`. */
  readonly output?: ContentCheckOutput;
  /** The folder a relative `--root` is resolved from; defaults to the current folder. */
  readonly baseDirectory?: string;
  /** Further inputs for the section loaders, which the command passes and the server's start-up does not. */
  readonly inputs?: StudioContentInputs;
  /** The loader; defaults to `loadStudioContent`. */
  readonly load?: (root: string, inputs: StudioContentInputs) => StudioContent;
}

const USAGE = 'Usage: npm run content:check [-- --root=<content folder>]';

const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const rootOf = (args: readonly string[], baseDirectory: string): string | Error => {
  let root = STUDIO_CONTENT_ROOT;
  for (const arg of args) {
    if (!arg.startsWith('--root=') || arg === '--root=') return new Error(`unknown argument "${arg}"`);
    root = resolve(baseDirectory, arg.slice('--root='.length));
  }
  return root;
};

/**
 * The one-line summary of loaded content. The guide, pattern and mappe sections write their own parts
 * (`describeGuideContent` and the others, in their modules), so this function stays as it is.
 * @param content - The loaded content.
 * @returns e.g. `3 phases (Forarbeid, Mellomarbeid, Etterarbeid; status proposed), 16 references (16 to verify)`.
 */
export function describeStudioContent(content: StudioContent): string {
  const { phases, references } = content;
  const labels = phases.phases.map((phase) => phase.label.nn).join(', ');
  const toVerify = references.references.filter((reference) => reference.verify).length;
  return [
    `${phases.phases.length} phases (${labels}; status ${phases.status})`,
    `${counted(references.references.length, 'reference')} (${toVerify} to verify)`,
    describeGuideContent(content.guide),
    describePatternContent(content.patterns),
    describeMappeContent(content.mappe),
  ]
    .filter((part) => part !== undefined)
    .join(', ');
}

/**
 * Runs the check.
 * @param args - The command-line arguments after the script name.
 * @param options - Output, base folder and loader; defaults suit the command.
 * @returns The exit code: 0 when the content loads, 1 otherwise.
 * @spec PED-001
 */
export function runContentCheck(args: readonly string[], options: ContentCheckOptions = {}): number {
  const { output = console, baseDirectory = process.cwd(), inputs = {}, load = loadStudioContent } = options;
  const root = rootOf(args, baseDirectory);
  if (root instanceof Error) {
    output.error(`✗ content:check: ${root.message}. ${USAGE}`);
    return 1;
  }
  const shown = `${contentDisplayPath(root)}/`;
  try {
    output.log(`✓ content:check: ${shown} loads: ${describeStudioContent(load(root, inputs))}`);
    return 0;
  } catch (error) {
    if (!(error instanceof StudioContentError)) {
      output.error(`✗ content:check: ${shown} could not be checked: ${(error as Error).message}`);
      return 1;
    }
    const count = counted(error.problems.length, 'problem');
    output.error(`✗ content:check: ${shown} has ${count}; the server will not start until it is fixed:`);
    for (const problem of error.problems) output.error(`  ✗ ${formatContentProblem(problem)}`);
    output.error('See content/README.md for how to edit these files.');
    return 1;
  }
}
