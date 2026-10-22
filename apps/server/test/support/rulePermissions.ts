/**
 * rulePermissions — a test-only permission system whose answers each test sets, for isolated editor tests.
 *
 * Why: unit tests of the editor rules must control exactly what is allowed (for example "may view but not
 *      download") without a database. The production rules live in src/h5p/HvlPermissionSystem.ts and have
 *      their own table-driven tests; Lumi's allow-everything system is never used, not even in tests.
 * Spec: H5P-006
 * Tests: shared by apps/server/test/h5p/HvlH5PEditor*.test.ts.
 */
import {
  ContentPermission,
  GeneralPermission,
  TemporaryFilePermission,
  UserDataPermission,
  type IPermissionSystem,
} from '@lumieducation/h5p-server';
import { isHvlH5pUser, type HvlH5pUser } from '../../src/h5p/HvlH5pUser.js';

/** One permission check as the editor made it. */
export interface PermissionCall {
  kind: 'content' | 'userData' | 'temporaryFile' | 'general';
  permission: string;
  role: string | undefined;
}

/** Default answers: admins may do everything, authors everything but general actions, learners only View. */
const byRole = (user: HvlH5pUser | undefined, kind: PermissionCall['kind'], permission: string): boolean => {
  if (!isHvlH5pUser(user)) return false;
  if (user.actor.role === 'admin') return true;
  if (user.actor.role === 'author') return kind !== 'general';
  return kind === 'content' && permission === 'View';
};

/** A permission system for tests: role-based defaults, overridable per permission name. */
export class RulePermissions implements IPermissionSystem<HvlH5pUser> {
  /** Every check, in order. */
  readonly calls: PermissionCall[] = [];
  /** Overrides by permission name, e.g. `{ Download: false }`. */
  readonly overrides: Record<string, boolean> = {};

  private decide(user: HvlH5pUser | undefined, kind: PermissionCall['kind'], permission: string): boolean {
    this.calls.push({ kind, permission, role: isHvlH5pUser(user) ? user.actor.role : undefined });
    if (!isHvlH5pUser(user)) return false;
    return this.overrides[permission] ?? byRole(user, kind, permission);
  }

  async checkForContent(user: HvlH5pUser | undefined, permission: ContentPermission): Promise<boolean> {
    return this.decide(user, 'content', ContentPermission[permission]);
  }

  async checkForUserData(user: HvlH5pUser | undefined, permission: UserDataPermission): Promise<boolean> {
    return this.decide(user, 'userData', UserDataPermission[permission]);
  }

  async checkForTemporaryFile(
    user: HvlH5pUser | undefined,
    permission: TemporaryFilePermission,
  ): Promise<boolean> {
    return this.decide(user, 'temporaryFile', TemporaryFilePermission[permission]);
  }

  async checkForGeneralAction(user: HvlH5pUser | undefined, permission: GeneralPermission): Promise<boolean> {
    return this.decide(user, 'general', GeneralPermission[permission]);
  }
}
