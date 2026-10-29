/**
 * bankListingWrites — sets and clears an activity's content-bank listing (`H5PContent.bankListedAt`) and audits each
 * change, inside the caller's transaction.
 *
 * Why: D-091 makes the bank opt-in, needs a published activity shared with HVL or wider, and (as amended) removes the
 *      listing in the same transaction that unpublishes the activity or makes it private. The owner's own listing
 *      and unlisting, the publish flow and the sharing route all change the flag here, so every change is audited
 *      the same way.
 * Spec: PROD-007, DATA-007
 * Invariants:
 *   - Listing is one conditional UPDATE: it sets the flag only while the activity is published, shared with HVL or
 *     wider (`organisation`, `feide`) and not yet listed, so a concurrent unpublish or change to private can never
 *     leave a listed activity that no longer qualifies.
 *   - Neither statement touches `updatedAt`: the listing is not a change of the activity, so the publish flow's
 *     `updatedAt` precondition (D-074) and the "newest change first" lists stay as they were. (Raw SQL, because
 *     Prisma sets an `@updatedAt` column on every update it makes.)
 *   - An audit event is written only when the flag really changed; it names the actor in its column, and its details
 *     hold the consent version or the cause only (DATA-007).
 * Collaborators: ./contentBank.ts (the owner's routes), ../../content/ContentPublisher.ts (unpublish),
 *   ../../http/api/contentSharingRoutes.ts (private), ../../infra/prismaClient.ts.
 * Tests: apps/server/test/learningDesign/collaboration/contentBank.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/bankListingCleared.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';

/** The audit action of a bank listing. */
export const BANK_LISTED_ACTION = 'content.bank.list';
/** The audit action of a removed bank listing. */
export const BANK_UNLISTED_ACTION = 'content.bank.unlist';

/** Why a listing was removed: by the owner, or because the activity was unpublished or made private (D-091). */
export type BankUnlistCause = 'owner' | 'unpublish' | 'private';

/** The part of the client (or a transaction) these writes use. */
export type BankListingClient = Pick<Database, '$executeRaw' | 'auditEvent'>;

/** Who changes the listing of which activity. */
export interface BankListingChange {
  /** The canonical activity ID. */
  readonly contentId: string;
  /** `User.id` of the person whose request changes it. */
  readonly actorUserId: string;
}

const audit = (
  client: BankListingClient,
  change: BankListingChange,
  action: string,
  details: Record<string, string | number>,
) =>
  client.auditEvent.create({
    data: {
      actorUserId: change.actorUserId,
      action,
      targetType: 'H5PContent',
      targetId: change.contentId,
      // PRIVACY: a version number or a cause, never a name or a text (DATA-007).
      details,
    },
  });

/**
 * Lists an activity in the bank if it qualifies now and is not listed yet, and audits it.
 * @param client - The database or the caller's transaction.
 * @param change - The activity and the owner.
 * @param consentVersion - The consent text version the owner accepted (`BANK_CONSENT_VERSION`).
 * @param now - The listing time.
 * @returns True when this call listed it; false when it was listed already or does not qualify.
 * @spec PROD-007
 */
export async function listInBank(
  client: BankListingClient,
  change: BankListingChange,
  consentVersion: number,
  now: Date,
): Promise<boolean> {
  // WHY: `AT TIME ZONE 'UTC'` stores the UTC wall time Prisma reads back, whatever the session's time zone.
  const listed = await client.$executeRaw`
    UPDATE "H5PContent" SET "bankListedAt" = ${now.toISOString()}::timestamptz AT TIME ZONE 'UTC'
    WHERE "id" = ${change.contentId}::uuid AND "bankListedAt" IS NULL
      AND "status" = 'published' AND "visibility" IN ('organisation', 'feide')`;
  if (listed === 0) return false;
  await audit(client, change, BANK_LISTED_ACTION, { consentVersion });
  return true;
}

/**
 * Removes an activity's bank listing, if it has one, and audits it with the cause.
 * @param client - The database or the caller's transaction (the publish flow's or the sharing route's).
 * @param change - The activity and the person whose request removes the listing.
 * @param cause - The owner's unlisting, or the unpublish or change to private that ends it.
 * @returns True when a listing was removed.
 * @spec PROD-007
 */
export async function clearBankListing(
  client: BankListingClient,
  change: BankListingChange,
  cause: BankUnlistCause,
): Promise<boolean> {
  const cleared = await client.$executeRaw`
    UPDATE "H5PContent" SET "bankListedAt" = NULL
    WHERE "id" = ${change.contentId}::uuid AND "bankListedAt" IS NOT NULL`;
  if (cleared === 0) return false;
  await audit(client, change, BANK_UNLISTED_ACTION, { cause });
  return true;
}
