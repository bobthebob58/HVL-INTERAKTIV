/**
 * editorSaveSteps — HVL's steps around Lumi's write in every editor save, in their fixed order: what runs before
 * Lumi writes anything, and what runs right after.
 *
 * Why: HvlH5PEditor overrides Lumi's save to add HVL's rules (./HvlH5PEditor.ts). The steps share state (the main
 *      library, the files stored before the save, the learner-state plan), and keeping them in one module keeps
 *      the editor small and the order in one place.
 * Spec: H5P-002, H5P-006, SEC-008, PROD-007, PROD-013
 * Invariants:
 *   - Before Lumi's write, in this order: permission and main library (./saveAdmission.ts) → the files the stored
 *     version references → sub-content policy (D-039) → paste-source guard (D-092) → learner-state check (D-093).
 *     Any refusal is thrown here, so a refused save changes neither the parameters, nor the files, nor the state.
 *   - After Lumi's write: first the learner-state reset of a structural edit (state rows deleted, version raised),
 *     then the dropped files are deleted as the author (./contentFileCleanup.ts); a new activity has neither.
 * Collaborators: ./HvlH5PEditor.ts, ./saveAdmission.ts, ./contentFileCleanup.ts, ./semantics/SubContentPolicy.ts,
 *   ./pasteSourceGuard.ts, ../learningDesign/safeEditing/LearnerStateGate.ts.
 * Tests: apps/server/test/h5p/HvlH5PEditor.test.ts, apps/server/test/h5p/pasteSourceGuard.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/safeEditing.int.test.ts
 */
import type {
  ContentParameters,
  H5PEditor,
  IContentMetadata,
  ILibraryName,
  IPermissionSystem,
  IUser,
  LibraryManager,
} from '@lumieducation/h5p-server';
import {
  LearnerStateGate,
  type LearnerStatePlan,
  type LearnerStateStore,
  type SaveChoice,
} from '../learningDesign/safeEditing/LearnerStateGate.js';
import { ContentFileCleanup } from './contentFileCleanup.js';
import type { HvlH5pUser } from './HvlH5pUser.js';
import { PasteSourceGuard } from './pasteSourceGuard.js';
import type { ContentAccessRepository } from './permissions/ContentAccessRepository.js';
import { admitSave } from './saveAdmission.js';
import { SubContentPolicy } from './semantics/SubContentPolicy.js';

/** What the save steps read besides Lumi's managers. */
export interface SaveStepPolicy {
  readonly permissionSystem: IPermissionSystem<HvlH5pUser>;
  /** The activity facts the paste-source guard decides duplicates on (D-092). */
  readonly contentFacts: ContentAccessRepository;
  /** The learner-state rows a structural save checks and resets (D-093). */
  readonly learnerStates: LearnerStateStore;
}

/** One save, as the editor passes it to Lumi. */
export interface EditorSave {
  /** The activity, or undefined for a new one. */
  readonly contentId: string | undefined;
  readonly parameters: ContentParameters;
  readonly metadata: IContentMetadata;
  readonly mainLibraryUbername: string;
  readonly user: IUser;
  /** The author's answer to the save choice dialog (PROD-013). */
  readonly choice?: SaveChoice;
}

/** What `beforeWrite` found, for `afterWrite`. */
export interface CheckedSave {
  readonly main: ILibraryName;
  readonly filesBefore: readonly string[];
  readonly learnerState: LearnerStatePlan;
}

/** HVL's steps of an editor save. */
export class EditorSaveSteps {
  private readonly subContent: SubContentPolicy;
  private readonly pasteSources: PasteSourceGuard;
  private readonly learnerState: LearnerStateGate;
  private readonly files: ContentFileCleanup;

  /**
   * @param libraryManager - The editor's library manager.
   * @param contentManager - The editor's content manager (stored parameters, permission-checked file deletes).
   * @param policy - Permission system, activity facts and learner-state rows.
   */
  constructor(
    private readonly libraryManager: LibraryManager,
    contentManager: H5PEditor['contentManager'],
    private readonly policy: SaveStepPolicy,
  ) {
    this.subContent = new SubContentPolicy(libraryManager);
    this.pasteSources = new PasteSourceGuard(libraryManager, policy.contentFacts);
    this.learnerState = new LearnerStateGate(contentManager, policy.learnerStates);
    this.files = new ContentFileCleanup(libraryManager, contentManager);
  }

  /**
   * Every check before Lumi's write; the parameters and metadata are cleaned in place.
   * @param save - The save.
   * @returns What `afterWrite` needs.
   * @throws The first refusal: H5pError 403/404 (permission, library, sub-content, paste source), 400 (paths,
   *   nesting, text), HttpError 409 `hvl:learner-state-reset-needed`.
   */
  async beforeWrite(save: EditorSave): Promise<CheckedSave> {
    const { contentId, parameters, user } = save;
    const deps = { permissionSystem: this.policy.permissionSystem, libraryManager: this.libraryManager };
    const main = await admitSave(deps, contentId, save.mainLibraryUbername, user);
    const filesBefore = contentId === undefined ? [] : await this.files.storedFiles(contentId, main, user);
    await this.subContent.enforce(parameters as Record<string, unknown>, save.metadata, main);
    await this.pasteSources.enforce(parameters, main, user);
    const learnerState = await this.learnerState.admit(
      contentId,
      parameters,
      save.mainLibraryUbername,
      user,
      save.choice,
    );
    return { main, filesBefore, learnerState };
  }

  /**
   * The steps after Lumi's write.
   * @param save - The save.
   * @param savedId - The ID Lumi saved under.
   * @param checked - From `beforeWrite`.
   */
  async afterWrite(save: EditorSave, savedId: string, checked: CheckedSave): Promise<void> {
    // WHY: before the file clean-up, so a failing delete cannot leave old state on a structurally changed activity.
    await this.learnerState.settle(checked.learnerState);
    if (save.contentId === undefined) return;
    const after = await this.files.referencedFiles(save.parameters, checked.main);
    await this.files.deleteDropped(savedId, [...checked.filesBefore], after, save.user);
  }
}
