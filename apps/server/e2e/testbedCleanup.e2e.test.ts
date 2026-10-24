/**
 * End-to-end test of the test beds' own cleanup on the shared database, with the mock Feide's demo author holding an
 * account from an earlier run (the state that left 3 000+ activities on the author's start page): a closed app test
 * bed removes its run author with their activity and notice dismissal, and every activity `activity` saved, also for
 * the surviving account; a closed real web app (../test/support/realWebApp.ts) leaves none of the activities it
 * imported, the draft a flow saved as its author, the teacher's imports, or any of their accounts.
 *
 * Spec: NFR-004
 */
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { identitySource } from '../src/auth/identity/subjectSources.js';
import { createPrismaClient, type Database } from '../src/infra/prismaClient.js';
import { IdentityHasher } from '../src/security/keys/IdentityHasher.js';
import { openAppTestbed } from '../test/support/appTestbed.js';
import { loginWithFeide } from '../test/support/feideTestbed.js';
import { saveImageWithoutAltDraft } from '../test/support/imageWithoutAltDraft.js';
import { openRealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { serviceEnv } from '../test/support/services.js';

/** The demo author's account, made (if missing) as an earlier run would have left it; `made` says who removes it. */
async function demoAuthorAccount(db: Database): Promise<{ userId: string; made: boolean }> {
  const source = identitySource({ kind: 'feide', feideId: 'author@hvl.no' });
  const { hash, keyId } = new IdentityHasher(serviceEnv().IDENTITY_HASH_KEYS).hash(
    'identity-subject',
    source,
  );
  const found = await db.identity.findFirst({ where: { provider: 'feide', subjectHash: hash } });
  if (found) return { userId: found.userId, made: false };
  const { id } = await db.user.create({
    data: {
      kind: 'staff',
      identities: { create: { provider: 'feide', subjectHash: hash, subjectKeyId: keyId } },
    },
  });
  return { userId: id, made: true };
}

describeWithRealWebApp('[NFR-004] test beds remove what they created', () => {
  let db: Database;
  let demo: { userId: string; made: boolean };
  let browser: Browser;
  beforeAll(async () => {
    db = createPrismaClient(serviceEnv().DATABASE_URL);
    demo = await demoAuthorAccount(db);
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
    if (demo?.made) await db.user.deleteMany({ where: { id: demo.userId } });
    await db?.$disconnect();
  });

  it('[NFR-004] an app test bed with a run author removes them, their activity and dismissal, and every saved activity', async () => {
    // Arrange: the run author signs in and gets an activity and a dismissal; the surviving demo account an activity
    const tb = await openAppTestbed(undefined, { runAuthor: true });
    await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'author');
    const author = await tb.feideAccount('author');
    const own = await tb.activity(author, { published: true });
    await db.noticeDismissal.create({
      data: { userId: author, noticeId: 'formative-use', noticeVersion: 1 },
    });
    const onDemo = await tb.activity(demo.userId);
    // Act
    await tb.close();
    // Assert
    expect(author).not.toBe(demo.userId);
    expect(await db.user.count({ where: { id: author } })).toBe(0);
    expect(await db.h5PContent.count({ where: { id: { in: [own, onDemo] } } })).toBe(0);
    expect(await db.noticeDismissal.count({ where: { userId: author } })).toBe(0);
    expect(await db.user.count({ where: { id: demo.userId } })).toBe(1);
  });

  it('[NFR-004] a closed real web app leaves none of its activities or accounts', async () => {
    // Arrange: the activities it imports, the teacher's two, and a draft a flow saves as the author
    const app = await openRealWebApp(browser);
    await app.deepLink();
    const flowDraft = await saveImageWithoutAltDraft(app.tb.runtime.editor, app.authorId, 'Utkast i flyten');
    const teachers = await db.identity.findMany({ where: { platformId: app.tb.platformId } });
    const users = [app.authorId, ...teachers.map((identity) => identity.userId)];
    const contents = [...app.ids.values(), app.draftId, flowDraft];
    const demoContentBefore = await db.h5PContent.count({ where: { ownerUserId: demo.userId } });
    // Act
    await app.close();
    // Assert
    expect(app.authorId).not.toBe(demo.userId);
    expect(teachers.length).toBeGreaterThan(0);
    expect(contents).toHaveLength(12);
    expect(await db.h5PContent.count({ where: { id: { in: contents } } })).toBe(0);
    expect(await db.h5PContent.count({ where: { ownerUserId: { in: users } } })).toBe(0);
    expect(await db.user.count({ where: { id: { in: users } } })).toBe(0);
    expect(await db.h5PContent.count({ where: { ownerUserId: demo.userId } })).toBe(demoContentBefore);
  }, 240_000);
});
