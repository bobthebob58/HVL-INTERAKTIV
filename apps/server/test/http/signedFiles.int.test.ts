/**
 * Integration tests for signed content-file URLs over HTTP: the player points H5P at `/h5p/files/<grant>/…`,
 * the files are served there without any credential but a valid grant, with the D-045 headers, and every bad
 * grant is refused with 403 before storage is read; player AJAX URLs carry the request's token, encoded (D-058).
 *
 * Spec: H5P-007, SEC-004, H5P-004
 */
import request from 'supertest';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { ContentFileGrants, GRANT_LIFETIME_SECONDS } from '../../src/h5p/contentFileGrants.js';
import type { UrlToken } from '../../src/h5p/HvlH5pUser.js';
import { HvlUrlGenerator } from '../../src/h5p/HvlUrlGenerator.js';
import { t } from '../../src/i18n/translate.js';
import { parseKeyring } from '../../src/security/keys/keyring.js';
import { randomKey } from '../support/authEnv.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';
import { FILE_FIELD, MINIMAL_PDF, PNG_1X1, rawBody, uploadEditorFile } from '../support/uploadFixtures.js';
import { integrationFromPage } from '../support/playerIntegration.js';
import { requestAs } from '../support/requestAs.js';

interface PlayerIntegration {
  ajaxPath: string;
  ajax: { contentUserData: string; setFinished: string };
  contents: Record<string, { contentUrl: string }>;
}

const integrationOf = (html: string) => integrationFromPage<PlayerIntegration>(html) as PlayerIntegration;

describeWithServices('signed content-file URLs', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  let contentId: string;
  let otherId: string;
  let image: string;
  let pdf: string;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
    const png = (await uploadEditorFile(tb.app, author, 'bilde.png', PNG_1X1)).body as { path: string };
    const doc = (await uploadEditorFile(tb.app, author, 'notat.pdf', MINIMAL_PDF, FILE_FIELD)).body as {
      path: string;
    };
    const params = {
      question: 'Kva?',
      answers: ['Ja'],
      media: { path: png.path, mime: 'image/png', width: 1, height: 1 },
      attachment: { path: doc.path, mime: 'application/pdf' },
    };
    contentId = await tb.activity(author, { published: true, params });
    otherId = await tb.activity(author, { published: true });
    const files = await tb.db.h5PContentFile.findMany({ where: { contentId }, select: { filename: true } });
    image = files.find((f) => f.filename.endsWith('.png'))?.filename ?? '';
    pdf = files.find((f) => f.filename.endsWith('.pdf'))?.filename ?? '';
  }, 60_000);
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => tb.close());

  const play = async (urlToken?: UrlToken) => {
    const learner = await tb.actor('learner', urlToken ? { urlToken } : {});
    const res = await requestAs(tb.app, learner, 'get', `/h5p/play/${contentId}`);
    expect(res.status).toBe(200);
    return { html: res.text, integration: integrationOf(res.text) };
  };
  const contentUrl = async () => (await play()).integration.contents[`cid-${contentId}`]?.contentUrl ?? '';
  const fetchFile = (path: string) => request(tb.app).get(path).buffer(true).parse(rawBody);
  const grantOf = (url: string) => /^\/h5p\/files\/([^/]+)\//.exec(`${url}/`)?.[1] ?? '';

  it('[H5P-007] the player of a published activity points H5P at a signed file URL with a valid grant', async () => {
    // Act
    const url = await contentUrl();
    // Assert
    expect(url).toMatch(new RegExp(`^/h5p/files/[A-Za-z0-9_.-]+/${contentId}$`));
    expect(tb.runtime.fileGrants.verifyGrant(grantOf(url), contentId, new Date())).toMatchObject({
      valid: true,
    });
  });

  it('[H5P-007] the runtime gives editor and player one HvlUrlGenerator, signing with the routes’ grants', () => {
    // Arrange
    const generatorOf = (engine: object) => (engine as { urlGenerator?: unknown }).urlGenerator;
    const shared = generatorOf(tb.runtime.editor);
    // Act and assert
    expect(shared).toBeInstanceOf(HvlUrlGenerator);
    expect(generatorOf(tb.runtime.player)).toBe(shared);
    const url = (shared as HvlUrlGenerator).contentFilesUrl(contentId);
    expect(tb.runtime.fileGrants.verifyGrant(grantOf(url), contentId, new Date()).valid).toBe(true);
  });

  it('[SEC-004] an image through the signed URL is 200 with the D-045 headers, without any credential', async () => {
    // Act
    const res = await fetchFile(`${await contentUrl()}/${image}`);
    // Assert
    expect(image).toMatch(/^images\/.+\.png$/);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBe(
      "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    );
    expect(res.headers['content-disposition'] ?? 'inline').toMatch(/^inline/);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(Buffer.compare(res.body as Buffer, PNG_1X1)).toBe(0);
    const maxAge = Number(/^private, max-age=(\d+)$/.exec(res.headers['cache-control'] ?? '')?.[1]);
    expect(maxAge).toBeGreaterThan(GRANT_LIFETIME_SECONDS - 5);
    expect(maxAge).toBeLessThanOrEqual(GRANT_LIFETIME_SECONDS + 3600);
  });

  it('[SEC-004] a document through the signed URL is a download, and HEAD answers with headers only', async () => {
    const url = await contentUrl();
    expect((await fetchFile(`${url}/${pdf}`)).headers['content-disposition']).toMatch(/^attachment/);
    const head = await request(tb.app).head(`${url}/${image}`);
    expect(head.status).toBe(200);
    expect(head.headers['content-length']).toBe(String(PNG_1X1.length));
    expect(head.headers['x-content-type-options']).toBe('nosniff');
  });

  it('[H5P-004] a byte range through the signed URL gives 206 with the file’s type', async () => {
    const res = await fetchFile(`${await contentUrl()}/${image}`).set('Range', 'bytes=0-3');
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 0-3/${PNG_1X1.length}`);
    expect(res.headers['content-type']).toBe('image/png');
  });

  it('[H5P-007] a tampered, expired, other-activity or removed-key grant is 403 before storage is read', async () => {
    // Arrange
    const grants = tb.runtime.fileGrants;
    const valid = grantOf(await contentUrl());
    const signature = valid.slice(-43);
    const tampered = `${valid.slice(0, -43)}${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
    const expired = grants.issueGrant(
      contentId,
      new Date(Date.now() - (GRANT_LIFETIME_SECONDS + 7200) * 1000),
    );
    const removedKey = new ContentFileGrants(parseKeyring(`gone=${randomKey(7)}`)).issueGrant(
      contentId,
      new Date(),
    );
    const otherActivity = grants.issueGrant(otherId, new Date());
    const storage = tb.runtime.editor.contentManager.contentStorage;
    const reads = [vi.spyOn(storage, 'getFileStats'), vi.spyOn(storage, 'getFileStream')];
    // Act and assert
    for (const grant of [tampered, expired, removedKey, otherActivity, 'not-a-grant']) {
      const res = await fetchFile(`/h5p/files/${grant}/${contentId}/${image}`);
      expect(res.status, grant).toBe(403);
      expect(JSON.parse((res.body as Buffer).toString('utf8'))).toEqual({
        success: false,
        errorCode: 'hvl:file-grant-invalid',
        httpStatusCode: 403,
        message: t('error.fileGrantInvalid', {}, 'nn'),
      });
    }
    for (const read of reads) expect(read).not.toHaveBeenCalled();
  });

  it('[H5P-004] a valid grant opens only registered files of its activity: missing is 404, traversal never leaves it', async () => {
    const url = await contentUrl();
    expect((await fetchFile(`${url}/images/missing.png`)).status).toBe(404);
    expect((await fetchFile(`${url}/..%2F..%2F${otherId}%2Fcontent.json`)).status).toBe(404);
    const grant = grantOf(url);
    expect((await fetchFile(`/h5p/files/${grant}/${otherId}/${image}`)).status).toBe(403);
  });

  it('[H5P-007] the player’s AJAX URLs carry the request’s ltik URL-encoded; file and script URLs carry none', async () => {
    // Arrange
    const ltik = 'eyJhbGciOiJSUzI1NiJ9.e+30/x=.s_g-n';
    // Act
    const { html, integration } = await play({ name: 'ltik', value: ltik });
    // Assert
    const encoded = encodeURIComponent(ltik);
    expect(integration.ajaxPath).toBe(`/h5p/ajax?ltik=${encoded}&action=`);
    // WHY: the activity's version follows the token in the state URL (D-093), so old pages' writes can be dropped.
    expect(integration.ajax.contentUserData).toMatch(
      new RegExp(`[?&]ltik=${encoded.replace(/[.]/g, '\\.')}&contentVersion=\\d+$`),
    );
    expect(integration.ajax.setFinished).toBe(`/h5p/finishedData?ltik=${encoded}`);
    expect(integration.contents[`cid-${contentId}`]?.contentUrl).not.toContain('ltik');
    expect(html.split(encoded)).toHaveLength(4);
    expect(html).not.toContain(ltik);
  });

  it('[H5P-007] a grant is issued only after the View check: none for a draft the person may not view', async () => {
    // Arrange
    const draft = await tb.activity(author);
    const learner = await tb.actor('learner');
    const issued = vi.spyOn(tb.runtime.fileGrants, 'issueGrant');
    // Act
    const refused = await requestAs(tb.app, learner, 'get', `/h5p/play/${draft}`);
    const refusedIssues = issued.mock.calls.length;
    await play();
    // Assert: the published activity in the same runtime does get one, so the spy sees the real issuer.
    expect(refused.status).toBe(404);
    expect(refusedIssues).toBe(0);
    expect(issued).toHaveBeenCalledWith(contentId, expect.any(Date));
  });
});
