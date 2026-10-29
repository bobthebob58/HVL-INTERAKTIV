/**
 * Integration tests that a bank listing ends with the conditions it needs (D-091 as amended): unpublishing an activity
 * or making it private removes its listing in the same transaction, audited with the cause; a change that keeps it
 * shared with HVL or wider keeps it.
 *
 * Spec: PROD-007, PROD-003, PROD-006, DATA-007
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { BANK_UNLISTED_ACTION } from '../../../src/learningDesign/collaboration/bankListingWrites.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { personNamed, runToken } from './collaborationFixtures.js';

const TOKEN = runToken();

describeWithServices('[PROD-007] a bank listing ends when the activity no longer qualifies', () => {
  const tb = openApiTestbed();
  let owner: TestPrincipal;

  beforeAll(async () => {
    owner = await personNamed(tb, `Eigar ${TOKEN}`);
  });
  afterAll(() => tb.close());

  /** A published activity shared with HVL and listed in the bank by its owner. */
  const listedActivity = async () => {
    const contentId = await tb.content(owner.principal.userId, {
      status: 'published',
      visibility: 'organisation',
    });
    const listed = await requestAs(tb.app, owner, 'put', `/api/content/${contentId}/bank`).send({
      consentVersion: 1,
    });
    expect(listed.status).toBe(200);
    return contentId;
  };
  const after = async (contentId: string) => {
    const row = await tb.db.h5PContent.findUniqueOrThrow({
      where: { id: contentId },
      select: { bankListedAt: true },
    });
    const events = await tb.db.auditEvent.findMany({
      where: { targetId: contentId, action: BANK_UNLISTED_ACTION },
      select: { actorUserId: true, details: true },
    });
    return { listed: row.bankListedAt !== null, events };
  };

  it('[PROD-007] unpublishing removes the listing, audited with the cause', async () => {
    // Arrange
    const contentId = await listedActivity();
    const { updatedAt } = await tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
    // Act
    const res = await requestAs(tb.app, owner, 'post', `/api/content/${contentId}/unpublish`).send({
      updatedAt: updatedAt.toISOString(),
    });
    // Assert
    expect(res.status).toBe(200);
    expect(await after(contentId)).toEqual({
      listed: false,
      events: [{ actorUserId: owner.principal.userId, details: { cause: 'unpublish' } }],
    });
  });

  it('[PROD-007] making the activity private removes the listing, audited with the cause', async () => {
    // Arrange
    const contentId = await listedActivity();
    // Act
    const res = await requestAs(tb.app, owner, 'patch', `/api/content/${contentId}/sharing`).send({
      visibility: 'private',
    });
    // Assert
    expect(res.status).toBe(200);
    expect(await after(contentId)).toEqual({
      listed: false,
      events: [{ actorUserId: owner.principal.userId, details: { cause: 'private' } }],
    });
  });

  it('[PROD-007] sharing it more widely keeps the listing', async () => {
    // Arrange
    const contentId = await listedActivity();
    // Act
    const res = await requestAs(tb.app, owner, 'patch', `/api/content/${contentId}/sharing`).send({
      visibility: 'feide',
    });
    // Assert
    expect(res.status).toBe(200);
    expect(await after(contentId)).toEqual({ listed: true, events: [] });
  });

  it('[PROD-007] a refused unpublish (a stale updatedAt) keeps the listing', async () => {
    // Arrange
    const contentId = await listedActivity();
    // Act
    const res = await requestAs(tb.app, owner, 'post', `/api/content/${contentId}/unpublish`).send({
      updatedAt: new Date(0).toISOString(),
    });
    // Assert: the same transaction, so nothing of it happened
    expect([res.status, res.body.errorCode]).toEqual([409, 'hvl:content-changed']);
    expect(await after(contentId)).toEqual({ listed: true, events: [] });
  });
});
