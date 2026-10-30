/**
 * patternBuildFailures — remembers which pattern skeletons could not be built for a reason other than a missing
 * library, so each such failure is logged once instead of on every catalogue request.
 *
 * Why: an installed library whose skeleton cannot be built (a `semantics.json` that does not parse, a damaged folder)
 *      makes its patterns unavailable rather than failing the whole overview (D-085 amendment 2026-10-29, S5 review).
 *      An administrator must still learn of it, but the public catalogue asks every minute, so the log says it once
 *      per pattern and content type until a build succeeds again.
 * Spec: PED-001, PROD-001
 * Invariants:
 *   - A warning names the pattern ID, the content type and the error's name only: no message, no people.
 *   - After a successful build of the same pair, its next failure is logged again.
 *   - Without a logger nothing is written, and the pattern is still reported unavailable.
 * Collaborators: ./PatternCreator.ts (reports builds), pino (`Logger`).
 * Tests: apps/server/test/learningDesign/patterns/patternAvailability.test.ts
 */
import type { Logger } from 'pino';

/** Where the warnings go: the server's logger, or anything with its `warn`. */
export type PatternBuildLog = Pick<Logger, 'warn'>;

/** The pattern-and-content-type pairs whose last build failed and was logged. */
export class PatternBuildFailures {
  private readonly logged = new Set<string>();

  /**
   * @param log - The server's logger; undefined writes nothing.
   */
  constructor(private readonly log: PatternBuildLog | undefined) {}

  /**
   * Notes a failed build and logs it, unless the same pair's failure is already logged.
   * @param patternId - The pattern.
   * @param contentType - The skeleton's content type.
   * @param error - What the build threw.
   */
  failed(patternId: string, contentType: string, error: unknown): void {
    const key = `${patternId} ${contentType}`;
    if (this.logged.has(key)) return;
    this.logged.add(key);
    const errorName = error instanceof Error ? error.name : typeof error;
    this.log?.warn({ patternId, contentType, errorName }, 'pattern skeleton not built; shown as unavailable');
  }

  /**
   * Notes a successful build, so a later failure of the same pair is logged again.
   * @param patternId - The pattern.
   * @param contentType - The skeleton's content type.
   */
  succeeded(patternId: string, contentType: string): void {
    this.logged.delete(`${patternId} ${contentType}`);
  }
}
