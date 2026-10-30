/**
 * ContentDuplicator — makes a copy of an activity: «Lag ein kopi» (PROD-007, D-092) and the editor's «Lagre som ny
 * versjon» (D-093), which saves edited parameters as a copy and leaves the original untouched.
 *
 * Why: a duplicate must copy the parameters, the H5P metadata and every file, keep the link to the source and its
 *      author, and never copy learner data. Lumi copies files only through its paste-source form and fails quietly
 *      (D-092 amendment, probe P2), so this class decides the permission first, prepares the paths, saves through
 *      the editor, copies what Lumi will not, checks the stored result and removes anything half-made.
 * Spec: PROD-007, PROD-013, DATA-007
 * Invariants:
 *   - `duplicateRules` is decided before anything is read: unknown or invisible is 404 `hvl:activity-unavailable`
 *     (D-066), visible but not copyable is 403 `hvl:duplicate-not-allowed`. An allowed copy then counts against the
 *     person's copy limit (`editor.copyLimit`, ./CopyRateLimit.ts): past it, 429 `hvl:rate-limited` (D-092).
 *   - The copy is saved through `HvlH5PEditor.saveOrUpdateContent` as a new activity of the source's main library,
 *     with the source's h5p.json (its `defaultLanguage` and `language` included), so every editor check runs; the
 *     editor's paste-source guard admits the paths because the same rule allowed them. «Lagre som ny versjon» may
 *     name the editor's minor version of that library instead (./copyLibraryChoice.ts; D-093 amendment 2026-10-29,
 *     the copy's library version).
 *   - Any failure after the editor created a row removes every row it created (with its files), and answers 500
 *     `hvl:duplicate-failed` with the cause attached; a refusal (4xx) raised before any row was written is passed on.
 *   - The copy is a private draft owned by the person; learner data, placements, acknowledgements, co-authors, the
 *     bank listing and the published status never travel (./copyRecords.ts).
 * Collaborators: ./duplicateRules.ts, ./copySource.ts, ./copyLibraryChoice.ts, ./pasteSourceRewrite.ts,
 *   ./ownFileCopies.ts, ./copyVerification.ts, ./copyRecords.ts, ../../h5p/HvlH5PEditor.ts,
 *   ../../h5p/storage/contentCreations.ts,
 *   ../../http/learningDesignErrors.ts, ../../http/h5pErrorResponse.ts (what counts as a refusal); called by
 *   ../http/collaborationRoutes.ts («Lag ein kopi») and ../../http/routes/contentRoutes.ts («Lagre som ny versjon»).
 * Tests: apps/server/test/learningDesign/collaboration/ContentDuplicator.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/ContentDuplicatorData.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/ContentDuplicatorFailures.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/ContentDuplicatorSaveAsCopy.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/copyLibraryChoice.int.test.ts
 */
import {
  ContentFileScanner,
  type ContentParameters,
  type IContentMetadata,
  type IUser,
} from '@lumieducation/h5p-server';
import type { HvlH5PEditor } from '../../h5p/HvlH5PEditor.js';
import { asAccountUser, type HvlH5pActor } from '../../h5p/HvlH5pUser.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { trackContentCreations } from '../../h5p/storage/contentCreations.js';
import { authError } from '../../http/authErrors.js';
import { toErrorResponse } from '../../http/h5pErrorResponse.js';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import type { Database } from '../../infra/prismaClient.js';
import { chooseCopyLibrary } from './copyLibraryChoice.js';
import { readCopySource, withSourceLanguages, type CopySourceActivity } from './copySource.js';
import { copyLimitedError } from './CopyRateLimit.js';
import { findCopyDefect } from './copyVerification.js';
import { recordCopy, type CopyKind } from './copyRecords.js';
import { decideDuplicate, type DuplicateRoute } from './duplicateRules.js';
import { copyOwnFiles } from './ownFileCopies.js';
import { planCopy } from './pasteSourceRewrite.js';

/** What the duplicator works with; all of them are the server's single instances. */
export interface ContentDuplicatorDeps {
  readonly db: Database;
  /** The editor every save goes through (createH5pRuntime's `editor`). */
  readonly editor: HvlH5PEditor;
  /** The activity facts the permission system reads. */
  readonly access: ContentAccessRepository;
}

/** A made copy. */
export interface DuplicateResult {
  /** The new activity, a private draft owned by the person. */
  readonly contentId: string;
  /** `edit` when the person may Edit the source (rationale and course code were copied), else `bank`. */
  readonly via: DuplicateRoute;
}

interface Admitted {
  readonly user: IUser;
  readonly actorUserId: string;
  readonly sourceId: string;
  readonly sourceAuthorUserId: string;
  readonly via: DuplicateRoute;
}

/** What the copy is saved with, chosen from the stored source; `editorLibrary` is the editor's, if it sent one. */
type CopyContent = (source: CopySourceActivity) => {
  readonly params: ContentParameters;
  readonly metadata: IContentMetadata;
  readonly editorLibrary?: string;
};

// WHY: classified exactly as the error handler will answer it, so Lumi's plain Error for metadata its schema refuses
// («Lagre som ny versjon» sends the editor's h5p.json) stays the author's 400, not a 500 "try again".
const isRefusal = (error: unknown): boolean => {
  const { status } = toErrorResponse(error, 'en');
  return status >= 400 && status < 500;
};

/** Makes duplicates and editor copies of activities. */
export class ContentDuplicator {
  private readonly scanner: ContentFileScanner;

  /**
   * @param deps - Database, editor and activity facts.
   */
  constructor(private readonly deps: ContentDuplicatorDeps) {
    this.scanner = new ContentFileScanner(deps.editor.libraryManager);
  }

  /**
   * Copies an activity as it is stored («Lag ein kopi»).
   * @param sourceId - The activity to copy (untrusted: from the request).
   * @param actor - The person copying; the copy is theirs.
   * @returns The new activity and the route that allowed it.
   * @throws HttpError 404 `hvl:activity-unavailable`, 403 `hvl:duplicate-not-allowed`, 500 `hvl:duplicate-failed`;
   *   an editor refusal (4xx H5pError) raised before anything was written.
   * @spec PROD-007
   */
  async duplicate(sourceId: string, actor: HvlH5pActor): Promise<DuplicateResult> {
    return this.copy(await this.admit(sourceId, actor), 'duplicate', (source) => source);
  }

  /**
   * Saves an editor's parameters as a copy of the activity they were edited from («Lagre som ny versjon», D-093).
   * @param sourceId - The activity being edited (untrusted).
   * @param params - The edited parameters; `#tmp` uploads are saved with the copy.
   * @param metadata - The edited H5P metadata; a missing `defaultLanguage` or `language` is taken from the source.
   * @param actor - The person saving; the copy is theirs.
   * @param library - The editor's main library (`H5P.Name major.minor`); used when it is an installed minor version
   *   of the source's library, else the source's own version is kept.
   * @returns The new activity and the route that allowed it; the source is not changed.
   * @throws as {@link ContentDuplicator.duplicate}.
   * @example
   * // The copy route's body is `{ params, metadata }`, as H5P's editor gives them (`JSON.parse(content.params)`).
   * const { contentId } = await duplicator.saveAsCopy(id, req.body.params, req.body.metadata, actor);
   * @spec PROD-007
   */
  async saveAsCopy(
    sourceId: string,
    params: ContentParameters,
    metadata: IContentMetadata,
    actor: HvlH5pActor,
    library?: string,
  ): Promise<DuplicateResult> {
    return this.copy(await this.admit(sourceId, actor), 'save-as-copy', (source) => ({
      params,
      metadata: withSourceLanguages(metadata, source.metadata),
      ...(library === undefined ? {} : { editorLibrary: library }),
    }));
  }

  private async admit(sourceId: string, actor: HvlH5pActor): Promise<Admitted> {
    const user = asAccountUser(actor);
    const facts = await this.deps.access.factsFor(sourceId);
    const decision = decideDuplicate(user, facts);
    // SECURITY: one answer for unknown and invisible activities, so a refusal reveals nothing (D-066).
    if (!facts || decision.kind === 'unavailable') throw authError('hvl:activity-unavailable');
    if (decision.kind === 'refused') throw learningDesignError('hvl:duplicate-not-allowed');
    // SECURITY: every copy streams all the source's files; one person may start only so many (D-092 amendment).
    const limit = await this.deps.editor.copyLimit.take(actor.accountId);
    if (!limit.allowed) throw copyLimitedError(limit.retryAfterSeconds);
    const ids = { actorUserId: actor.accountId, sourceAuthorUserId: facts.ownerUserId };
    return { user, ...ids, sourceId: facts.contentId, via: decision.via };
  }

  private async copy(admitted: Admitted, kind: CopyKind, contentOf: CopyContent): Promise<DuplicateResult> {
    const { editor, db } = this.deps;
    const { user, sourceId, via } = admitted;
    const tools = { manager: editor.contentManager, scanner: this.scanner };
    const created: string[] = [];
    try {
      const source = await readCopySource(editor.contentManager, sourceId, user);
      const content = contentOf(source);
      const { library, ubername } = await chooseCopyLibrary(
        source,
        content.editorLibrary,
        editor.libraryManager,
      );
      const { params, metadata } = content;
      const plan = await planCopy(this.scanner, { params, library, sourceId, sourceFiles: source.files });
      const copyId = await trackContentCreations(created, () =>
        editor.saveOrUpdateContent(undefined, plan.params, metadata, ubername, user),
      );
      await copyOwnFiles(tools, { sourceId, copyId, library, names: plan.ownCopies, user });
      const defect = await findCopyDefect(tools, { copyId, library, user }, plan);
      if (defect) throw new Error(`the saved copy is incomplete: ${defect}`);
      await recordCopy(db, { ...admitted, copyId, kind });
      return { contentId: copyId, via };
    } catch (error) {
      await this.discard(created);
      if (created.length === 0 && isRefusal(error)) throw error;
      throw Object.assign(learningDesignError('hvl:duplicate-failed'), { cause: error });
    }
  }

  private async discard(created: readonly string[]): Promise<void> {
    for (const id of created) {
      // WHY: cleanup must not depend on the person's permissions, and its own failure must not hide the cause.
      await this.deps.editor.contentStorage.deleteContent(id).catch(() => undefined);
    }
  }
}
