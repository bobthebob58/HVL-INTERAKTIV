/**
 * patternAvailabilityMemo — keeps each pattern's availability for a short time, so the public studio routes do not
 * build every skeleton on every anonymous request.
 *
 * Why: `PatternCreator.availability` builds each of a pattern's skeletons (library and semantics reads, the
 *      semantic-defaults walk) to tell whether its libraries are installed. `GET /api/studio` asks this for every
 *      pattern, and it needs no sign-in (D-089), so without a memo any visitor could make the server repeat that work
 *      at will (S5 W1a review; D-083 amendment 2026-10-29, S5 integration).
 * Spec: PED-001, PROD-001
 * Invariants:
 *   - An answer is kept for `ttlMs` (60 s by default): a library an administrator installs or removes shows within
 *     that time. Creating an activity never reads the memo; `PatternCreator.create` checks the libraries itself.
 *   - Requests for the same pattern while an answer is being worked out share it, so a burst builds once.
 *   - A failure is never kept: the next request asks again.
 * Collaborators: ./studioContentRoutes.ts (uses it), ./studioContentAnswers.ts (`PatternAvailabilityLookup`),
 *   ../patterns/PatternCreator.ts.
 * Tests: apps/server/test/learningDesign/http/patternAvailabilityMemo.test.ts
 */
import type { PatternAvailabilityLookup } from './studioContentAnswers.js';

/** How long an availability answer is kept by default, in milliseconds. */
export const PATTERN_AVAILABILITY_TTL_MS = 60_000;

type Availability = Awaited<ReturnType<PatternAvailabilityLookup['availability']>>;

/** What the memo needs besides the lookup; both have defaults. */
export interface PatternAvailabilityMemoOptions {
  /** How long an answer is kept, in milliseconds. */
  readonly ttlMs?: number;
  /** The clock, in milliseconds (tests pass their own). */
  readonly now?: () => number;
}

/**
 * Wraps an availability lookup in a short-lived memo.
 * @param lookup - The pattern creator, or anything with its `availability`.
 * @param options - The time an answer is kept and the clock.
 * @returns A lookup with the same answers, each kept for `ttlMs`.
 * @example
 * const available = memoizePatternAvailability(deps.studio.patternCreator);
 * await studioOverviewAnswer(content, available);
 * @spec PED-001
 */
export function memoizePatternAvailability(
  lookup: PatternAvailabilityLookup,
  options: PatternAvailabilityMemoOptions = {},
): PatternAvailabilityLookup {
  const ttlMs = options.ttlMs ?? PATTERN_AVAILABILITY_TTL_MS;
  const now = options.now ?? Date.now;
  const kept = new Map<string, { readonly answer: Promise<Availability>; readonly until: number }>();
  return {
    availability(patternId) {
      const entry = kept.get(patternId);
      if (entry && now() < entry.until) return entry.answer;
      const answer = lookup.availability(patternId);
      kept.set(patternId, { answer, until: now() + ttlMs });
      // WHY: a failed build must not be served for a minute; the entry is dropped so the next request retries.
      answer.catch(() => {
        if (kept.get(patternId)?.answer === answer) kept.delete(patternId);
      });
      return answer;
    },
  };
}
