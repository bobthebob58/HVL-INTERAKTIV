/**
 * PublishDialog — publishes an activity: lists the errors that still need a reason, asks for one per error, and sends
 * `POST /api/content/:id/publish` with the `updatedAt` of the findings the author saw. For a published activity with
 * errors that have no reason that holds (`renew`) the same request stores new reasons; the dialog then says so.
 *
 * Why: PROD-003 blocks publishing on an error unless the author records a reason (UD-022); D-074 has the server
 *      validate again and refuse a changed activity. Problems are listed in an ErrorSummary linked to their fields
 *      (UD-013), and the two conflicts get plain-language messages: still-unexplained errors (`hvl:publish-blocked`)
 *      and an activity changed in the meantime (`hvl:content-changed`, after which the findings are fetched again).
 *      Publishing a published activity validates again and stores the new reasons (D-074 W3 amendment), so renewing a
 *      reason needs no other request; only the dialog's title, introduction and button say what happens.
 * Spec: PROD-003, UD-022, UD-013, UD-006
 * Invariants:
 *   - Reasons are trimmed and 1 to `REASON_MAX_LENGTH` (500) characters; the server checks them again.
 *   - Typed reasons are kept, keyed by rule and path, when the findings are fetched again (WCAG 3.3.7).
 *   - Only errors without a valid acknowledgement get a field; warnings and hints never block.
 *   - A field's label is short ("Grunngjeving for feil 1"); the finding's message is its description, so it is read
 *     once with the field and never nested in quotation marks (UD-013).
 * Collaborators: ./Dialog.tsx, ./ErrorSummary.tsx, ./AcknowledgementField.tsx, ../api/contentApi.ts,
 *   ../features/activity/CheckPanel.tsx.
 * Tests: apps/web/test/components/PublishDialog.test.tsx
 */
'use client';

import type {
  FindingWithAcknowledgement,
  FindingsResponse,
  PublishBlockedBody,
  PublishResponse,
} from '@hvl-interaktiv/api-contract';
import { useId, useState, type FormEvent } from 'react';
import { useApiAuth } from '../api/ApiAuthContext';
import { publishContent } from '../api/contentApi';
import { useLocale } from '../i18n/LocaleContext';
import { t, type MessageKey } from '../i18n/translate';
import { AcknowledgementField } from './AcknowledgementField';
import { Dialog } from './Dialog';
import { ERROR_ICON, ErrorSummary, type FieldError } from './ErrorSummary';

/** The longest reason; api-contract's `REASON_MAX_LENGTH` (a test checks that they agree). */
export const REASON_MAX = 500;

/** What the dialog needs. */
export interface PublishDialogProps {
  readonly contentId: string;
  readonly open: boolean;
  readonly findings: FindingsResponse;
  readonly onClose: () => void;
  readonly onPublished: (result: PublishResponse) => void;
  /** The activity changed or a reason no longer applies: fetch the findings again. */
  readonly onStale: () => void;
  /** The server refused with its current findings. */
  readonly onFindings: (findings: readonly FindingWithAcknowledgement[]) => void;
  /** The activity is published and some errors have no reason that holds: the dialog asks for new ones. */
  readonly renew?: boolean;
}

/** The dialog's own texts, for a first publish and for new reasons on a published activity. */
const TEXTS: Readonly<
  Record<'publish' | 'renew', Readonly<Record<'title' | 'intro' | 'submit' | 'busy', MessageKey>>>
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

const keyOf = (finding: FindingWithAcknowledgement): string => `${finding.ruleId}|${finding.path}`;

/**
 * The errors that still need a reason before the activity can be published.
 * @param findings - All current findings.
 * @returns Errors without an acknowledgement that still holds.
 */
export const unexplainedErrors = (findings: readonly FindingWithAcknowledgement[]) =>
  findings.filter((finding) => finding.severity === 'error' && finding.acknowledgement === null);

/**
 * The publish dialog.
 * @param props - The activity, its findings and the handlers for the outcomes.
 * @returns The dialog.
 */
export function PublishDialog(props: PublishDialogProps) {
  const { contentId, open, findings, onClose, onPublished, onStale, onFindings, renew = false } = props;
  const texts = TEXTS[renew ? 'renew' : 'publish'];
  const locale = useLocale();
  const auth = useApiAuth();
  const base = useId();
  const [reasons, setReasons] = useState<Readonly<Record<string, string>>>({});
  const [problems, setProblems] = useState<{ attempt: number; errors: FieldError[] }>({
    attempt: 0,
    errors: [],
  });
  const [serverProblem, setServerProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const needed = unexplainedErrors(findings.findings);
  const others = findings.findings.filter((finding) => finding.severity !== 'error').length;
  const fieldId = (index: number) => `${base}-reason-${index}`;

  const validate = (): FieldError[] =>
    needed.flatMap((finding, index) => {
      const reason = (reasons[keyOf(finding)] ?? '').trim();
      const values = { number: index + 1, count: reason.length, max: REASON_MAX };
      if (reason.length === 0)
        return [{ fieldId: fieldId(index), message: t('publish.reasonMissing', locale, values) }];
      if (reason.length > REASON_MAX)
        return [{ fieldId: fieldId(index), message: t('publish.reasonTooLong', locale, values) }];
      return [];
    });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate();
    setProblems({ attempt: problems.attempt + 1, errors });
    setServerProblem(undefined);
    if (errors.length > 0) return;
    setBusy(true);
    const acknowledgements = needed.map((finding) => ({
      ruleId: finding.ruleId,
      path: finding.path,
      reason: (reasons[keyOf(finding)] ?? '').trim(),
    }));
    const result = await publishContent(contentId, { updatedAt: findings.updatedAt, acknowledgements }, auth);
    setBusy(false);
    if (result.ok) return onPublished(result.data);
    const code = result.error?.errorCode;
    if (code === 'hvl:publish-blocked') {
      setServerProblem(t('publish.blocked', locale));
      const body = result.body as Partial<PublishBlockedBody> | undefined;
      if (Array.isArray(body?.findings)) onFindings(body.findings);
    } else if (code === 'hvl:content-changed' || code === 'hvl:acknowledgement-invalid') {
      setServerProblem(t(code === 'hvl:content-changed' ? 'publish.changed' : 'publish.invalid', locale));
      onStale();
    } else {
      setServerProblem(result.error?.message ?? t('publish.failed', locale));
    }
  };

  // WHY: problems belong to one attempt; the typed reasons stay for the next opening (WCAG 3.3.7).
  const close = () => {
    setProblems({ attempt: problems.attempt, errors: [] });
    setServerProblem(undefined);
    onClose();
  };
  const fieldErrors = new Map(problems.errors.map((error) => [error.fieldId, error.message]));
  return (
    <Dialog open={open} title={t(texts.title, locale)} onClose={close}>
      <form noValidate onSubmit={(event) => void submit(event)}>
        {problems.errors.length > 0 ? <ErrorSummary key={problems.attempt} errors={problems.errors} /> : null}
        {serverProblem ? (
          <p role="alert" className="border-l-4 border-hvl-feedback-incorrect-border p-3 font-bold">
            <span aria-hidden="true">{ERROR_ICON} </span>
            {serverProblem}
          </p>
        ) : null}
        <p>{t(texts.intro, locale)}</p>
        {needed.length === 0 ? (
          <p>{t('publish.noErrors', locale)}</p>
        ) : (
          <fieldset className="m-0 mb-4 border-0 p-0">
            <legend className="mb-2 text-lg font-bold">{t('publish.errorsHeading', locale)}</legend>
            <p>{t('publish.errorsIntro', locale)}</p>
            {needed.map((finding, index) => (
              <AcknowledgementField
                key={keyOf(finding)}
                id={fieldId(index)}
                label={t('publish.reasonLabel', locale, { number: index + 1 })}
                description={finding.message}
                hint={t('publish.reasonHint', locale, { max: REASON_MAX })}
                value={reasons[keyOf(finding)] ?? ''}
                onChange={(value) => setReasons({ ...reasons, [keyOf(finding)]: value })}
                error={fieldErrors.get(fieldId(index))}
              />
            ))}
          </fieldset>
        )}
        {others > 0 ? <p>{t('publish.nonBlocking', locale, { count: others })}</p> : null}
        <p role="status" className="min-h-6">
          {busy ? t(texts.busy, locale) : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="button-primary" disabled={busy}>
            {t(texts.submit, locale)}
          </button>
          <button type="button" className="button-secondary" onClick={close}>
            {t('common.cancel', locale)}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
