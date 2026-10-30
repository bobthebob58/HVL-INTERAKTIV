/**
 * PatternCreator — creates a draft activity from a pattern in one server request, with its learning-design
 * metadata, and tells other routes whether a pattern can be created at all.
 *
 * Why: PROD-001 opens the editor on a pedagogically sound skeleton. D-085 builds it on the server and saves it
 *      through HvlH5PEditor's save path, so the whitelist, the sub-content policy and the installed-library check
 *      run as for any save, and writes the metadata in the same request, so neither travels through the browser.
 * Spec: PROD-001, PED-010, PED-011, PED-030
 * Invariants:
 *   - Unknown pattern: 404 `error.notFound`. Wrong phase or content type: 400 `hvl:pattern-choice-invalid`. A library
 *     the completed skeleton names is not installed: 409 `hvl:pattern-unavailable`, checked before any row exists.
 *   - The save gets a copy of the parameters, the title, `license: 'U'`, and `defaultLanguage` and `language` set
 *     to the chosen language (D-084 amendment); the activity is a private draft of the person creating it.
 *   - The metadata row holds the phase, the pattern ID, the normalised course code (D-087) and the pattern's
 *     student minutes. If saving or writing it fails, every activity row the save created is removed (with its
 *     files), and the failure is passed on.
 *   - Availability is decided per request from the installed libraries (an admin may install one meanwhile). A
 *     skeleton that cannot be built for another reason is unavailable too, and logged once (./patternBuildFailures.ts,
 *     D-085 amendment 2026-10-29): `availability` never rejects for a build, so one bad library cannot fail a page.
 * Collaborators: ./patternChoice.ts, ./patternActivityBuild.ts, ./patternLibraries.ts,
 *   ../content/patternAccessors.ts, ../../h5p/HvlH5PEditor.ts, ../../h5p/storage/contentCreations.ts,
 *   ../../http/learningDesignErrors.ts; built in ../../server/studioServices.ts, used by ../http/patternRoutes.ts and,
 *   for `availability`, by ../http/studioContentRoutes.ts (through ../http/patternAvailabilityMemo.ts).
 * Tests: apps/server/test/learningDesign/patterns/patternCreation.int.test.ts,
 *   apps/server/test/learningDesign/patterns/patternCreationGuards.int.test.ts,
 *   apps/server/test/learningDesign/http/patternRoutes.int.test.ts
 */
import {
  courseCodeSchema,
  type AuthorableContentType,
  type PatternActivityRequest,
  type PatternActivityResponse,
} from '@hvl-interaktiv/api-contract';
import type { IContentMetadata } from '@lumieducation/h5p-server';
import type { HvlH5PEditor } from '../../h5p/HvlH5PEditor.js';
import { asAccountUser, type HvlH5pActor } from '../../h5p/HvlH5pUser.js';
import { trackContentCreations } from '../../h5p/storage/contentCreations.js';
import { HttpError } from '../../http/HttpError.js';
import { isLearningDesignError, learningDesignError } from '../../http/learningDesignErrors.js';
import type { Database } from '../../infra/prismaClient.js';
import { findPattern } from '../content/patternAccessors.js';
import type { PatternContent, StudioPattern, StudioPatternSkeleton } from '../content/patternContent.js';
import { buildPatternActivity, type PatternActivity } from './patternActivityBuild.js';
import { PatternBuildFailures, type PatternBuildLog } from './patternBuildFailures.js';
import { choosePatternOption } from './patternChoice.js';
import { MissingPatternLibraryError } from './patternLibraries.js';

/** What the creator works with; the server's single instances. */
export interface PatternCreatorDeps {
  readonly db: Database;
  /** The editor every save goes through (createH5pRuntime's `editor`). */
  readonly editor: Pick<HvlH5PEditor, 'saveOrUpdateContent' | 'libraryManager' | 'contentStorage'>;
  /** The patterns loaded at start-up (D-082). */
  readonly patterns: PatternContent;
  /** Where a skeleton that cannot be built is reported once (the server's logger); none writes nothing. */
  readonly log?: PatternBuildLog;
}

/** Whether a pattern can be created now, as a whole and per content type. */
export interface PatternAvailability {
  /** True when every content type of the pattern can be created (the catalogue's `available`). */
  readonly available: boolean;
  readonly contentTypes: readonly {
    readonly contentType: AuthorableContentType;
    readonly available: boolean;
  }[];
}

const unavailable = (cause: unknown) =>
  Object.assign(learningDesignError('hvl:pattern-unavailable'), { cause });

/** Creates activities from patterns. */
export class PatternCreator {
  private readonly buildFailures: PatternBuildFailures;

  /**
   * @param deps - Database, editor, the loaded patterns and the logger.
   */
  constructor(private readonly deps: PatternCreatorDeps) {
    this.buildFailures = new PatternBuildFailures(deps.log);
  }

  /**
   * Whether a pattern can be created with the libraries installed now.
   * @param patternId - The pattern's ID (untrusted).
   * @returns Its availability, or undefined for an unknown pattern.
   * @spec PROD-001
   */
  async availability(patternId: string): Promise<PatternAvailability | undefined> {
    const pattern = findPattern(this.deps.patterns, patternId);
    if (!pattern) return undefined;
    const contentTypes = await Promise.all(
      pattern.skeletons.map(async (skeleton) => ({
        contentType: skeleton.contentType,
        available: await this.build(pattern, skeleton, 'nn').then(
          () => (this.buildFailures.succeeded(pattern.id, skeleton.contentType), true),
          (error: unknown) => {
            // WHY: a library that is installed but unreadable makes only its patterns unavailable (D-085 amendment).
            if (!isLearningDesignError(error, 'hvl:pattern-unavailable'))
              this.buildFailures.failed(pattern.id, skeleton.contentType, error);
            return false;
          },
        ),
      })),
    );
    return { available: contentTypes.every((type) => type.available), contentTypes };
  }

  /**
   * Creates a private draft from a pattern, with its learning-design metadata.
   * @param patternId - The pattern's ID (untrusted, from the path).
   * @param request - The checked body: language, and optionally phase, course code and content type.
   * @param actor - The portal author creating it; the activity is theirs.
   * @returns The new activity's ID.
   * @throws HttpError 404 `error.notFound`, 400 `hvl:pattern-choice-invalid`, 409 `hvl:pattern-unavailable`; an
   *   editor refusal (4xx H5pError); the database's error when the metadata cannot be written (nothing remains).
   * @spec PROD-001
   */
  async create(
    patternId: string,
    request: PatternActivityRequest,
    actor: HvlH5pActor,
  ): Promise<PatternActivityResponse> {
    const pattern = findPattern(this.deps.patterns, patternId);
    if (!pattern) throw new HttpError(404, 'error.notFound');
    const { phase, skeleton } = choosePatternOption(pattern, request);
    const activity = await this.build(pattern, skeleton, request.language);
    const created: string[] = [];
    try {
      const contentId = await trackContentCreations(created, () =>
        this.save(activity, request.language, actor),
      );
      await this.deps.db.learningDesignMetadata.create({
        data: {
          contentId,
          phase,
          patternId: pattern.id,
          // PRIVACY: a course code, not personal data; normalised again in case a caller skipped the schema (D-087).
          courseCode: request.courseCode === undefined ? null : courseCodeSchema.parse(request.courseCode),
          estimatedStudentMinutes: pattern.studentMinutes,
        },
      });
      return { contentId };
    } catch (error) {
      await this.discard(created);
      throw error;
    }
  }

  private async build(
    pattern: StudioPattern,
    skeleton: StudioPatternSkeleton,
    language: PatternActivityRequest['language'],
  ): Promise<PatternActivity> {
    try {
      return await buildPatternActivity(pattern, skeleton, language, this.deps.editor.libraryManager);
    } catch (error) {
      if (error instanceof MissingPatternLibraryError) throw unavailable(error);
      throw error;
    }
  }

  private save(activity: PatternActivity, language: string, actor: HvlH5pActor): Promise<string> {
    // WHY: Lumi writes `language: 'en'` without these, and V-LANG would then treat a Nynorsk activity as English.
    const metadata = { title: activity.title, license: 'U', defaultLanguage: language, language };
    // WHY: a copy, because the save path changes the parameters in place (sub-content policy, Lumi's sanitiser).
    return this.deps.editor.saveOrUpdateContent(
      undefined,
      structuredClone(activity.params),
      metadata as IContentMetadata,
      activity.library,
      asAccountUser(actor),
    );
  }

  private async discard(created: readonly string[]): Promise<void> {
    for (const id of created) {
      // WHY: cleanup must not depend on the person's permissions, and its own failure must not hide the cause.
      await this.deps.editor.contentStorage.deleteContent(id).catch(() => undefined);
    }
  }
}
