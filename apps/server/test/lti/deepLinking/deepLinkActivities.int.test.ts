/**
 * Integration tests for what the Deep Linking picker lists and accepts.
 *
 * Spec: LTI-005, PROD-005, PROD-004
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isAuthError } from '../../../src/http/authErrors.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { chosenActivities, listPickerActivities } from '../../../src/lti/deepLinking/deepLinkActivities.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

describeWithServices('[LTI-005] Deep Linking picker activities', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  let author: string;
  let ids: { own: string; draft: string; coAuthored: string; foreign: string };

  beforeAll(async () => {
    author = (await db.user.create({ data: { kind: 'staff' } })).id;
    const colleague = (await db.user.create({ data: { kind: 'staff' } })).id;
    const make = (title: string, ownerUserId: string, status: 'draft' | 'published') =>
      db.h5PContent.create({
        data: { mainLibrary: 'H5P.Blanks', title, params: {}, metadata: {}, ownerUserId, status },
      });
    const own = await make('Eiga', author, 'published');
    const draft = await make('Utkast', author, 'draft');
    const coAuthored = await make('Saman', colleague, 'published');
    await db.contentCollaborator.create({ data: { contentId: coAuthored.id, userId: author } });
    const foreign = await make('Andre sitt', colleague, 'published');
    ids = { own: own.id, draft: draft.id, coAuthored: coAuthored.id, foreign: foreign.id };
  });
  afterAll(() => db.$disconnect());

  it("[PROD-005] lists own and co-authored activities, drafts not selectable, never a colleague's", async () => {
    // Act
    const listed = await listPickerActivities(db, author);
    // Assert
    expect(new Map(listed.map((a) => [a.id, a.selectable]))).toEqual(
      new Map([
        [ids.coAuthored, true],
        [ids.draft, false],
        [ids.own, true],
      ]),
    );
  });

  it('[LTI-005] accepts published own and co-authored choices in the order given', async () => {
    const chosen = await chosenActivities(db, author, [ids.coAuthored, ids.own, ids.own]);
    expect(chosen).toEqual([
      { id: ids.coAuthored, title: 'Saman' },
      { id: ids.own, title: 'Eiga' },
    ]);
  });

  it('[PROD-004] refuses a draft with 409, and a foreign, unknown or malformed ID as not available', async () => {
    // Arrange
    const refusal = async (contentIds: string[]) =>
      chosenActivities(db, author, contentIds).catch((e: unknown) => e);
    // Act and assert
    expect(isAuthError(await refusal([ids.own, ids.draft]), 'hvl:deep-link-draft')).toBe(true);
    for (const bad of [[ids.foreign], [crypto.randomUUID()], ['not-a-uuid'], []]) {
      expect(isAuthError(await refusal(bad), 'hvl:activity-unavailable'), JSON.stringify(bad)).toBe(true);
    }
  });
});
