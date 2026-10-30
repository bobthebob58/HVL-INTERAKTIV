/**
 * Integration tests for the publish gate on saves (D-074): saving a published activity through the H5P content
 * route, with injected validators, judged as the editor stores it, and the version: kept by a text-only save,
 * raised by a structural one (D-093 amends D-074's "every save").
 *
 * Spec: PROD-003, UD-022, H5P-006, PROD-013
 */
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { PublishedSaveGate } from '../../src/content/PublishedSaveGate.js';
import { editorSavedForm } from '../../src/content/savedForm.js';
import { t } from '../../src/i18n/translate.js';
import type { Finding, ValidationInput } from '../../src/validation/types.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { altError, colourHint, DAY } from '../support/publishFixtures.js';
import { describeWithServices } from '../support/services.js';

const linkWarning: Finding = { ...altError, ruleId: 'V-LINK-TEXT', severity: 'warning', path: 'question' };

const questionText = (params: unknown): string =>
  String((params as { question?: unknown }).question ?? '')
    .replace(/<[^>]*>/g, '')
    .trim();

/**
 * Finds an alt-text error when the question says so or reads as empty once tags are removed (as the validator's
 * text reading does), and a warning and a hint when it mentions a link.
 */
const byQuestion = (input: ValidationInput): Finding[] => {
  const text = JSON.stringify(input.params);
  return [
    ...(text.includes('utan alt') || questionText(input.params) === '' ? [altError] : []),
    ...(text.includes('lenkje') ? [linkWarning, colourHint] : []),
  ];
};

describeWithServices('[PROD-003] saving a published activity', () => {
  let tb: HttpTestbed;
  let app: Express;
  let author: TestActor;
  let colleague: TestActor;
  const validated: ValidationInput[] = [];

  const save = (id: string, question: string, who: TestActor = author, answers = ['Ja']) =>
    request(app)
      .put(`/h5p/content/${id}`)
      .set(...who.header)
      .send({
        library: 'H5P.MultiChoice 1.16',
        params: { params: { question, answers }, metadata: { title: 'Q', license: 'U' } },
      });
  const stored = (id: string) => tb.db.h5PContent.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
    colleague = await tb.actor('author');
    const gate = new PublishedSaveGate(
      {
        db: tb.db,
        validator: (input) => (validated.push(input), byQuestion(input)),
        clock: () => new Date(),
      },
      editorSavedForm(tb.runtime.editor.libraryManager),
    );
    app = tb.appWith({ saveGate: gate });
  }, 60_000);
  beforeEach(() => void validated.splice(0));
  afterAll(() => tb.close());

  it('[PROD-003] a save that adds an error nobody explained is refused with 409 and its findings', async () => {
    // Arrange
    const id = await tb.activity(author, { published: true });
    // Act
    const res = await save(id, 'Bilete utan alt');
    // Assert
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      errorCode: 'hvl:published-save-blocked',
      message: t('error.publishedSaveBlocked'),
      findings: [{ ...altError, acknowledgement: null }],
    });
    expect(validated[0]).toMatchObject({ mainLibrary: 'H5P.MultiChoice 1.16', locale: 'nn' });
    expect(await stored(id)).toMatchObject({ params: { question: 'Kva?' }, version: 1 });
  });

  it('[PROD-003] the gate judges what the editor stores: text that sanitising empties counts as empty', async () => {
    // Arrange
    const id = await tb.activity(author, { published: true });
    // Act
    const res = await save(id, '<style>Kva er rett?</style>');
    // Assert
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('hvl:published-save-blocked');
    expect(validated[0]?.params).toMatchObject({ question: '' });
    expect(await stored(id)).toMatchObject({ params: { question: 'Kva?' }, status: 'published', version: 1 });
  });

  it('[PROD-003] a save with only warnings and hints goes through; a text-only edit keeps the version', async () => {
    // Arrange
    const id = await tb.activity(author, { published: true });
    // Act
    const res = await save(id, 'Klikk på lenkje');
    // Assert
    expect(res.status).toBe(200);
    expect(await stored(id)).toMatchObject({ params: { question: 'Klikk på lenkje' }, version: 1 });
  });

  it('[UD-022] an error explained less than 14 days ago does not block the save; one older than 14 days does', async () => {
    // Arrange
    const id = await tb.activity(author, { published: true });
    const { ruleId, path } = altError;
    const ack = await tb.db.validationAcknowledgement.create({
      data: {
        contentId: id,
        ruleId,
        path,
        reason: 'Pynt.',
        userId: author.actor.accountId,
        at: new Date(Date.now() - 13 * DAY),
      },
    });
    // Act
    const recent = await save(id, 'Framleis utan alt');
    await tb.db.validationAcknowledgement.update({
      where: { id: ack.id },
      data: { at: new Date(Date.now() - 15 * DAY) },
    });
    const expired = await save(id, 'Igjen utan alt');
    // Assert
    expect(recent.status).toBe(200);
    expect(expired.status).toBe(409);
    expect(expired.body.findings).toEqual([{ ...altError, acknowledgement: null }]);
    expect(await stored(id)).toMatchObject({ params: { question: 'Framleis utan alt' }, version: 1 });
  });

  it('[PROD-013] a draft is saved without the gate, and only a structural save raises the version', async () => {
    // Arrange
    const id = await tb.activity(author);
    // Act: a reworded question, then an added option (structural; nobody has state, so nothing asks first)
    const first = await save(id, 'Utkast utan alt');
    const afterText = (await stored(id)).version;
    const second = await save(id, 'Utkast utan alt igjen', author, ['Ja', 'Nei']);
    // Assert
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(validated).toEqual([]);
    expect(afterText).toBe(1);
    expect(await stored(id)).toMatchObject({ status: 'draft', version: 2 });
  });

  it('[H5P-006] someone who may not edit meets the editor’s 403 and never learns the findings', async () => {
    // Arrange
    const id = await tb.activity(author, { published: true });
    // Act
    const res = await save(id, 'Bilete utan alt', colleague);
    // Assert
    expect(res.status).toBe(403);
    expect(res.body.findings).toBeUndefined();
    expect(validated).toEqual([]);
    expect((await stored(id)).version).toBe(1);
  });
});
