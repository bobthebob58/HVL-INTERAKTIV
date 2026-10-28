/**
 * ownFileCopies — copies into a saved duplicate the source files whose names Lumi would not copy, under safe
 * names, and points the duplicate's references at them.
 *
 * Why: Lumi's paste copy only takes names that fit `^[\w\-./_]+$`; a name with a space or æøå (from an imported
 *      package) would stay pointing into the source (D-092 amendment, probe P2). The duplicator copies such files
 *      itself, through the content manager (which checks View on the source and Edit on the copy), and fixes the
 *      paths, writing the parameters once more as Lumi itself does after its own copies.
 * Spec: PROD-007
 * Invariants:
 *   - Each listed name is copied once; every reference to it in the copy then names the new file.
 *   - A new name fits Lumi's pattern and the storage's rules (./safeCopyName.ts) and does not replace a file the copy
 *     already has.
 *   - Only `path` values change; the rest of the saved parameters and the h5p.json are written back unchanged.
 * Collaborators: ./ContentDuplicator.ts (the caller), ./safeCopyName.ts, Lumi's ContentManager and
 *   ContentFileScanner.
 * Tests: apps/server/test/learningDesign/collaboration/ContentDuplicator.int.test.ts
 */
import type { ContentFileScanner, H5PEditor, ILibraryName, IUser } from '@lumieducation/h5p-server';
import { copySuffix, safeCopyName } from './safeCopyName.js';

/** Lumi's content manager (not exported from the package index): every call checks our permission system. */
export type ContentManager = H5PEditor['contentManager'];

/** One duplicate whose remaining files are to be copied. */
export interface OwnCopyJob {
  readonly sourceId: string;
  readonly copyId: string;
  /** The copy's main library, for the scan. */
  readonly library: ILibraryName;
  /** Source file names Lumi did not copy (`CopyPlan.ownCopies`). */
  readonly names: readonly string[];
  /** The person duplicating, in the account view. */
  readonly user: IUser;
}

const ATTEMPTS = 5;

async function freeName(manager: ContentManager, copyId: string, name: string): Promise<string> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const candidate = safeCopyName(name, copySuffix());
    if (!(await manager.contentFileExists(copyId, candidate))) return candidate;
  }
  // WHY: five clashes of a random 8-character suffix means something is wrong; the duplicate fails and is removed.
  throw new Error('no free file name for an own copy');
}

/**
 * Copies the listed files from the source into the copy and fixes the copy's references to them.
 * @param tools - The editor's content manager and a scanner on its library manager.
 * @param job - The source, the saved copy, the names and the person.
 * @throws whatever the content manager throws (a refused permission, a storage failure); the caller removes the copy.
 * @spec PROD-007
 */
export async function copyOwnFiles(
  tools: { readonly manager: ContentManager; readonly scanner: ContentFileScanner },
  job: OwnCopyJob,
): Promise<void> {
  if (job.names.length === 0) return;
  const { manager, scanner } = tools;
  const renamed = new Map<string, string>();
  for (const name of job.names) {
    const target = await freeName(manager, job.copyId, name);
    const stream = await manager.getContentFileStream(job.sourceId, name, job.user);
    await manager.addContentFile(job.copyId, target, stream, job.user);
    renamed.set(name, target);
  }
  const params = await manager.getContentParameters(job.copyId, job.user);
  const metadata = await manager.getContentMetadata(job.copyId, job.user);
  for (const ref of await scanner.scanForFiles(params, job.library)) {
    const target = ref.temporary ? undefined : renamed.get(ref.filePath);
    if (target) (ref.context.params as { path: string }).path = target;
  }
  await manager.createOrUpdateContent(metadata, params, job.user, job.copyId);
}
