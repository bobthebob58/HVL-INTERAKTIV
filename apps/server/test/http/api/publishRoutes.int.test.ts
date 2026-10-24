/**
 * Integration tests for the check-and-publish gate: the findings, publishing with and without acknowledgements,
 * the 14-day rule, and what never blocks.
 *
 * Spec: PROD-003, UD-022, PROD-012
 */
import {
  findingsResponseSchema,
  publishBlockedBodySchema,
  publishResponseSchema,
} from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { t } from '../../../src/i18n/translate.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import {
  altError,
  altReason,
  checkedUpdatedAt,
  colourHint,
  contentApi,
  DAY,
  findingsOnly,
  langWarning,
} from '../../support/publishFixtures.js';
import { describeWithServices } from '../../support/services.js';

describeWithServices('[PROD-003] publish flow', () => {
  const tb = openApiTestbed();
  let author: TestPrincipal;
  const api = (method: 'get' | 'post', path: string, who: TestPrincipal = author) =>
    contentApi(tb, method, path, who);
  const checked = (id: string) => checkedUpdatedAt(tb, id, author);

  beforeAll(async () => {
    author = await tb.principal('author');
  });
  afterAll(() => tb.close());

  it('[PROD-003] lists the stored activity’s findings in the author’s language, only to those who may edit', async () => {
    // Arrange
    const id = await tb.content(author.principal.userId);
    const locales: string[] = [];
    tb.validator = (input) => (locales.push(input.locale), [altError, langWarning]);
    const viewer = await tb.principal('author');
    const english = await tb.principal('author', { userId: author.principal.userId, locale: 'en' });
    // Act
    const res = await api('get', `${id}/findings`, english);
    const stranger = await api('get', `${id}/findings`, viewer);
    // Assert
    expect(res.status).toBe(200);
    expect(findingsResponseSchema.parse(res.body).findings).toEqual([
      { ...altError, acknowledgement: null },
      { ...langWarning, acknowledgement: null },
    ]);
    expect(locales).toEqual(['en']);
    expect(stranger.status).toBe(404);
    expect(stranger.body.errorCode).toBe('hvl:activity-unavailable');
    expect([res.headers['cache-control'], stranger.headers['cache-control']]).toEqual([
      'no-store',
      'no-store',
    ]);
  });

  it('[PROD-003] publishing is blocked without an acknowledgement, with the findings, and nothing changes', async () => {
    // Arrange
    const id = await tb.content(author.principal.userId);
    tb.validator = findingsOnly(altError);
    // Act
    const res = await api('post', `${id}/publish`).send({
      updatedAt: await checked(id),
      acknowledgements: [],
    });
    // Assert
    expect(res.status).toBe(409);
    // PRIVACY: the findings quote the author's texts; the error answer must not be cached either.
    expect(res.headers['cache-control']).toBe('no-store');
    const body = publishBlockedBodySchema.parse(res.body);
    expect(body).toMatchObject({ errorCode: 'hvl:publish-blocked', message: t('error.publishBlocked') });
    expect(body.findings).toEqual([{ ...altError, acknowledgement: null }]);
    expect((await tb.db.h5PContent.findUniqueOrThrow({ where: { id } })).status).toBe('draft');
    expect(await tb.db.validationAcknowledgement.count({ where: { contentId: id } })).toBe(0);
  });

  it('[UD-022] an acknowledged error publishes, stores the trimmed reason and shows it in the findings', async () => {
    // Arrange
    const id = await tb.content(author.principal.userId);
    tb.validator = findingsOnly(altError);
    // Act
    const res = await api('post', `${id}/publish`).send({
      updatedAt: await checked(id),
      acknowledgements: [altReason],
    });
    const after = await api('get', `${id}/findings`);
    // Assert
    expect(res.status).toBe(200);
    const published = publishResponseSchema.parse(res.body);
    const row = await tb.db.h5PContent.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: 'published', publishedAt: new Date(published.publishedAt) });
    expect(published.updatedAt).toBe(row.updatedAt.toISOString());
    const stored = await tb.db.validationAcknowledgement.findMany({ where: { contentId: id } });
    expect(stored).toEqual([
      expect.objectContaining({
        ruleId: altError.ruleId,
        path: altError.path,
        userId: author.principal.userId,
      }),
    ]);
    expect(stored[0]?.reason).toBe('Biletet er pynt, alt kjem.');
    const [acknowledged] = findingsResponseSchema.parse(after.body).findings;
    expect(acknowledged?.acknowledgement?.reason).toBe('Biletet er pynt, alt kjem.');
    expect(Date.parse(acknowledged?.acknowledgement?.expiresAt ?? '') - (stored[0]?.at.getTime() ?? 0)).toBe(
      14 * DAY,
    );
  });

  it('[UD-022] an acknowledgement older than 14 days asks again; one 13 days old still covers the error', async () => {
    // Arrange
    const id = await tb.content(author.principal.userId);
    tb.validator = findingsOnly(altError);
    await api('post', `${id}/publish`).send({ updatedAt: await checked(id), acknowledgements: [altReason] });
    // Act
    tb.clockOffsetMs = 13 * DAY;
    const within = await api('post', `${id}/publish`).send({
      updatedAt: await checked(id),
      acknowledgements: [],
    });
    tb.clockOffsetMs = 15 * DAY;
    const findings = await api('get', `${id}/findings`);
    const expired = await api('post', `${id}/publish`).send({
      updatedAt: await checked(id),
      acknowledgements: [],
    });
    tb.clockOffsetMs = 0;
    // Assert
    expect(within.status).toBe(200);
    expect(findingsResponseSchema.parse(findings.body).findings[0]?.acknowledgement).toBeNull();
    expect(expired.status).toBe(409);
    expect(expired.body.errorCode).toBe('hvl:publish-blocked');
  });

  it('[PROD-003] warnings and hints never block publishing', async () => {
    // Arrange
    const id = await tb.content(author.principal.userId);
    tb.validator = findingsOnly(langWarning, colourHint);
    // Act
    const res = await api('post', `${id}/publish`).send({
      updatedAt: await checked(id),
      acknowledgements: [],
    });
    // Assert
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
  });

  it('[PROD-003] a reason that names no current error is 400, and so is a body with client findings', async () => {
    // Arrange
    const id = await tb.content(author.principal.userId);
    tb.validator = findingsOnly(altError, langWarning);
    const updatedAt = await checked(id);
    // Act
    const forWarning = await api('post', `${id}/publish`).send({
      updatedAt,
      acknowledgements: [{ ruleId: langWarning.ruleId, path: langWarning.path, reason: 'x' }],
    });
    const withFindings = await api('post', `${id}/publish`).send({
      updatedAt,
      acknowledgements: [],
      findings: [],
    });
    // Assert
    expect(forWarning.status).toBe(400);
    expect(forWarning.body.errorCode).toBe('hvl:acknowledgement-invalid');
    expect(withFindings.status).toBe(400);
    expect(withFindings.body.errorCode).toBe('error.badRequest');
    expect((await tb.db.h5PContent.findUniqueOrThrow({ where: { id } })).status).toBe('draft');
  });
});
