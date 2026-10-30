/**
 * Integration tests for the guards of the publish flow: an activity changed or saved in the meantime, the audit
 * record, unpublishing, who may publish at all, and how a malformed activity ID is answered.
 *
 * Spec: PROD-003, DATA-007, H5P-006, DOC-012
 */
import { API_ROUTES, buildOpenApiDocument } from '@hvl-interaktiv/api-contract';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ContentPublisher } from '../../../src/content/ContentPublisher.js';
import { isAuthError } from '../../../src/http/authErrors.js';
import { t } from '../../../src/i18n/translate.js';
import type { Database } from '../../../src/infra/prismaClient.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import {
  altError,
  altReason,
  checkedUpdatedAt,
  contentApi,
  findingsOnly,
} from '../../support/publishFixtures.js';
import { describeWithServices } from '../../support/services.js';

describeWithServices('[PROD-003] publish flow guards', () => {
  const tb = openApiTestbed();
  let author: TestPrincipal;
  const api = (method: 'get' | 'post', path: string, who: TestPrincipal = author) =>
    contentApi(tb, method, path, who);
  const checked = (id: string) => checkedUpdatedAt(tb, id, author);
  /** The database as the publisher sees it, with a save of `id` landing after validation, before the transaction. */
  const racingSave = (id: string): Database =>
    new Proxy(tb.db, {
      get(target, property) {
        if (property === 'validationAcknowledgement') {
          return {
            findMany: async (args: Parameters<Database['validationAcknowledgement']['findMany']>[0]) => {
              const later = new Date(Date.now() + 2000);
              await target.h5PContent.update({ where: { id }, data: { title: 'Racing', updatedAt: later } });
              return target.validationAcknowledgement.findMany(args);
            },
          };
        }
        const value: unknown = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

  beforeAll(async () => {
    author = await tb.principal('author');
  });
  afterAll(() => tb.close());

  it('[PROD-003] an activity changed since it was checked, or by a save racing the publish, is refused with 409', async () => {
    // Arrange
    const id = await tb.content(author.principal.userId);
    tb.validator = findingsOnly(altError);
    const stale = await checked(id);
    await tb.db.h5PContent.update({
      where: { id },
      data: { title: 'Edited', updatedAt: new Date(Date.now() + 1000) },
    });
    const fresh = await checked(id);
    const racing = new ContentPublisher({
      db: racingSave(id),
      validator: findingsOnly(altError),
      clock: () => new Date(),
    });
    // Act
    const changed = await api('post', `${id}/publish`).send({
      updatedAt: stale,
      acknowledgements: [altReason],
    });
    const raced = await racing
      .publish(id, { ...author.principal }, { updatedAt: fresh, acknowledgements: [altReason] })
      .catch((error: unknown) => error);
    // Assert
    expect(changed.status).toBe(409);
    expect(changed.body.errorCode).toBe('hvl:content-changed');
    expect(isAuthError(raced, 'hvl:content-changed')).toBe(true);
    expect(await tb.db.h5PContent.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'draft',
      title: 'Racing',
    });
    expect(await tb.db.validationAcknowledgement.count({ where: { contentId: id } })).toBe(0);
    expect(await tb.db.auditEvent.count({ where: { targetId: id } })).toBe(0);
  });

  it('[DATA-007] the audit records the rule IDs and the previous status, never the reason', async () => {
    // Arrange
    const id = await tb.content(author.principal.userId);
    tb.validator = findingsOnly(altError);
    // Act
    await api('post', `${id}/publish`).send({ updatedAt: await checked(id), acknowledgements: [altReason] });
    // Assert
    const audit = await tb.db.auditEvent.findFirstOrThrow({
      where: { targetId: id, action: 'content.publish' },
    });
    expect(audit).toMatchObject({
      actorUserId: author.principal.userId,
      targetType: 'H5PContent',
      details: { from: 'draft', acknowledgedRuleIds: ['V-IMG-ALT'], mode: 'portal' },
    });
    expect(JSON.stringify(audit.details)).not.toMatch(/pynt|Biletet/);
  });

  it('[PROD-003] unpublishing returns the activity to draft, is audited, and refuses a stale updatedAt', async () => {
    // Arrange
    const id = await tb.content(author.principal.userId);
    tb.validator = findingsOnly();
    const published = await api('post', `${id}/publish`).send({
      updatedAt: await checked(id),
      acknowledgements: [],
    });
    // Act
    const stale = await api('post', `${id}/unpublish`).send({ updatedAt: new Date(0).toISOString() });
    const res = await api('post', `${id}/unpublish`).send({ updatedAt: published.body.updatedAt });
    // Assert
    expect(stale.status).toBe(409);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'draft', updatedAt: expect.any(String) });
    expect(await tb.db.h5PContent.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'draft',
      publishedAt: null,
    });
    const audit = await tb.db.auditEvent.findFirstOrThrow({
      where: { targetId: id, action: 'content.unpublish' },
    });
    expect(audit.details).toEqual({ from: 'published', mode: 'portal' });
  });

  it('[PROD-003] only those who may edit publish: someone who may view gets 403, a stranger 404, nobody 401', async () => {
    // Arrange
    const id = await tb.content(author.principal.userId, { status: 'published', visibility: 'organisation' });
    const colleague = await tb.principal('author');
    const learner = await tb.principal('learner');
    const body = { updatedAt: await checked(id), acknowledgements: [] };
    // Act
    const viewer = await api('post', `${id}/publish`, colleague).send(body);
    const outsider = await api(
      'post',
      `${id}/unpublish`,
      await tb.principal('author', { hvlMember: false }),
    ).send(body);
    const pupil = await api('get', `${id}/findings`, learner);
    const anonymous = await request(tb.app).get(`/api/content/${id}/findings`);
    // Assert
    expect(viewer.status).toBe(403);
    expect(viewer.body).toMatchObject({
      errorCode: 'hvl:edit-not-allowed',
      message: t('error.editNotAllowed'),
    });
    expect([outsider.status, pupil.status, anonymous.status]).toEqual([404, 403, 401]);
  });

  it('[DOC-012] a malformed activity ID is 404 like an unknown one on every activity route, as the document says', async () => {
    // Arrange
    const bodies: Record<string, object> = {
      publishContent: { updatedAt: new Date().toISOString(), acknowledgements: [] },
      unpublishContent: { updatedAt: new Date().toISOString() },
      changeSharing: { visibility: 'private' },
    };
    const routes = API_ROUTES.filter((route) => route.path.includes(':contentId'));
    const paths = buildOpenApiDocument().paths as Record<string, Record<string, { responses: object }>>;
    // Act
    const answers = await Promise.all(
      routes.map((route) => {
        // WHY: only the activity ID is malformed; another path parameter (a co-author's user ID) is a valid UUID.
        const path = route.path.replace(':contentId', 'not-a-uuid').replace(/:\w+/g, randomUUID());
        const call = request(tb.app)[route.method](`/api${path}`);
        return call.set(...author.header).send(bodies[route.operationId]);
      }),
    );
    // Assert
    expect(routes.length).toBeGreaterThanOrEqual(5);
    routes.forEach((route, index) => {
      const answer = answers[index];
      expect([answer?.status, answer?.body.errorCode], route.operationId).toEqual([
        404,
        'hvl:activity-unavailable',
      ]);
      expect(answer?.headers['cache-control'], route.operationId).toBe('no-store');
      const responses = paths[`/api${route.path.replace(/:(\w+)/g, '{$1}')}`]?.[route.method]?.responses;
      expect(JSON.stringify(responses), route.operationId).toMatch(/malformed ID/);
    });
  });
});
