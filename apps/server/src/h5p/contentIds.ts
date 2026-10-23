/**
 * contentIds — the one rule for what counts as an activity ID.
 *
 * Why: activity IDs come from URLs and from Lumi, so every lookup checks the shape before it reaches PostgreSQL
 *      (`H5PContent.id` is a UUID column; a malformed value would make the query fail instead of answering
 *      "not found"). Three modules needed the same check; one definition keeps them in step.
 * Spec: H5P-004, H5P-006
 * Invariants:
 *   - Accepts a canonical UUID in any letter case, nothing else.
 * Collaborators: ./permissions/ContentAccessRepository.ts, ./storage/PrismaContentStorage.ts,
 *   ./storage/learnerStateRows.ts.
 * Tests: apps/server/test/h5p/permissions/HvlPermissionSystem.int.test.ts,
 *   apps/server/test/h5p/contentStorage.int.test.ts
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tells whether a value can be an activity ID.
 * @param value - Any value, usually from a request or from Lumi.
 * @returns True only for a canonical UUID (the `H5PContent.id` column type).
 */
export const isContentUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value);
