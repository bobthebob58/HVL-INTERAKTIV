/**
 * studioContentContext — what `loadStudioContent` hands each content section's loader (guide, patterns, mappe): the
 * content folder and the phases and references already loaded, for cross-checks.
 *
 * Why: the guide and the patterns cite references, and patterns name phases (D-082); their loaders check those
 *      against the loaded files instead of reading them again. One context type lets each workstream fill in its own
 *      loader without changing the entry point's signature.
 * Spec: PED-001
 * Invariants:
 *   - `root` is an absolute path; section loaders read only files under it, plus what an input names.
 *   - `phases` or `references` is undefined when that file failed to load; its problems are already reported, so a
 *     section loader then skips the cross-check instead of reporting a second, misleading problem.
 *   - Any further field is optional and comes from the caller (`StudioContentInputs`): `npm run content:check` may
 *     pass what the server's start-up does not have (the installed libraries' semantics, D-084 amendment).
 * Collaborators: ./loadStudioContent.ts (builds it), ./runContentCheck.ts and ./contentCheckCli.ts (pass the inputs),
 *   ./guideContent.ts, ./patternContent.ts, ./mappeContent.ts, ./installedLibraries.ts.
 * Tests: apps/server/test/learningDesign/content/loadStudioContent.test.ts
 */
import { join } from 'node:path';
import type { InstalledLibraries } from './installedLibraries.js';
import type { PhasesContent } from './phasesContent.js';
import type { ReferencesContent } from './referencesContent.js';

/** The inputs of a content section's loader. */
export interface StudioContentContext {
  /** The absolute content folder: the repository's `content/`, or a test fixture laid out the same way. */
  readonly root: string;
  /** The loaded phases.yaml, or undefined when it has problems. */
  readonly phases: PhasesContent | undefined;
  /** The loaded references.yaml, or undefined when it has problems. */
  readonly references: ReferencesContent | undefined;
  /**
   * The installed H5P libraries the pattern skeletons are checked against (D-084 amendment); `content:check`
   * passes them, the server's start-up does not (it then skips those checks).
   */
  readonly installedLibraries?: InstalledLibraries;
}

/**
 * What a caller hands the section loaders beyond the folder and the loaded files: every other field of
 * `StudioContentContext` (so far the pattern workstream's installed libraries, D-084 amendment). A workstream that
 * needs another adds it to `StudioContentContext` as an optional field, and it reaches the loaders through
 * `loadStudioContent(root, inputs)` without a change there.
 */
export type StudioContentInputs = Omit<StudioContentContext, 'root' | 'phases' | 'references'>;

/**
 * The absolute path of a file in the content folder.
 * @param context - The loader context.
 * @param relativeFile - The file relative to the content folder, with `/`, e.g. `laeringsdesign/guide.nn.md`.
 * @returns The path on disk.
 */
export function studioContentFile(context: StudioContentContext, relativeFile: string): string {
  return join(context.root, ...relativeFile.split('/'));
}
