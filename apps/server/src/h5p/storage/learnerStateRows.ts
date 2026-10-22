/**
 * learnerStateRows — translates between H5P's user-data objects and `H5PUserData` rows.
 *
 * Why: the storage adapter should only talk to the database; how H5P's fields map onto our unique key,
 *      which IDs may form a key, how a delete is signalled and in which order the player needs the states
 *      are rules of their own (H5P-005, D-036, D-038) and are unit-tested without a database.
 * Spec: H5P-005, PROD-008, DATA-002
 * Invariants:
 *   - An empty or missing `subContentId` is the main state '0'; a missing `contextId` is stored as ''.
 *   - `learnerKey` is the `userId` exactly as given, and only an ID shaped like a pseudonym is accepted.
 *   - Only canonical UUIDs are content IDs; anything else is "not found" before it reaches the database.
 *   - The main state sorts first, then by sub-content and data type, by plain code-unit order.
 * Collaborators: ./PrismaContentUserDataStorage.ts, ../../generated/prisma (H5PUserData),
 *   ../../privacy/deriveLearnerKey.ts (the pseudonym's shape).
 * Tests: apps/server/test/h5p/learnerStateRows.test.ts,
 *   apps/server/test/h5p/PrismaContentUserDataStorage.int.test.ts
 */
import type { IContentUserData } from '@lumieducation/h5p-server';
import type { H5PUserData } from '../../generated/prisma/client.js';

/** `subContentId` of the activity's own state; h5p.js sends 0 when there is no sub-content. */
export const MAIN_STATE = '0';

/** Stored `contextId` when a launch has no LMS context (the column is part of the unique key). */
export const NO_CONTEXT = '';

/** What h5p.js posts as `data` to delete a state (`H5P.deleteUserData` sends `data: 0`). */
const DELETE_SIGNAL = '0';

/** HMAC-SHA256 in base64url without padding, as `deriveLearnerKey` produces it (DATA-002). */
const LEARNER_KEY = /^[A-Za-z0-9_-]{43}$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The unique key of one stored state (the `@@unique` of `H5PUserData`). */
export interface StateKey {
  contentId: string;
  subContentId: string;
  dataType: string;
  learnerKey: string;
  contextId: string;
}

/**
 * Tells whether an ID has the shape of a learner pseudonym.
 * @param value - The ID Lumi passed (`userId` or `user.id`); may be anything.
 * @returns True only for a 43-character base64url string.
 */
export const isLearnerKey = (value: unknown): value is string =>
  // PRIVACY: an account UUID, e-mail, Feide ID, national ID number or LTI `sub` never has this shape (D-036).
  typeof value === 'string' && LEARNER_KEY.test(value);

/**
 * Tells whether an ID can name a stored activity.
 * @param value - A content ID from Lumi or a request; may be anything.
 * @returns True only for a canonical UUID (the `H5PContent.id` column type).
 */
export const isContentUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);

/**
 * Builds the unique key of a state, in the argument order of Lumi's `getContentUserData`.
 * @param contentId - The activity.
 * @param dataType - H5P's data type, usually "state".
 * @param subContentId - Sub-content ID; missing or empty means the main state '0'.
 * @param learnerKey - The pseudonym, used unchanged.
 * @param contextId - LMS context; missing means no context ('').
 * @returns The key.
 */
export function stateKey(
  contentId: string,
  dataType: string,
  subContentId: string | undefined,
  learnerKey: string,
  contextId: string | undefined,
): StateKey {
  const subContent = subContentId === undefined || subContentId === '' ? MAIN_STATE : subContentId;
  return { contentId, subContentId: subContent, dataType, learnerKey, contextId: contextId ?? NO_CONTEXT };
}

/**
 * Builds the unique key of a state that is about to be saved or deleted.
 * @param userData - The state from Lumi; `userId` is the learnerKey.
 * @param contentId - The activity.
 * @returns The key; the learnerKey is the given `userId`, unchanged.
 * @throws TypeError when `userId` is not shaped like a learnerKey (missing, empty or a raw ID), or when
 *   `dataType` is missing (a delete without it would match every data type).
 */
export function stateKeyOf(userData: IContentUserData, contentId: string): StateKey {
  // PRIVACY: the state view's ID is the pseudonym (D-036); it is stored as given and nothing else is.
  if (!isLearnerKey(userData.userId)) throw new TypeError('content user data needs a learnerKey');
  if (!userData.dataType) throw new TypeError('content user data needs a dataType');
  return stateKey(contentId, userData.dataType, userData.subContentId, userData.userId, userData.contextId);
}

/**
 * Tells whether h5p.js asked to delete the state instead of saving it.
 * @param userState - The posted `data` value.
 * @returns True for "0" (a form body) or 0 (a JSON body).
 */
export const isDeleteSignal = (userState: unknown): boolean =>
  (typeof userState === 'string' || typeof userState === 'number') && String(userState) === DELETE_SIGNAL;

const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Sort comparator: main state first, then by sub-content and data type.
 * @param a - A row.
 * @param b - Another row.
 * @returns Negative when `a` comes first.
 */
export const mainStateFirst = (
  a: Pick<H5PUserData, 'subContentId' | 'dataType'>,
  b: Pick<H5PUserData, 'subContentId' | 'dataType'>,
): number =>
  // WHY: Lumi sorts by Number(subContentId), which is NaN (= "equal") for UUIDs, and the player reads
  // the main state at index 0, so this order must already be right when the rows leave storage (D-038).
  Number(b.subContentId === MAIN_STATE) - Number(a.subContentId === MAIN_STATE) ||
  byCodeUnits(a.subContentId, b.subContentId) ||
  byCodeUnits(a.dataType, b.dataType);

/**
 * Maps a stored row back to H5P's shape.
 * @param row - A row of `H5PUserData`.
 * @returns The state; an empty context becomes an absent `contextId`.
 */
export const toUserData = (row: H5PUserData): IContentUserData => ({
  contentId: row.contentId,
  subContentId: row.subContentId,
  dataType: row.dataType,
  userId: row.learnerKey,
  ...(row.contextId === NO_CONTEXT ? {} : { contextId: row.contextId }),
  // WHY: rows are written as a JSON string value (D-038); anything else is re-serialised, not dropped.
  userState: typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
  preload: row.preload,
  invalidate: row.invalidate,
});
