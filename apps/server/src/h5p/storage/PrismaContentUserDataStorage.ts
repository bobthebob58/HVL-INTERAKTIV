/**
 * PrismaContentUserDataStorage — H5P learner state (resume) in PostgreSQL, keyed by the learner pseudonym.
 *
 * Why: a learner who leaves an activity and comes back on any device or server node resumes where they
 *      left off (H5P-005, PROD-008), and state from one Canvas course never leaks into another. Lumi hands
 *      this store the state view of the actor (D-036), so every user ID it sees is already the learnerKey.
 * Spec: H5P-005, PROD-008, DATA-002, PROD-013
 * Invariants:
 *   - Key: (contentId, subContentId, dataType, learnerKey, contextId). `learnerKey` is exactly the ID Lumi
 *     passes; an ID that is not shaped like a pseudonym is refused on save and finds nothing (DATA-002).
 *   - Reads and deletes never run without a learnerKey or content ID, so they never match everyone's rows.
 *   - The state string is stored as a JSON string value; H5P's `data=0` deletes the row instead (D-038).
 *   - Lists for the player hold exactly one context and put the main state ('0') first (D-038).
 *   - Finished data is off: nothing is stored or returned (D-037, ./FinishedDataSwitchedOff.ts).
 *   - Content IDs that are not UUIDs are "not found" and never reach the database.
 *   - A write the state route runs inside `withStateWriteVersion` is made only while the activity has the version
 *     the learner's page was rendered with, checked in the write's own transaction (D-093, ./learnerStateWrites.ts).
 * Collaborators: ./learnerStateRows.ts, ./learnerStateWrites.ts, ./stateWriteVersion.ts,
 *   ./FinishedDataSwitchedOff.ts, ../../infra/prismaClient.ts, ../h5pStorage.ts, Lumi's ContentUserDataManager
 *   (calls it after the permission check), ../HvlH5pUser.ts (the state view).
 * Tests: apps/server/test/h5p/PrismaContentUserDataStorage.int.test.ts,
 *   apps/server/test/h5p/PrismaContentUserDataStorage.cleanup.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/staleStateWrites.int.test.ts
 */
import type { ContentId, IContentUserData, IContentUserDataStorage, IUser } from '@lumieducation/h5p-server';
import type { Database } from '../../infra/prismaClient.js';
import { FinishedDataSwitchedOff } from './FinishedDataSwitchedOff.js';
import {
  NO_CONTEXT,
  isContentUuid,
  isLearnerKey,
  mainStateFirst,
  stateKey,
  stateKeyOf,
  toUserData,
} from './learnerStateRows.js';
import { stateWrite, writeIfVersion } from './learnerStateWrites.js';
import { stateWriteExpectation } from './stateWriteVersion.js';

// UPSTREAM: a miss is null, as in https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/implementation/fs/FileContentUserDataStorage.ts
// The interface types a value, but Lumi's ContentUserDataManager passes null on to its caller unchanged.
// Remove the cast when Lumi's interface types the miss as null.
const NOT_FOUND = null as unknown as IContentUserData;

/** `IContentUserDataStorage` on PostgreSQL (Prisma); finished data is switched off (D-037). */
export class PrismaContentUserDataStorage extends FinishedDataSwitchedOff implements IContentUserDataStorage {
  /**
   * @param db - Database client.
   */
  constructor(private readonly db: Database) {
    super();
  }

  /**
   * Saves one state, or deletes it when h5p.js posts `data=0`; inside `withStateWriteVersion` only while the
   * activity still has the version the learner's page was rendered with (D-093).
   * @param userData - The state; `userId` is the learnerKey (state view, D-036).
   * @returns Nothing; a content ID that is not a UUID is ignored, and a stale write is dropped and marked stale.
   * @throws TypeError when `contentId` is missing, `userId` is not a learnerKey or the state is not a string.
   */
  async createOrUpdateContentUserData(userData: IContentUserData): Promise<void> {
    if (!userData.contentId) throw new TypeError('content user data needs a contentId');
    const key = stateKeyOf(userData, userData.contentId);
    if (!isContentUuid(key.contentId)) return;
    const write = stateWrite(key, userData);
    const expectation = stateWriteExpectation();
    await (expectation ? writeIfVersion(this.db, key.contentId, expectation, write) : write(this.db));
  }

  /**
   * Loads one state.
   * @param contentId - The activity.
   * @param dataType - H5P's data type, usually "state".
   * @param subContentId - Sub-content ID, or "0" for the activity itself.
   * @param userId - The learnerKey.
   * @param contextId - LMS context; undefined outside Canvas.
   * @returns The state, or null when nothing is stored.
   */
  async getContentUserData(
    contentId: ContentId,
    dataType: string,
    subContentId: string,
    userId: string,
    contextId?: string,
  ): Promise<IContentUserData> {
    if (!isContentUuid(contentId) || !isLearnerKey(userId)) return NOT_FOUND;
    const key = stateKey(contentId, dataType, subContentId, userId, contextId);
    const row = await this.db.h5PUserData.findUnique({
      where: { contentId_subContentId_dataType_learnerKey_contextId: key },
    });
    return row ? toUserData(row) : NOT_FOUND;
  }

  /**
   * Lists one learner's states for an activity in exactly one context (the player's preload).
   * @param contentId - The activity.
   * @param userId - The learnerKey.
   * @param contextId - LMS context; undefined means "no context", not "any context".
   * @returns The states, main state first, then by sub-content and data type.
   */
  async getContentUserDataByContentIdAndUser(
    contentId: ContentId,
    userId: string,
    contextId?: string,
  ): Promise<IContentUserData[]> {
    if (!isContentUuid(contentId) || !isLearnerKey(userId)) return [];
    const rows = await this.db.h5PUserData.findMany({
      where: { contentId, learnerKey: userId, contextId: contextId ?? NO_CONTEXT },
    });
    return rows.sort(mainStateFirst).map(toUserData);
  }

  /**
   * Lists every state of one learner (data-subject requests).
   * @param user - The state view; `id` is the learnerKey.
   * @returns The states, ordered by activity, context, sub-content and data type.
   */
  async getContentUserDataByUser(user: IUser): Promise<IContentUserData[]> {
    // SECURITY: Prisma drops an undefined filter, so a missing ID would otherwise list every learner's state.
    if (!isLearnerKey(user?.id)) return [];
    const rows = await this.db.h5PUserData.findMany({
      where: { learnerKey: user.id },
      orderBy: [{ contentId: 'asc' }, { contextId: 'asc' }, { subContentId: 'asc' }, { dataType: 'asc' }],
    });
    return rows.map(toUserData);
  }

  /**
   * Deletes every state of one learner (data-subject requests).
   * @param user - The state view; `id` is the learnerKey.
   * @returns Nothing; an ID that is not a learnerKey has no state to delete.
   */
  async deleteAllContentUserDataByUser(user: IUser): Promise<void> {
    // SECURITY: Prisma drops an undefined filter, so a missing ID would otherwise delete every learner's state.
    if (!isLearnerKey(user?.id)) return;
    await this.db.h5PUserData.deleteMany({ where: { learnerKey: user.id } });
  }

  /**
   * Deletes every state of an activity (the activity is being deleted).
   * @param contentId - The activity.
   * @returns Nothing.
   */
  async deleteAllContentUserDataByContentId(contentId: ContentId): Promise<void> {
    if (!isContentUuid(contentId)) return;
    await this.db.h5PUserData.deleteMany({ where: { contentId } });
  }

  /**
   * Deletes the states that asked to be invalidated when the activity changes (H5P semantics, D-038).
   * @param contentId - The activity whose content changed.
   * @returns Nothing; states without `invalidate` stay.
   */
  async deleteInvalidatedContentUserData(contentId: ContentId): Promise<void> {
    if (!isContentUuid(contentId)) return;
    await this.db.h5PUserData.deleteMany({ where: { contentId, invalidate: true } });
  }
}
