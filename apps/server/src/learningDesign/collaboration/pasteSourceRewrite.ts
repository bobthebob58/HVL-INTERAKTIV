/**
 * pasteSourceRewrite — prepares a copy's parameters so that saving them makes Lumi copy the source's files.
 *
 * Why: Lumi 10.0.4 copies another activity's file into the activity being saved only when the file's path has the
 *      paste-source form `../<sourceId>/<file>` (D-092). The duplicator therefore rewrites the source's file
 *      references to that form before it saves the copy, finding them with Lumi's own ContentFileScanner so that it
 *      rewrites exactly the references Lumi will copy, nested sub-content included.
 * Spec: PROD-007
 * Invariants:
 *   - Works on a deep clone; the parameters passed in are never changed (Lumi's save mutates what it gets).
 *   - Only references to files the source stores are rewritten. URLs, protocol-less video links and names the
 *     source does not store keep their path (Lumi would empty or strand them), and a `#tmp` upload stays as it is,
 *     because «Lagre som ny versjon» saves new uploads with the copy (D-093).
 *   - A stored name outside Lumi's pattern is not rewritten but listed in `ownCopies`: the duplicator copies it
 *     itself after the save (./ownFileCopies.ts).
 *   - `references` and `mustLand` describe the clone, so the check after the save (./copyVerification.ts) can tell
 *     an emptied or stranded path from a complete copy.
 * Collaborators: ./ContentDuplicator.ts (the caller), ../../h5p/pasteSourcePaths.ts, Lumi's ContentFileScanner.
 * Tests: apps/server/test/learningDesign/collaboration/ContentDuplicator.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/ContentDuplicatorSaveAsCopy.int.test.ts
 */
import type { ContentFileScanner, ContentParameters, ILibraryName } from '@lumieducation/h5p-server';
import { fitsLumiFilePattern, pasteSourcePath } from '../../h5p/pasteSourcePaths.js';

/** The source a copy is planned from. */
export interface CopySource {
  /** The parameters to copy: the source's own, or the editor's edited ones for «Lagre som ny versjon». */
  readonly params: unknown;
  /** The main library the parameters belong to. */
  readonly library: ILibraryName;
  /** The source activity's ID. */
  readonly sourceId: string;
  /** The names of the files the source stores. */
  readonly sourceFiles: readonly string[];
}

/** The copy's parameters as they go to the editor, and what the save must achieve. */
export interface CopyPlan {
  /** A deep clone with every stored source file rewritten to `../<sourceId>/<file>` (unless listed below). */
  readonly params: ContentParameters;
  /** How many file references the clone holds, as Lumi's scanner counts them (empty paths are not references). */
  readonly references: number;
  /** How many of them must end up naming a file the copy stores: rewritten files, own copies and `#tmp` uploads. */
  readonly mustLand: number;
  /** Stored source files whose names Lumi would not copy; the duplicator copies them itself, once each. */
  readonly ownCopies: readonly string[];
}

/**
 * Plans the copy's parameters.
 * @param scanner - Lumi's ContentFileScanner on the editor's library manager.
 * @param source - The parameters to copy and the source they come from.
 * @returns The rewritten clone and the counts the save is checked against.
 * @spec PROD-007
 */
export async function planCopy(scanner: ContentFileScanner, source: CopySource): Promise<CopyPlan> {
  const params = structuredClone(source.params) as ContentParameters;
  const stored = new Set(source.sourceFiles);
  const ownCopies = new Set<string>();
  let mustLand = 0;
  const references = await scanner.scanForFiles(params, source.library);
  for (const ref of references) {
    if (ref.temporary) {
      mustLand += 1;
      continue;
    }
    if (!stored.has(ref.filePath)) continue;
    mustLand += 1;
    // WHY: Lumi leaves a paste path whose name is outside its pattern pointing into the source (probe P2).
    if (fitsLumiFilePattern(ref.filePath)) {
      (ref.context.params as { path: string }).path = pasteSourcePath(source.sourceId, ref.filePath);
    } else {
      ownCopies.add(ref.filePath);
    }
  }
  return { params, references: references.length, mustLand, ownCopies: [...ownCopies] };
}
