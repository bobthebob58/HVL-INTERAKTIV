/**
 * Table-driven test of the H5P-006 matrix for general (role) permissions and temporary editor files, through
 * HvlPermissionSystem: every role x view x permission (x file name for temporary files), plus values that
 * are not in Lumi's enums. Neither kind of check may read content facts or write the audit log.
 *
 * Spec: H5P-006
 */
import { describe, expect, it } from 'vitest';
import { GeneralPermission, TemporaryFilePermission } from '@lumieducation/h5p-server';
import { HvlPermissionSystem } from '../../../src/h5p/HvlPermissionSystem.js';
import {
  asAccountUser,
  asStateUser,
  type H5pRole,
  type H5pUserView,
  type HvlH5pActor,
} from '../../../src/h5p/HvlH5pUser.js';
import { decideGeneral, decideTemporaryFile } from '../../../src/h5p/permissions/contentRules.js';
import { numeric, product, ROLES, VIEWS } from './matrixDimensions.js';

/** An actor who reaches everything else: HVL member, Feide login, an LTI launch, a data-subject request. */
const actorFor = (role: H5pRole): HvlH5pActor => ({
  accountId: '0192f0c4-0000-7000-8000-000000000001',
  role,
  learnerKey: 'my-learner-key',
  contextId: 'course-1',
  locale: 'nn',
  hvlMember: true,
  feideAuthenticated: true,
  ltiLaunchContentIds: ['0192f0c4-0000-7000-8000-00000000c001'],
  dataSubjectRequest: { requestId: 'DSR-2026-0001', learnerKey: 'named-learner-key' },
});
const userFor = (role: H5pRole, view: H5pUserView) =>
  (view === 'account' ? asAccountUser : asStateUser)(actorFor(role));

/** A system whose repository and auditor fail the test if they are ever used. */
function systemWithoutIo(): HvlPermissionSystem {
  const touched = (what: string) => async (): Promise<never> => {
    throw new Error(`${what} must not be used for this check`);
  };
  return new HvlPermissionSystem({
    content: { factsFor: touched('the content repository') },
    auditor: { recordDataSubjectAccess: touched('the auditor') },
  });
}

describe('[H5P-006] general permissions: every cell (admin only, account view)', () => {
  const rows = product({ role: ROLES, view: VIEWS, permission: numeric(GeneralPermission) }).map((c) => ({
    ...c,
    name: GeneralPermission[c.permission],
    allowed: c.role === 'admin' && c.view === 'account',
  }));

  it('[H5P-006] the table covers all three general permissions for every role and view', () => {
    expect(new Set(rows.map((r) => r.permission))).toEqual(
      new Set([
        GeneralPermission.InstallRecommended,
        GeneralPermission.UpdateAndInstallLibraries,
        GeneralPermission.CreateRestricted,
      ]),
    );
    expect(rows).toHaveLength(3 * 2 * 3);
  });

  it.each(rows)(
    '[H5P-006] $role ($view view) $name -> $allowed',
    async ({ role, view, permission, allowed }) => {
      expect(await systemWithoutIo().checkForGeneralAction(userFor(role, view), permission)).toBe(allowed);
      expect(decideGeneral(userFor(role, view), permission)).toBe(allowed);
    },
  );

  it.each(product({ role: ROLES, view: VIEWS }))(
    '[H5P-006] $role ($view view) is denied general permissions outside the enum',
    async ({ role, view }) => {
      for (const value of [-1, 3, 99, Number.NaN, '0', null]) {
        const permission = value as unknown as GeneralPermission;
        expect(await systemWithoutIo().checkForGeneralAction(userFor(role, view), permission)).toBe(false);
      }
    },
  );
});

describe('[H5P-006] temporary-file permissions: every cell (author or admin, account view)', () => {
  const rows = product({
    role: ROLES,
    view: VIEWS,
    permission: numeric(TemporaryFilePermission),
    filename: [undefined, 'images/photo.png', '../0192f0c4-other-user/images/photo.png'],
  }).map((c) => ({
    ...c,
    name: TemporaryFilePermission[c.permission],
    allowed: c.role !== 'learner' && c.view === 'account',
  }));

  it('[H5P-006] the table covers all four temporary-file permissions for every role and view', () => {
    expect(new Set(rows.map((r) => r.name))).toEqual(new Set(['Create', 'Delete', 'List', 'View']));
    expect(rows).toHaveLength(3 * 2 * 4 * 3);
  });

  it.each(rows)(
    '[H5P-006] $role ($view view) $name on file $filename -> $allowed',
    async ({ role, view, permission, filename, allowed }) => {
      const user = userFor(role, view);
      expect(await systemWithoutIo().checkForTemporaryFile(user, permission, filename)).toBe(allowed);
      expect(decideTemporaryFile(user, permission)).toBe(allowed);
    },
  );

  it.each(product({ role: ROLES, view: VIEWS }))(
    '[H5P-006] $role ($view view) is denied temporary-file permissions outside the enum',
    async ({ role, view }) => {
      for (const value of [-1, 4, 99, Number.NaN, '0', null]) {
        const permission = value as unknown as TemporaryFilePermission;
        expect(await systemWithoutIo().checkForTemporaryFile(userFor(role, view), permission, 'a.png')).toBe(
          false,
        );
      }
    },
  );
});
