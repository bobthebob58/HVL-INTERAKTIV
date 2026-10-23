/**
 * HvlH5PEditor — Lumi's H5PEditor with HVL's rules where Lumi has no hook for them.
 *
 * Why: several rules must hold on every path into the editor, and Lumi 10.0.4 offers no extension point for
 *      them: only the ten types are creatable (`H5P-002`); a save checks the permission before it touches
 *      learner state (D-038, Lumi deletes invalidated state first); sub-content is checked on save (D-039);
 *      an author's package import never installs or swaps code (`SEC-003`); library changes are audited and
 *      never come from the Hub (`H5P-011`, D-041); and the download path asks our permission system (Lumi
 *      builds its exporter without one).
 * Spec: H5P-002, H5P-006, H5P-011, SEC-003, SEC-005, SEC-008
 * Invariants:
 *   - The content-type list holds only installed members of the ten (all four Lumi paths that return it).
 *   - Save order: permission → main library is one of the ten and installed → sub-content policy → Lumi's save →
 *     delete dropped files as the author → (saveOrUpdateContent only) invalidate learner state.
 *   - Package import: path only (never a buffer), `inspectZip`, manifest, main library one of the ten, for
 *     non-admins every library already installed in the same version, Lumi's import, audit for admins.
 *   - Hub install and Content Hub download are refused for everyone.
 * Collaborators: ./HvlTop10ContentTypeFilter.ts, ./semantics/SubContentPolicy.ts, ./contentFileCleanup.ts,
 *   ./libraries/*, ../security/zipEntryGuard.ts; built only by ./H5pEditorFactory.ts.
 * Tests: apps/server/test/h5p/HvlH5PEditor.test.ts, apps/server/test/h5p/HvlH5PEditor.upload.test.ts,
 *   apps/server/test/h5p/HvlH5PEditor.library.test.ts
 */
import {
  ContentPermission,
  GeneralPermission,
  H5PEditor,
  H5pError,
  LibraryName,
  PackageExporter,
  type ContentId,
  type ContentParameters,
  type IContentMetadata,
  type IPermissionSystem,
  type IUser,
} from '@lumieducation/h5p-server';
import type { IHubInfo } from '@lumieducation/h5p-server/build/src/types.js';
import { inspectZip } from '../security/zipEntryGuard.js';
import { ContentFileCleanup } from './contentFileCleanup.js';
import {
  assertAuthorableMainLibrary,
  filterContentTypeCache,
  isAuthorableType,
} from './HvlTop10ContentTypeFilter.js';
import type { HvlH5pUser } from './HvlH5pUser.js';
import { auditBeforeInstall } from './libraries/auditBeforeInstall.js';
import type { LibraryAuditSink } from './libraries/LibraryAuditSink.js';
import { disconnectFromHub } from './offlineContentTypeCache.js';
import { assertPackageLibrariesInstalled } from './libraries/packageLibraryCheck.js';
import { readPackageManifest } from './libraries/packageManifest.js';
import { sha256File } from './libraries/sha256Sums.js';
import { SubContentPolicy } from './semantics/SubContentPolicy.js';

/** What HvlH5PEditor needs beyond Lumi's constructor arguments. */
export interface HvlEditorPolicy {
  /** The permission system also passed to Lumi in `options.permissionSystem`. */
  readonly permissionSystem: IPermissionSystem<HvlH5pUser>;
  /** Where library installs by admins are recorded. */
  readonly audit: LibraryAuditSink;
}

type UploadResult = Awaited<ReturnType<H5PEditor['uploadPackage']>>;
type SaveResult = Awaited<ReturnType<H5PEditor['saveOrUpdateContentReturnMetaData']>>;

const hubDisabled = (): H5pError => new H5pError('hvl:hub-install-disabled', {}, 403);

/** The H5P editor with HVL's content-type, save, import and library rules. */
export class HvlH5PEditor extends H5PEditor {
  private readonly policy: HvlEditorPolicy;
  private readonly subContent: SubContentPolicy;
  private readonly files: ContentFileCleanup;

  /**
   * @param args - Lumi's H5PEditor constructor arguments, unchanged.
   * @param policy - Permission system and audit sink.
   */
  constructor(args: ConstructorParameters<typeof H5PEditor>, policy: HvlEditorPolicy) {
    super(...args);
    this.policy = policy;
    disconnectFromHub(this);
    this.subContent = new SubContentPolicy(this.libraryManager);
    this.files = new ContentFileCleanup(this.libraryManager, this.contentManager);
    // SECURITY: Lumi builds its PackageExporter from the config, which has no permission system, so downloads
    // would never be checked (H5PEditor.js:108). This exporter asks ours for ContentPermission.Download.
    (this as unknown as { packageExporter: PackageExporter }).packageExporter = new PackageExporter(
      this.libraryManager,
      this.contentStorage,
      {
        exportMaxContentPathLength: this.config.exportMaxContentPathLength,
        permissionSystem: policy.permissionSystem,
      },
    );
  }

  /** Only installed members of the ten types, none installable or updatable (`H5P-002`). */
  override async getContentTypeCache(user: IUser, language?: string): Promise<IHubInfo> {
    return filterContentTypeCache(await super.getContentTypeCache(user, language));
  }

  /** Saves with HVL's checks in the order described in the module header; learner state is not touched. */
  override async saveOrUpdateContentReturnMetaData(
    contentId: ContentId | undefined,
    parameters: ContentParameters,
    metadata: IContentMetadata,
    mainLibraryUbername: string,
    user: IUser,
  ): Promise<SaveResult> {
    const permission = contentId === undefined ? ContentPermission.Create : ContentPermission.Edit;
    if (!(await this.policy.permissionSystem.checkForContent(user as HvlH5pUser, permission, contentId))) {
      throw new H5pError('h5p-server:content-missing-edit-permission', {}, 403);
    }
    assertAuthorableMainLibrary(mainLibraryUbername);
    const main = LibraryName.fromUberName(mainLibraryUbername, { useWhitespace: true });
    if (!(await this.libraryManager.libraryExists(main))) {
      throw new H5pError('hvl:library-not-installed', { library: main.machineName }, 400);
    }
    const before = contentId === undefined ? [] : await this.files.storedFiles(contentId, main, user);
    await this.subContent.enforce(parameters as Record<string, unknown>, metadata, main);
    const result = await super.saveOrUpdateContentReturnMetaData(
      // WHY: Lumi types the ID as a string but treats undefined as "new content".
      contentId as ContentId,
      parameters,
      metadata,
      mainLibraryUbername,
      user,
    );
    if (contentId !== undefined) {
      const after = await this.files.referencedFiles(parameters, main);
      await this.files.deleteDropped(result.id, before, after, user);
    }
    return result;
  }

  /** Saves, then drops invalidated learner state, only after the save passed every check (D-038). */
  override async saveOrUpdateContent(
    contentId: ContentId | undefined,
    parameters: ContentParameters,
    metadata: IContentMetadata,
    mainLibraryUbername: string,
    user: IUser,
  ): Promise<ContentId> {
    const { id } = await this.saveOrUpdateContentReturnMetaData(
      contentId,
      parameters,
      metadata,
      mainLibraryUbername,
      user,
    );
    await this.contentUserDataManager.deleteInvalidatedContentUserDataByContentId(id);
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
