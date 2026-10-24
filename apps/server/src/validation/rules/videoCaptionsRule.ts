/**
 * videoCaptionsRule (V-VID-CAPTIONS) — every video has captions: a subtitles or captions text track (WebVTT), or a
 * source on a media service listed as captioned (`CAPTIONED_MEDIA_ORIGINS`, e.g. HVL's Panopto).
 *
 * Why: WCAG 1.2.2 (Captions, Prerecorded): learners who are deaf or hard of hearing, or who watch without sound,
 *      need the speech as text. Panopto adds captions on its own side, so its videos count as captioned when the
 *      origin is configured (D-073).
 * Spec: UD-021
 * Invariants:
 *   - Applies to `H5P.InteractiveVideo` and `H5P.Video`, at any depth; a video without files is skipped.
 *   - A track counts when it has a file and its kind is subtitles or captions. A track marked "descriptions" or
 *     "chapters" is not shown as captions, and a track with no kind is not added to the video at all
 *     (UPSTREAM: H5P.Video 1.6 html5.js `addTrack` skips it,
 *     https://github.com/h5p/h5p-video/blob/master/scripts/html5.js); the message names which of the two it is.
 *     InteractiveVideo hands its tracks to H5P.Video, so the same holds there.
 *   - Severity error: publishing needs a fix or an acknowledgement (PROD-003).
 * Collaborators: ../videoSources.ts; the origins come from ValidationContext.captionedMediaOrigins.
 * Tests: apps/server/test/validation/rules/videoCaptionsRule.test.ts
 */
import type { RuleHit, ValidationRule } from '../rule.js';
import type { ValidationMessageKey } from '../validationMessages.js';
import { originOf, videoOf, type VideoTrack } from '../videoSources.js';

const CAPTION_KINDS: ReadonlySet<string | undefined> = new Set(['subtitles', 'captions']);

const messageFor = (tracksWithFile: readonly VideoTrack[]): ValidationMessageKey => {
  if (tracksWithFile.length === 0) return 'V-VID-CAPTIONS.missing';
  return tracksWithFile.some((track) => (track.kind ?? '') === '')
    ? 'V-VID-CAPTIONS.kindNotSet'
    : 'V-VID-CAPTIONS.wrongKind';
};

/** V-VID-CAPTIONS: videos need captions. */
export const videoCaptionsRule: ValidationRule = {
  id: 'V-VID-CAPTIONS',
  requirement: 'UD-021',
  severity: 'error',
  messages: ['V-VID-CAPTIONS.missing', 'V-VID-CAPTIONS.wrongKind', 'V-VID-CAPTIONS.kindNotSet'],
  check(scope) {
    const captioned = new Set(scope.context.captionedMediaOrigins);
    const hits: RuleHit[] = [];
    for (const video of scope.nodes.map(videoOf)) {
      if (!video) continue;
      const withFile = video.tracks.filter((track) => track.file !== '');
      if (withFile.some((track) => CAPTION_KINDS.has(track.kind))) continue;
      if (video.files.some((file) => captioned.has(originOf(file) ?? ''))) continue;
      hits.push({ path: video.tracksPath, message: messageFor(withFile) });
    }
    return hits;
  },
};
