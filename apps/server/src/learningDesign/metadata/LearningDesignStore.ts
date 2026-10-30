/**
 * LearningDesignStore — reads and replaces an activity's learning-design metadata, and answers the author's
 * questions about their courses: the course codes they use, the outcomes already used in a course, and the planner.
 *
 * Why: PED-030 tags each activity with phase, course code, outcomes, rationale, student minutes and (D-087) a
 *      learner purpose; PED-031 plans one course from those tags (D-088). One service per app (studioServices) holds
 *      the database rules, so the routes only check who asks.
 * Spec: PED-030, PED-031
 * Invariants:
 *   - The caller has already decided that the person may Edit the activity (`read`, `replace`) or is a portal author
 *     (the course questions); nothing here checks permissions.
 *   - `replace` is a full replace guarded by the `updatedAt` read (null: no row yet): a stale or concurrent write
 *     answers 409 `hvl:learning-design-conflict` and changes nothing. It keeps the stored `patternId`, which only
 *     creation and duplication write (D-087), and stores the outcomes in the order sent.
 *   - Every successful `replace` gives a later `updatedAt` than the one it replaced, so a precondition never matches
 *     twice, even within one millisecond.
 *   - Building contacts nothing; the service holds no resource, so it has no `close()`.
 * Collaborators: ./learningDesignRecord.ts, ./authorCourses.ts, ./plannerSource.ts, ./plannerGrid.ts,
 *   ../../http/learningDesignErrors.ts, ../../server/studioServices.ts (builds it), ../http/learningDesignRoutes.ts.
 * Tests: apps/server/test/learningDesign/metadata/learningDesignRoutes.int.test.ts,
 *   apps/server/test/learningDesign/metadata/learningDesignReplace.int.test.ts,
 *   apps/server/test/learningDesign/metadata/plannerRoutes.int.test.ts
 */
import type {
  CourseCode,
  CourseCodeSuggestions,
  CourseOutcomes,
  LearningDesign,
  LearningDesignUpdate,
  PhaseKey,
  Planner,
} from '@hvl-interaktiv/api-contract';
import { authError } from '../../http/authErrors.js';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import type { Database } from '../../infra/prismaClient.js';
import { courseCodeSuggestions, courseOutcomes } from './authorCourses.js';
import { STORED_LEARNING_DESIGN, storedCategory, toLearningDesign } from './learningDesignRecord.js';
import { buildPlanner } from './plannerGrid.js';
import { plannerActivities } from './plannerSource.js';

/** What the store is built from. */
export interface LearningDesignStoreDeps {
  readonly db: Database;
  /** Every phase key once, in content order (`content.phases`), for the planner's columns (D-088). */
  readonly phases: readonly PhaseKey[];
}

const prismaCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;

/** Reads and replaces learning-design metadata, and answers questions about an author's courses. */
export class LearningDesignStore {
  /**
   * @param deps - The database and the phase order.
   */
  constructor(private readonly deps: LearningDesignStoreDeps) {}

  /**
   * An activity's metadata.
   * @param contentId - The canonical activity ID; the caller has checked Edit.
   * @returns The metadata, or the empty metadata (`updatedAt: null`) when none is stored.
   * @spec PED-030
   */
  async read(contentId: string): Promise<LearningDesign> {
    const row = await this.deps.db.learningDesignMetadata.findUnique({
      where: { contentId },
      select: STORED_LEARNING_DESIGN,
    });
    return toLearningDesign(row);
  }

  /**
   * Replaces an activity's metadata if it is still as of `update.updatedAt`.
   * @param contentId - The canonical activity ID; the caller has checked Edit.
   * @param update - The checked body: every editable field and the `updatedAt` read.
   * @param now - The current moment; the new `updatedAt` is never earlier than one millisecond after the old.
   * @returns The stored metadata.
   * @throws HttpError 409 `hvl:learning-design-conflict` when the metadata changed since `updatedAt` (or a row
   *   appeared when it was null); 404 `hvl:activity-unavailable` when the activity was deleted meanwhile.
   * @spec PED-030
   */
  async replace(
    contentId: string,
    update: LearningDesignUpdate,
    now: Date = new Date(),
  ): Promise<LearningDesign> {
    const fields = {
      phase: update.phase ?? null,
      courseCode: update.courseCode ?? null,
      rationale: update.rationale ?? null,
      estimatedStudentMinutes: update.estimatedStudentMinutes ?? null,
      learnerPurpose: update.learnerPurpose ?? null,
    };
    const outcomes = update.outcomes.map(({ text, category }, position) => ({
      text,
      category: storedCategory(category),
      position,
    }));
    const { updatedAt } = update;
    try {
      const row = await this.deps.db.$transaction(async (tx) => {
        if (updatedAt === null) {
          return tx.learningDesignMetadata.create({
            data: { contentId, ...fields, updatedAt: now, outcomes: { create: outcomes } },
            select: STORED_LEARNING_DESIGN,
          });
        }
        const read = new Date(updatedAt);
        // WHY: a conditional update; a concurrent writer that got there first changed `updatedAt`, so this matches
        // nothing (PostgreSQL re-checks the condition on the row it waited for).
        const { count } = await tx.learningDesignMetadata.updateMany({
          where: { contentId, updatedAt: read },
          data: { ...fields, updatedAt: new Date(Math.max(now.getTime(), read.getTime() + 1)) },
        });
        if (count === 0) throw learningDesignError('hvl:learning-design-conflict');
        await tx.learningOutcome.deleteMany({ where: { metadataContentId: contentId } });
        await tx.learningOutcome.createMany({
          data: outcomes.map((outcome) => ({ ...outcome, metadataContentId: contentId })),
        });
        return tx.learningDesignMetadata.findUniqueOrThrow({
          where: { contentId },
          select: STORED_LEARNING_DESIGN,
        });
      });
      return toLearningDesign(row);
    } catch (error) {
      // WHY: P2002, a row was stored after the author read none; P2003, the activity was deleted meanwhile.
      if (prismaCode(error) === 'P2002') throw learningDesignError('hvl:learning-design-conflict');
      if (prismaCode(error) === 'P2003') throw authError('hvl:activity-unavailable');
      throw error;
    }
  }

  /**
   * The author's course codes: in their activities' metadata, and from their Canvas placements.
   * @param userId - The author's `User.id`.
   * @returns Both lists, sorted, without repeats.
   * @spec PED-030
   */
  courseCodes(userId: string): Promise<CourseCodeSuggestions> {
    return courseCodeSuggestions(this.deps.db, userId);
  }

  /**
   * The outcomes the author's activities already use for a course code.
   * @param userId - The author's `User.id`.
   * @param courseCode - A normalised course code.
   * @returns The distinct outcomes, by category and then text.
   * @spec PED-030
   */
  courseOutcomes(userId: string, courseCode: CourseCode): Promise<CourseOutcomes> {
    return courseOutcomes(this.deps.db, userId, courseCode);
  }

  /**
   * The alignment planner of one course for an author.
   * @param userId - The author's `User.id`.
   * @param courseCode - A normalised course code.
   * @returns The grid, the gaps and the untagged activities (D-088).
   * @spec PED-031
   */
  async planner(userId: string, courseCode: CourseCode): Promise<Planner> {
    const activities = await plannerActivities(this.deps.db, userId, courseCode);
    return buildPlanner(courseCode, this.deps.phases, activities);
  }
}
