/**
 * InsightFindings — INS-010 on the Innsikt tab: the validator's current findings for the stored activity, counted by
 * severity and listed with their reasons where an author has given one, and, on the activity page, a way to the
 * **Sjekk og publiser** tab to fix them.
 *
 * Why: INS-010 shows the activity's current validator findings and acknowledgements (UD-022) beside the results, so
 *      accessibility debt stays visible when the teacher looks at how learners did. The findings come from the same
 *      route as the check tab (`GET /api/content/:id/findings`, PROD-003), which only people who may edit can read.
 * Spec: INS-010, UD-022, UD-003, PROD-003
 * Invariants:
 *   - Severity is an icon and a word («✗ Feil:», «! Åtvaring:», «ℹ︎ Tips:»), never colour alone (UD-003); icons are
 *     `aria-hidden`. Errors first, as on the check tab (../../components/FindingsList.tsx `SEVERITY_ORDER`).
 *   - A refused request (403, 404) says the findings are for editors; any other failure says they could not load.
 *   - A11Y: a region named by its `h3`; the list is a list.
 * Collaborators: ../../api/contentApi.ts (`getFindings`), ../../components/FindingsList.tsx (`SEVERITY_ICON`,
 *   `SEVERITY_ORDER`), ../../i18n/formatDate.ts, ./InsightPanel.tsx.
 * Tests: apps/web/test/features/insight/InsightFindings.test.tsx
 */
'use client';

import type { FindingWithAcknowledgement } from '@hvl-interaktiv/api-contract';
import { useEffect, useId, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getFindings } from '../../api/contentApi';
import { SEVERITY_ICON, SEVERITY_ORDER } from '../../components/FindingsList';
import { formatDate } from '../../i18n/formatDate';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

type Findings = readonly FindingWithAcknowledgement[] | 'loading' | 'unavailable' | 'failed';

/**
 * The findings section.
 * @param props - The activity, and on the activity page a handler that opens its check tab.
 * @returns The section.
 */
export function InsightFindings({
  contentId,
  onOpenCheck,
}: {
  readonly contentId: string;
  readonly onOpenCheck?: () => void;
}) {
  const locale = useLocale();
  const auth = useApiAuth();
  const headingId = useId();
  const [findings, setFindings] = useState<Findings>('loading');

  useEffect(() => {
    let active = true;
    void getFindings(contentId, auth).then((result) => {
      if (!active) return;
      if (result.ok) setFindings(result.data.findings);
      else setFindings(result.status === 403 || result.status === 404 ? 'unavailable' : 'failed');
    });
    return () => {
      active = false;
    };
  }, [contentId, auth]);

  let body;
  if (findings === 'loading') body = <p role="status">{t('common.loading', locale)}</p>;
  else if (findings === 'unavailable') body = <p>{t('insight.findings.unavailable', locale)}</p>;
  else if (findings === 'failed') body = <p role="alert">{t('insight.findings.failed', locale)}</p>;
  else if (findings.length === 0) body = <p>{t('insight.findings.none', locale)}</p>;
  else {
    const count = (severity: string) => findings.filter((finding) => finding.severity === severity).length;
    const ordered = SEVERITY_ORDER.flatMap((severity) => findings.filter((f) => f.severity === severity));
    body = (
      <>
        <p>
          {t('insight.findings.counts', locale, {
            errors: count('error'),
            warnings: count('warning'),
            hints: count('hint'),
          })}
        </p>
        <ul className="m-0 mb-3 list-none p-0">
          {ordered.map((finding) => (
            <li
              key={`${finding.ruleId}|${finding.path}`}
              className="mb-2 border-l-4 border-hvl-ink-muted p-2"
            >
              <p className="m-0">
                <strong>
                  <span aria-hidden="true">{SEVERITY_ICON[finding.severity]} </span>
                  {t(`severity.${finding.severity}`, locale)}:
                </strong>{' '}
                {finding.message}
              </p>
              {finding.acknowledgement ? (
                <p className="m-0 mt-1">
                  {t('findings.acknowledged', locale, {
                    reason: finding.acknowledgement.reason,
                    date: formatDate(finding.acknowledgement.expiresAt, locale),
                  })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <section aria-labelledby={headingId} className="mb-6">
      <h3 id={headingId}>{t('insight.findings.heading', locale)}</h3>
      <p>{t('insight.findings.intro', locale)}</p>
      {body}
      {onOpenCheck && findings !== 'unavailable' ? (
        <button type="button" className="button-secondary" onClick={onOpenCheck}>
          {t('insight.findings.openCheck', locale)}
        </button>
      ) : null}
    </section>
  );
}
