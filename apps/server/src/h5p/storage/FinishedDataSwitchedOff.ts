/**
 * FinishedDataSwitchedOff — the "finished data" half of Lumi's user-data storage, switched off (D-037).
 *
 * Why: Lumi can keep a separate record per learner (score, start and end time) when an activity is
 *      finished. Spec 05 has no such entity and scores reach the LMS through xAPI and AGS (S6), so storing
 *      it would only add learner data. One class holds the decision, so the state store stays about state.
 * Spec: H5P-005, DATA-002
 * Invariants:
 *   - Saving stores nothing, listing returns [], deleting does nothing; no method ever fails.
 *   - No method reads its arguments, so a finished record never reaches the database or a log.
 * Collaborators: ./PrismaContentUserDataStorage.ts (extends it), ../H5pConfigFactory.ts
 *   (`setFinishedEnabled = false`, so h5p.js never posts finished data).
 * Tests: apps/server/test/h5p/PrismaContentUserDataStorage.cleanup.int.test.ts
 */
import type { ContentId, IContentUserDataStorage, IFinishedUserData, IUser } from '@lumieducation/h5p-server';

/** The finished-data part of Lumi's `IContentUserDataStorage`. */
export type FinishedDataMethods = Pick<
  IContentUserDataStorage,
  | 'createOrUpdateFinishedData'
  | 'getFinishedDataByContentId'
  | 'getFinishedDataByUser'
  | 'deleteFinishedDataByContentId'
  | 'deleteFinishedDataByUser'
>;

/** The finished-data methods of `IContentUserDataStorage` as no-ops (D-037); storages extend it. */
export class FinishedDataSwitchedOff implements FinishedDataMethods {
  /**
   * Stores nothing.
   * @param _finishedData - Ignored.
   * @returns A resolved promise.
   */
  createOrUpdateFinishedData(_finishedData: IFinishedUserData): Promise<void> {
    // PRIVACY: data minimisation (D-037, DATA-012); the score reaches the LMS through xAPI, never through this record.
    return Promise.resolve();
  }

  /**
   * Lists nothing.
   * @param _contentId - Ignored.
   * @returns An empty list.
   */
  getFinishedDataByContentId(_contentId: ContentId): Promise<IFinishedUserData[]> {
    return Promise.resolve([]);
  }

  /**
   * Lists nothing.
   * @param _user - Ignored.
   * @returns An empty list.
   */
  getFinishedDataByUser(_user: IUser): Promise<IFinishedUserData[]> {
    return Promise.resolve([]);
  }

  /**
   * There is nothing to delete.
   * @param _contentId - Ignored.
   * @returns A resolved promise.
   */
  deleteFinishedDataByContentId(_contentId: ContentId): Promise<void> {
    return Promise.resolve();
  }

  /**
   * There is nothing to delete.
   * @param _user - Ignored.
   * @returns A resolved promise.
   */
  deleteFinishedDataByUser(_user: IUser): Promise<void> {
    return Promise.resolve();
  }
}
