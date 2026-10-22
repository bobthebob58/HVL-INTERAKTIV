/**
 * learnerStateFixtures — activities, real pseudonyms and save/load shortcuts for the learner-state tests.
 *
 * Why: the learner-state integration tests live in two files (one per theme, 200-line limit). Both need an
 *      author and activities to hang state on, realistic learnerKeys, short save and load helpers, and a
 *      cleanup that removes every row they created.
 * Spec: H5P-005
 * Tests: used by test/h5p/PrismaContentUserDataStorage.int.test.ts and
 *   test/h5p/PrismaContentUserDataStorage.cleanup.int.test.ts.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import type { IContentUserData, IUser } from '@lumieducation/h5p-server';
import { PrismaContentUserDataStorage } from '../../src/h5p/storage/PrismaContentUserDataStorage.js';
import { createPrismaClient, type Database } from '../../src/infra/prismaClient.js';
import { deriveLearnerKey } from '../../src/privacy/deriveLearnerKey.js';
import { serviceEnv } from './services.js';

// WHY: a per-run secret and a fixed date give real 43-character learnerKeys without depending on which
// academic years the environment's PSEUDONYM_SECRETS happens to cover.
const SECRETS = new Map([[2026, randomBytes(32)]]);
const AT = new Date('2026-10-22T12:00:00Z');

/** The LTI issuer of the test learners (HVL's Canvas). */
export const ISSUER = 'https://hvl.instructure.com';

/** A sub-content ID as H5P generates it (a UUID). */
export const SUB_A = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

/** Another sub-content ID that sorts after `SUB_A`. */
export const SUB_B = 'f0e1d2c3-b4a5-4968-8776-5e4d3c2b1a09';

/**
 * Derives a real learnerKey, as the LTI launch will (S3).
 * @param subject - The LTI `sub` of a test learner.
 * @returns The 43-character pseudonym.
 */
export const learnerKeyOf = (subject: string): string =>
  deriveLearnerKey({ kind: 'lti', issuer: ISSUER, subject }, SECRETS, AT);

/**
 * A learnerKey for a fresh, random learner.
 * @returns The pseudonym.
 */
export const newLearner = (): string => learnerKeyOf(randomUUID());

/**
 * The state view Lumi passes for a learner (D-036).
 * @param learnerKey - The pseudonym.
 * @returns A user whose `id` is the learnerKey, without name or e-mail.
 */
export const stateUser = (learnerKey: string): IUser => ({
  id: learnerKey,
  name: '',
  email: '',
  type: 'local',
});

/** A storage on the test database plus helpers that create activities and save or load state. */
export interface LearnerStateFixture {
  /** The test database. */
  db: Database;
  /** The adapter under test. */
  storage: PrismaContentUserDataStorage;
  /** Creates an activity owned by the fixture's author and returns its ID. */
  newContent(): Promise<string>;
  /** Saves the main state `{"page":1}` (preload, invalidate) of a learner, with `overrides` applied. */
  save(contentId: string, userId: string, overrides?: Partial<IContentUserData>): Promise<void>;
  /** Loads one "state" record; null when nothing is stored. */
  stateOf(
    contentId: string,
    learnerKey: string,
    contextId?: string,
    sub?: string,
  ): Promise<IContentUserData | null>;
  /** Deletes the activities (their state cascades) and the author, then disconnects. */
  close(): Promise<void>;
}

/**
 * Connects to the test database and creates an author for the fixture's activities.
 * @returns The fixture; call `close()` in `afterAll`.
 */
export async function openLearnerStateFixture(): Promise<LearnerStateFixture> {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const storage = new PrismaContentUserDataStorage(db);
  const ownerUserId = (await db.user.create({ data: { kind: 'staff' } })).id;
  const content = { mainLibrary: 'H5P.QuestionSet', title: 'Resume', params: {}, metadata: {}, ownerUserId };
  return {
    db,
    storage,
    newContent: async () => (await db.h5PContent.create({ data: content, select: { id: true } })).id,
    save: (contentId, userId, overrides = {}) =>
      storage.createOrUpdateContentUserData({
        ...{ contentId, userId, dataType: 'state', subContentId: '0', userState: '{"page":1}' },
        ...{ preload: true, invalidate: true, ...overrides },
      }),
    stateOf: async (contentId, learnerKey, contextId, sub = '0') =>
      (await storage.getContentUserData(
        contentId,
        'state',
        sub,
        learnerKey,
        contextId,
      )) as IContentUserData | null,
    close: async () => {
      await db.h5PContent.deleteMany({ where: { ownerUserId } });
      await db.user.delete({ where: { id: ownerUserId } });
      await db.$disconnect();
    },
  };
}
