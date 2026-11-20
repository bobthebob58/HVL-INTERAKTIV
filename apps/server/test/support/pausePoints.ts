/**
 * pausePoints — lets a test stop one step of the code under test until the test lets it go on.
 *
 * Why: the tests of two requests for one activity at the same time (a save and a publish, a save and a delete)
 *      must decide the order themselves; waiting and hoping would make them slow and unreliable.
 * Spec: PROD-003, H5P-006
 * Invariants:
 *   - A paused method runs with its real object as `this`, and returns what the real method returns.
 * Collaborators: none.
 * Tests: used by apps/server/test/content/saveRace.int.test.ts and apps/server/test/content/deleteRace.int.test.ts
 */

/** A step that stops until the test lets it go on, and tells the test when it has stopped. */
export interface PausePoint {
  /** Settles when the paused step has been reached. */
  readonly hasReached: Promise<void>;
  /** Lets the paused step go on. */
  release(): void;
  /** What the paused step awaits. */
  wait(): Promise<void>;
}

/**
 * Makes a pause point.
 * @returns The point: pass `wait` to `pausing`, await `hasReached`, then call `release`.
 */
export function pausePoint(): PausePoint {
  let reached = (): void => undefined;
  let release = (): void => undefined;
  const hasReached = new Promise<void>((resolve) => (reached = resolve));
  const released = new Promise<void>((resolve) => (release = resolve));
  return { hasReached, release, wait: () => (reached(), released) };
}

/**
 * Wraps an object so one of its methods first waits at a pause point.
 * @param target - The object, e.g. the editor or the database client.
 * @param method - The method that waits.
 * @param at - What the method awaits before it runs.
 * @param member - When given, the method is looked for on this member of `target` (e.g. a Prisma model).
 * @returns A proxy that behaves as `target` in every other way.
 */
export function pausing<T extends object>(
  target: T,
  method: string,
  at: () => Promise<void>,
  member?: string,
): T {
  return new Proxy(target, {
    get(object, property) {
      const value: unknown = Reflect.get(object, property);
      if (member === undefined && property === method && typeof value === 'function') {
        return async (...args: unknown[]) => (await at(), Reflect.apply(value, object, args) as unknown);
      }
      if (member !== undefined && property === member) return pausing(value as object, method, at);
      return typeof value === 'function' ? value.bind(object) : value;
    },
  });
}
