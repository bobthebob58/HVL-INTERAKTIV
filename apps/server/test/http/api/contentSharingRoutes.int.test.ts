/**
 * Integration tests for the sharing API: the change, its audit record, refusals and malformed requests.
 *
 * Spec: PROD-006, DATA-007, PROD-004
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Principal } from '../../../src/auth/Principal.js';
import { setPrincipal } from '../../../src/auth/principalLocals.js';
import { contentSharingRoutes } from '../../../src/http/api/contentSharingRoutes.js';
import { h5pErrorHandler } from '../../../src/http/h5pErrorHandler.js';
import {
  PrismaContentAccessRepository,
  type ContentAccessRepository,
} from '../../../src/h5p/permissions/ContentAccessRepository.js';
import { t } from '../../../src/i18n/translate.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { createLogger } from '../../../src/logging/logger.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

describeWithServices('[PROD-006] sharing API', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const logger = createLogger({ level: 'silent' });
  let owner: string;
  let contentId: string;

  const appAs = (
    principal?: Partial<Principal>,
    access: ContentAccessRepository = new PrismaContentAccessRepository(db),
  ) =>
    express()
      .use((_req, res, next) => {
        if (principal)
          setPrincipal(res, {
            learnerKey: 'lk',
            mode: 'portal',
            locale: 'nn',
            hvlMember: true,
            feideAuthenticated: true,
            studentAuthor: false,
            userId: owner,
            roles: ['author'],
            ...principal,
          });
        next();
      })
      .use('/api', contentSharingRoutes({ db, access }))
      .use(h5pErrorHandler(logger));

  beforeAll(async () => {
    owner = (await db.user.create({ data: { kind: 'staff' } })).id;
    contentId = (
      await db.h5PContent.create({
        data: {
          mainLibrary: 'H5P.DragText',
          title: 'T',
          params: {},
          metadata: {},
          ownerUserId: owner,
          status: 'draft',
        },
      })
    ).id;
  });
  afterAll(() => db.$disconnect());

  it('[PROD-006] the owner shares with HVL at once, the status stays, and the change is audited', async () => {
    // Act
    const res = await request(appAs({}))
      .patch(`/api/content/${contentId}/sharing`)
      .send({ visibility: 'organisation' });
    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ contentId, visibility: 'organisation' });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(await db.h5PContent.findUniqueOrThrow({ where: { id: contentId } })).toMatchObject({
      visibility: 'organisation',
      status: 'draft',
    });
    const audit = await db.auditEvent.findFirstOrThrow({
      where: { targetId: contentId, action: 'content.sharing.change' },
    });
    expect(audit).toMatchObject({
      actorUserId: owner,
      details: { from: 'private', to: 'organisation', mode: 'portal' },
    });
  });

  it('[PROD-004] someone who may not edit, or an unknown ID, gets the same 404 and nothing changes', async () => {
    // Arrange
    const colleague = (await db.user.create({ data: { kind: 'staff' } })).id;
    const visibilityOf = async () =>
      (await db.h5PContent.findUniqueOrThrow({ where: { id: contentId } })).visibility;
    const before = await visibilityOf();
    // Act
    const foreign = await request(appAs({ userId: colleague }))
      .patch(`/api/content/${contentId}/sharing`)
      .send({ visibility: 'feide' });
    const unknown = await request(appAs({}))
      .patch(`/api/content/${crypto.randomUUID()}/sharing`)
      .send({ visibility: 'feide' });
    // Assert
    for (const res of [foreign, unknown]) {
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ errorCode: 'hvl:activity-unavailable' });
    }
    expect(await visibilityOf()).toBe(before);
  });

  it('[PROD-006] a student author may not share beyond private; nobody signed in is 401; bad bodies are 400', async () => {
    // Act and assert
    const student = await request(appAs({ studentAuthor: true }))
      .patch(`/api/content/${contentId}/sharing`)
      .send({ visibility: 'feide' });
    expect(student.status).toBe(403);
    expect(student.body).toMatchObject({ errorCode: 'hvl:sharing-not-allowed' });
    const anonymous = await request(appAs())
      .patch(`/api/content/${contentId}/sharing`)
      .send({ visibility: 'private' });
    expect(anonymous.status).toBe(401);
    for (const body of [{ visibility: 'public' }, { visibility: 'private', status: 'published' }, {}]) {
      expect(
        (await request(appAs({})).patch(`/api/content/${contentId}/sharing`).send(body)).status,
        JSON.stringify(body),
      ).toBe(400);
    }
  });

  it('[PROD-006] the canonical activity ID is changed, audited and returned, whatever case the path uses', async () => {
    // Act
    const res = await request(appAs({}))
      .patch(`/api/content/${contentId.toUpperCase()}/sharing`)
      .send({ visibility: 'private' });
    // Assert
    expect(res.body).toMatchObject({ contentId });
    const last = await db.auditEvent.findFirst({ where: { actorUserId: owner }, orderBy: { at: 'desc' } });
    expect(last?.targetId).toBe(contentId);
  });

  it('[PROD-006] a change that lost a race to another one is refused with 409, and the audit trail stays true', async () => {
    // Arrange: someone else changes the visibility between our check and our update
    const real = new PrismaContentAccessRepository(db);
    const racing: ContentAccessRepository = {
      ...real,
      factsFor: async (id) => {
        const facts = await real.factsFor(id);
        await db.h5PContent.update({ where: { id: contentId }, data: { visibility: 'feide' } });
        return facts;
      },
    };
    await db.h5PContent.update({ where: { id: contentId }, data: { visibility: 'private' } });
    const audits = await db.auditEvent.count({ where: { targetId: contentId } });
    // Act
    const res = await request(appAs({}, racing))
      .patch(`/api/content/${contentId}/sharing`)
      .send({ visibility: 'organisation' });
    // Assert
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('hvl:sharing-changed');
    expect((await db.h5PContent.findUniqueOrThrow({ where: { id: contentId } })).visibility).toBe('feide');
    expect(await db.auditEvent.count({ where: { targetId: contentId } })).toBe(audits);
  });

  it('[PROD-012] refusals are in the signed-in person’s language', async () => {
    const res = await request(appAs({ locale: 'en', userId: crypto.randomUUID() }))
      .patch(`/api/content/${contentId}/sharing`)
      .send({ visibility: 'feide' });
    expect(res.body.message).toBe(t('error.activityUnavailable', {}, 'en'));
  });
});
