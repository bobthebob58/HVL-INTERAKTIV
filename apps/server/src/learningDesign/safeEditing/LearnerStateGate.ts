/**
 * LearnerStateGate — the editor's learner-state step on every save of an existing activity: a text-only edit keeps
 * all saved progress; a structural edit asks first when other people have progress, and resets it once saved; an
 * edit of an answer key keeps the progress and starts a new version.
 *
 * Why: PROD-013 and D-093 (with its probe P3 amendment) replace D-038's "every save deletes the invalidated state".
 *      Resumed state is restored by position, so after a structural edit learners could see another question's
 *      answer, lose their input or meet a crash; after a text-only edit they resume correctly. The author decides
 *      before anything is written: HvlH5PEditor calls `admit` after its own checks and before Lumi's write, and
 *      runs Lumi's write through `runSave`, so a reset commits with the new parameters or not at all.
 * Spec: PROD-013
 * Invariants:
 *   - New activities (no ID) and text-only saves keep every state row and the version.
 *   - A save with the same structure and another answer key (../../insight/content/answerKeys.ts) keeps every state
 *     row, asks nothing, and raises `H5PContent.version` with the storage's first parameter write
 *     (../../h5p/storage/contentVersionRaiseWrite.ts), so insight never shows answers judged against one key
 *     under another (D-137). A storage without that hook gets the store's `raiseVersion` right after the write.
 *   - A structural save, when anyone but the saver has state of the activity (any course, any context), needs
 *     `confirmLearnerStateReset: true`; without it `admit` throws 409 `hvl:learner-state-reset-needed` before
 *     anything is written. The answer says nothing about who or how many (D-093).
 *   - "The saver" is the saver's current learnerKey, as the state routes derive it (`asStateUser(actor).id`); their
 *     Canvas or last year's preview counts as someone else's, which errs on the safe side.
 *   - Every structural save that goes through (confirmed, or with nobody else's state) deletes all the activity's
 *     state rows and raises `H5PContent.version` in the same transaction as the storage's first parameter write
 *     (../../h5p/storage/PrismaContentStorage.ts; D-093 amendment 2026-10-29, S5 review), so a failure later in
 *     Lumi's save never leaves the new structure with the old state. A storage without that hook gets
 *     ./PrismaLearnerStateStore.ts's own transaction right after the write. Deleting all, not only the saver's,
 *     also removes rows that another learner's old page wrote between `admit` and the save.
 *   - The stored side is read with the saver's rights through Lumi's ContentManager, as the editor reads it. A
 *     stored version past the limits for one activity (../../h5p/semantics/contentBudget.ts, D-126) is not
 *     compared: the save counts as structural.
 * Collaborators: ./structureSignature.ts, ./structuralChange.ts, ./PrismaLearnerStateStore.ts,
 *   ../../h5p/semantics/contentBudget.ts, ../../insight/content/answerKeys.ts,
 *   ../../h5p/storage/learnerStateResetWrite.ts, ../../h5p/storage/contentVersionRaiseWrite.ts,
 *   ../../h5p/HvlH5PEditor.ts (calls it),
 *   ../../content/storedContent.ts (`mainLibraryUbername`),
 *   ../../http/learningDesignErrors.ts.
 * Tests: apps/server/test/learningDesign/safeEditing/LearnerStateGate.test.ts,
 *   apps/server/test/learningDesign/safeEditing/safeEditing.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/safeEditingFailures.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/answerKeyVersions.int.test.ts
 */
import type { H5PEditor, IUser } from '@lumieducation/h5p-server';
import { mainLibraryUbername } from '../../content/storedContent.js';
import { asStateUser, isHvlH5pUser } from '../../h5p/HvlH5pUser.js';
import { contentLimitPassed } from '../../h5p/semantics/contentBudget.js';
import { withContentVersionRaise } from '../../h5p/storage/contentVersionRaiseWrite.js';
import { withLearnerStateReset } from '../../h5p/storage/learnerStateResetWrite.js';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import { answerKeys, answerKeysDiffer } from '../../insight/content/answerKeys.js';
import { structuralDifference } from './structuralChange.js';
import { structureSignature } from './structureSignature.js';

/**
 * The author's answer to the save choice dialog, sent with the editor's save (`PUT /h5p/content/:contentId`).
 * @spec PROD-013
 */
export interface SaveChoice {
  /** True when the author confirmed that learners' saved progress is reset by this structural edit. */
  readonly confirmLearnerStateReset?: boolean;
}

/** The learner-state rows of activities, as the gate needs them. */
export interface LearnerStateStore {
  /**
   * Tells whether anyone but one learner has saved state of an activity, in any context.
   * @param contentId - The activity.
   * @param ownLearnerKey - The saver's learnerKey; undefined means every row counts as someone else's.
   */
  hasOtherLearnersState(contentId: string, ownLearnerKey: string | undefined): Promise<boolean>;
  /**
   * Deletes every state row of an activity and raises its version, in one transaction; used only when the content
   * storage did not reset them with its write.
   * @param contentId - The activity.
   */
  resetLearnerState(contentId: string): Promise<void>;
  /**
   * Raises an activity's version and keeps its state rows; used only when the content storage did not raise it
   * with its write.
   * @param contentId - The activity.
   */
  raiseVersion(contentId: string): Promise<void>;
}

/** What the gate reads of a stored activity: Lumi's ContentManager, with the saver's rights. */
export type StoredContentReader = Pick<
  H5PEditor['contentManager'],
  'getContentParameters' | 'getContentMetadata'
>;

/** What `admit` decided; `runSave` carries it out with Lumi's write. */
export interface LearnerStatePlan {
  /** The activity whose state is reset after the write; absent when the save keeps all state. */
  readonly resetContentId?: string;
  /** The activity whose version is raised with the write while its state is kept: its answer key changed. */
  readonly newVersionContentId?: string;
}

const KEEP_STATE: LearnerStatePlan = Object.freeze({});

const ownLearnerKey = (user: IUser): string | undefined =>
  isHvlH5pUser(user) ? asStateUser(user.actor).id : undefined;

/** The learner-state step of HvlH5PEditor's save. */
export class LearnerStateGate {
  /**
   * @param content - Lumi's ContentManager (reads the stored parameters and metadata as the saver).
   * @param store - The state rows (./PrismaLearnerStateStore.ts in the server).
   */
  constructor(
    private readonly content: StoredContentReader,
    private readonly store: LearnerStateStore,
  ) {}

  /**
   * Decides what a save does to learner state, before anything is written.
   * @param contentId - The activity, or undefined for a new one.
   * @param params - The parameters the editor will store (after HVL's sub-content policy).
   * @param mainLibrary - The save's main library, e.g. `H5P.MultiChoice 1.16`.
   * @param user - The saver (account view).
   * @param choice - The author's answer to the save choice dialog; none by default.
   * @returns The plan for `runSave`.
   * @throws HttpError 409 `hvl:learner-state-reset-needed` for an unconfirmed structural save while anyone else has
   *   saved state of the activity.
   * @spec PROD-013
   */
  async admit(
    contentId: string | undefined,
    params: unknown,
    mainLibrary: string,
    user: IUser,
    choice: SaveChoice = {},
  ): Promise<LearnerStatePlan> {
    if (contentId === undefined) return KEEP_STATE;
    // WHY: one after the other: Prisma batches `findUnique` calls of one tick into one `IN (…)` query and
    // matches the rows back by string equality, so the permission checks' look-ups of an ID the URL spells in upper
    // case would find no row and refuse the save with 403.
    const stored = await this.content.getContentParameters(contentId, user);
    const metadata = await this.content.getContentMetadata(contentId, user);
    // WHY: a stored version past the limits for one activity (a row no save wrote, D-126) is not read further:
    // the save counts as structural, which asks before anyone's progress is reset.
    const comparable = contentLimitPassed(stored) === undefined;
    const storedMain = mainLibraryUbername(metadata.mainLibrary, metadata);
    const before = () => structureSignature(stored, storedMain);
    if (comparable && structuralDifference(before(), structureSignature(params, mainLibrary)) === null) {
      // WHY: the saved progress still fits, but answers judged against the old key must not be counted under the
      // new one, so the save starts a new version (D-137).
      const newKey = answerKeysDiffer(answerKeys(storedMain, stored), answerKeys(mainLibrary, params));
      return newKey ? { newVersionContentId: contentId } : KEEP_STATE;
    }
    const confirmed = choice.confirmLearnerStateReset === true;
    // PRIVACY: only whether someone else has progress is read and answered, never who or how many (D-093).
    if (!confirmed && (await this.store.hasOtherLearnersState(contentId, ownLearnerKey(user)))) {
      throw learningDesignError('hvl:learner-state-reset-needed');
    }
    return { resetContentId: contentId };
  }

  /**
   * Runs Lumi's write under the plan: a structural save's reset, or an answer-key save's version raise, commits
   * with the storage's first parameter write (../../h5p/storage/learnerStateResetWrite.ts,
   * ../../h5p/storage/contentVersionRaiseWrite.ts); a storage without that hook gets it right after the write.
   * @param plan - From `admit`.
   * @param save - Lumi's write of the save.
   * @returns What `save` returned, once the reset or the raise (if any) is committed.
   * @spec PROD-013
   */
  async runSave<T>(plan: LearnerStatePlan, save: () => Promise<T>): Promise<T> {
    const { resetContentId, newVersionContentId } = plan;
    if (resetContentId !== undefined) {
      const { result, claimed } = await withLearnerStateReset(resetContentId, save);
      if (!claimed) await this.store.resetLearnerState(resetContentId);
      return result;
    }
    if (newVersionContentId === undefined) return save();
    const { result, claimed } = await withContentVersionRaise(newVersionContentId, save);
    if (!claimed) await this.store.raiseVersion(newVersionContentId);
    return result;
  }
}
