/**
 * learnerStateLimits — the names a learner's saved state may have, and how much of it one learner may keep for
 * one activity in one course.
 *
 * Why: H5P-005 keeps a learner's answers so a reload resumes them. For the ten content types that is one state per
 *      learner, activity and course: h5p.js saves data type `state` for sub-content `0`, every five seconds while
 *      the activity is open. The limits here leave that far below them, and bound what one learner can store and
 *      what one page load reads (D-120).
 * Spec: H5P-005
 * Invariants:
 *   - A data type is `state`, nothing else; a sub-content ID is `0` or a UUID.
 *   - Per learner, activity and course: at most `rows` states, each at most `rowBytes`, together at most
 *     `totalBytes`, counted as the bytes of the stored JSON text.
 *   - A state past a size limit is refused with 413 `error.tooLarge`, and so is a state that would be one too many.
 * Collaborators: ./learnerStateWrites.ts (checks a write), ./PrismaContentUserDataStorage.ts (bounds the preload),
 *   ../../http/routes/userDataRoutes.ts (checks the names, counts the saves).
 * Tests: apps/server/test/http/userDataLimits.int.test.ts, apps/server/test/h5p/learnerStatePreload.int.test.ts
 */
import { HttpError } from '../../http/HttpError.js';
import { isContentUuid } from '../contentIds.js';
import { MAIN_STATE } from './learnerStateRows.js';

const KB = 1024;
const MB = 1024 * KB;

/** How much state one learner may keep for one activity in one course. */
export const LEARNER_STATE_LIMITS = {
  /** States (rows); a real activity has one. */
  rows: 20,
  /** Bytes of one state. */
  rowBytes: 512 * KB,
  /** Bytes of all the learner's states for the activity and course. */
  totalBytes: 1 * MB,
} as const;

/** Saves one learner may send for one activity in a minute; an open activity sends twelve. */
export const STATE_SAVES_PER_MINUTE = 60;

/** The one data type h5p.js saves a learner's state under. */
export const STATE_DATA_TYPE = 'state';

/**
 * Tells whether a data type is one the player saves.
 * @param value - The `dataType` of a request.
 * @returns True only for `state`.
 */
export const isStateDataType = (value: string): boolean => value === STATE_DATA_TYPE;

/**
 * Tells whether a sub-content ID is one the player can name.
 * @param value - The `subContentId` of a request.
 * @returns True for `0` (the activity itself) and for a UUID (H5P's sub-content IDs).
 */
export const isStateSubContentId = (value: string): boolean => value === MAIN_STATE || isContentUuid(value);

/**
 * The size a state takes when stored.
 * @param state - The state string h5p.js posted.
 * @returns The bytes of its JSON text, which is what the database keeps (D-038).
 */
export const storedStateBytes = (state: string): number => Buffer.byteLength(JSON.stringify(state));

/**
 * The refusal of a state past a limit.
 * @param maxBytes - The limit that was passed.
 * @returns HttpError 413 `error.tooLarge` naming the limit in megabytes.
 */
export const stateTooLarge = (maxBytes: number): HttpError =>
  new HttpError(413, 'error.tooLarge', { maxMb: maxBytes / MB });
