/**
 * duplicateFilesBench — the PROD-007 duplicate probe's server: the real content types on a testbed, a source owner
 * and a second author who copies, and the few actions the probe repeats.
 *
 * Why: every probe case imports a real example as the owner, rewrites it to Lumi's paste-source form and saves it as
 *      the copier through HvlH5PEditor, as the ContentDuplicator does (D-092). One bench keeps the cases short and
 *      makes them all use the same save path. The ContentDuplicator and paste-source guard tests reuse it.
 * Spec: PROD-007
 * Invariants:
 *   - Saves go through `HvlH5PEditor.saveOrUpdateContent`, with every HVL check, never through Lumi's storage.
 *   - The owner is findable staff (`coAuthorSearchableAt` now), so a published, listed source is in the bank.
 *   - Both authors are testbed actors, so `close()` removes every activity, file row and bucket they made.
 * Collaborators: ../../support/httpTestbed.ts, ../../support/realPackages.ts, ./duplicateFilesPasteSource.ts.
 * Tests: apps/server/test/learningDesign/collaboration/duplicateFiles.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/ContentDuplicator.int.test.ts,
 *   apps/server/test/h5p/pasteSourceGuard.int.test.ts
 */
import type { ReadStream } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { ContentFileScanner, ContentPermission } from '@lumieducation/h5p-server';
import { asAccountUser, type HvlH5pUser } from '../../../src/h5p/HvlH5pUser.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import {
  pasteSourceParams,
  referencedPaths,
  storedActivity,
  storedFiles,
  streamSha256,
  type PasteSourceResult,
  type StoredActivity,
  type StoredFile,
} from './duplicateFilesPasteSource.js';

/** A source read for duplication: the activity, its stored files and the paste-source clone. */
export interface PastedSource extends PasteSourceResult {
  readonly source: StoredActivity;
  readonly files: StoredFile[];
}

/** The running bench. */
export interface DuplicateBench {
  readonly tb: HttpTestbed;
  /** Lumi's scanner on the testbed's libraries. */
  readonly scanner: ContentFileScanner;
  /** Owns every source. */
  readonly owner: TestActor;
  /** Another HVL author who saves the copies. */
  readonly copier: TestActor;
  /** The copier as Lumi sees them. */
  readonly copierUser: HvlH5pUser;
  /**
   * Imports a real example (e.g. `H5P.ImageHotspots`) as the owner; `published` shares it with all of HVL and lists it
   * in the content bank, so the copier may duplicate it (D-092).
   */
  importExample(type: string, published: boolean): Promise<string>;
  /** Reads a source and rewrites its stored files to the paste-source form. */
  pasteFrom(sourceId: string): Promise<PastedSource>;
  /** Saves `params` as a new activity of the source's type and metadata, as the copier. */
  saveCopy(params: object, source: StoredActivity): Promise<string>;
  /** Stores the bytes of the source's file `from` again under `name`, as the owner. */
  storeAs(sourceId: string, from: string, name: string): Promise<void>;
  /** The SHA-256 of a stored file's bytes, read through Lumi as the copier. */
  readSha256(contentId: string, filename: string): Promise<string>;
  /** Deletes an activity and its files as the owner. */
  deleteAsOwner(contentId: string): Promise<void>;
  /** The IDs of the activities the copier owns, to find a row a failed save left behind. */
  copierActivityIds(): Promise<string[]>;
  /** Puts a small file into the copier's temporary storage, as an editor upload does; returns its unique name. */
  uploadTemporary(name: string): Promise<string>;
  /** Whether our permission system lets the copier View an activity. */
  copierMayView(contentId: string): Promise<boolean>;
  /** An activity's stored file rows, sorted by name (straight from the database). */
  filesOf(contentId: string): Promise<StoredFile[]>;
  /** The same, names only. */
  fileNames(contentId: string): Promise<string[]>;
  /** An activity's saved parameters (straight from the database). */
  paramsOf(contentId: string): Promise<Record<string, unknown>>;
  /** The local file paths Lumi's scanner finds in an activity's saved parameters, sorted. */
  referencedPathsOf(contentId: string): Promise<string[]>;
  close(): Promise<void>;
}

/**
 * Starts the bench: seeds the real packages and creates the two authors.
 * @returns The bench; call `close()` in `afterAll`.
 */
export async function openDuplicateBench(): Promise<DuplicateBench> {
  const tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
  const { contentManager, libraryManager } = tb.runtime.editor;
  const scanner = new ContentFileScanner(libraryManager);
  const owner = await tb.actor('author');
  // WHY: a bank listing counts only while its owner is findable staff, as after an eligible login (D-092 amendment).
  await tb.db.user.update({
    where: { id: owner.actor.accountId },
    data: { coAuthorSearchableAt: new Date() },
  });
  const copier = await tb.actor('author');
  const asOwner = asAccountUser(owner.actor);
  const asCopier = asAccountUser(copier.actor);
  return {
    tb,
    scanner,
    owner,
    copier,
    copierUser: asCopier,
    importExample: async (type, published) => {
      const id = await tb.importPackage(owner, join(REAL_PACKAGES_DIR, `${type}.h5p`), { published });
      // WHY: the editor's paste-source guard admits a colleague's files only from a bank-listed activity (D-092).
      if (published) await tb.db.h5PContent.update({ where: { id }, data: { bankListedAt: new Date() } });
      return id;
    },
    pasteFrom: async (sourceId) => {
      const source = await storedActivity(tb.db, sourceId);
      const files = await storedFiles(tb.db, sourceId);
      const names = files.map((f) => f.filename);
      return { source, files, ...(await pasteSourceParams(scanner, source, sourceId, names)) };
    },
    saveCopy: (params, source) =>
      tb.runtime.editor.saveOrUpdateContent(undefined, params, source.metadata, source.ubername, asCopier),
    storeAs: async (sourceId, from, name) => {
      const stream = await contentManager.getContentFileStream(sourceId, from, asOwner);
      await contentManager.addContentFile(sourceId, name, stream, asOwner);
    },
    readSha256: async (contentId, filename) =>
      streamSha256(await contentManager.getContentFileStream(contentId, filename, asCopier)),
    deleteAsOwner: (contentId) => contentManager.deleteContent(contentId, asOwner),
    copierActivityIds: async () => {
      const where = { ownerUserId: copier.actor.accountId };
      return (await tb.db.h5PContent.findMany({ where, select: { id: true } })).map((row) => row.id);
    },
    uploadTemporary: (name) =>
      // WHY: Lumi types the stream as fs.ReadStream but only reads it; the bytes do not matter here.
      tb.runtime.editor.temporaryFileManager.addFile(name, Readable.from([name]) as ReadStream, asCopier),
    copierMayView: (contentId) =>
      tb.runtime.permissions.checkForContent(asCopier, ContentPermission.View, contentId),
    filesOf: (contentId) => storedFiles(tb.db, contentId),
    fileNames: async (contentId) => (await storedFiles(tb.db, contentId)).map((f) => f.filename),
    paramsOf: async (contentId) => (await storedActivity(tb.db, contentId)).params,
    referencedPathsOf: async (contentId) => referencedPaths(scanner, await storedActivity(tb.db, contentId)),
    close: () => tb.close(),
  };
}

/** The part of ImageHotspots' parameters the probe changes. */
export interface ImageParams {
  image: { path: string };
}

/** The parts of InteractiveVideo's parameters the probe changes. */
export interface VideoParams {
  interactiveVideo: {
    video: { startScreenOptions: object; files: { path: string; mime: string }[] };
    assets: { interactions: object[] };
  };
}

/**
 * Adds a poster and an H5P.Image interaction that both reference one PNG at `path`, as an author pasting them would.
 * @param params - InteractiveVideo parameters; changed in place.
 * @param path - The path both get, e.g. a paste-source path or a temporary upload's `<name>#tmp`.
 */
export function addPosterAndImageInteraction(params: object, path: string): void {
  const file = { path, mime: 'image/png' };
  const { interactiveVideo } = params as VideoParams;
  const { video, assets } = interactiveVideo;
  video.startScreenOptions = { ...video.startScreenOptions, poster: { ...file } };
  assets.interactions.push({
    ...{ x: 1, y: 1, width: 10, height: 10, duration: { from: 1, to: 2 } },
    action: {
      library: 'H5P.Image 1.1',
      subContentId: '5f0c2a4e-7b1d-4c3a-9e2f-8a6b4d2c0e17',
      params: { file: { ...file }, alt: 'Diagram', decorative: false },
      metadata: { contentType: 'Image', license: 'U', title: 'Diagram' },
    },
  });
}
