/**
 * contentBank — one activity's place in the HVL content bank: whether it is listed and may be listed, and the owner's
 * listing and unlisting.
 *
 * Why: PROD-007 lets an author put an activity in the bank so colleagues can copy it. D-091 (as amended) makes that
 *      opt-in by the owner, with the consent text's version, for a published activity shared with HVL or wider whose
 *      owner is an HVL staff author; a student author lists nothing.
 * Spec: PROD-007, DATA-007, H5P-006
 * Invariants:
 *   - Order: View first (404, D-066); reading needs Edit (403 `hvl:edit-not-allowed`); listing and unlisting need the
 *     owner (403 `hvl:owner-only`); listing then needs a staff author (403 `hvl:sharing-not-allowed` for a student
 *     author, `error.forbidden` otherwise), the current consent version (else 400) and an eligible activity (409
 *     `hvl:bank-not-eligible`).
 *   - `eligible` is published AND `organisation` or `feide` AND an owner who is a staff author: the owner's own
 *     login facts when the owner asks, else the owner's `coAuthorSearchableAt` (./staffEligibility.ts).
 *   - Listing an activity that is listed already, and unlisting one that is not, change nothing (no audit event).
 * Collaborators: ./bankListingWrites.ts, ./staffEligibility.ts, ../../content/contentAccess.ts,
 *   ../http/collaborationRoutes.ts, @hvl-interaktiv/api-contract (`BANK_CONSENT_VERSION`).
 * Tests: apps/server/test/learningDesign/collaboration/contentBank.int.test.ts
 */
import {
  BANK_CONSENT_VERSION,
  bankListingRequestSchema,
  type BankListing,
} from '@hvl-interaktiv/api-contract';
import type { Principal } from '../../auth/Principal.js';
import { editableContent, viewableContent, type ContentAccess } from '../../content/contentAccess.js';
import type { Clock } from '../../content/publishingDeps.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { parseBody } from '../../http/api/apiBodies.js';
import { authError } from '../../http/authErrors.js';
import { HttpError } from '../../http/HttpError.js';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import type { Database } from '../../infra/prismaClient.js';
import { clearBankListing, listInBank } from './bankListingWrites.js';
import { isEligibleStaffAuthor, isSearchable } from './staffEligibility.js';

/** What the bank requests read and write. */
export interface ContentBankDeps {
  readonly db: Database;
  readonly access: ContentAccessRepository;
  readonly clock: Clock;
}

/** The visibilities that let an activity into the bank: HVL or wider (D-091). */
export const BANK_VISIBILITIES = ['organisation', 'feide'] as const;

const listingOf = async (deps: ContentBankDeps, principal: Principal, access: ContentAccess) => {
  const row = await deps.db.h5PContent.findUnique({
    where: { id: access.facts.contentId },
    select: {
      status: true,
      visibility: true,
      bankListedAt: true,
      owner: { select: { coAuthorSearchableAt: true } },
    },
  });
  if (!row) throw authError('hvl:activity-unavailable');
  const ownerEligible =
    access.role === 'owner'
      ? isEligibleStaffAuthor(principal)
      : isSearchable(row.owner.coAuthorSearchableAt, deps.clock());
  const shared = (BANK_VISIBILITIES as readonly string[]).includes(row.visibility);
  return {
    listedAt: row.bankListedAt?.toISOString() ?? null,
    eligible: row.status === 'published' && shared && ownerEligible,
  } satisfies BankListing;
};

const ownersOnly = async (deps: ContentBankDeps, principal: Principal, contentId: string) => {
  const access = await viewableContent(deps.access, principal, contentId);
  if (access.role !== 'owner') throw learningDesignError('hvl:owner-only');
  return access;
};

/**
 * Whether an activity is in the bank, and whether it may be listed now.
 * @param deps - Database, activity facts and clock.
 * @param principal - Who asks.
 * @param contentId - The ID from the path (untrusted).
 * @returns The listing.
 * @throws HttpError 404 `hvl:activity-unavailable`; 403 `hvl:edit-not-allowed`.
 * @spec PROD-007
 */
export async function readBankListing(
  deps: ContentBankDeps,
  principal: Principal,
  contentId: string,
): Promise<BankListing> {
  return listingOf(deps, principal, await editableContent(deps.access, principal, contentId));
}

/**
 * Lists an activity in the bank as its owner, who accepted the current consent text.
 * @param deps - Database, activity facts and clock.
 * @param principal - Who asks.
 * @param contentId - The ID from the path (untrusted).
 * @param body - `{ consentVersion }` (untrusted).
 * @returns The listing after the change.
 * @throws HttpError 404; 403 `hvl:owner-only`, `hvl:sharing-not-allowed`, `error.forbidden`; 400 `error.badRequest`;
 *   409 `hvl:bank-not-eligible`.
 * @spec PROD-007
 */
export async function listInBankRequest(
  deps: ContentBankDeps,
  principal: Principal,
  contentId: string,
  body: unknown,
): Promise<BankListing> {
  const access = await ownersOnly(deps, principal, contentId);
  // PRIVACY: the bank shows colleagues the owner's name, which /personvern tells only staff (D-091 as amended).
  if (principal.studentAuthor) throw authError('hvl:sharing-not-allowed');
  if (!isEligibleStaffAuthor(principal)) throw new HttpError(403, 'error.forbidden');
  const { consentVersion } = parseBody(bankListingRequestSchema, body);
  // WHY: listing is consent to a text; an old page that shows an older version must not list under the new one.
  if (consentVersion !== BANK_CONSENT_VERSION) throw new HttpError(400, 'error.badRequest');
  const change = { contentId: access.facts.contentId, actorUserId: principal.userId };
  const listing = await listingOf(deps, principal, access);
  if (listing.listedAt !== null) return listing;
  const listed = await deps.db.$transaction((tx) => listInBank(tx, change, consentVersion, deps.clock()));
  const after = await listingOf(deps, principal, access);
  // WHY: a second request at the same moment finds the activity listed by the first; that is not a refusal.
  if (!listed && after.listedAt === null) throw learningDesignError('hvl:bank-not-eligible');
  return after;
}

/**
 * Takes an activity out of the bank as its owner; copies already made stay with their authors (D-091).
 * @param deps - Database, activity facts and clock.
 * @param principal - Who asks.
 * @param contentId - The ID from the path (untrusted).
 * @returns The listing after the change.
 * @throws HttpError 404 `hvl:activity-unavailable`; 403 `hvl:owner-only`.
 * @spec PROD-007
 */
export async function unlistFromBankRequest(
  deps: ContentBankDeps,
  principal: Principal,
  contentId: string,
): Promise<BankListing> {
  const access = await ownersOnly(deps, principal, contentId);
  const change = { contentId: access.facts.contentId, actorUserId: principal.userId };
  await deps.db.$transaction((tx) => clearBankListing(tx, change, 'owner'));
  return listingOf(deps, principal, access);
}
