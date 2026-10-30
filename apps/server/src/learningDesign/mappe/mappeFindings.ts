/**
 * mappeFindings — the universal design status of an activity for the pedagogisk mappe: the validator's UD-021
 * findings on the stored activity, each error with the newest reason its authors gave for publishing despite it.
 *
 * Why: D-094 shows per activity "the validator's result with any acknowledgements and their reasons" (MAPPE-002,
 *      criterion 2.3). The portfolio documents the reasons the authors wrote, so an acknowledgement counts here at
 *      any age: the 14-day limit (PROD-003) decides whether publishing asks again, not whether a reason was given.
 * Spec: MAPPE-002, UD-021, UD-022
 * Invariants:
 *   - The same validator and input as the findings and publish routes (../../content/storedContent.ts), so the
 *     portfolio never disagrees with the check an author sees; only the stored activity is validated.
 *   - Only UD-021 findings (universal design); the pedagogical hints (PED-020) and V-PLACEHOLDER are not this status.
 *   - Only errors carry a reason, matched by rule and path as ../../content/acknowledgementCoverage.ts does.
 *   - PRIVACY: who gave a reason is never read or shown; the reason is the authors' own text about their activity.
 * Collaborators: ./MappeRenderer.ts, ./mappeActivityView.ts, ../../content/storedContent.ts,
 *   ../../content/acknowledgementCoverage.ts, ../../validation/types.ts.
 * Tests: apps/server/test/learningDesign/mappe/mappeExport.int.test.ts
 */
import type { StoredAcknowledgement } from '../../content/acknowledgementCoverage.js';
import { storedValidationInput, type StoredContentRow } from '../../content/storedContent.js';
import type { Locale } from '../../i18n/translate.js';
import type { ContentValidator, FindingSeverity } from '../../validation/types.js';

/** One universal design finding with the reason given for it, if any. */
export interface MappeFinding {
  readonly severity: FindingSeverity;
  /** The validator's message in the portfolio's language. */
  readonly message: string;
  /** The newest reason given for this error, of any age; only errors have one. */
  readonly acknowledgement?: { readonly reason: string; readonly at: Date };
}

const keyOf = (item: { readonly ruleId: string; readonly path: string }): string =>
  JSON.stringify([item.ruleId, item.path]);

/**
 * The universal design findings of a stored activity.
 * @param validator - The pre-publish validator, configured at start-up.
 * @param row - The stored activity.
 * @param acknowledgements - Its stored acknowledgements, of any age.
 * @param locale - The portfolio's language, for the messages.
 * @returns The UD-021 findings in the validator's order, each error with its newest reason.
 * @spec MAPPE-002
 */
export function mappeFindings(
  validator: ContentValidator,
  row: StoredContentRow,
  acknowledgements: readonly StoredAcknowledgement[],
  locale: Locale,
): MappeFinding[] {
  const newest = new Map<string, StoredAcknowledgement>();
  for (const acknowledgement of acknowledgements) {
    const known = newest.get(keyOf(acknowledgement));
    if (!known || known.at < acknowledgement.at) newest.set(keyOf(acknowledgement), acknowledgement);
  }
  return validator(storedValidationInput(row, locale))
    .filter((finding) => finding.requirement === 'UD-021')
    .map((finding) => {
      const acknowledgement = finding.severity === 'error' ? newest.get(keyOf(finding)) : undefined;
      return {
        severity: finding.severity,
        message: finding.message,
        ...(acknowledgement
          ? { acknowledgement: { reason: acknowledgement.reason, at: acknowledgement.at } }
          : {}),
      };
    });
}
