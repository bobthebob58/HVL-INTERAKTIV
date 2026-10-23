/**
 * ltiRecordLifetimes — how long the short-lived ltijs records live: OIDC nonces and launch ID tokens.
 *
 * Why: `LTI-002` fixes the lifetimes (nonces 10 minutes, ID tokens 24 hours, D-052). The storage that writes
 *      the records and the job that deletes them must use the same numbers, so they are defined once here.
 * Spec: LTI-002
 * Invariants:
 *   - A nonce older than `NONCE_LIFETIME_MS` is never accepted, whether or not the cleanup job has run.
 *   - An ID token is never returned after `ID_TOKEN_LIFETIME_MS`, which equals the ltik's own 24-hour life.
 * Collaborators: ./PrismaLtiDatabaseManager.ts, ./LtiRecordCleanupJob.ts.
 * Tests: apps/server/test/lti/storage/PrismaLtiDatabaseManager.int.test.ts,
 *   apps/server/test/lti/storage/LtiRecordCleanupJob.test.ts
 */

/** How long a saved OIDC nonce can be consumed: 10 minutes, ltijs's own state lifetime (D-052). */
export const NONCE_LIFETIME_MS = 10 * 60 * 1000;

/** How long a launch's ID-token record lives: 24 hours, the lifetime of the ltik that points to it (D-052). */
export const ID_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
