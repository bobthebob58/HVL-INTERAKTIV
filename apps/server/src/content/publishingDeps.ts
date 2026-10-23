/**
 * publishingDeps — what the publish flow is built from: the database, the pre-publish validator and a clock.
 *
 * Why: the validator is pure and configured at start-up (D-073), so the publish and findings code takes it as a
 *      dependency instead of building it; the clock is passed in so tests can prove the 14-day rule (PROD-003)
 *      without waiting.
 * Spec: PROD-003, UD-020
 * Invariants:
 *   - `validator` is the same function for the findings API, the publish API and the save gate, so all three agree.
 * Collaborators: ./ContentPublisher.ts, ./PublishedSaveGate.ts, ./storedContent.ts, ../server/createApp.ts.
 * Tests: apps/server/test/http/api/publishRoutes.int.test.ts, apps/server/test/content/publishedSave.int.test.ts
 */
import type { Database } from '../infra/prismaClient.js';
import type { ContentValidator } from '../validation/types.js';

/** The current moment; `() => new Date()` outside tests. */
export type Clock = () => Date;

/** The publish flow's dependencies. */
export interface PublishingDeps {
  readonly db: Database;
  /** The pre-publish validator (UD-020), with its configuration already bound. */
  readonly validator: ContentValidator;
  readonly clock: Clock;
}
