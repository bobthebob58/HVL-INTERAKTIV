/**
 * Tests for HvlPermissionSystem as Lumi uses it: unknown users fail closed on all four methods, anything
 * outside the matrix is denied, data-subject access is audited before it is granted, and Lumi's own
 * ContentUserDataManager reaches own state only through the state view (D-036).
 *
 * Spec: H5P-006, DATA-007, DATA-008
 */
import { describe, expect, it } from 'vitest';
import {
  ContentPermission,
  ContentUserDataManager,
  GeneralPermission,
  TemporaryFilePermission,
  UserDataPermission,
  type IContentUserDataStorage,
  type IPermissionSystem,
} from '@lumieducation/h5p-server';
import { HvlPermissionSystem } from '../../src/h5p/HvlPermissionSystem.js';
import { asAccountUser, asStateUser } from '../../src/h5p/HvlH5pUser.js';
import type { H5pRole, HvlH5pActor, HvlH5pUser } from '../../src/h5p/HvlH5pUser.js';
import type { ContentFacts } from '../../src/h5p/permissions/ContentAccessRepository.js';
import type { DataSubjectAccess } from '../../src/h5p/permissions/UserDataAccessAuditor.js';
import { testActor } from '../support/testActors.js';

const CONTENT_ID = '0192f0c4-0000-7000-8000-00000000c001';
const ME = '0192f0c4-0000-7000-8000-000000000001';
const OWN_KEY = 'my-learner-key';
const NAMED_KEY = 'named-learner-key';
const REQUEST = { requestId: 'DSR-2026-0001', learnerKey: NAMED_KEY };
/** Published, shared with every Feide user and owned by the acting person: all but Embed is in reach. */
const FACTS: ContentFacts = {
  contentId: CONTENT_ID,
  ownerUserId: ME,
  coAuthorIds: [],
  status: 'published',
  visibility: 'feide',
  bankListed: false,
};
const { View, Edit, Embed, Create, List } = ContentPermission;
const { ViewState, DeleteState, EditFinished, ViewFinished, DeleteFinished } = UserDataPermission;

/** An actor who reaches everything: HVL member, Feide login, an LTI launch and a data-subject request. */
const actor = (role: H5pRole, extra: Partial<HvlH5pActor> = {}): HvlH5pActor =>
  testActor(role, {
    accountId: ME,
    learnerKey: OWN_KEY,
    contextId: 'course-1',
    ltiLaunchContentIds: [CONTENT_ID],
    dataSubjectRequest: REQUEST,
    ...extra,
  });
const account = (role: H5pRole) => asAccountUser(actor(role));
const state = (role: H5pRole) => asStateUser(actor(role));
const deleteRecord = (contentId: string | undefined): DataSubjectAccess => ({
  actorUserId: ME,
  request: REQUEST,
  contentId,
  permission: DeleteState,
});

/** A system over an in-memory repository that records lookups and audit records. */
function setup(auditor?: (access: DataSubjectAccess) => Promise<void>) {
  const lookups: string[] = [];
  const audited: DataSubjectAccess[] = [];
  const system = new HvlPermissionSystem({
    content: { factsFor: async (id) => (lookups.push(id), id === CONTENT_ID ? FACTS : undefined) },
    auditor: { recordDataSubjectAccess: auditor ?? (async (access) => void audited.push(access)) },
  });
  return { system, lookups, audited };
}

describe('[H5P-006] HvlPermissionSystem', () => {
  it('[H5P-006] denies an undefined, forged or copied user on all four methods without any I/O', async () => {
    const real = account('admin'); // Arrange
    const forged = [
      undefined,
      null,
      {},
      { id: ME, name: '', email: '', type: 'local' },
      { id: ME, name: '', email: '', type: 'local', actor: actor('admin'), view: 'account' },
      { ...real },
      Object.create(real),
    ] as unknown as (HvlH5pUser | undefined)[];
    const { system, lookups, audited } = setup();
    // Act and assert: every method refuses every such user, and nothing is looked up or audited.
    for (const user of forged) {
      expect(await system.checkForContent(user, View, CONTENT_ID)).toBe(false);
      expect(await system.checkForContent(user, Create, undefined)).toBe(false);
      expect(await system.checkForUserData(user, ViewState, CONTENT_ID, OWN_KEY)).toBe(false);
      expect(await system.checkForUserData(user, ViewState, CONTENT_ID, NAMED_KEY)).toBe(false);
      expect(await system.checkForTemporaryFile(user, TemporaryFilePermission.Create, undefined)).toBe(false);
      expect(await system.checkForGeneralAction(user, GeneralPermission.UpdateAndInstallLibraries)).toBe(
        false,
      );
    }
    expect(lookups).toEqual([]);
    expect(audited).toEqual([]);
  });

  it('[H5P-006] anything not in the matrix is denied', async () => {
    const { system: s, audited } = setup(); // Arrange
    const unknown = 99 as never;
    const blank = asStateUser(
      actor('admin', { learnerKey: '', dataSubjectRequest: { ...REQUEST, learnerKey: '' } }),
    );
    const content = (user: HvlH5pUser, p: ContentPermission) => () => s.checkForContent(user, p, CONTENT_ID);
    const data = (user: HvlH5pUser, p: UserDataPermission, whose?: string) => () =>
      s.checkForUserData(user, p, CONTENT_ID, whose);
    const denied: [string, () => Promise<boolean>][] = [
      ['Embed for the admin owner', content(account('admin'), Embed)],
      ['Embed for the author owner', content(account('author'), Embed)],
      ...[EditFinished, ViewFinished, DeleteFinished].flatMap((p): [string, () => Promise<boolean>][] => [
        [`own ${UserDataPermission[p]} (D-037)`, data(state('learner'), p, OWN_KEY)],
        [`${UserDataPermission[p]} by request`, data(state('admin'), p, NAMED_KEY)],
      ]),
      ['unknown content permission', content(account('admin'), unknown)],
      ['unknown user-data permission', data(state('admin'), unknown, OWN_KEY)],
      [
        'unknown temporary-file permission',
        () => s.checkForTemporaryFile(account('admin'), unknown, undefined),
      ],
      ['unknown general permission', () => s.checkForGeneralAction(account('admin'), unknown)],
      ...[0, 1, 2].map((p): [string, () => Promise<boolean>] => [
        `learner on ${GeneralPermission[p]}`,
        () => s.checkForGeneralAction(account('learner'), p),
      ]),
      ['state view on Edit, author owner', content(state('author'), Edit)],
      ['state view on Edit, admin', content(state('admin'), Edit)],
      ['account view on own state', data(account('learner'), ViewState, OWN_KEY)],
      ['account view, Lumi default ID', data(account('learner'), ViewState, ME)],
      ['an empty learner key', data(blank, DeleteState, '')],
      ['every learner, with a request', data(state('admin'), DeleteState)],
    ];
    for (const [label, run] of denied) expect(await run(), label).toBe(false); // Act and assert
    expect(audited).toEqual([]);
  });

  it('[DATA-007] records a granted data-subject access before it allows it', async () => {
    let release = (): void => undefined; // Arrange: an auditor that holds its record until released
    const recorded: DataSubjectAccess[] = [];
    const { system } = setup(
      (access) => new Promise<void>((resolve) => (release = () => (recorded.push(access), resolve()))),
    );
    let settled = false;
    // Act and assert: the check stays pending until the record is written, then grants.
    const check = system
      .checkForUserData(account('admin'), DeleteState, CONTENT_ID, NAMED_KEY)
      .finally(() => (settled = true));
    await new Promise((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    release();
    expect(await check).toBe(true);
    expect(recorded).toEqual([deleteRecord(CONTENT_ID)]);
  });

  it('[DATA-007] a failing audit write or content lookup rejects the check and grants nothing', async () => {
    const { system } = setup(async () => Promise.reject(new Error('audit down')));
    const check = system.checkForUserData(state('admin'), DeleteState, CONTENT_ID, NAMED_KEY);
    await expect(check).rejects.toThrow('audit down');
    const broken = new HvlPermissionSystem({
      content: { factsFor: async () => Promise.reject(new Error('database down')) },
      auditor: { recordDataSubjectAccess: async () => undefined },
    });
    await expect(broken.checkForContent(account('admin'), View, CONTENT_ID)).rejects.toThrow('database down');
  });

  it('[H5P-006] Create and List need no lookup; a missing or non-string content ID is unknown', async () => {
    const { system, lookups, audited } = setup(); // Arrange
    // Act and assert
    expect(await system.checkForContent(account('author'), Create, undefined)).toBe(true);
    expect(await system.checkForContent(account('author'), List, undefined)).toBe(true);
    for (const id of [undefined, 42, null, { id: CONTENT_ID }, [CONTENT_ID]] as unknown as string[]) {
      expect(await system.checkForContent(account('author'), View, id)).toBe(false);
      expect(await system.checkForUserData(state('learner'), ViewState, id, OWN_KEY)).toBe(false);
    }
    expect(lookups).toEqual([]);
    // WHY: Lumi's deleteAllContentUserDataByUser asks with no content ID; the request still names one learner.
    expect(await system.checkForUserData(state('admin'), DeleteState, undefined, NAMED_KEY)).toBe(true);
    expect(audited).toEqual([deleteRecord(undefined)]);
  });

  it("[H5P-006] through Lumi's ContentUserDataManager only the state view resumes own state", async () => {
    const { system, audited } = setup(); // Arrange
    const stored = { dataType: 'state', subContentId: '0', userState: '{"page":2}', contentId: CONTENT_ID };
    const storage = { getContentUserData: async () => stored } as unknown as IContentUserDataStorage;
    // WHY: Lumi's constructors take IPermissionSystem<IUser>; the factories pass ours typed like this.
    const manager = new ContentUserDataManager(storage, system as IPermissionSystem<HvlH5pUser>);
    const read = (user: HvlH5pUser, asUserId?: string) =>
      manager.getContentUserData(CONTENT_ID, 'state', '0', user, 'course-1', asUserId);
    // Act and assert: own state through the state view, another learner's only by an audited request.
    expect(await read(state('learner'))).toEqual(stored);
    await expect(read(account('learner'))).rejects.toMatchObject({ httpStatusCode: 403 });
    await expect(read(state('author'), NAMED_KEY)).rejects.toMatchObject({ httpStatusCode: 403 });
    expect(audited).toEqual([]);
    expect(await read(state('admin'), NAMED_KEY)).toEqual(stored);
    expect(audited).toHaveLength(1);
  });
});
