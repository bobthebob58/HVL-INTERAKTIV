/**
 * Integration tests of an activity's content-bank listing (D-091 as amended): its preconditions, who may read, list
 * and unlist it, the consent version, idempotent changes, the audit trail, and that listing is not a change of the
 * activity (`updatedAt` stays).
 *
 * Spec: PROD-007, DATA-007, H5P-006
 */
import { BANK_CONSENT_VERSION, bankListingSchema } from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaContentAccessRepository } from '../../../src/h5p/permissions/ContentAccessRepository.js';
import type { Database } from '../../../src/infra/prismaClient.js';
import {
  BANK_LISTED_ACTION,
  BANK_UNLISTED_ACTION,
} from '../../../src/learningDesign/collaboration/bankListingWrites.js';
import { listInBankRequest } from '../../../src/learningDesign/collaboration/contentBank.js';
import { openApiTestbed, type TestContentOptions, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { EXPIRED_LOGIN, LTI_OVERRIDES, personNamed, runToken } from './collaborationFixtures.js';

const TOKEN = runToken();
const SHARED: TestContentOptions = { status: 'published', visibility: 'organisation' };

describeWithServices('[PROD-007] listing an activity in the content bank', () => {
  const tb = openApiTestbed();
  let owner: TestPrincipal;
  let coAuthor: TestPrincipal;
  const path = (contentId: string) => `/api/content/${contentId}/bank`;
  const list = (who: TestPrincipal, contentId: string, consentVersion: unknown = BANK_CONSENT_VERSION) =>
    requestAs(tb.app, who, 'put', path(contentId)).send({ consentVersion });
  const stored = (id: string) =>
    tb.db.h5PContent.findUniqueOrThrow({ where: { id }, select: { bankListedAt: true, updatedAt: true } });
  const events = (contentId: string) =>
    tb.db.auditEvent.findMany({
      where: { targetId: contentId, action: { in: [BANK_LISTED_ACTION, BANK_UNLISTED_ACTION] } },
      orderBy: { at: 'asc' },
      select: { actorUserId: true, action: true, details: true },
    });

  beforeAll(async () => {
    owner = await personNamed(tb, `Eigar ${TOKEN}`);
    coAuthor = await personNamed(tb, `Medforfattar ${TOKEN}`);
  });
  afterAll(() => tb.close());

  it('[PROD-007] the owner lists and unlists once each, audited, without changing the activity', async () => {
    // Arrange
    const contentId = await tb.content(owner.principal.userId, SHARED);
    const before = await stored(contentId);
    // Act
    const listed = await list(owner, contentId);
    const again = await list(owner, contentId);
    const unlisted = await requestAs(tb.app, owner, 'delete', path(contentId));
    const unlistedAgain = await requestAs(tb.app, owner, 'delete', path(contentId));
    // Assert: the answers, and one event per real change with the consent version or the cause
    expect(bankListingSchema.parse(listed.body)).toMatchObject({
      eligible: true,
      listedAt: expect.any(String),
    });
    expect(again.body).toEqual(listed.body);
    expect([unlisted.status, unlisted.body]).toEqual([200, { listedAt: null, eligible: true }]);
    expect(unlistedAgain.status).toBe(200);
    expect(await events(contentId)).toEqual([
      { actorUserId: owner.principal.userId, action: BANK_LISTED_ACTION, details: { consentVersion: 1 } },
      { actorUserId: owner.principal.userId, action: BANK_UNLISTED_ACTION, details: { cause: 'owner' } },
    ]);
    expect((await stored(contentId)).updatedAt).toEqual(before.updatedAt);
  });

  it.each([
    ['a draft', { status: 'draft', visibility: 'organisation' }],
    ['a private activity', { status: 'published', visibility: 'private' }],
  ] as const)('[PROD-007] %s is not eligible and cannot be listed', async (_name, options) => {
    // Arrange
    const contentId = await tb.content(owner.principal.userId, options);
    // Act
    const read = await requestAs(tb.app, owner, 'get', path(contentId));
    const listed = await list(owner, contentId);
    // Assert
    expect(read.body).toEqual({ listedAt: null, eligible: false });
    expect([listed.status, listed.body.errorCode]).toEqual([409, 'hvl:bank-not-eligible']);
    expect((await stored(contentId)).bankListedAt).toBeNull();
  });

  it('[PROD-007] a listing that meets one made at the same moment answers the listing, not a refusal', async () => {
    // Arrange: the other request lists the activity between this one's read and its update
    const contentId = await tb.content(owner.principal.userId, SHARED);
    const db = new Proxy(tb.db, {
      get: (target, key) =>
        key === '$transaction'
          ? async (write: Parameters<Database['$transaction']>[0]) => {
              await target.h5PContent.update({
                where: { id: contentId },
                data: { bankListedAt: new Date() },
              });
              return target.$transaction(write as never);
            }
          : Reflect.get(target, key),
    });
    const deps = { db, access: new PrismaContentAccessRepository(tb.db), clock: () => new Date() };
    // Act
    const listing = await listInBankRequest(deps, owner.principal, contentId, {
      consentVersion: BANK_CONSENT_VERSION,
    });
    // Assert
    expect(listing).toMatchObject({ listedAt: expect.any(String), eligible: true });
    expect(await events(contentId)).toEqual([]);
  });

  it('[PROD-007] an activity shared with every Feide user is eligible too', async () => {
    const contentId = await tb.content(owner.principal.userId, { status: 'published', visibility: 'feide' });
    expect((await list(owner, contentId)).status).toBe(200);
  });

  it.each([
    ['no version', null],
    ['an older version', 0],
    ['a newer version', BANK_CONSENT_VERSION + 1],
  ])(
    '[PROD-007] a listing with %s of the consent text is 400 and lists nothing',
    async (_name, consentVersion) => {
      const contentId = await tb.content(owner.principal.userId, SHARED);
      const res = await list(owner, contentId, consentVersion);
      expect([res.status, res.body.errorCode]).toEqual([400, 'error.badRequest']);
      expect((await stored(contentId)).bankListedAt).toBeNull();
    },
  );

  it('[PROD-007] a co-author sees the listing but may not change it; a viewer may not see it', async () => {
    // Arrange
    const viewer = await personNamed(tb, `Lesar ${TOKEN}`);
    const contentId = await tb.content(owner.principal.userId, {
      ...SHARED,
      coAuthors: [coAuthor.principal.userId],
    });
    // Act
    const read = await requestAs(tb.app, coAuthor, 'get', path(contentId));
    const listed = await list(coAuthor, contentId);
    const unlisted = await requestAs(tb.app, coAuthor, 'delete', path(contentId));
    const viewed = await requestAs(tb.app, viewer, 'get', path(contentId));
    // Assert
    expect(read.body).toEqual({ listedAt: null, eligible: true });
    expect([listed.status, listed.body.errorCode]).toEqual([403, 'hvl:owner-only']);
    expect([unlisted.status, unlisted.body.errorCode]).toEqual([403, 'hvl:owner-only']);
    expect([viewed.status, viewed.body.errorCode]).toEqual([403, 'hvl:edit-not-allowed']);
  });

  it('[PROD-007] an owner whose last eligible login is old makes the activity not eligible for co-authors', async () => {
    const old = await personNamed(tb, `Gammal ${TOKEN}`, { searchableAt: EXPIRED_LOGIN });
    const contentId = await tb.content(old.principal.userId, {
      ...SHARED,
      coAuthors: [coAuthor.principal.userId],
    });
    const read = await requestAs(tb.app, coAuthor, 'get', path(contentId));
    expect(read.body).toEqual({ listedAt: null, eligible: false });
  });

  it.each([
    ['a student author who owns it', { studentAuthor: true }, 403, 'hvl:sharing-not-allowed'],
    ['an owner launched from Canvas (ltik)', LTI_OVERRIDES, 401, 'hvl:unauthenticated'],
  ] as const)('[PROD-007] %s may not list it', async (_name, overrides, status, code) => {
    // Arrange
    const student = await tb.principal('author', overrides);
    const contentId = await tb.content(student.principal.userId, SHARED);
    // Act
    const res = await list(student, contentId);
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([status, code]);
    expect((await stored(contentId)).bankListedAt).toBeNull();
  });
});
