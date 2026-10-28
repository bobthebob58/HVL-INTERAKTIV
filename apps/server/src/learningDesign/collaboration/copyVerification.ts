/**
 * copyVerification — checks a saved duplicate against its plan before the duplicate counts as made.
 *
 * Why: Lumi never reports a file it could not copy. It empties the path (or, for something that looks like a
 *      protocol-less URL, leaves the `../<id>/…` path in place) and saves the rest (D-092 amendment, probe P2). A
 *      copy with a silently missing image or video must not be handed to the person as complete, so the duplicator
 *      reads the stored copy back and compares it with what it submitted.
 * Spec: PROD-007
 * Invariants:
 *   - Reads what is stored, never the objects the save mutated: the parameters and file list come from the content
 *     manager after every write.
 *   - A defect is reported by kind only (no file names, which may hold personal names), for the error's cause.
 *   - `emptied`: fewer file references than submitted (Lumi drops a reference by emptying its path).
 *   - `paste-path-left`: a path with a `..` segment, or a `#tmp` marker, survived the save.
 *   - `file-missing`: fewer references name a stored file of the copy than the plan says must land.
 * Collaborators: ./ContentDuplicator.ts (the caller), ./pasteSourceRewrite.ts (the plan), ./ownFileCopies.ts.
 * Tests: apps/server/test/learningDesign/collaboration/ContentDuplicatorFailures.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/ContentDuplicator.int.test.ts
 */
import type { ContentFileScanner, ILibraryName, IUser } from '@lumieducation/h5p-server';
import type { ContentManager } from './ownFileCopies.js';
import type { CopyPlan } from './pasteSourceRewrite.js';

/** What is wrong with a saved copy. */
export type CopyDefect = 'emptied' | 'paste-path-left' | 'file-missing';

/** The saved copy to check. */
export interface SavedCopy {
  readonly copyId: string;
  readonly library: ILibraryName;
  /** The person duplicating, in the account view (the copy's owner). */
  readonly user: IUser;
}

/**
 * Compares a saved copy with its plan.
 * @param tools - The editor's content manager and a scanner on its library manager.
 * @param copy - The saved copy.
 * @param plan - What was submitted: the reference count and how many must name a stored file.
 * @returns The first defect found, or `undefined` when the copy is complete.
 * @spec PROD-007
 */
export async function findCopyDefect(
  tools: { readonly manager: ContentManager; readonly scanner: ContentFileScanner },
  copy: SavedCopy,
  plan: Pick<CopyPlan, 'references' | 'mustLand'>,
): Promise<CopyDefect | undefined> {
  const params = await tools.manager.getContentParameters(copy.copyId, copy.user);
  const references = await tools.scanner.scanForFiles(params, copy.library);
  if (references.length < plan.references) return 'emptied';
  if (references.some((ref) => ref.temporary || ref.filePath.split('/').includes('..'))) {
    return 'paste-path-left';
  }
  const stored = new Set(await tools.manager.listContentFiles(copy.copyId, copy.user));
  const landed = references.filter((ref) => stored.has(ref.filePath)).length;
  return landed < plan.mustLand ? 'file-missing' : undefined;
}
