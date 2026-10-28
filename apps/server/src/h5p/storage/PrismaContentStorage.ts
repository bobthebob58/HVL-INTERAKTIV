/**
 * PrismaContentStorage — H5P's content store: activity metadata and parameters in PostgreSQL, files in S3.
 *
 * Why: activities must be queryable (ownership, visibility, insight joins) and shared by every node, so
 *      they live in PostgreSQL; their media files go to S3 through S3ContentFileStore (H5P-004, D-025).
 * Spec: H5P-004
 * Invariants:
 *   - Only the user's ID is stored as owner; H5P's user object (name, e-mail) is never persisted.
 *   - The database row is the source of truth for which files exist; S3 holds only their bytes.
 *   - IDs that are not UUIDs are treated as "not found" instead of reaching the database.
 *   - Every row `addContent` creates is reported to ./contentCreations.ts, so a failed duplicate can remove it.
 * Collaborators: ./S3ContentFileStore.ts, ./contentUsage.ts, ./contentCreations.ts, ../../infra/prismaClient.ts,
 *   H5PEditor (S2).
 * Tests: apps/server/test/h5p/contentStorage.int.test.ts
 */
import type { Readable } from 'node:stream';
import {
  H5pError,
  type ContentId,
  type IContentMetadata,
  type IContentStorage,
  type IFileStats,
  type ILibraryName,
  type IUser,
} from '@lumieducation/h5p-server';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Database } from '../../infra/prismaClient.js';
import { noteContentCreated } from './contentCreations.js';
import { countLibraryUsage } from './contentUsage.js';
import type { S3ContentFileStore } from './S3ContentFileStore.js';
import { assertStorableText } from './storableText.js';
import { isContentUuid } from '../contentIds.js';

const json = (value: unknown) => value as Prisma.InputJsonValue;

/** `IContentStorage` on PostgreSQL (Prisma) and S3. */
export class PrismaContentStorage implements IContentStorage {
  /**
   * @param db - Database client.
   * @param files - S3 store for content files.
   */
  constructor(
    private readonly db: Database,
    private readonly files: S3ContentFileStore,
  ) {}

  /** Creates an activity, or replaces metadata and parameters of an existing one. */
  async addContent(
    metadata: IContentMetadata,
    content: unknown,
    user: IUser,
    contentId?: ContentId,
  ): Promise<ContentId> {
    assertStorableText(content, metadata);
    const data = {
      mainLibrary: metadata.mainLibrary,
      title: metadata.title,
      params: json(content),
      metadata: json(metadata),
    };
    if (contentId === undefined) {
      const created = await this.db.h5PContent.create({
        data: { ...data, ownerUserId: user.id },
        select: { id: true },
      });
      noteContentCreated(created.id);
      return created.id;
    }
    if (!isContentUuid(contentId))
      throw new H5pError('storage-file-implementations:content-not-found', { contentId }, 404);
    await this.db.h5PContent.upsert({
      where: { id: contentId },
      update: data,
      create: { id: contentId, ...data, ownerUserId: user.id },
    });
    return contentId;
  }

  /** Stores a file of an activity (replacing a file with the same name). */
  async addFile(contentId: ContentId, filename: string, readStream: Readable, _user?: IUser): Promise<void> {
    await this.requireContent(contentId);
    const { key, size, sha256 } = await this.files.put(contentId, filename, readStream);
    await this.db.h5PContentFile.upsert({
      where: { contentId_filename: { contentId, filename } },
      update: { s3Key: key, size, sha256 },
      create: { contentId, filename, s3Key: key, size, sha256 },
    });
  }

  /** True when the activity exists. */
  async contentExists(contentId: ContentId): Promise<boolean> {
    return isContentUuid(contentId) && (await this.db.h5PContent.count({ where: { id: contentId } })) > 0;
  }

  /** Deletes an activity, its files and (by cascade) its learner state and statements. */
  async deleteContent(contentId: ContentId, _user?: IUser): Promise<void> {
    await this.requireContent(contentId);
    await this.files.deleteAll(contentId);
    await this.db.h5PContent.delete({ where: { id: contentId } });
  }

  /** Deletes one file of an activity. */
  async deleteFile(contentId: ContentId, filename: string, _user?: IUser): Promise<void> {
    const row = await this.requireFile(contentId, filename);
    await this.files.delete(row.s3Key);
    await this.db.h5PContentFile.delete({ where: { id: row.id } });
  }

  /** True when the activity has a file with this name. */
  async fileExists(contentId: ContentId, filename: string): Promise<boolean> {
    if (!isContentUuid(contentId)) return false;
    return (await this.db.h5PContentFile.count({ where: { contentId, filename } })) > 0;
  }

  /** Size and creation time of a file. */
  async getFileStats(contentId: ContentId, file: string, _user?: IUser): Promise<IFileStats> {
    const row = await this.requireFile(contentId, file);
    return { size: row.size, birthtime: row.createdAt };
  }

  /** Streams a file, or an inclusive byte range of it. */
  async getFileStream(
    contentId: ContentId,
    file: string,
    _user: IUser,
    rangeStart?: number,
    rangeEnd?: number,
  ): Promise<Readable> {
    const row = await this.requireFile(contentId, file);
    return this.files.get(row.s3Key, rangeStart, rangeEnd);
  }

  /** H5P metadata (h5p.json) of an activity. */
  async getMetadata(contentId: ContentId, _user?: IUser): Promise<IContentMetadata> {
    return (await this.requireContent(contentId)).metadata as unknown as IContentMetadata;
  }

  /** H5P parameters (content.json) of an activity. */
  async getParameters(contentId: ContentId, _user?: IUser): Promise<unknown> {
    return (await this.requireContent(contentId)).params;
  }

  /** How many activities use a library. */
  async getUsage(library: ILibraryName): Promise<{ asDependency: number; asMainLibrary: number }> {
    return countLibraryUsage(this.db, library);
  }

  /** IDs of all activities, or of the activities a user owns. */
  async listContent(user?: IUser): Promise<ContentId[]> {
    const rows = await this.db.h5PContent.findMany({
      where: user ? { ownerUserId: user.id } : {},
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => r.id);
  }

  /** Names of an activity's files. */
  async listFiles(contentId: ContentId, _user?: IUser): Promise<string[]> {
    if (!isContentUuid(contentId)) return [];
    const rows = await this.db.h5PContentFile.findMany({
      where: { contentId },
      select: { filename: true },
      orderBy: { filename: 'asc' },
    });
    return rows.map((r) => r.filename);
  }

  private async requireContent(contentId: ContentId) {
    const row = isContentUuid(contentId)
      ? await this.db.h5PContent.findUnique({ where: { id: contentId } })
      : null;
    if (!row) throw new H5pError('storage-file-implementations:content-not-found', { contentId }, 404);
    return row;
  }

  private async requireFile(contentId: ContentId, filename: string) {
    const row = isContentUuid(contentId)
      ? await this.db.h5PContentFile.findUnique({ where: { contentId_filename: { contentId, filename } } })
      : null;
    if (!row) throw new H5pError('content-file-missing', { file: filename, contentId }, 404);
    return row;
  }
}
