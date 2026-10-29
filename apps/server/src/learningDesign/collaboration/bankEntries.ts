/**
 * bankEntries — the HVL content bank as one reader sees it: the published, listed activities they may view, newest
 * listing first, with the learning-design fields colleagues need to choose one.
 *
 * Why: PROD-007 lets colleagues find activities to copy and adapt. D-091 shows each with its title, type, phase,
 *      purpose, minutes, outcomes and the owner's name, to HVL staff authors only (as amended, never a student
 *      author, a learner or a Canvas launch).
 * Spec: PROD-007, PED-030, PED-032, DATA-002
 * Invariants:
 *   - Only activities that are published, listed and shared with HVL or wider are read, and each passes the same
 *     View rule as every other route (`decideContent`), so the bank never shows what the reader could not open.
 *   - PRIVACY: an entry never carries the rationale or the course code (the source author's own planning, D-092),
 *     nor any user ID, e-mail address or co-author; the owner's display name is read now, so a renamed owner shows
 *     their current name, and an empty one is null.
 *   - The purpose passes the same filter as for learners (`learnerInfoFields`: one with a control character is left
 *     out); the activity's language goes with it, so the page can mark it with `lang`.
 *   - PRIVACY: only listings whose owner is findable staff now (`findableStaffWhere`: an eligible Feide login in the
 *     last 13 months, D-090) are read, so the name of someone who has left HVL, or became a student author, stops
 *     showing to colleagues without anyone unlisting (D-091 amendment 2026-10-29). Their listing returns at their
 *     next eligible login.
 *   - At most `BANK_LIST_MAX_ENTRIES` entries, newest listing first (ties by ID, so the order is stable).
 * Collaborators: ./contentBank.ts (`BANK_VISIBILITIES`), ./staffEligibility.ts, ../../h5p/permissions/contentRules.ts,
 *   ../metadata/learnerInfoFields.ts, ../metadata/learningDesignRecord.ts, ../../validation/activityLanguage.ts,
 *   ../http/collaborationRoutes.ts.
 * Tests: apps/server/test/learningDesign/collaboration/bankList.int.test.ts
 */
import { ContentPermission } from '@lumieducation/h5p-server';
import type { BankEntry, BankList } from '@hvl-interaktiv/api-contract';
import type { Principal } from '../../auth/Principal.js';
import { principalToH5pActor } from '../../auth/principalToH5pActor.js';
import { asAccountUser } from '../../h5p/HvlH5pUser.js';
import { decideContent } from '../../h5p/permissions/contentRules.js';
import type { Database } from '../../infra/prismaClient.js';
import { activityLanguage } from '../../validation/activityLanguage.js';
import { findableStaffWhere } from './staffEligibility.js';
import { LEARNER_INFO_SELECT, learnerInfoFields } from '../metadata/learnerInfoFields.js';
import { contractOutcome } from '../metadata/learningDesignRecord.js';
import { BANK_VISIBILITIES } from './contentBank.js';

/** The most entries one bank answer holds (the newest listings). */
export const BANK_LIST_MAX_ENTRIES = 200;

const BANK_ROW = {
  id: true,
  title: true,
  mainLibrary: true,
  metadata: true,
  status: true,
  visibility: true,
  ownerUserId: true,
  updatedAt: true,
  bankListedAt: true,
  owner: { select: { displayName: true } },
  collaborators: { where: { role: 'coauthor' }, select: { userId: true } },
  // PRIVACY: never the rationale or the course code (D-092); only what colleagues choose by.
  learningDesign: {
    select: {
      phase: true,
      ...LEARNER_INFO_SELECT,
      outcomes: { select: { text: true, category: true }, orderBy: { position: 'asc' } },
    },
  },
} as const;

/**
 * Reads the bank for one reader.
 * @param db - The database.
 * @param reader - A person the bank is for (the route has checked `isBankReader`).
 * @param now - The current moment, for whether each owner is still findable staff.
 * @returns The entries the reader may view, newest listing first.
 * @spec PROD-007
 */
export async function readBank(db: Database, reader: Principal, now: Date = new Date()): Promise<BankList> {
  const rows = await db.h5PContent.findMany({
    where: {
      status: 'published',
      bankListedAt: { not: null },
      visibility: { in: [...BANK_VISIBILITIES] },
      owner: findableStaffWhere(now),
    },
    select: BANK_ROW,
    orderBy: [{ bankListedAt: 'desc' }, { id: 'desc' }],
    take: BANK_LIST_MAX_ENTRIES,
  });
  const user = asAccountUser(principalToH5pActor(reader));
  const items: BankEntry[] = [];
  for (const row of rows) {
    const facts = {
      contentId: row.id,
      ownerUserId: row.ownerUserId,
      coAuthorIds: row.collaborators.map((c) => c.userId),
      status: row.status,
      visibility: row.visibility,
      bankListed: true,
    };
    // SECURITY: the same View rule as opening the activity (H5P-006); the query alone is not the permission check.
    if (!row.bankListedAt || !decideContent(user, ContentPermission.View, facts)) continue;
    const design = row.learningDesign;
    const language = activityLanguage(row.metadata);
    const ownerName = row.owner.displayName;
    items.push({
      contentId: row.id,
      title: row.title,
      mainLibrary: row.mainLibrary,
      ...(language ? { language } : {}),
      ...(design?.phase ? { phase: design.phase } : {}),
      ...learnerInfoFields(design),
      outcomes: (design?.outcomes ?? []).map(contractOutcome),
      ownerName: ownerName === null || ownerName === '' ? null : ownerName,
      updatedAt: row.updatedAt.toISOString(),
      listedAt: row.bankListedAt.toISOString(),
    });
  }
  return { items };
}
