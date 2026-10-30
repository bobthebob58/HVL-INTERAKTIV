/**
 * publishReasons — the publish dialog's texts and its reason rules: which key a typed reason is kept under, and the
 * problems with the reasons before the dialog sends them.
 *
 * Why: PROD-003 asks a reason for every error published despite (UD-022), and the dialog lists the problems in an
 *      error summary linked to their fields (UD-013). These rules are apart from ./PublishDialog.tsx so that the
 *      dialog stays one component within DOC-007's 200 lines while it gains the learning-design prompt (D-087).
 * Spec: PROD-003, UD-022, UD-013
 * Invariants:
 *   - A reason is trimmed and 1 to `REASON_MAX` (500) characters; the server checks it again.
 *   - A reason is kept by rule and path, so it stays when the findings are fetched again (WCAG 3.3.7).
 * Collaborators: ./PublishDialog.tsx, ./ErrorSummary.tsx.
 * Tests: apps/web/test/components/PublishDialog.test.tsx
 */
import type { FindingWithAcknowledgement } from '@hvl-interaktiv/api-contract';
import { t, type Locale, type MessageKey } from '../i18n/translate';
import type { FieldError } from './ErrorSummary';

/** The longest reason; api-contract's `REASON_MAX_LENGTH` (a test checks that they agree). */
export const REASON_MAX = 500;

/** Which texts the dialog shows: for a first publish, or for new reasons on a published activity. */
export type PublishDialogMode = 'publish' | 'renew';

/** The dialog's own texts, for a first publish and for new reasons on a published activity. */
export const PUBLISH_DIALOG_TEXTS: Readonly<
  Record<PublishDialogMode, Readonly<Record<'title' | 'intro' | 'submit' | 'busy', MessageKey>>>
> = {
  publish: {
    title: 'publish.title',
    intro: 'publish.intro',
    submit: 'publish.submit',
    busy: 'publish.publishing',
  },
  renew: {
    title: 'publish.renewTitle',
    intro: 'publish.renewIntro',
    submit: 'publish.renewSubmit',
    busy: 'publish.renewing',
  },
};

/**
 * The key a typed reason is kept under.
 * @param finding - The error the reason is for.
 * @returns `ruleId|path`.
 */
export const reasonKey = (finding: FindingWithAcknowledgement): string => `${finding.ruleId}|${finding.path}`;

/**
 * The problems with the typed reasons, one per error that needs a reason.
 * @param needed - The errors that still need a reason, in the dialog's order.
 * @param reasons - The typed reasons by `reasonKey`.
 * @param fieldId - The `id` of the reason field of the error at an index.
 * @param locale - The page's locale.
 * @returns A missing or too-long reason for each field that has one; empty when all can be sent.
 */
export function reasonProblems(
  needed: readonly FindingWithAcknowledgement[],
  reasons: Readonly<Record<string, string>>,
  fieldId: (index: number) => string,
  locale: Locale,
): FieldError[] {
  return needed.flatMap((finding, index) => {
    const reason = (reasons[reasonKey(finding)] ?? '').trim();
    const values = { number: index + 1, count: reason.length, max: REASON_MAX };
    if (reason.length === 0)
      return [{ fieldId: fieldId(index), message: t('publish.reasonMissing', locale, values) }];
    if (reason.length > REASON_MAX)
      return [{ fieldId: fieldId(index), message: t('publish.reasonTooLong', locale, values) }];
    return [];
  });
}
