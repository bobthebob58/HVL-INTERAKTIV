/**
 * MappeDownloads — the `/mappe` page's two downloads, Markdown (to edit) and PDF, with what happened in words: the
 * file's name when it is saved, and when the PDF cannot be made, why and that the Markdown file has the same content.
 *
 * Why: MAPPE-001 exports Markdown for editing and PDF for submission; the PDF needs the server's browser, which may be
 *      missing or busy (503 `hvl:pdf-unavailable`, `hvl:pdf-busy`, D-096), and then the page points to the Markdown
 *      export, which always works. The file is never stored on the server (MAPPE-003).
 * Spec: MAPPE-001, MAPPE-003, MAPPE-004, UD-006
 * Invariants:
 *   - A11Y: progress and success are a polite status, a refusal an alert, both in text (WCAG 4.1.3); the buttons stay
 *     enabled and say what is missing when nothing is chosen (WCAG 3.3.1); one download at a time. Each refusal
 *     mounts a new alert (`attempt`), so pressing again with nothing chosen is announced again.
 *   - PRIVACY: the file goes from the answer straight to the browser's save (./saveDownloadedFile.ts).
 * SPEC-DEVIATION: D-094 (amendment 2026-10-29) — UD-007 asks file links to show type and size; the buttons name the
 *   type only, because the server makes the file on request and stores nothing, so its size is unknown.
 * Collaborators: ./MappeWorkspace.tsx, ./saveDownloadedFile.ts, ../../api/mappeApi.ts.
 * Tests: apps/web/test/features/MappeDownloads.test.tsx
 */
'use client';

import type { MappeExportQuery, MappeRequest } from '@hvl-interaktiv/api-contract';
import { useId, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import type { ApiFailure } from '../../api/apiRequest';
import { exportMappe } from '../../api/mappeApi';
import { useLocale } from '../../i18n/LocaleContext';
import { t, type Locale, type MessageKey } from '../../i18n/translate';
import { saveDownloadedFile } from './saveDownloadedFile';

type Format = MappeExportQuery['format'];

/** What the page says after a download. */
type Outcome =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'saved'; readonly file: string }
  /** `attempt` counts refusals in a row; it keys the alert. */
  | { readonly kind: 'refused'; readonly message: string; readonly attempt: number };

/** The messages of the refusals the page explains itself. */
const REFUSAL_MESSAGE: Readonly<Record<string, MessageKey>> = {
  'hvl:pdf-unavailable': 'mappe.pdfUnavailable',
  'hvl:pdf-busy': 'mappe.pdfBusy',
  'hvl:mappe-not-ready': 'mappe.notReady',
};

const refusalText = (failure: ApiFailure, locale: Locale): string => {
  const code = failure.error?.errorCode;
  const own = code === undefined ? undefined : REFUSAL_MESSAGE[code];
  if (own) return t(own, locale);
  return failure.error?.message ?? t('mappe.downloadFailed', locale);
};

/**
 * The downloads.
 * @param props - The request to export, or undefined while no activity is chosen.
 * @returns A section with two buttons and the outcome.
 */
export function MappeDownloads({ request }: { readonly request: MappeRequest | undefined }) {
  const locale = useLocale();
  const auth = useApiAuth();
  const headingId = useId();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  // A11Y: WCAG 4.1.3: an alert is announced when it appears or changes; a new key mounts the same text afresh.
  const refuse = (message: string) =>
    setOutcome((previous) => ({
      kind: 'refused',
      message,
      attempt: previous.kind === 'refused' ? previous.attempt + 1 : 0,
    }));
  const download = async (format: Format) => {
    if (outcome.kind === 'busy') return;
    if (!request) return refuse(t('mappe.chooseFirst', locale));
    setOutcome({ kind: 'busy' });
    const result = await exportMappe(format, request, auth);
    if (!result.ok) return refuse(refusalText(result, locale));
    const file = result.filename ?? `pedagogisk-mappe.${format}`;
    saveDownloadedFile(result.blob, file);
    setOutcome({ kind: 'saved', file });
  };
  return (
    <section aria-labelledby={headingId} className="mb-4">
      <h2 id={headingId}>{t('mappe.downloadsHeading', locale)}</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="button-primary" onClick={() => void download('md')}>
          {t('mappe.downloadMarkdown', locale)}
        </button>
        <button type="button" className="button-secondary" onClick={() => void download('pdf')}>
          {t('mappe.downloadPdf', locale)}
        </button>
      </div>
      <p role="status" className="mt-2">
        {outcome.kind === 'busy' ? t('mappe.downloading', locale) : null}
        {outcome.kind === 'saved' ? t('mappe.downloaded', locale, { file: outcome.file }) : null}
      </p>
      {outcome.kind === 'refused' ? (
        <p
          key={outcome.attempt}
          role="alert"
          className="border-l-4 border-hvl-feedback-incorrect-border p-3 font-bold"
        >
          {outcome.message}
        </p>
      ) : null}
    </section>
  );
}
