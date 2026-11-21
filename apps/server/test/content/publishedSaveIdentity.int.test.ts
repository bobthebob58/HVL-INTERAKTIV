/**
 * Integration tests that the publish gate on saves (D-074) knows an activity by one spelling of its ID (D-131): a
 * save whose address writes the ID in capital letters is checked like any other and waits on the lock a publish
 * holds, and the gate refuses an activity it cannot find instead of saving it unchecked.
 *
 * Spec: PROD-003, H5P-006
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PublishedSaveGate } from '../../src/content/PublishedSaveGate.js';
import { editorSavedForm } from '../../src/content/savedForm.js';
import type { Finding, ValidationInput } from '../../src/validation/types.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { altError } from '../support/publishFixtures.js';
import { describeWithServices } from '../support/services.js';

/** Finds an alt-text error when the question says so. */
const byQuestion = (input: ValidationInput): Finding[] =>
  JSON.stringify(input.params).includes('utan alt') ? [altError] : [];

describeWithServices('[PROD-003] the save gate and the spelling of an activity ID', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
  }, 60_000);
  afterAll(() => tb.close());
  /** A gate whose lock records the keys it is asked for. */
  const gateWith = (held: string[] = []) =>
    new PublishedSaveGate(
      {
        db: tb.db,
        validator: byQuestion,
        clock: () => new Date(),
        writeLock: { hold: <T>(key: string, work: () => Promise<T>) => (held.push(key), work()) },
      },
      editorSavedForm(tb.runtime.editor.libraryManager),
    );

  it('[PROD-003] a save with the ID in capital letters is checked alike, under the lock a publish holds', async () => {
    // Arrange
    const id = await tb.activity(author, { published: true });
    const held: string[] = [];
    const app = tb.appWith({ saveGate: gateWith(held) });
    // Act
    const res = await request(app)
      .put(`/h5p/content/${id.toUpperCase()}`)
      .set(...author.header)
      .send({
        library: 'H5P.MultiChoice 1.16',
        params: { params: { question: 'Bilete utan alt' }, metadata: { title: 'Q', license: 'U' } },
      });
    // Assert
    expect(id.toUpperCase()).not.toBe(id);
    expect([res.status, res.body.errorCode]).toEqual([409, 'hvl:published-save-blocked']);
    expect(held).toEqual([id]);
    expect(await tb.db.h5PContent.findUniqueOrThrow({ where: { id } })).toMatchObject({
      params: { question: 'Kva?' },
      version: 1,
    });
  });

  it('[PROD-003] the gate itself takes the lock under the stored spelling, whatever it is handed', async () => {
    // Arrange
    const id = await tb.activity(author);
    const held: string[] = [];
    const submitted = {
      mainLibrary: 'H5P.MultiChoice 1.16',
      params: {},
      metadata: {},
      locale: 'nn',
    } as const;
    // Act
    const saved = await gateWith(held).save(id.toUpperCase(), submitted as never, async () => id);
    // Assert
    expect(saved).toBe(id);
    expect(held).toEqual([id]);
  });

  it('[H5P-006] the gate refuses a save of an activity it cannot find, and writes nothing', async () => {
    // Arrange
    const submitted = {
      mainLibrary: 'H5P.MultiChoice 1.16',
      params: {},
      metadata: {},
      locale: 'nn',
    } as const;
    let written = 0;
    // Act
    const saving = gateWith().save('0192f1a2-3b4c-7d5e-8f60-000000000404', submitted as never, async () => {
      written += 1;
      return 'x';
    });
    // Assert
    await expect(saving).rejects.toMatchObject({ errorCode: 'hvl:activity-unavailable', status: 404 });
    expect(written).toBe(0);
  });
});
