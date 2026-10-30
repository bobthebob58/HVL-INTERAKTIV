/**
 * placeholderRule (V-PLACEHOLDER) — the activity still holds pattern guidance `⟦…⟧`, or a required video or
 * background image is missing.
 *
 * Why: an activity created from a pattern holds guidance where the author's content goes and empty media slots
 *      (D-084). PROD-001 lets a new activity fail validation only on such deliberately flagged placeholders; guidance
 *      or an English error message shown to students instead of the activity is a real defect, so each is an error.
 * Spec: PROD-001, UD-020
 * Invariants:
 *   - Severity error: publishing needs a fix or an acknowledgement with a reason, as for every error (D-074,
 *     unchanged); one finding per field, at the field's path for «Gå til feltet».
 *   - Guidance: every string of the parameters, label groups included, and the titles of the activity and of each
 *     sub-content (../guidanceMarkers.ts); a lone `⟦` or `⟧` counts.
 *   - Media: an InteractiveVideo without a video and an ImageHotspots without a background image, also as
 *     sub-content (../requiredMedia.ts).
 * Collaborators: ../guidanceMarkers.ts, ../requiredMedia.ts, ../rule.ts.
 * Tests: apps/server/test/validation/rules/placeholderRule.test.ts
 */
import { guidanceExcerpt, guidanceFields } from '../guidanceMarkers.js';
import { missingMedia } from '../requiredMedia.js';
import type { RuleHit, ValidationRule } from '../rule.js';

/** V-PLACEHOLDER: no pattern guidance left, and no required medium missing. */
export const placeholderRule: ValidationRule = {
  id: 'V-PLACEHOLDER',
  requirement: 'PROD-001',
  severity: 'error',
  messages: ['V-PLACEHOLDER.guidance', 'V-PLACEHOLDER.videoMissing', 'V-PLACEHOLDER.backgroundImageMissing'],
  check(scope) {
    const [activity] = scope.nodes;
    const guidance = guidanceFields(activity?.params, scope.metadata.title).map(
      ({ path, text }): RuleHit => ({
        path,
        message: 'V-PLACEHOLDER.guidance',
        values: { text: guidanceExcerpt(text) },
      }),
    );
    const media = missingMedia(scope.nodes).map(({ kind, path }): RuleHit => ({
      path,
      message: kind === 'video' ? 'V-PLACEHOLDER.videoMissing' : 'V-PLACEHOLDER.backgroundImageMissing',
    }));
    return [...guidance, ...media];
  },
};
