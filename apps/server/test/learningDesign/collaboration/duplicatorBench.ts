/**
 * duplicatorBench — the duplicate probe's bench with a ContentDuplicator on the same runtime, and readers that show
 * what a copy holds, for the PROD-007 duplicator tests.
 *
 * Why: the duplicator must be tested on the real content types and the real save path (D-092). The probe's bench
 *      already imports real examples as one author and copies as another; this adds the duplicator and the
 *      comparisons the tests repeat: parameters with every file reference replaced by the bytes it names, and the
 *      rows a copy left (or did not leave) behind.
 * Spec: PROD-007
 * Invariants: everything is owned by the bench's authors, so `close()` removes every row, file and audit event.
 * Collaborators: ./duplicateFilesBench.ts, ../../../src/learningDesign/collaboration/ContentDuplicator.ts.
 * Tests: apps/server/test/learningDesign/collaboration/ContentDuplicator*.int.test.ts
 */
import type { IContentMetadata } from '@lumieducation/h5p-server';
import type { Prisma } from '../../../src/generated/prisma/client.js';
import { asAccountUser } from '../../../src/h5p/HvlH5pUser.js';
import { PrismaContentAccessRepository } from '../../../src/h5p/permissions/ContentAccessRepository.js';
import { ContentDuplicator } from '../../../src/learningDesign/collaboration/ContentDuplicator.js';
import { DUPLICATED_ACTION } from '../../../src/learningDesign/collaboration/copyRecords.js';
import { openDuplicateBench, type DuplicateBench } from './duplicateFilesBench.js';
import { storedActivity } from './duplicateFilesPasteSource.js';

/** The bench with its duplicator and readers. */
export interface DuplicatorBench extends DuplicateBench {
  readonly duplicator: ContentDuplicator;
  /**
   * Imports a real example as {@link DuplicateBench.importExample} does, then saves it once as the owner through the
   * editor, so its parameters are what the editor stores (Lumi's import skips the editor's text normalising).
   */
  importSaved(type: string, published: boolean): Promise<string>;
  /** The parameters, with each `path` that names a stored file replaced by `sha256:<hash of its bytes>`. */
  hashedParams(contentId: string): Promise<unknown>;
  /** An activity's stored h5p.json (straight from the database). */
  metadataOf(contentId: string): Promise<IContentMetadata>;
  /** Changes fields of an activity's stored h5p.json (straight in the database); returns the new h5p.json. */
  changeMetadata(contentId: string, changes: Partial<IContentMetadata>): Promise<IContentMetadata>;
  /** The `content.duplicated` audit events of a copy. */
  duplicatedEvents(copyId: string): Promise<{ actorUserId: string | null; details: unknown }[]>;
  /** The copier's activities that are not in `before`. */
  newCopierRows(before: readonly string[]): Promise<string[]>;
}

function replacePaths(node: unknown, hashes: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(node)) return node.map((item) => replacePaths(item, hashes));
  if (typeof node !== 'object' || node === null) return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => {
      const hash = key === 'path' && typeof value === 'string' ? hashes.get(value) : undefined;
      return [key, hash ? `sha256:${hash}` : replacePaths(value, hashes)];
    }),
  );
}

/**
 * Starts the bench (real packages, two authors) and a duplicator on its runtime.
 * @returns The bench; call `close()` in `afterAll`.
 */
export async function openDuplicatorBench(): Promise<DuplicatorBench> {
  const bench = await openDuplicateBench();
  const { db, runtime } = bench.tb;
  const access = new PrismaContentAccessRepository(db);
  const duplicator = new ContentDuplicator({ db, editor: runtime.editor, access });
  return Object.assign(bench, {
    duplicator,
    importSaved: async (type: string, published: boolean) => {
      const id = await bench.importExample(type, published);
      const { params, metadata, ubername } = await storedActivity(db, id);
      await runtime.editor.saveOrUpdateContent(
        id,
        params,
        metadata,
        ubername,
        asAccountUser(bench.owner.actor),
      );
      return id;
    },
    hashedParams: async (contentId: string) => {
      const files = await bench.filesOf(contentId);
      return replacePaths(await bench.paramsOf(contentId), new Map(files.map((f) => [f.filename, f.sha256])));
    },
    metadataOf: async (contentId: string) => {
      const row = await db.h5PContent.findUniqueOrThrow({
        where: { id: contentId },
        select: { metadata: true },
      });
      return row.metadata as unknown as IContentMetadata;
    },
    changeMetadata: async (contentId: string, changes: Partial<IContentMetadata>) => {
      const row = await db.h5PContent.findUniqueOrThrow({
        where: { id: contentId },
        select: { metadata: true },
      });
      const metadata = { ...(row.metadata as object), ...changes };
      await db.h5PContent.update({
        where: { id: contentId },
        data: { metadata: metadata as unknown as Prisma.InputJsonValue },
      });
      return metadata as IContentMetadata;
    },
    duplicatedEvents: (copyId: string) =>
      db.auditEvent.findMany({
        where: { action: DUPLICATED_ACTION, targetId: copyId },
        select: { actorUserId: true, details: true },
      }),
    newCopierRows: async (before: readonly string[]) =>
      (await bench.copierActivityIds()).filter((id) => !before.includes(id)),
  });
}
