/**
 * UserDataAccessAuditor — writes an audit event each time an admin is granted another learner's H5P state.
 *
 * Why: the H5P-006 matrix allows access to someone else's state only for data-subject requests, and only
 *      audit-logged (DATA-007, DATA-008). The permission system records the grant before it returns true.
 * Spec: H5P-006, DATA-007, DATA-008
 * Invariants:
 *   - One `AuditEvent` per granted check; denials are never recorded here.
 *   - The event names the learner by learnerKey (a pseudonym) only; details hold IDs and the permission name,
 *     no free-text personal data (DATA-007).
 *   - A failed write rejects, so the permission check rejects too and no state is released unaudited.
 * Collaborators: ../HvlPermissionSystem.ts (the caller), ../../infra/prismaClient.ts, ../HvlH5pUser.ts.
 * Tests: apps/server/test/h5p/permissions/HvlPermissionSystem.int.test.ts,
 *   apps/server/test/h5p/permissions/userDataMatrix.test.ts, apps/server/test/h5p/HvlPermissionSystem.test.ts
 */
import { UserDataPermission } from '@lumieducation/h5p-server';
import type { Database } from '../../infra/prismaClient.js';
import type { DataSubjectRequest } from '../HvlH5pUser.js';

/** The `AuditEvent.action` of a granted data-subject access to H5P state. */
export const DATA_SUBJECT_ACCESS_ACTION = 'h5p.userData.dataSubjectAccess';

/** One granted access by an admin to another learner's H5P state. */
export interface DataSubjectAccess {
  /** `User.id` of the admin. */
  readonly actorUserId: string;
  /** The open request that names the learner. */
  readonly request: DataSubjectRequest;
  /** The activity whose state is accessed; `undefined` when Lumi asks about all activities. */
  readonly contentId: string | undefined;
  /** What the admin was granted. */
  readonly permission: UserDataPermission;
}

/** Records granted data-subject accesses. */
export interface UserDataAccessAuditor {
  /**
   * Records one granted access; must complete before the state is released.
   * @param access - Who accessed whose state, for which request and activity.
   * @returns Resolves when the record is stored; rejects when it could not be stored.
   */
  recordDataSubjectAccess(access: DataSubjectAccess): Promise<void>;
}

/** `UserDataAccessAuditor` writing to the `AuditEvent` table. */
export class PrismaUserDataAccessAuditor implements UserDataAccessAuditor {
  /**
   * @param db - The server's Prisma client; the caller owns and disconnects it.
   */
  constructor(private readonly db: Database) {}

  /**
   * Writes one `AuditEvent` for a granted data-subject access.
   * @param access - Who accessed whose state, for which request and activity.
   * @returns Resolves when the row is stored.
   */
  async recordDataSubjectAccess(access: DataSubjectAccess): Promise<void> {
    await this.db.auditEvent.create({
      data: {
        actorUserId: access.actorUserId,
        action: DATA_SUBJECT_ACCESS_ACTION,
        targetType: 'learner',
        // PRIVACY: the learnerKey is the pseudonym (DATA-002); no raw or internal learner ID is stored.
        targetId: access.request.learnerKey,
        details: {
          requestId: access.request.requestId,
          contentId: access.contentId ?? null,
          permission: UserDataPermission[access.permission] ?? String(access.permission),
        },
      },
    });
  }
}
