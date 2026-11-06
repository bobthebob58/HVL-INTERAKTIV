/**
 * Integration tests of the editor's files on the app origin (`/h5p/editor-files/<grant>/…`), which stay there for now
 * (SPEC-DEVIATION: D-110): an editor grant opens its own activity's files with `SEC-004`'s headers and no session,
 * and nothing else; the player's grants open nothing on the app origin; the editor pages (Canvas and portal) point at
 * the app origin and their policy never names the files origin (D-110 amendment of 2026-11-05).
 *
 * Spec: SEC-004, H5P-007
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { filesOriginOf } from '../../src/config/filesOrigin.js';
import { GRANT_LIFETIME_SECONDS } from '../../src/h5p/contentFileGrants.js';
import { USER_FILE_CSP } from '../../src/security/ContentFileHeaders.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { onAppOrigin, signedPath, storeUserFiles, STORED } from '../support/filesOriginFixtures.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { integrationFromPage } from '../support/playerIntegration.js';
import { describeWithServices } from '../support/services.js';
import { PNG_1X1 } from '../support/uploadFixtures.js';

describeWithServices('[SEC-004] the editor’s files on the app origin', () => {
  let tb: AppTestbed;
  let contentId: string;
  let otherId: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    const owner = await tb.staffAccount();
    contentId = await tb.activity(owner);
    otherId = await tb.activity(owner);
    await storeUserFiles(tb, contentId);
    await storeUserFiles(tb, otherId);
  }, 60_000);
  afterAll(() => tb?.close());

  const editorPath = (file: string, inPath = contentId, at = new Date()) =>
    signedPath(tb.runtime.editorFileGrants, '/h5p/editor-files', contentId, file, inPath, at);

  it('[SEC-004] an editor grant opens its activity’s file with nosniff and the sandbox policy, without a session', async () => {
    // Act
    const image = await onAppOrigin(tb, editorPath(STORED.image));
    const svg = await onAppOrigin(tb, editorPath(STORED.svg));
    // Assert
    expect(image.status).toBe(200);
    expect(Buffer.compare(image.body as Buffer, PNG_1X1)).toBe(0);
    for (const res of [image, svg]) {
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBe(USER_FILE_CSP);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
    expect(svg.headers['content-disposition']).toMatch(/^attachment/);
  });

  it('[SEC-004] an editor grant opens no other activity’s file and expires; a player’s grant opens nothing here', async () => {
    // Arrange
    const expired = new Date(Date.now() - (GRANT_LIFETIME_SECONDS + 7200) * 1000);
    const player = signedPath(tb.runtime.fileGrants, '/h5p/editor-files', contentId, STORED.image);
    // Act and assert
    for (const path of [
      editorPath(STORED.image, otherId),
      editorPath(STORED.image, contentId, expired),
      player,
    ]) {
      expect((await onAppOrigin(tb, path)).status, path).toBe(403);
    }
    expect((await onAppOrigin(tb, editorPath('images/missing.png'))).status).toBe(404);
  });

  it('[SEC-004] the player’s path answers 404 on the app origin whatever the grant, also to a launched learner', async () => {
    // Arrange: a learner with a valid ltik for this very activity
    const published = await tb.activity(await tb.staffAccount(), { published: true });
    await storeUserFiles(tb, published);
    const { ltik } = await launchFromCanvas(tb.app, tb.mock.canvas, {
      user: CANVAS_USERS.student,
      custom: { contentId: published },
      resourceLinkId: `editor-files-${published}`,
    });
    const path = signedPath(tb.runtime.fileGrants, '/h5p/files', published, STORED.image);
    // Act
    const anonymous = await onAppOrigin(tb, path);
    const launched = await onAppOrigin(tb, path).set('Authorization', `Bearer ${ltik ?? ''}`);
    // Assert
    for (const res of [anonymous, launched]) {
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).not.toMatch(/^image\//);
    }
  });

  it('[SEC-004] the editor pages in Canvas and in the portal open saved files on the app origin, and their policy never names the files origin', async () => {
    // Arrange: a Canvas teacher who owns an activity with stored files
    const launch = async (id: string) =>
      (
        await launchFromCanvas(tb.app, tb.mock.canvas, {
          user: CANVAS_USERS.teacher,
          custom: { contentId: id },
          resourceLinkId: `editor-page-${id}`,
        })
      ).ltik ?? '';
    const first = await tb.activity(await tb.staffAccount(), { published: true });
    const { principal } = await tb.lti.resolveLtik(await launch(first));
    const owned = await tb.activity(principal.userId, { published: true });
    await storeUserFiles(tb, owned);
    const ltik = await launch(owned);
    // Act: the Canvas editor (/lti/edit) and the portal editor (/h5p/edit, here with the ltik as Bearer)
    const pages = [
      await request(tb.app).get(`/lti/edit?ltik=${encodeURIComponent(ltik)}`),
      await request(tb.app).get(`/h5p/edit/${owned}`).set('Authorization', `Bearer ${ltik}`),
    ];
    // Assert
    for (const page of pages) {
      expect(page.status).toBe(200);
      expect(String(page.headers['content-security-policy'])).not.toContain(filesOriginOf(tb.env));
      const integration = integrationFromPage<{ contents: Record<string, { contentUrl: string }> }>(
        page.text,
      );
      const contentUrl = integration?.contents[`cid-${owned}`]?.contentUrl ?? '';
      expect(contentUrl).toMatch(new RegExp(`^/h5p/editor-files/[\\w-]+\\.\\d+\\.[\\w-]{43}/${owned}$`));
      const file = await onAppOrigin(tb, `${contentUrl}/${STORED.image}`);
      expect(file.status).toBe(200);
      expect(Buffer.compare(file.body as Buffer, PNG_1X1)).toBe(0);
    }
  });
});
