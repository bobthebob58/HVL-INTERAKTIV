/**
 * boundedValidator — puts the limits for one activity in front of the pre-publish validator: content past them
 * is answered with one finding and is never read.
 *
 * Why: the validator parses every text of an activity and builds a path for what it reads. No save stores
 *      content past the limits (D-126), but the validator reads the stored row, and a row can be written by
 *      other means than a save. One guard where the validator is wired covers its three users: the findings
 *      list, publishing and the mappe (D-127).
 * Spec: UD-020, SEC-005, PROD-003
 * Invariants:
 *   - Parameters and metadata within the limits of ../h5p/semantics/contentBudget.ts: the validator's own
 *     findings, unchanged.
 *   - Past a limit: exactly one finding, `V-SIZE`, an error (so it blocks publishing like any error, PROD-003),
 *     at the path of the activity as a whole (''), with a message in the input's language. The validator is not
 *     called.
 *   - Lives outside src/validation, which imports nothing but itself (D-073).
 * Collaborators: ../server/createApp.ts (wraps the validator), ../h5p/semantics/contentBudget.ts,
 *   ../i18n/translate.ts, ../validation/types.ts, ../learningDesign/mappe/mappeFindings.ts (lists the finding).
 * Tests: apps/server/test/content/boundedValidator.test.ts, apps/server/test/content/boundedValidator.int.test.ts
 */
import { contentLimitPassed } from '../h5p/semantics/contentBudget.js';
import { t } from '../i18n/translate.js';
import type { ContentValidator, Finding } from '../validation/types.js';

/** The rule ID of the finding for content past the limits. */
export const SIZE_RULE_ID = 'V-SIZE';

/**
 * Wraps a validator so that it only ever reads content within the limits for one activity.
 * @param validator - The pre-publish validator, with its configuration bound.
 * @returns A validator that answers content past a limit with the one `V-SIZE` finding.
 * @spec UD-020
 */
export function withinContentLimits(validator: ContentValidator): ContentValidator {
  return (input) => {
    const inside =
      contentLimitPassed(input.params) === undefined && contentLimitPassed(input.metadata) === undefined;
    if (inside) return validator(input);
    const finding: Finding = {
      ruleId: SIZE_RULE_ID,
      severity: 'error',
      requirement: 'SEC-005',
      path: '',
      message: t('h5p.contentTooLarge.check', {}, input.locale),
    };
    return [finding];
  };
}
