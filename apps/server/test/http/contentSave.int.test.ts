/**
 * Integration tests for saving, loading, deleting and exporting an activity over HTTP: stored markup is inert,
 * a colleague cannot change someone else's activity, and refusals never look like downloads.
 *
 * Spec: H5P-002, H5P-006, SEC-008
 */
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { openZip, readEntries } from '../../src/security/zipEntryGuard.js';
import { describeWithServices } from '../support/services.js';
import { rawBody } from '../support/uploadFixtures.js';
import { requestAs } from '../support/requestAs.js';

const XSS = '<img src=x onerror=alert(1)>svar';
const META = { title: 'Aktivitet', license: 'U', language: 'nn' };
const mcBody = (question: string, metadata: object = META) => ({
  library: 'H5P.MultiChoice 1.16',
  params: { params: { question, answers: [XSS, 'Nei'] }, metadata },
});

describeWithServices('H5P content over HTTP', () => {
  let tb: HttpTestbed;
  let owner: TestActor;
  let colleague: TestActor;
  let learner: TestActor;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    owner = await tb.actor('author');
    colleague = await tb.actor('author');
    learner = await tb.actor('learner');
  }, 60_000);
  afterAll(() => tb.close());

  const create = async (body: object = mcBody('Kva er rett?')): Promise<string> => {
    const res = await requestAs(tb.app, owner, 'post', '/h5p/content').send(body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return (res.body as { contentId: string }).contentId;
  };

  it('[SEC-008] markup in a text field, a list item and the title is stored inert', async () => {
    const id = await create(mcBody(XSS, { ...META, title: XSS }));
    const res = await requestAs(tb.app, owner, 'get', `/h5p/params/${id}`);
    expect(res.status).toBe(200);
    const stored = JSON.stringify(res.body);
    expect(stored).not.toContain('<img');
    expect(stored).not.toMatch(/<[^>]*onerror/i);
    const row = await tb.db.h5PContent.findUniqueOrThrow({ where: { id } });
    expect(JSON.stringify([row.params, row.metadata, row.title])).not.toContain('<img');
  });

  it('[H5P-002] a DragQuestion hidden under an unknown key is refused, so the player never loads it', async () => {
    const body = mcBody('Kva?');
    (body.params.params as Record<string, unknown>).extra = { library: 'H5P.DragQuestion 1.14', params: {} };
    const res = await requestAs(tb.app, owner, 'post', '/h5p/content').send(body);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ errorCode: 'hvl:sub-content-not-allowed' });
  });

  it('[H5P-006] the owner updates the activity; a colleague can neither read nor change it', async () => {
    const id = await create(); // Arrange
    // Act and assert: the owner's update is saved
    const own = await requestAs(tb.app, owner, 'put', `/h5p/content/${id}`).send(mcBody('Ny tekst'));
    expect(own.status).toBe(200);
    expect(own.body).toEqual({ contentId: id });
    // Act and assert: the colleague's read and write are refused, and the owner's text stays
    const read = await requestAs(tb.app, colleague, 'get', `/h5p/params/${id}`);
    const write = await requestAs(tb.app, colleague, 'put', `/h5p/content/${id}`).send(mcBody('Kapra'));
    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
    const row = await tb.db.h5PContent.findUniqueOrThrow({ where: { id } });
    expect(JSON.stringify(row.params)).toContain('Ny tekst');
  });

  it('[H5P-006] learners never reach saving, loading parameters or deleting', async () => {
    const id = await create(); // Arrange
    // Act: every write, read and delete a learner could try
    const calls = [
      requestAs(tb.app, learner, 'post', '/h5p/content').send(mcBody('x')),
      requestAs(tb.app, learner, 'put', `/h5p/content/${id}`).send(mcBody('x')),
      requestAs(tb.app, learner, 'get', `/h5p/params/${id}`),
      requestAs(tb.app, learner, 'delete', `/h5p/content/${id}`),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(403); // Assert
  });

  it('[H5P-006] an unrelated colleague cannot delete; the owner can, and the activity is gone afterwards', async () => {
    const id = await create(); // Arrange
    // Act and assert: the colleague's delete is refused; the owner's succeeds and leaves nothing behind
    expect((await requestAs(tb.app, colleague, 'delete', `/h5p/content/${id}`)).status).toBe(403);
    expect((await requestAs(tb.app, owner, 'delete', `/h5p/content/${id}`)).status).toBe(204);
    expect(await tb.db.h5PContent.findUnique({ where: { id } })).toBeNull();
    expect((await requestAs(tb.app, owner, 'get', `/h5p/params/${id}`)).status).toBe(403);
  });

  it('[H5P-006] the owner downloads a complete .h5p package; a refusal is JSON, never an attachment', async () => {
    // Arrange
    // WHY: a long text makes the zip span many chunks, so a response cut short cannot pass as complete.
    const long = 'Lang tekst. '.repeat(5000);
    const id = await create(mcBody(long));
    // Act: the owner downloads
    const ok = await requestAs(tb.app, owner, 'get', `/h5p/download/${id}`).buffer(true).parse(rawBody);
    // Assert: an attachment that unpacks to a complete package
    expect(ok.status).toBe(200);
    expect(ok.headers['content-disposition']).toBe(`attachment; filename="${id}.h5p"`);
    expect(ok.headers['x-content-type-options']).toBe('nosniff');
    const dir = mkdtempSync(join(tmpdir(), 'h5p-download-'));
    try {
      const file = join(dir, 'export.h5p');
      writeFileSync(file, ok.body as Buffer);
      const names: string[] = [];
      for await (const entry of readEntries(await openZip(file))) names.push(entry.fileName);
      expect(names).toEqual(expect.arrayContaining(['h5p.json', 'content/content.json']));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    // Act: a learner tries the same download
    const refused = await requestAs(tb.app, learner, 'get', `/h5p/download/${id}`);
    // Assert: a JSON refusal, not an attachment
    expect(refused.status).toBe(403);
    expect(refused.headers['content-disposition']).toBeUndefined();
    expect(refused.headers['content-type']).toMatch(/^application\/json/);
  });

  it('[H5P-006] a malformed save or an unknown activity is refused without saving anything', async () => {
    // Arrange
    const before = await tb.db.h5PContent.count({ where: { ownerUserId: owner.actor.accountId } });
    // Act and assert: a malformed save is refused
    const malformed = await requestAs(tb.app, owner, 'post', '/h5p/content').send({
      library: 'H5P.MultiChoice 1.16',
      params: { params: [] },
    });
    expect(malformed.status).toBe(400);
    // Act and assert: a save to an unknown activity is refused
    const unknown = await requestAs(tb.app, owner, 'put', `/h5p/content/${randomUUID()}`).send(mcBody('x'));
    expect(unknown.status).toBe(403);
    // Assert: nothing was saved
    expect(await tb.db.h5PContent.count({ where: { ownerUserId: owner.actor.accountId } })).toBe(before);
  });
});
