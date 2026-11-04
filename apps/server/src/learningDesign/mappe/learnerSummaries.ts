/**
 * learnerSummaries — turns the stored statements the pedagogisk mappe reads into one summary per learner and group
 * (attempts, completion, first and last scored result), from the groups of at least *k* learners only.
 *
 * Why: D-095 hands the mappe's aggregates the learners' summaries (./activityResults.ts), and D-115 says what each
 *      part reads, as insight does: a learner started with any stored statement, completed with a stored root
 *      result, the attempts are the stored root results, and the scores are the scaled scores of the root results
 *      with a maximum above 0. Insight reads them per course, version and period (D-106); the mappe adds up all of
 *      an activity's groups. So that its totals cannot be differenced against insight's views, each group counts as
 *      insight sees it: a group of fewer than *k* learners is left out altogether (the "all contexts minus one" D-106
 *      refused), and a learner in two groups gives one summary in each, as they are one learner in each of insight's
 *      two views. Merging them would let the mappe's totals, minus insight's, say how many learners played in two
 *      groups and whether that one learner completed in both.
 * Spec: MAPPE-003, INS-006
 * Invariants:
 *   - PRIVACY: a group is one activity in one course (`<platformId>:<contextId>`, D-103, or the portal's plays), one
 *     content version (PROD-013) and one semester (./resultSemesters.ts). Only groups with at least *k* distinct
 *     learners count; every summary is of one learner in one such group and reads that group's results only.
 *   - PRIVACY: the learner reference only tells learners apart inside this function; a summary carries no
 *     identifier, no answer and no time, only its group's number within the activity, which means nothing outside
 *     one read; the order of an activity's summaries means nothing.
 *   - A result counts only for a learner present in its group, so a row stored between the source's reads never
 *     adds a learner to a group, or a group of fewer than *k*.
 *   - Root results are taken in the order given (stored order: timestamp, then ID); the first and last scores are
 *     given only to a learner with two or more scored results in the group, since one attempt has no change
 *     (MAPPE-002), and a single attempt's 0 would let one retrying learner's change show through the mean.
 * Collaborators: ./storedActivityResults.ts (the caller), ./activityResults.ts, ./resultSemesters.ts,
 *   ../../xapi/xapiRootTests.ts (`isStoredRootResult`, `isGradableResult`), ../../privacy/minimumGroupSize.ts.
 * Tests: apps/server/test/learningDesign/mappe/learnerSummaries.test.ts,
 *   apps/server/test/learningDesign/mappe/storedActivityResults.int.test.ts
 */
import { visibleCount, type MinimumGroupSize } from '../../privacy/minimumGroupSize.js';
import { isGradableResult, isStoredRootResult } from '../../xapi/xapiRootTests.js';
import type { LearnerAttemptSummary } from './activityResults.js';
import { semesterStartOf } from './resultSemesters.js';

/** Where a learner's stored statement belongs, besides its semester. */
export interface StoredPlace {
  readonly contentId: string;
  /** `<platformId>:<contextId>`, or null for the portal's plays (D-103). */
  readonly contextId: string | null;
  readonly contentVersion: number;
  /** Tells learners apart; never leaves this module. */
  readonly learner: string;
}

/** A learner who stored at least one statement in a place during the semester starting at `semesterStart`. */
export interface LearnerPresence extends StoredPlace {
  /** The semester's start (./resultSemesters.ts). */
  readonly semesterStart: Date;
}

/** A stored root `answered` or `completed` with its score, as the source reads it. */
export interface LearnerRootResult extends StoredPlace {
  readonly subContentId: string | null;
  readonly verb: string;
  readonly scoreMax: number | null;
  readonly scaled: number | null;
  readonly timestamp: Date;
}

/** What is counted for one learner in one group. */
interface Tally {
  attempts: number;
  readonly scores: number[];
}

/** One group's learners as they are counted. */
interface Group {
  readonly contentId: string;
  readonly tallies: Map<string, Tally>;
}

const groupOf = (place: StoredPlace, semesterStart: Date): string =>
  JSON.stringify([place.contentId, place.contextId, place.contentVersion, semesterStart.getTime()]);

const summaryOf = ({ attempts, scores }: Tally, group: number): LearnerAttemptSummary => {
  const twoOrMore = scores.length >= 2;
  return {
    group,
    attempts,
    completed: attempts > 0,
    firstScore: twoOrMore ? (scores[0] ?? null) : null,
    lastScore: twoOrMore ? (scores.at(-1) ?? null) : null,
  };
};

/**
 * One summary per learner and group, from the groups of at least *k* learners.
 * @param size - The minimum group size.
 * @param presences - Each learner's places per semester (one entry per learner, place and semester is enough).
 * @param results - The stored root results, in stored order.
 * @returns A map from activity to its summaries, each with its group's number (0, 1, … within the activity); an
 *   activity with no counted group is missing.
 * @spec MAPPE-003
 */
export function learnerSummaries(
  size: MinimumGroupSize,
  presences: readonly LearnerPresence[],
  results: readonly LearnerRootResult[],
): Map<string, LearnerAttemptSummary[]> {
  const groups = new Map<string, Group>();
  for (const presence of presences) {
    const key = groupOf(presence, presence.semesterStart);
    const group = groups.get(key) ?? { contentId: presence.contentId, tallies: new Map<string, Tally>() };
    if (!group.tallies.has(presence.learner))
      group.tallies.set(presence.learner, { attempts: 0, scores: [] });
    groups.set(key, group);
  }
  for (const result of results) {
    const tally = groups.get(groupOf(result, semesterStartOf(result.timestamp)))?.tallies.get(result.learner);
    if (!tally || !isStoredRootResult(result)) continue;
    tally.attempts += 1;
    if (isGradableResult(result) && result.scaled !== null) tally.scores.push(result.scaled);
  }
  const summaries = new Map<string, LearnerAttemptSummary[]>();
  for (const { contentId, tallies } of groups.values()) {
    // PRIVACY: a group of fewer than k learners is not counted at all, so insight's views cannot difference it out.
    if (visibleCount(size, tallies.size) === undefined) continue;
    const activity = summaries.get(contentId) ?? [];
    const group = new Set(activity.map((summary) => summary.group)).size;
    summaries.set(contentId, [...activity, ...[...tallies.values()].map((tally) => summaryOf(tally, group))]);
  }
  return summaries;
}
