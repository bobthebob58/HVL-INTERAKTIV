/**
 * publishingDeps — what the publish flow is built from: the database, the pre-publish validator, a clock and the
 * activities' write lock.
 *
 * Why: the validator is pure and configured at start-up (D-073), so the publish and findings code takes it as a
 *      dependency instead of building it; the clock is passed in so tests can prove the 14-day rule (PROD-003)
 *      without waiting; the write lock keeps a publish from committing in the middle of a save (D-074).
 * Spec: PROD-003, UD-020
 * Invariants:
 *   - `validator` is the same function for the findings API, the publish API and the save gate, so all three agree.
 *   - `writeLock` is the same lock for the publish API and the save gate. createApp passes the Redis lock; without
 *     one, both use the process-wide lock, which serialises only within one process (tests).
 * Collaborators: ./ContentPublisher.ts, ./PublishedSaveGate.ts, ./storedContent.ts, ./ContentWriteLock.ts,
 *   ../server/createApp.ts.
 * Tests: apps/server/test/http/api/publishRoutes.int.test.ts, apps/server/test/content/publishedSave.int.test.ts,
 *   apps/server/test/content/saveRace.int.test.ts
 */
import type { Database } from '../infra/prismaClient.js';
import type { ContentValidator } from '../validation/types.js';
import type { ContentWriteLock } from './ContentWriteLock.js';

/** The current moment; `() => new Date()` outside tests. */
export type Clock = () => Date;

/** The publish flow's dependencies. */
export interface PublishingDeps {
  readonly db: Database;
  /** The pre-publish validator (UD-020), with its configuration already bound. */
  readonly validator: ContentValidator;
  readonly clock: Clock;
  /** One save or publish of an activity at a time (D-074); the process-wide lock when absent. */
  readonly writeLock?: ContentWriteLock;
}
