/**
 * videoTimeline — what an InteractiveVideo's parameters tell about time: when each interaction appears, and the
 * latest moment the video is known to reach.
 *
 * Why: PED-H01 and PED-H02 need the video's length and the gaps between checks. H5P does not store the video's
 *      duration in content.json, so the latest interaction, bookmark or submit screen is the best known lower
 *      bound; the stretch after it up to the real end stays unknown.
 * Spec: PED-020
 * Invariants:
 *   - Times are in seconds, as H5P stores them (`duration.from`, `bookmarks[].time`, `endscreens[].time`).
 *   - Interactions without a valid start time are left out.
 *   - Output is sorted by time, then by list position, so it is deterministic.
 * Collaborators: ./rules/videoLengthHint.ts, ./rules/videoInteractionGapHint.ts, ./rules/videoSummaryHint.ts.
 * Tests: apps/server/test/validation/rules/videoInteractionGapHint.test.ts
 */
import { machineNameOf } from './contentKinds.js';
import { asArray, asNumber, asString, fieldAt } from './paramReaders.js';

/** One interaction on the video's timeline. */
export interface TimedInteraction {
  /** Start time in seconds. */
  readonly from: number;
  /** End time in seconds (the start time when not set). */
  readonly to: number;
  /** e.g. `H5P.MultiChoice`; `undefined` when the interaction has no content yet. */
  readonly machineName: string | undefined;
}

/** The timeline of one InteractiveVideo. */
export interface VideoTimeline {
  readonly interactions: readonly TimedInteraction[];
  /** The latest time any interaction, bookmark or submit screen refers to (0 when none). */
  readonly knownEnd: number;
}

/**
 * Reads the timeline of an InteractiveVideo.
 * @param params - The InteractiveVideo node's params.
 * @returns Its interactions, sorted by start time, and the known end.
 */
export function timelineOf(params: unknown): VideoTimeline {
  const assets = fieldAt(params, 'interactiveVideo', 'assets');
  const interactions = asArray(fieldAt(assets, 'interactions'))
    .map((item, index) => {
      const from = asNumber(fieldAt(item, 'duration', 'from'));
      const to = asNumber(fieldAt(item, 'duration', 'to'));
      const library = asString(fieldAt(item, 'action', 'library'));
      return {
        index,
        from,
        to: Math.max(to ?? 0, from ?? 0),
        machineName: library && machineNameOf(library),
      };
    })
    .filter((item): item is typeof item & { from: number } => item.from !== undefined && item.from >= 0)
    .sort((a, b) => a.from - b.from || a.index - b.index)
    .map(({ from, to, machineName }) => ({ from, to, machineName }));
  const marks = [
    ...asArray(fieldAt(assets, 'bookmarks')).map((b) => asNumber(fieldAt(b, 'time'))),
    ...asArray(fieldAt(assets, 'endscreens')).map((e) => asNumber(fieldAt(e, 'time'))),
    ...interactions.map((i) => i.to),
  ].filter((time): time is number => time !== undefined);
  return { interactions, knownEnd: marks.reduce((latest, time) => Math.max(latest, time), 0) };
}
