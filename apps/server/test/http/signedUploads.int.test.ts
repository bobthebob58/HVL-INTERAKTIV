/**
 * Integration tests for the editor's grant-bearing upload URLs: a valid grant serves the owner's fresh upload with
 * the user-file headers and no credential; every other grant, owner or purpose is refused the same way.
 *
 * Spec: H5P-007, SEC-004
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';
import { PNG_1X1, rawBody, uploadEditorFile } from '../support/uploadFixtures.js';

describeWithServices('signed upload URLs', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  let other: TestActor;
  let file: string;
  const grantFor = (accountId: string) => tb.runtime.uploadGrants.issueGrant(accountId, new Date());
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
    other = await tb.actor('author');
    const res = await uploadEditorFile(tb.app, author, 'bilete.png', PNG_1X1);
    file = (res.body as { path: string }).path.replace(/#tmp$/, '');
  }, 60_000);
  afterAll(() => tb.close());

  it('[H5P-007] the owner’s grant serves the upload without any credential, with the user-file headers', async () => {
    // Act
    const res = await request(tb.app)
      .get(`/h5p/uploads/${grantFor(author.actor.accountId)}/${author.actor.accountId}/${file}`)
      .buffer(true)
      .parse(rawBody);
    // Assert
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toMatch(/^sandbox/);
    expect(res.headers['cache-control']).toMatch(/^private, max-age=\d+$/);
    expect(Buffer.compare(res.body as Buffer, PNG_1X1)).toBe(0);
  });

  it('[H5P-007] another account’s grant, another account in the path, and a content-file grant are refused alike', async () => {
    // Arrange
    const contentGrant = tb.runtime.fileGrants.issueGrant(author.actor.accountId, new Date());
    const attempts = [
      `/h5p/uploads/${grantFor(other.actor.accountId)}/${author.actor.accountId}/${file}`,
      `/h5p/uploads/${grantFor(author.actor.accountId)}/${other.actor.accountId}/${file}`,
      `/h5p/uploads/${contentGrant}/${author.actor.accountId}/${file}`,
      `/h5p/uploads/not-a-grant/${author.actor.accountId}/${file}`,
    ];
    // Act
    const answers = await Promise.all(attempts.map((path) => request(tb.app).get(path)));
    // Assert
    expect(answers.map((r) => r.status)).toEqual([403, 403, 403, 403]);
    expect(new Set(answers.map((r) => r.text)).size).toBe(1);
  });

  it('[SEC-004] the other author’s own grant does not reach this upload', async () => {
    const res = await request(tb.app).get(
      `/h5p/uploads/${grantFor(other.actor.accountId)}/${other.actor.accountId}/${file}`,
    );
    expect(res.status).toBe(404);
  });
});
