/**
 * gradeDbFixture — the database rows the grade enqueuer and the subject cleanup are tested on: a staff owner, an
 * activity, a platform row and graded placements, plus learner principals launched into them; removed again by
 * `close`.
 *
 * Why: the enqueuer (LTI-012, D-104) reads a placement by `(platformId, contextId, resourceLinkId)` and writes
 *      `GradeSyncJob` rows; neither needs a running app or a mock Canvas, so these tests use rows alone.
 * Spec: LTI-012, DATA-002
 * Invariants:
 *   - The platform row has no decryptable key and a URL of this run (`https://test-grades-…`), and `close` deletes
 *     it, so `getPlatforms()` elsewhere never meets it; its placements and jobs cascade with it.
 *   - Learner keys and subjects are unique per call, so runs never share a job.
 * Collaborators: ../../support/services.ts, ../../../src/auth/Principal.ts.
 * Tests: apps/server/test/grades/gradeJobEnqueuer.int.test.ts, apps/server/test/grades/gradeSubjectCleanup.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import { sealPrincipal, type Principal, type Role } from '../../../src/auth/Principal.js';
import type { GradableRow } from '../../../src/grades/GradeJobEnqueuer.js';
import { createPrismaClient, type Database } from '../../../src/infra/prismaClient.js';
import { serviceEnv, uniqueName } from '../../support/services.js';

/** The view part of the attempt IDs the tests use (`<viewId>:<n>`, D-115). */
export const VIEW_ID = '7d3c2b1a-0f9e-4d8c-b7a6-958473625140';

/**
 * A stored gradable root result, as the xAPI ingestion hands it to the enqueuer: MultiChoice's root `answered` with a
 * score of 3 of 4 (D-115's table).
 * @param contentId - The activity.
 * @param overrides - Fields to change, e.g. `attemptId`, `scaled`, `timestamp`.
 * @returns The row's fields that the enqueuer reads.
 */
export const gradableRow = (contentId: string, overrides: Partial<GradableRow> = {}): GradableRow => ({
  contentId,
  subContentId: null,
  verb: 'answered',
  scoreMax: 4,
  scaled: 0.75,
  attemptId: `${VIEW_ID}:1`,
  timestamp: new Date('2026-10-30T10:00:00.000Z'),
  academicYear: 2026,
  ...overrides,
});

/** A placement made by the fixture. */
export interface FixturePlacement {
  readonly id: string;
  readonly platformId: string;
  readonly contextId: string;
  readonly resourceLinkId: string;
  readonly contentId: string;
}

/** The fixture's rows and helpers. */
export interface GradeDbFixture {
  readonly db: Database;
  readonly platformId: string;
  readonly contentId: string;
  /** A placement of the activity; graded (with a line item) unless `lineItemUrl` is null. */
  placement(lineItemUrl?: string | null): Promise<FixturePlacement>;
  /** A principal launched into a placement, with its own learner key. */
  principal(placement: FixturePlacement, roles?: readonly Role[]): Principal;
  close(): Promise<void>;
}

/**
 * Creates the rows.
 * @returns The fixture.
 */
export async function openGradeDbFixture(): Promise<GradeDbFixture> {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const owner = await db.user.create({ data: { kind: 'staff' } });
  const content = await db.h5PContent.create({
    data: { mainLibrary: 'H5P.MultiChoice', title: 'Quiz', params: {}, metadata: {}, ownerUserId: owner.id },
  });
  const url = `https://${uniqueName('grades')}.example`;
  const platform = await db.ltiPlatform.create({
    data: {
      url,
      clientId: '1',
      name: 'Canvas',
      authenticationEndpoint: 'https://sso.example/auth',
      accessTokenEndpoint: 'https://sso.example/token',
      idTokenValidationMethod: 'JWK_SET',
      idTokenValidationKey: 'https://sso.example/jwks',
      publicKey: 'p',
      privateKeyEncrypted: Buffer.from([1]),
    },
  });
  return {
    db,
    platformId: platform.id,
    contentId: content.id,
    placement: async (
      lineItemUrl = `https://canvas.example/api/lti/courses/1/line_items/${randomUUID()}`,
    ) => {
      const row = await db.ltiPlacement.create({
        data: {
          platformId: platform.id,
          contextId: uniqueName('course'),
          resourceLinkId: uniqueName('link'),
          contentId: content.id,
          lineItemUrl,
        },
      });
      return row;
    },
    principal: (placement, roles = ['learner']) =>
      sealPrincipal({
        userId: randomUUID(),
        learnerKey: uniqueName('learner'),
        roles,
        mode: 'lti',
        locale: 'nn',
        hvlMember: false,
        feideAuthenticated: false,
        studentAuthor: false,
        lti: {
          platformId: placement.platformId,
          deploymentId: '1',
          contextId: placement.contextId,
          resourceLinkId: placement.resourceLinkId,
          contentId: placement.contentId,
          messageType: 'LtiResourceLinkRequest',
        },
      }),
    close: async () => {
      await db.ltiPlatform.deleteMany({ where: { url } });
      await db.h5PContent.deleteMany({ where: { id: content.id } });
      await db.user.deleteMany({ where: { id: owner.id } });
      await db.$disconnect();
    },
  };
}
