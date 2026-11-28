/**
 * Integration tests of the editor's files on the whole app (`createApp`): an editor grant opens its own activity's
 * saved files, and an upload grant its owner's fresh uploads, on the files origin only, with `SEC-004`'s headers and no
 * session; each kind of grant opens nothing on another kind's path; the app origin answers 404 on all three paths;
 * and the editor page in Canvas points H5P at the files origin, in CORS mode (D-153).
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
import * as files from '../support/filesOriginFixtures.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { integrationFromPage } from '../support/playerIntegration.js';
import { describeWithServices } from '../support/services.js';
import { PNG_1X1 } from '../support/uploadFixtures.js';

const { onAppOrigin, onFilesOrigin, signedPath, STORED, UPLOADED } = files;
const [PLAYER, EDITOR, UPLOADS] = ['/h5p/files', '/h5p/editor-files', '/h5p/uploads'] as const;

describeWithServices('[SEC-004] the editor’s files on the files origin', () => {
  let tb: AppTestbed;
  let owner: string;
  let contentId: string;
  let otherId: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    owner = await tb.staffAccount();
    contentId = await tb.activity(owner);
    otherId = await tb.activity(owner);
    await files.storeUserFiles(tb, contentId);
    await files.storeUserFiles(tb, otherId);
    await files.storeUpload(tb, owner);
  }, 60_000);
  afterAll(() => tb?.close());

  const saved = (file: string = STORED.image, inPath = contentId, at = new Date()) =>
    signedPath(tb.runtime.editorFileGrants, EDITOR, contentId, file, inPath, at);
  const upload = (inPath = owner, at = new Date()) =>
    signedPath(tb.runtime.uploadGrants, UPLOADS, owner, UPLOADED, inPath, at);

  it('[SEC-004] an editor grant and an upload grant open their file on the files origin, with the user-file headers and no session', async () => {
    // Act
    const answers = [
      await onFilesOrigin(tb, saved()),
      await onFilesOrigin(tb, upload()).set('Cookie', '__Host-hvli_sid=not-read-here'),
      // SECURITY: another site's `Origin` is never echoed: the one origin allowed stays the app's.
      await onFilesOrigin(tb, saved(STORED.svg)).set('Origin', 'https://annan-stad.example'),
    ];
    // Assert
    for (const res of answers) {
      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBe(USER_FILE_CSP);
      // WHY: the picture tool reads a picture's pixels, which a browser allows only with this header (D-153).
      expect(res.headers['access-control-allow-origin']).toBe(tb.toolUrl);
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      expect(res.headers['cache-control']).toMatch(/^private, max-age=\d+$/);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
    expect(Buffer.compare(answers[0]?.body as Buffer, PNG_1X1)).toBe(0);
    expect(Buffer.compare(answers[1]?.body as Buffer, PNG_1X1)).toBe(0);
    expect(answers[2]?.headers['content-disposition']).toMatch(/^attachment/);
  });

  it('[SEC-004] the app origin answers 404 on every path of a grant-checked file, whatever the grant', async () => {
    // Arrange: the very URLs that open a file on the files origin, and the player's
    const player = signedPath(tb.runtime.fileGrants, PLAYER, contentId, STORED.image);
    // Act
    const answers = await Promise.all([saved(), upload(), player].map((path) => onAppOrigin(tb, path)));
    const others = await Promise.all([request(tb.app).head(saved()), request(tb.app).post(upload())]);
    // Assert
    for (const res of answers) {
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/^application\/json/);
    }
    expect(others.map((res) => res.status)).toEqual([404, 404]);
  });

  it('[SEC-004] a grant opens no other activity’s or account’s file, expires, and opens nothing on another kind’s path', async () => {
    // Arrange
    const expired = new Date(Date.now() - (GRANT_LIFETIME_SECONDS + 7200) * 1000);
    const { fileGrants, editorFileGrants, uploadGrants } = tb.runtime;
    const refused = [
      saved(STORED.image, otherId),
      saved(STORED.image, contentId, expired),
      upload(await tb.staffAccount()),
      upload(owner, expired),
      signedPath(fileGrants, EDITOR, contentId, STORED.image),
      signedPath(uploadGrants, EDITOR, contentId, STORED.image),
      signedPath(fileGrants, UPLOADS, owner, UPLOADED),
      signedPath(editorFileGrants, UPLOADS, owner, UPLOADED),
    ];
    // Act and assert
    for (const path of refused) {
      const res = await onFilesOrigin(tb, path);
      expect(res.status, path).toBe(403);
      expect(res.headers['content-security-policy']).toBe(USER_FILE_CSP);
    }
    expect((await onFilesOrigin(tb, saved('images/missing.png'))).status).toBe(404);
    expect((await onFilesOrigin(tb, upload().replace(UPLOADED, 'images/missing.png'))).status).toBe(404);
  });

  it('[SEC-004][NFR-006] both paths answer the app’s CORS preflight, and the request log holds neither grant nor account', async () => {
    // Act
    const preflights = await Promise.all(
      [saved(), upload()].map((path) =>
        request(tb.app)
          .options(path)
          .set('Host', files.filesHost(tb))
          .set('Origin', tb.toolUrl)
          .set('Access-Control-Request-Method', 'GET')
          .set('Access-Control-Request-Headers', 'range'),
      ),
    );
    const [asked, before] = [[saved(), upload()], tb.logs.length];
    for (const path of asked) await onFilesOrigin(tb, path);
    // Assert
    for (const res of preflights) {
      const { 'access-control-allow-methods': methods, 'access-control-allow-origin': origin } = res.headers;
      expect([res.status, methods, origin]).toEqual([204, 'GET, HEAD', tb.toolUrl]);
    }
    // WHY: the logger's redaction masks the `:grant` segment of the pattern too (../../src/logging/redactText.ts).
    const logged = (text: string, from = 0) => tb.logs.slice(from).some((line) => line.includes(text));
    const routes = ['editor-files/[Redacted]/:contentId', 'uploads/[Redacted]/:owner'];
    expect(routes.map((route) => logged(`"route":"/h5p/${route}/*file"`, before))).toEqual([true, true]);
    const secrets = [...asked.map((path) => path.split('/')[3] ?? ''), `/${owner}/`, `/${contentId}/`];
    expect(secrets.filter((secret) => logged(secret))).toEqual([]);
  });

  it('[SEC-004] a launched learner’s ltik opens no file path on the app origin either', async () => {
    // Arrange: a learner with a valid ltik for this very activity
    const published = await tb.activity(await tb.staffAccount(), { published: true });
    await files.storeUserFiles(tb, published);
    const { ltik } = await launchFromCanvas(tb.app, tb.mock.canvas, {
      user: CANVAS_USERS.student,
      custom: { contentId: published },
      resourceLinkId: `editor-files-${published}`,
    });
    const path = signedPath(tb.runtime.fileGrants, PLAYER, published, STORED.image);
    // Act
    const anonymous = await onAppOrigin(tb, path);
    const launched = await onAppOrigin(tb, path).set('Authorization', `Bearer ${ltik ?? ''}`);
    // Assert
    // WHY: a file address is on no ltik's list (D-130): a request that carries one is refused before the path.
    expect([anonymous.status, launched.status]).toEqual([404, 403]);
    for (const res of [anonymous, launched]) {
      expect(res.headers['content-type']).not.toMatch(/^image\//);
    }
  });

  it('[SEC-004] the editor page in Canvas points H5P at the files origin in CORS mode, and its policy names it only for media', async () => {
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
    await files.storeUserFiles(tb, owned);
    const origin = filesOriginOf(tb.env);
    // Act: the Canvas editor (/lti/edit); the portal's editor page is on no ltik's list (D-130), and
    //      ../../e2e/editorImageTool.e2e.test.ts covers its file addresses with a portal session
    const page = await request(tb.app).get(`/lti/edit?ltik=${encodeURIComponent(await launch(owned))}`);
    const integration = integrationFromPage<{
      contents: Record<string, { contentUrl: string }>;
      editor: { filesPath: string };
      crossorigin?: string;
    }>(page.text);
    const contentUrl = integration?.contents[`cid-${owned}`]?.contentUrl ?? '';
    // Assert
    expect(page.status).toBe(200);
    const naming = String(page.headers['content-security-policy'])
      .split('; ')
      .filter((directive) => directive.split(' ').includes(origin))
      .map((directive) => directive.split(' ')[0]);
    expect(naming).toEqual(['img-src', 'media-src']);
    expect(integration?.crossorigin).toBe('anonymous');
    const grant = '[\\w-]+\\.\\d+\\.[\\w-]{43}';
    const escaped = origin.replace(/\./g, '\\.');
    expect(contentUrl).toMatch(new RegExp(`^${escaped}/h5p/editor-files/${grant}/${owned}$`));
    expect(integration?.editor.filesPath).toMatch(
      new RegExp(`^${escaped}/h5p/uploads/${grant}/${principal.userId}$`),
    );
    const file = await onFilesOrigin(tb, `${contentUrl.slice(origin.length)}/${STORED.image}`);
    expect(file.status).toBe(200);
    expect(Buffer.compare(file.body as Buffer, PNG_1X1)).toBe(0);
  });
});
