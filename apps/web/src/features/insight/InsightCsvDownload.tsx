/**
 * InsightCsvDownload — «Last ned tala som CSV»: the view on screen as an aggregated CSV file, with what happened said
 * in words: the file's name when it is saved, or that it could not be made.
 *
 * Why: INS-009 exports insight as CSV with the same suppression (INS-006); the server builds the file from the same
 *      already suppressed view (the same period, context and version), so it holds nothing the tab does not. The file
 *      is fetched with the page's credential and handed to the browser to save, because a plain link cannot carry
 *      the Bearer ltik in Canvas (LTI-003), as the mappe's export does (D-099).
 * Spec: INS-009, INS-006, UD-006, LTI-003
 * Invariants:
 *   - PRIVACY: the file goes from the answer straight to the browser's save; nothing is stored
 *     (../mappe/saveDownloadedFile.ts).
 *   - The button names the file type; the server makes the file on request, so its size is unknown beforehand.
 *   - A11Y: progress and success are a polite status, a refusal an alert (WCAG 4.1.3); one download at a time; each
 *     refusal mounts a new alert, so pressing again is announced again.
 * Collaborators: ./insightApi.ts (`exportInsightCsv`), ../mappe/saveDownloadedFile.ts, ./InsightReportView.tsx.
 * Tests: apps/web/test/features/insight/InsightCsv.test.tsx
 */
'use client';

import type { InsightQuery } from '@hvl-interaktiv/api-contract';
import { useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { saveDownloadedFile } from '../mappe/saveDownloadedFile';
import { exportInsightCsv } from './insightApi';

/** The name the file gets when the server suggests none. */
export const CSV_FALLBACK_NAME = 'innsikt.csv';

type Outcome =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'saved'; readonly file: string }
  | { readonly kind: 'refused'; readonly attempt: number };

/**
 * The CSV download of the view on screen.
 * @param props - The activity and the query of the view on screen.
 * @returns The button and its outcome.
 */
export function InsightCsvDownload({
  contentId,
  query,
}: {
  readonly contentId: string;
  readonly query: InsightQuery;
}) {
  const locale = useLocale();
  const auth = useApiAuth();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

  const download = async () => {
    if (outcome.kind === 'busy') return;
    setOutcome({ kind: 'busy' });
    const result = await exportInsightCsv(contentId, query, auth);
    if (!result.ok) {
      setOutcome((previous) => ({
        kind: 'refused',
        attempt: previous.kind === 'refused' ? previous.attempt + 1 : 0,
      }));
      return;
    }
    const file = result.filename ?? CSV_FALLBACK_NAME;
    saveDownloadedFile(result.blob, file);
    setOutcome({ kind: 'saved', file });
  };

  return (
    <div className="mb-6">
      <button type="button" className="button-secondary" onClick={() => void download()}>
        {t('insight.csv.download', locale)}
      </button>
      <p className="mb-0 mt-1">{t('insight.csv.note', locale)}</p>
      <p role="status" className="mt-1">
        {outcome.kind === 'busy' ? t('insight.csv.downloading', locale) : null}
        {outcome.kind === 'saved' ? t('insight.csv.downloaded', locale, { file: outcome.file }) : null}
      </p>
      {outcome.kind === 'refused' ? (
        <p
          key={outcome.attempt}
          role="alert"
          className="border-l-4 border-hvl-feedback-incorrect-border p-3 font-bold"
        >
          {t('insight.csv.failed', locale)}
        </p>
      ) : null}
    </div>
  );
}
