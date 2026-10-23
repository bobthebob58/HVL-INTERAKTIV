/**
 * storedContent — reads an activity as the validator needs it, validates it, and reads its recent acknowledgements.
 *
 * Why: D-074 validates the stored activity on the server and never trusts the client's findings, so the findings API,
 *      the publish API and the save gate all start from the same rows and the same validator input.
 * Spec: PROD-003, UD-020, UD-022
 * Invariants:
 *   - The validator's `mainLibrary` is `Name major.minor`, taken from the stored metadata's dependencies (Lumi stores
 *     only the machine name in `H5PContent.mainLibrary`).
 *   - Only acknowledgements younger than 14 days are read; older ones stay stored for insight and the portfolio.
 *   - An activity that has disappeared is `hvl:activity-unavailable`, as if it never existed (D-066).
 * Collaborators: ./publishingDeps.ts, ./acknowledgementCoverage.ts, ./ContentPublisher.ts, ./PublishedSaveGate.ts.
 * Tests: apps/server/test/content/storedContent.test.ts, apps/server/test/http/api/publishRoutes.int.test.ts
 */
import { authError } from '../http/authErrors.js';
import type { Locale } from '../i18n/translate.js';
import type { Database } from '../infra/prismaClient.js';
import type { Finding, ValidationInput, ValidationMetadata } from '../validation/types.js';
import { ACKNOWLEDGEMENT_LIFETIME_MS, type StoredAcknowledgement } from './acknowledgementCoverage.js';
import type { PublishingDeps } from './publishingDeps.js';

/** The parts of an `H5PContent` row the publish flow reads. */
export interface StoredContentRow {
  readonly id: string;
  readonly mainLibrary: string;
  readonly params: unknown;
  readonly metadata: unknown;
  readonly status: 'draft' | 'published';
  readonly updatedAt: Date;
}

interface LibraryRef {
  readonly machineName?: unknown;
  readonly majorVersion?: unknown;
  readonly minorVersion?: unknown;
}

/**
 * The main library as the validator names it.
 * @param mainLibrary - The machine name, e.g. `H5P.MultiChoice`.
 * @param metadata - The stored h5p.json metadata, whose `preloadedDependencies` hold the versions.
 * @returns e.g. `H5P.MultiChoice 1.16`, or the machine name alone when the metadata has no version for it.
 */
export function mainLibraryUbername(mainLibrary: string, metadata: unknown): string {
  const dependencies = (metadata as { preloadedDependencies?: unknown } | null)?.preloadedDependencies;
  const main = Array.isArray(dependencies)
    ? (dependencies as LibraryRef[]).find((dependency) => dependency?.machineName === mainLibrary)
    : undefined;
  const { majorVersion: major, minorVersion: minor } = main ?? {};
  return Number.isInteger(major) && Number.isInteger(minor)
    ? `${mainLibrary} ${String(major)}.${String(minor)}`
    : mainLibrary;
}

/**
 * The validator input for a stored activity.
 * @param row - The activity.
 * @param locale - The language of the messages.
 * @returns The input for `ContentValidator`.
 */
export const storedValidationInput = (row: StoredContentRow, locale: Locale): ValidationInput => ({
  mainLibrary: mainLibraryUbername(row.mainLibrary, row.metadata),
  params: row.params,
  metadata: (row.metadata ?? {}) as ValidationMetadata,
  locale,
});

/**
 * Reads an activity and validates what is stored.
 * @param deps - Database and validator.
 * @param contentId - The canonical activity ID (from the access check).
 * @param locale - The language of the messages.
 * @returns The row and the validator's findings.
 * @throws HttpError 404 `hvl:activity-unavailable` when the activity no longer exists.
 */
export async function validateStoredContent(
  deps: Pick<PublishingDeps, 'db' | 'validator'>,
  contentId: string,
  locale: Locale,
): Promise<{ row: StoredContentRow; findings: readonly Finding[] }> {
  const row = await deps.db.h5PContent.findUnique({
    where: { id: contentId },
    select: { id: true, mainLibrary: true, params: true, metadata: true, status: true, updatedAt: true },
  });
  if (!row) throw authError('hvl:activity-unavailable');
  return { row, findings: deps.validator(storedValidationInput(row, locale)) };
}

/**
 * Reads the acknowledgements of an activity that may still hold.
 * @param db - The database.
 * @param contentId - The canonical activity ID.
 * @param now - The current moment.
 * @returns Acknowledgements younger than 14 days, newest first.
 */
export async function recentAcknowledgements(
  db: Database,
  contentId: string,
  now: Date,
): Promise<StoredAcknowledgement[]> {
  return db.validationAcknowledgement.findMany({
    where: { contentId, at: { gt: new Date(now.getTime() - ACKNOWLEDGEMENT_LIFETIME_MS) } },
    select: { ruleId: true, path: true, reason: true, at: true },
    orderBy: { at: 'desc' },
  });
}
