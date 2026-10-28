/**
 * duplicateFilesPasteSource — the paste-source rewrite a duplicate needs, and readers for what an activity and its
 * storage hold, for the PROD-007 duplicate probe.
 *
 * Why: Lumi 10.0.4 copies another activity's file into the activity being saved only when the file's `path` in the
 *      saved parameters has the form `../<sourceId>/<file>` (ContentStorer.copyFilesFromPasteSource). The probe
 *      rewrites a source's parameters to that form the way the future ContentDuplicator must (D-092): with Lumi's own
 *      ContentFileScanner, so it finds exactly the references Lumi copies, nested sub-content included.
 * Spec: PROD-007
 * Invariants:
 *   - The source parameters are never changed: the rewrite works on a deep clone (Lumi's save mutates its input).
 *   - Only references to files the source really stores are rewritten. Anything else (a web URL, a protocol-less
 *     video link, a dangling name) keeps its path, because Lumi would empty or strand it (see the probe test).
 * Collaborators: Lumi's ContentFileScanner and LibraryName; the probe's HttpTestbed database.
 * Tests: apps/server/test/learningDesign/collaboration/duplicateFiles.int.test.ts
 */
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  LibraryName,
  type ContentFileScanner,
  type IContentMetadata,
  type ILibraryName,
} from '@lumieducation/h5p-server';
import type { Database } from '../../../src/infra/prismaClient.js';

/** An activity as the database holds it, with its main library resolved from h5p.json. */
export interface StoredActivity {
  /** content.json. */
  readonly params: Record<string, unknown>;
  /** h5p.json as Lumi stored it. */
  readonly metadata: IContentMetadata;
  /** The main library with its version, e.g. H5P.CoursePresentation 1.28. */
  readonly library: ILibraryName;
  /** The same as `H5P.Name major.minor`, as `saveOrUpdateContent` takes it. */
  readonly ubername: string;
}

/** One stored file row of an activity. */
export interface StoredFile {
  readonly filename: string;
  readonly s3Key: string;
  readonly sha256: string;
}

/** The rewritten parameters and what the rewrite did. */
export interface PasteSourceResult {
  /** A deep clone of the source parameters with every stored file pointing at `../<sourceId>/<file>`. */
  readonly params: Record<string, unknown>;
  /** The source file names that were rewritten, in scan order (a file used twice appears twice). */
  readonly rewritten: string[];
}

/**
 * Reads an activity's parameters and h5p.json straight from the database (no permission check).
 * @param db - The test database.
 * @param contentId - The activity.
 * @returns The activity with its main library.
 */
export async function storedActivity(db: Database, contentId: string): Promise<StoredActivity> {
  const row = await db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
  const metadata = row.metadata as unknown as IContentMetadata;
  const main = metadata.preloadedDependencies.find((d) => d.machineName === metadata.mainLibrary);
  if (!main) throw new Error(`${contentId}: h5p.json does not list its main library`);
  const library = new LibraryName(main.machineName, main.majorVersion, main.minorVersion);
  return {
    params: row.params as Record<string, unknown>,
    metadata,
    library,
    ubername: `${main.machineName} ${String(main.majorVersion)}.${String(main.minorVersion)}`,
  };
}

/**
 * Lists an activity's stored file rows, sorted by file name.
 * @param db - The test database.
 * @param contentId - The activity.
 * @returns The rows.
 */
export const storedFiles = (db: Database, contentId: string): Promise<StoredFile[]> =>
  db.h5PContentFile.findMany({
    where: { contentId },
    select: { filename: true, s3Key: true, sha256: true },
    orderBy: { filename: 'asc' },
  });

/**
 * The local file paths an activity's parameters reference, as Lumi's scanner reports them, sorted.
 * @param scanner - Lumi's ContentFileScanner on the testbed's library manager.
 * @param activity - The activity.
 * @returns The paths without `#tmp`.
 */
export async function referencedPaths(
  scanner: ContentFileScanner,
  activity: StoredActivity,
): Promise<string[]> {
  const refs = await scanner.scanForFiles(activity.params, activity.library);
  return refs.map((ref) => ref.filePath).sort();
}

/**
 * Rewrites every reference to a file the source stores into Lumi's paste-source form `../<sourceId>/<file>`.
 * @param scanner - Lumi's ContentFileScanner on the testbed's library manager.
 * @param source - The source activity.
 * @param sourceId - Its ID.
 * @param sourceFiles - The file names the source stores.
 * @returns The rewritten clone and the rewritten names.
 */
export async function pasteSourceParams(
  scanner: ContentFileScanner,
  source: StoredActivity,
  sourceId: string,
  sourceFiles: readonly string[],
): Promise<PasteSourceResult> {
  const params = structuredClone(source.params);
  const stored = new Set(sourceFiles);
  const rewritten: string[] = [];
  for (const ref of await scanner.scanForFiles(params, source.library)) {
    // WHY: Lumi empties a paste reference it cannot copy, and strands a protocol-less video link it mistakes for a
    // URL (ContentStorer.copyFilesFromPasteSource and isUrl), so only real files of the source are rewritten.
    if (!stored.has(ref.filePath)) continue;
    (ref.context.params as { path: string }).path = `../${sourceId}/${ref.filePath}`;
    rewritten.push(ref.filePath);
  }
  return { params, rewritten };
}

/**
 * The SHA-256 of a stream's bytes, in hex, as the storage records it.
 * @param stream - A content file stream.
 * @returns The digest.
 */
export async function streamSha256(stream: Readable): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/**
 * A pattern for the name Lumi gives a pasted file whose base name has NO hyphen: the same folder and base name with
 * a fresh 8-character suffix (FilenameGenerator; an earlier suffix is replaced, not stacked). For hyphenated names
 * use {@link namePattern}: Lumi cuts the name at its first hyphen or stacks suffixes (see the probe test).
 * @param sourceName - The source's file name, e.g. `videos/clip.nn.vtt`.
 * @returns e.g. /^videos\/clip\.nn-[0-9A-Za-z]{8}\.vtt$/.
 */
export function pastedName(sourceName: string): RegExp {
  const dot = sourceName.lastIndexOf('.');
  const base = sourceName.slice(0, dot).replace(/-[0-9A-Za-z]{8}$/, '');
  return new RegExp(`^${escape(base)}-[0-9A-Za-z]{8}${escape(sourceName.slice(dot))}$`);
}

/**
 * A pattern for an exact file name in which each `ID` stands for one 8-character suffix of Lumi's.
 * @param template - e.g. `images/my-diagram-2-ID-ID.png`.
 * @returns e.g. /^images\/my-diagram-2-[0-9A-Za-z]{8}-[0-9A-Za-z]{8}\.png$/.
 */
export const namePattern = (template: string): RegExp =>
  new RegExp(`^${template.split('ID').map(escape).join('[0-9A-Za-z]{8}')}$`);
