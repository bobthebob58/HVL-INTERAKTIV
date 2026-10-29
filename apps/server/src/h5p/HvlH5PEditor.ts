/**
 * HvlH5PEditor — Lumi's H5PEditor with HVL's rules where Lumi has no hook for them.
 *
 * Why: several rules must hold on every path into the editor, and Lumi 10.0.4 offers no extension point for
 *      them: only the ten types are creatable (`H5P-002`); a save checks the permission before it touches
 *      learner state, which only a structural edit resets, after the author's confirmation when others have
 *      some (D-038 as amended by D-093; Lumi deletes invalidated state first); sub-content is checked (D-039);
 *      file paths that copy from another activity or that the storage would refuse are refused before Lumi
 *      writes anything (D-092); an author's package import never installs or swaps code (`SEC-003`); library
 *      changes are audited and never come from the Hub (`H5P-011`, D-041); and the download path asks our
 *      permission system (Lumi builds its exporter without one).
 * Spec: H5P-002, H5P-006, H5P-011, SEC-003, SEC-005, SEC-008, PROD-007, PROD-013
 * Invariants:
 *   - The content-type list holds only installed members of the ten (all four Lumi paths that return it).
 *   - Save order (./editorSaveSteps.ts): permission and main library → stored files → sub-content policy →
 *     paste-source guard → learner-state check (409 for an unconfirmed structural edit while others have state) →
 *     Lumi's save → state reset and version raise of a structural edit → delete dropped files as the author.
 *     Both save methods take the author's `SaveChoice`; a text-only save keeps every state row.
 *   - Package import: path only (never a buffer), `inspectZip`, manifest, main library one of the ten, for
 *     non-admins every library already installed in the same version, Lumi's import, audit for admins.
 *   - Hub install and Content Hub download are refused for everyone.
 * Collaborators: ./HvlTop10ContentTypeFilter.ts, ./editorSaveSteps.ts, ./permissionCheckedExporter.ts,
 *   ./libraries/*, ../security/zipEntryGuard.ts; built only by ./H5pEditorFactory.ts.
 * Tests: apps/server/test/h5p/HvlH5PEditor.test.ts, apps/server/test/h5p/HvlH5PEditor.upload.test.ts,
 *   apps/server/test/h5p/HvlH5PEditor.library.test.ts, apps/server/test/h5p/pasteSourceGuard.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/safeEditing.int.test.ts
 */
import {
  GeneralPermission,
  H5PEditor,
  H5pError,
  type ContentId,
  type ContentParameters,
  type IContentMetadata,
  type IPermissionSystem,
  type IUser,
} from '@lumieducation/h5p-server';
import type { IHubInfo } from '@lumieducation/h5p-server/build/src/types.js';
import type { LearnerStateStore, SaveChoice } from '../learningDesign/safeEditing/LearnerStateGate.js';
import { inspectZip } from '../security/zipEntryGuard.js';
import { EditorSaveSteps } from './editorSaveSteps.js';
import { filterContentTypeCache, isAuthorableType } from './HvlTop10ContentTypeFilter.js';
import type { HvlH5pUser } from './HvlH5pUser.js';
import { auditBeforeInstall } from './libraries/auditBeforeInstall.js';
import type { LibraryAuditSink } from './libraries/LibraryAuditSink.js';
import { disconnectFromHub } from './offlineContentTypeCache.js';
import { assertPackageLibrariesInstalled } from './libraries/packageLibraryCheck.js';
import { readPackageManifest } from './libraries/packageManifest.js';
import { sha256File } from './libraries/sha256Sums.js';
import { usePermissionCheckedExporter } from './permissionCheckedExporter.js';
import type { ContentAccessRepository } from './permissions/ContentAccessRepository.js';

/** What HvlH5PEditor needs beyond Lumi's constructor arguments. */
export interface HvlEditorPolicy {
  /** The permission system also passed to Lumi in `options.permissionSystem`. */
  readonly permissionSystem: IPermissionSystem<HvlH5pUser>;
  /** Where library installs by admins are recorded. */
  readonly audit: LibraryAuditSink;
  /** The activity facts the permission system reads; the paste-source guard decides duplicates on them (D-092). */
  readonly contentFacts: ContentAccessRepository;
  /** The learner-state rows a structural save checks and resets (D-093). */
  readonly learnerStates: LearnerStateStore;
}

type UploadResult = Awaited<ReturnType<H5PEditor['uploadPackage']>>;
type SaveResult = Awaited<ReturnType<H5PEditor['saveOrUpdateContentReturnMetaData']>>;

const hubDisabled = (): H5pError => new H5pError('hvl:hub-install-disabled', {}, 403);

/** The H5P editor with HVL's content-type, save, import and library rules. */
export class HvlH5PEditor extends H5PEditor {
  private readonly policy: HvlEditorPolicy;
  private readonly saveSteps: EditorSaveSteps;

  /**
   * @param args - Lumi's H5PEditor constructor arguments, unchanged.
   * @param policy - Permission system, audit sink, activity facts and learner-state rows.
   */
  constructor(args: ConstructorParameters<typeof H5PEditor>, policy: HvlEditorPolicy) {
    super(...args);
    this.policy = policy;
    disconnectFromHub(this);
    this.saveSteps = new EditorSaveSteps(this.libraryManager, this.contentManager, policy);
    usePermissionCheckedExporter(this, policy.permissionSystem);
  }

  /** Only installed members of the ten types, none installable or updatable (`H5P-002`). */
  override async getContentTypeCache(user: IUser, language?: string): Promise<IHubInfo> {
    return filterContentTypeCache(await super.getContentTypeCache(user, language));
  }

  /**
   * Saves with HVL's checks in the order described in the module header.
   * @param choice - The author's answer to the save choice dialog (PROD-013); none by default.
   * @throws HttpError 409 `hvl:learner-state-reset-needed` for an unconfirmed structural edit while others have state.
   */
  override async saveOrUpdateContentReturnMetaData(
    contentId: ContentId | undefined,
    parameters: ContentParameters,
    metadata: IContentMetadata,
    mainLibraryUbername: string,
    user: IUser,
    choice?: SaveChoice,
  ): Promise<SaveResult> {
    const save = { contentId, parameters, metadata, mainLibraryUbername, user, choice };
    const checked = await this.saveSteps.beforeWrite(save);
    const result = await super.saveOrUpdateContentReturnMetaData(
      // WHY: Lumi types the ID as a string but treats undefined as "new content".
      contentId as ContentId,
      parameters,
      metadata,
      mainLibraryUbername,
      user,
    );
    await this.saveSteps.afterWrite(save, result.id, checked);
    return result;
  }

  /** Saves as `saveOrUpdateContentReturnMetaData`; unlike Lumi's, it never deletes state before the checks (D-093). */
  override async saveOrUpdateContent(
    contentId: ContentId | undefined,
    parameters: ContentParameters,
    metadata: IContentMetadata,
    mainLibraryUbername: string,
    user: IUser,
    choice?: SaveChoice,
  ): Promise<ContentId> {
    const { id } = await this.saveOrUpdateContentReturnMetaData(
      contentId,
      parameters,
      metadata,
      mainLibraryUbername,
      user,
      choice,
    );
    return id;
  }

  /** Imports an author's package with the `SEC-003`/`SEC-005` checks; admins may install libraries (audited). */
  override async uploadPackage(
    dataOrPath: Buffer | string,
    user?: IUser,
    options?: { onlyInstallLibraries?: boolean },
  ): Promise<UploadResult> {
    // SECURITY: the library-only mode skips every permission check in Lumi; the seed command has its own path.
    if (typeof dataOrPath !== 'string' || options?.onlyInstallLibraries || !user) {
      throw new H5pError('hvl:package-import-refused', {}, 400);
    }
    await inspectZip(dataOrPath);
    const manifest = await readPackageManifest(dataOrPath);
    if (!isAuthorableType(manifest.mainLibrary)) {
      throw new H5pError('hvl:content-type-not-allowed', { library: manifest.mainLibrary }, 403);
    }
    const actor = user as HvlH5pUser;
    const mayInstall = await this.policy.permissionSystem.checkForGeneralAction(
      actor,
      GeneralPermission.UpdateAndInstallLibraries,
    );
    if (!mayInstall) {
      await assertPackageLibrariesInstalled(manifest.libraries, this.libraryManager);
      return super.uploadPackage(dataOrPath, user);
    }
    const change = {
      source: 'upload',
      actorUserId: actor.actor.accountId,
      sha256: await sha256File(dataOrPath),
    } as const;
    let result: UploadResult | undefined;
    await auditBeforeInstall(
      { libraries: manifest.libraries, installed: this.libraryManager },
      { sink: this.policy.audit, change },
      async () => (result = await super.uploadPackage(dataOrPath, user)).installedLibraries,
    );
    return result as UploadResult;
  }

  /** Refused for everyone: libraries arrive only through reviewed seed packages or audited imports (D-041). */
  override async installLibraryFromHub(_machineName: string, _user: IUser): Promise<never> {
    throw hubDisabled();
  }

  /** Refused for everyone: the public Content Hub is off (H5pConfigFactory; D-041). */
  override async getContentHubContent(_contentHubId: string, _user: IUser): Promise<never> {
    throw hubDisabled();
  }
}
