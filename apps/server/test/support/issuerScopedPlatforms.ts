/**
 * issuerScopedPlatforms — an ltijs platform manager that lists only the platforms of one issuer, for the platform
 * sync of a test app.
 *
 * Why: `syncLtiPlatforms` deactivates every registered platform that is not configured (D-051). Test files share one
 *      database, so a test app's sync must see only its own mock Canvas, or it would deactivate another test's.
 * Spec: LTI-001
 * Invariants:
 *   - Only `getPlatforms` is narrowed; every other member is the manager's own, bound to it.
 * Collaborators: ./appTestbed.ts, ../../src/lti/platforms/syncLtiPlatforms.ts, ltijs's `Provider.platformManager`.
 * Tests: shared by the users of ./appTestbed.ts (e.g. apps/server/test/lti/ltiLaunch.int.test.ts).
 */
import type { Provider } from 'ltijs';

/** The ltijs platform manager. */
export type PlatformManager = Provider['platformManager'];

/**
 * The platform manager as the sync sees it: only the platforms of one issuer.
 * @param manager - The app's platform manager.
 * @param issuer - The issuer whose platforms it lists, e.g. the mock Canvas's.
 * @returns A view of the same manager.
 */
export const scopedTo = (manager: PlatformManager, issuer: string): PlatformManager =>
  new Proxy(manager, {
    get(target, property, receiver) {
      if (property === 'getPlatforms') return async () => target.getPlatforms({ url: issuer });
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
