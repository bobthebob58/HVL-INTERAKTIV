/**
 * Integration tests of the files origin on the whole app (`createApp`): the Canvas player points H5P at it, it serves
 * a player's file with `SEC-004`'s headers and nothing else, the app origin never serves the same URL, a grant expires
 * and opens only its own activity's files, and no cookie is read or set there (D-110 amendment of 2026-11-05).
 *
 * Spec: SEC-004, H5P-007, NFR-006
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { filesOriginOf } from '../../src/config/filesOrigin.js';
import { GRANT_LIFETIME_SECONDS } from '../../src/h5p/contentFileGrants.js';
import { USER_FILE_CSP } from '../../src/security/ContentFileHeaders.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import {
  filesHost,
  onAppOrigin,
  onFilesOrigin,
  SCRIPTED_SVG,
  signedPath,
  storeUserFiles,
  STORED,
} from '../support/filesOriginFixtures.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { integrationFromPage } from '../support/playerIntegration.js';
import { describeWithServices } from '../support/services.js';
import { PNG_1X1 } from '../support/uploadFixtures.js';

describeWithServices('[SEC-004] the files origin', () => {
  let tb: AppTestbed;
  let files: string;
  let contentId: string;
  let otherId: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    files = filesOriginOf(tb.env);
    const owner = await tb.staffAccount();
    contentId = await tb.activity(owner, { published: true });
    otherId = await tb.activity(owner, { published: true });
    await storeUserFiles(tb, contentId);
    await storeUserFiles(tb, otherId);
  }, 60_000);
  afterAll(() => tb?.close());

  const playerPath = (file: string = STORED.image) =>
    signedPath(tb.runtime.fileGrants, '/h5p/files', contentId, file);
  const expectUserFileHeaders = (headers: Record<string, string | undefined>) => {
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toBe(USER_FILE_CSP);
    expect(headers['access-control-allow-origin']).toBe(tb.toolUrl);
    expect(headers['access-control-allow-credentials']).toBeUndefined();
    expect(headers['set-cookie']).toBeUndefined();
  };

  it('[SEC-004] the Canvas player points H5P at the files origin, in CORS mode, and its policy names it only for media', async () => {
    // Arrange
    const { ltik } = await launchFromCanvas(tb.app, tb.mock.canvas, {
      user: CANVAS_USERS.student,
      custom: { contentId },
      resourceLinkId: `files-origin-${contentId}`,
    });
    // Act
    const page = await request(tb.app).get(`/lti/play?ltik=${encodeURIComponent(ltik ?? '')}`);
    const integration = integrationFromPage<{
      contents: Record<string, { contentUrl: string }>;
      crossorigin?: string;
    }>(page.text);
    // Assert
    expect(files).toBe(`http://files.${new URL(tb.toolUrl).host}`);
    expect(integration?.contents[`cid-${contentId}`]?.contentUrl).toMatch(
      new RegExp(`^${files.replace(/\./g, '\\.')}/h5p/files/[\\w-]+\\.\\d+\\.[\\w-]{43}/${contentId}$`),
    );
    expect(integration?.crossorigin).toBe('anonymous');
    const directives = String(page.headers['content-security-policy']).split('; ');
    const naming = directives
      .filter((directive) => directive.split(' ').includes(files))
      .map((d) => d.split(' ')[0]);
    expect(naming).toEqual(['img-src', 'media-src']);
  });

  it('[SEC-004] a player’s file comes from the files origin with nosniff, the sandbox policy and CORS for the app', async () => {
    // Act: a cookie the browser would never send there is ignored, and none is set
    const res = await onFilesOrigin(tb, playerPath()).set('Cookie', '__Host-hvli_sid=not-read-here');
    // Assert
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['content-disposition'] ?? 'inline').toMatch(/^inline/);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cache-control']).toMatch(/^private, max-age=\d+$/);
    expectUserFileHeaders(res.headers);
    expect(Buffer.compare(res.body as Buffer, PNG_1X1)).toBe(0);
  });

  it('[SEC-004] an SVG there is a download in its own text type, under the sandbox policy', async () => {
    const res = await onFilesOrigin(tb, playerPath(STORED.svg));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/svg+xml; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="teikning\.svg"/);
    expectUserFileHeaders(res.headers);
    expect(Buffer.compare(res.body as Buffer, SCRIPTED_SVG)).toBe(0);
  });

  it('[SEC-004] the app origin never serves a player’s file: the same signed URL is 404 there', async () => {
    // Act
    const onApp = await onAppOrigin(tb, playerPath());
    const asEditorGrant = await onAppOrigin(tb, playerPath().replace('/h5p/files/', '/h5p/editor-files/'));
    // Assert
    expect(onApp.status).toBe(404);
    expect(onApp.headers['content-type']).toMatch(/^application\/json/);
    expect(asEditorGrant.status).toBe(403);
  });

  it('[SEC-004] the files origin serves nothing else: pages, APIs, health, editor files and uploads are 404 there', async () => {
    // Arrange
    const editorFile = signedPath(tb.runtime.editorFileGrants, '/h5p/editor-files', contentId, STORED.image);
    const upload = `/h5p/uploads/${tb.runtime.uploadGrants.issueGrant('owner', new Date())}/owner/images/a.png`;
    const paths = ['/', '/healthz', '/api/me', `/h5p/play/${contentId}`, '/lti/play', editorFile, upload];
    // Act
    const answers = await Promise.all(
      [...paths, '/h5p/core/js/h5p.js'].map((path) => onFilesOrigin(tb, path)),
    );
    // Assert
    for (const res of answers) {
      expect(res.status).toBe(404);
      expectUserFileHeaders(res.headers);
    }
    expect((await onAppOrigin(tb, '/healthz')).status).toBe(200);
  });

  it('[SEC-004] a signed URL expires and opens only its own activity’s files, never with an editor’s grant', async () => {
    // Arrange
    const expiredAt = new Date(Date.now() - (GRANT_LIFETIME_SECONDS + 7200) * 1000);
    const grants = tb.runtime.fileGrants;
    const refused = [
      signedPath(grants, '/h5p/files', contentId, STORED.image, contentId, expiredAt),
      signedPath(grants, '/h5p/files', contentId, STORED.image, otherId),
      signedPath(tb.runtime.editorFileGrants, '/h5p/files', contentId, STORED.image),
      signedPath(tb.runtime.uploadGrants, '/h5p/files', contentId, STORED.image),
    ];
    // Act and assert
    for (const path of refused) {
      const res = await onFilesOrigin(tb, path);
      expect(res.status, path).toBe(403);
      expect(JSON.parse((res.body as Buffer).toString('utf8'))).toMatchObject({
        errorCode: 'hvl:file-grant-invalid',
      });
      expectUserFileHeaders(res.headers);
    }
    expect((await onFilesOrigin(tb, playerPath('images/missing.png'))).status).toBe(404);
    expect((await onFilesOrigin(tb, playerPath(`..%2F..%2F${otherId}%2F${STORED.image}`))).status).toBe(404);
  });

  it('[SEC-004] a file name no stored file can have is 404 on both origins, never a server error', async () => {
    // Arrange: a NUL byte, a backslash and a dot segment, each behind a valid grant
    const names = ['images/bilde.png%00.svg', 'images%5Cbilde.png', `images/%2e%2e/${STORED.image}`];
    const grants = tb.runtime.editorFileGrants;
    const logged = tb.logs.length;
    // Act
    const onFiles = await Promise.all(names.map((name) => onFilesOrigin(tb, playerPath(name))));
    const onApp = await Promise.all(
      names.map((name) => onAppOrigin(tb, signedPath(grants, '/h5p/editor-files', contentId, name))),
    );
    // Assert
    expect([...onFiles, ...onApp].map((res) => res.status)).toEqual(Array(6).fill(404));
    expect(tb.logs.slice(logged).some((line) => line.includes('"msg":"h5p request failed"'))).toBe(false);
  });

  it('[SEC-004] answers the app’s CORS preflight for GET and HEAD with Range, and HEAD with headers only', async () => {
    // Act
    const preflight = await request(tb.app)
      .options(playerPath())
      .set('Host', filesHost(tb))
      .set('Origin', tb.toolUrl)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'range');
    const head = await request(tb.app).head(playerPath()).set('Host', filesHost(tb));
    // Assert
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-methods']).toBe('GET, HEAD');
    expect(preflight.headers['access-control-allow-headers']).toBe('Range');
    expectUserFileHeaders(preflight.headers);
    expect(head.status).toBe(200);
    expect(head.headers['content-length']).toBe(String(PNG_1X1.length));
  });

  it('[NFR-006] the request log names the files route’s pattern, never the grant or the activity', async () => {
    // Act
    const path = playerPath();
    await onFilesOrigin(tb, path);
    // Assert
    const grant = path.split('/')[3] ?? '';
    // WHY: the logger's redaction masks the `:grant` segment of the pattern too (../../src/logging/redactText.ts).
    const lines = tb.logs.filter((line) => line.includes('"route":"/h5p/files/[Redacted]/:contentId/*file"'));
    expect(lines.length).toBeGreaterThan(0);
    expect(tb.logs.some((line) => line.includes(grant) || line.includes(`/${contentId}/`))).toBe(false);
  });
});
