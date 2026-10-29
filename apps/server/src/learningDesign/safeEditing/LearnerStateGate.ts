/**
 * LearnerStateGate — the editor's learner-state step on every save of an existing activity: a text-only edit keeps
 * all saved progress; a structural edit asks first when other people have progress, and resets it once saved.
 *
 * Why: PROD-013 and D-093 (with its probe P3 amendment) replace D-038's "every save deletes the invalidated state".
 *      Resumed state is restored by position, so after a structural edit learners could see another question's
 *      answer, lose their input or meet a crash; after a text-only edit they resume correctly. The author decides
 *      before anything is written: HvlH5PEditor calls `admit` after its own checks and before Lumi's write, and
 *      `settle` right after Lumi's write.
 * Spec: PROD-013
 * Invariants:
 *   - New activities (no ID) and text-only saves keep every state row and the version.
 *   - A structural save, when anyone but the saver has state of the activity (any course, any context), needs
 *     `confirmLearnerStateReset: true`; without it `admit` throws 409 `hvl:learner-state-reset-needed` before
 *     anything is written. The answer says nothing about who or how many (D-093).
 *   - "The saver" is the saver's current learnerKey, as the state routes derive it (`asStateUser(actor).id`); their
 *     Canvas or last year's preview counts as someone else's, which errs on the safe side.
 *   - Every structural save that goes through (confirmed, or with nobody else's state) deletes all the activity's
 *     state rows and raises `H5PContent.version` in one transaction (./PrismaLearnerStateStore.ts). Deleting all,
 *     not only the saver's, also removes rows that another learner's old page wrote between `admit` and the save.
 *   - The stored side is read with the saver's rights through Lumi's ContentManager, as the editor reads it.
 * Collaborators: ./structureSignature.ts, ./structuralChange.ts, ./PrismaLearnerStateStore.ts,
 *   ../../h5p/HvlH5PEditor.ts (calls it), ../../content/storedContent.ts (`mainLibraryUbername`),
 *   ../../http/learningDesignErrors.ts.
 * Tests: apps/server/test/learningDesign/safeEditing/LearnerStateGate.test.ts,
 *   apps/server/test/learningDesign/safeEditing/safeEditing.int.test.ts
 */
import type { H5PEditor, IUser } from '@lumieducation/h5p-server';
import { mainLibraryUbername } from '../../content/storedContent.js';
import { asStateUser, isHvlH5pUser } from '../../h5p/HvlH5pUser.js';
import { learningDesignError } from '../../http/learningDesignErrors.js';
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
   * Deletes every state row of an activity and raises its version, in one transaction.
   * @param contentId - The activity.
   */
  resetLearnerState(contentId: string): Promise<void>;
}

/** What the gate reads of a stored activity: Lumi's ContentManager, with the saver's rights. */
export type StoredContentReader = Pick<
  H5PEditor['contentManager'],
  'getContentParameters' | 'getContentMetadata'
>;

/** What `admit` decided; `settle` carries it out after Lumi's write. */
export interface LearnerStatePlan {
  /** The activity whose state is reset after the write; absent when the save keeps all state. */
  readonly resetContentId?: string;
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
   * @returns The plan for `settle`.
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
    const before = structureSignature(stored, mainLibraryUbername(metadata.mainLibrary, metadata));
    if (structuralDifference(before, structureSignature(params, mainLibrary)) === null) return KEEP_STATE;
    const confirmed = choice.confirmLearnerStateReset === true;
    // PRIVACY: only whether someone else has progress is read and answered, never who or how many (D-093).
    if (!confirmed && (await this.store.hasOtherLearnersState(contentId, ownLearnerKey(user)))) {
      throw learningDesignError('hvl:learner-state-reset-needed');
    }
    return { resetContentId: contentId };
  }

  /**
   * Carries out the plan right after Lumi's write: resets the state of a structurally changed activity.
   * @param plan - From `admit`.
   * @returns When the reset (if any) is committed.
   */
  async settle(plan: LearnerStatePlan): Promise<void> {
    if (plan.resetContentId !== undefined) await this.store.resetLearnerState(plan.resetContentId);
  }
}
