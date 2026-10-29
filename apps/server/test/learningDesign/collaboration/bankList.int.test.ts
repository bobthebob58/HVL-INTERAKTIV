/**
 * Integration tests of `GET /api/bank` (D-091 as amended): who may read the bank, which activities it lists and in
 * which order, and that an entry carries the owner's current name but never the rationale or the course code.
 *
 * Spec: PROD-007, PED-030, PED-032, DATA-002
 */
import { bankListSchema, type BankEntry } from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openApiTestbed, type TestContentOptions, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { storeMetadata } from '../metadata/metadataFixtures.js';
import { LTI_OVERRIDES, personNamed, runToken } from './collaborationFixtures.js';

const TOKEN = runToken();
const SHARED: TestContentOptions = { status: 'published', visibility: 'organisation' };

describeWithServices('[PROD-007] the content bank', () => {
  const tb = openApiTestbed();
  let owner: TestPrincipal;
  let reader: TestPrincipal;

  /** Stores an activity and, unless told otherwise, lists it in the bank at `listedAt`. */
  const activity = async (title: string, options: TestContentOptions, listedAt: Date | null) => {
    const contentId = await tb.content(owner.principal.userId, { ...options, title: `${title} ${TOKEN}` });
    await tb.db.h5PContent.update({ where: { id: contentId }, data: { bankListedAt: listedAt } });
    return contentId;
  };
  const mine = (body: { items: BankEntry[] }) => body.items.filter((entry) => entry.title.endsWith(TOKEN));

  beforeAll(async () => {
    owner = await personNamed(tb, `Eigar ${TOKEN}`);
    reader = await personNamed(tb, `Lesar ${TOKEN}`);
  });
  afterAll(() => tb.close());

  it('[PROD-007] lists published, listed activities shared with HVL or wider, newest listing first', async () => {
    // Arrange
    const older = await activity('Eldre', SHARED, new Date('2026-10-01T08:00:00.000Z'));
    const newer = await activity(
      'Nyare',
      { status: 'published', visibility: 'feide' },
      new Date('2026-10-02T08:00:00.000Z'),
    );
    await activity('Utkast', { status: 'draft', visibility: 'organisation' }, new Date());
    await activity('Privat', { status: 'published', visibility: 'private' }, new Date());
    await activity('Ikkje i banken', SHARED, null);
    // Act
    const res = await requestAs(tb.app, reader, 'get', '/api/bank');
    // Assert
    expect(res.status).toBe(200);
    expect(mine(bankListSchema.parse(res.body)).map((entry) => entry.contentId)).toEqual([newer, older]);
  });

  it('[PROD-007] leaves out listings whose owner is no longer findable staff, so their name stops showing', async () => {
    // Arrange: the owner's last eligible Feide login was over 13 months ago
    const listed = await activity('Gammal eigar', SHARED, new Date());
    await tb.db.user.update({
      where: { id: owner.principal.userId },
      data: { coAuthorSearchableAt: new Date('2025-01-01T08:00:00.000Z') },
    });
    // Act
    const res = await requestAs(tb.app, reader, 'get', '/api/bank');
    await tb.db.user.update({
      where: { id: owner.principal.userId },
      data: { coAuthorSearchableAt: new Date() },
    });
    const again = await requestAs(tb.app, reader, 'get', '/api/bank');
    // Assert
    expect(mine(bankListSchema.parse(res.body)).map((entry) => entry.contentId)).not.toContain(listed);
    expect(mine(bankListSchema.parse(again.body)).map((entry) => entry.contentId)).toContain(listed);
  });

  it('[PROD-007] an entry has what colleagues choose by and the owner’s current name, never rationale or course code', async () => {
    // Arrange
    const contentId = await activity('Full', SHARED, new Date());
    await storeMetadata(tb.db, contentId, {
      phase: 'etterarbeid',
      courseCode: 'SYK110',
      rationale: `Mi eiga grunngjeving ${TOKEN}`,
      estimatedStudentMinutes: 15,
      learnerPurpose: 'Du hentar fram det du lærte.',
      outcomes: [{ text: 'Forklare omgrepet', category: 'kunnskap' }],
    });
    await tb.db.user.update({
      where: { id: owner.principal.userId },
      data: { displayName: `Nytt namn ${TOKEN}` },
    });
    // Act
    const res = await requestAs(tb.app, reader, 'get', '/api/bank');
    // Assert
    const entry = mine(res.body as { items: BankEntry[] }).find((item) => item.contentId === contentId);
    expect(entry).toMatchObject({
      title: `Full ${TOKEN}`,
      mainLibrary: 'H5P.MultiChoice',
      phase: 'etterarbeid',
      estimatedStudentMinutes: 15,
      learnerPurpose: 'Du hentar fram det du lærte.',
      outcomes: [{ text: 'Forklare omgrepet', category: 'kunnskap' }],
      ownerName: `Nytt namn ${TOKEN}`,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/SYK110|grunngjeving|rationale|courseCode/);
    expect(JSON.stringify(res.body)).not.toContain(owner.principal.userId);
  });

  it.each([
    [
      'a student author',
      { role: 'author', overrides: { studentAuthor: true } },
      403,
      'hvl:sharing-not-allowed',
    ],
    ['a portal learner', { role: 'learner' }, 403, 'error.forbidden'],
    ['an admin-only member', { role: 'admin' }, 403, 'error.forbidden'],
    ['a Canvas launch (ltik)', { role: 'author', overrides: LTI_OVERRIDES }, 401, 'hvl:unauthenticated'],
  ] as const)('[PROD-007] %s may not read the bank', async (_name, who, status, code) => {
    // Arrange
    const caller = await tb.principal(who.role, 'overrides' in who ? who.overrides : {});
    // Act
    const res = await requestAs(tb.app, caller, 'get', '/api/bank');
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([status, code]);
    expect(res.body).not.toHaveProperty('items');
  });
});
