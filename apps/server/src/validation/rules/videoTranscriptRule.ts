/**
 * videoTranscriptRule (V-VID-TRANSCRIPT) — a video comes with a transcript or another text alternative.
 *
 * Why: WCAG 1.2.1 and 1.2.3 (media alternative): a transcript lets deafblind learners, screen-reader users and
 *      anyone who reads faster than they listen take in the content, and makes it searchable.
 * Spec: UD-021
 * Invariants:
 *   - Applies to `H5P.InteractiveVideo` and `H5P.Video`, at any depth; a video without files is skipped.
 *   - H5P has no transcript field, so a transcript counts as linked when any authored text in the activity (a
 *     link text or address, a text block, an interaction label) names one: «transkripsjon», "transcript",
 *     «tekstversjon», «tekstalternativ», «manus», "text alternative" or "text version".
 *   - Limitation: the rule cannot tell which video a transcript belongs to; one mention covers every video.
 * Collaborators: ../videoSources.ts, ../contentWalker.ts (authored strings).
 * Tests: apps/server/test/validation/rules/videoTranscriptRule.test.ts
 */
import type { RuleHit, RuleScope, ValidationRule } from '../rule.js';
import { videoOf } from '../videoSources.js';

const TRANSCRIPT =
  /(?<![\p{L}\p{N}])(?:transkripsjon\p{L}*|transkript\p{L}*|transcript\p{L}*|tekstversjon\p{L}*|tekstalternativ\p{L}*|manus\p{L}*|text alternatives?|text versions?)(?![\p{L}\p{N}])/iu;

const mentionsTranscript = (scope: RuleScope): boolean =>
  scope.nodes.some((node) =>
    node.strings.some(
      (field) =>
        TRANSCRIPT.test(field.rich.text) || field.rich.links.some((link) => TRANSCRIPT.test(link.href)),
    ),
  );

/** V-VID-TRANSCRIPT: videos need a transcript or text alternative. */
export const videoTranscriptRule: ValidationRule = {
  id: 'V-VID-TRANSCRIPT',
  requirement: 'UD-021',
  severity: 'warning',
  messages: ['V-VID-TRANSCRIPT.missing'],
  check(scope) {
    const videos = scope.nodes.map(videoOf).filter((video) => video !== undefined);
    if (videos.length === 0 || mentionsTranscript(scope)) return [];
    return videos.map((video): RuleHit => ({ path: video.filesPath, message: 'V-VID-TRANSCRIPT.missing' }));
  },
};
