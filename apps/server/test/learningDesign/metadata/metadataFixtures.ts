/**
 * metadataFixtures — stores learning-design metadata for a test activity directly in the database, and the callers
 * of the learning-design permission matrices.
 *
 * Why: the planner, the course questions and the learner info read metadata that pattern creation, duplication or a
 *      PUT wrote. Writing rows directly lets a test set every field (also `patternId`, which no route edits, and
 *      values outside the limits) without a route under test in between.
 * Spec: PED-030, PED-031, PED-032
 * Invariants:
 *   - Rows belong to activities the API testbed created, so its `close()` removes them with the activities.
 * Collaborators: ../../support/apiTestbed.ts, ../../../src/learningDesign/metadata/learningDesignRecord.ts.
 * Tests: used by the tests in this folder.
 */
import type { LearningOutcome, PhaseKey } from '@hvl-interaktiv/api-contract';
import type { Principal, Role } from '../../../src/auth/Principal.js';
import type { Database } from '../../../src/infra/prismaClient.js';
import { storedCategory } from '../../../src/learningDesign/metadata/learningDesignRecord.js';

/** What a test activity's metadata holds; every field optional. */
export interface MetadataFixture {
  readonly phase?: PhaseKey;
  readonly courseCode?: string;
  readonly outcomes?: readonly LearningOutcome[];
  readonly rationale?: string;
  readonly estimatedStudentMinutes?: number;
  readonly learnerPurpose?: string;
  readonly patternId?: string;
}

/**
 * Stores metadata for an activity, replacing none (the activity must have no row yet).
 * @param db - The test database.
 * @param contentId - The activity.
 * @param fixture - The fields to store.
 * @returns The stored row's `updatedAt`, as the API sends it.
 */
export async function storeMetadata(
  db: Database,
  contentId: string,
  fixture: MetadataFixture,
): Promise<string> {
  const { outcomes = [], ...fields } = fixture;
  const row = await db.learningDesignMetadata.create({
    data: {
      contentId,
      ...fields,
      outcomes: {
        create: outcomes.map(({ text, category }, position) => ({
          text,
          category: storedCategory(category),
          position,
        })),
      },
    },
    select: { updatedAt: true },
  });
  return row.updatedAt.toISOString();
}

/** A Canvas launch's facts, for an LTI principal. */
export const LTI_LAUNCH: Principal['lti'] = {
  platformId: '00000000-0000-4000-8000-000000000001',
  deploymentId: 'deployment-1',
  contextId: 'course-1',
  messageType: 'LtiResourceLinkRequest',
};

/** One caller of a portal-only studio route: how the testbed makes them. */
export interface StudioCaller {
  readonly who: string;
  readonly role?: Role;
  readonly overrides?: Partial<Principal>;
}

/** Who is refused before any course question is answered, and with what (D-089, D-090 amendment). */
export const REFUSED_CALLERS: readonly (StudioCaller & {
  readonly status: number;
  readonly errorCode: string;
})[] = [
  { who: 'nobody signed in', status: 401, errorCode: 'hvl:unauthenticated' },
  {
    who: 'an author launched from Canvas (ltik)',
    role: 'author',
    overrides: { mode: 'lti', hvlMember: false, feideAuthenticated: false, lti: LTI_LAUNCH },
    status: 401,
    errorCode: 'hvl:unauthenticated',
  },
  { who: 'a portal learner', role: 'learner', status: 403, errorCode: 'error.forbidden' },
];
