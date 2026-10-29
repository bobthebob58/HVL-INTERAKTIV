/**
 * mappeAnswers — turns a made pedagogisk mappe into the routes' answers: the word-count preview, and the Markdown or
 * PDF file with its download headers.
 *
 * Why: MAPPE-001 answers the export as a file (D-099 `mediaType`), and MAPPE-003 says it is never stored, so the file
 *      goes straight from memory into the answer with `Cache-Control: no-store`. D-094 shows the word count against
 *      the limit in the preview, and an export over a limit is a warning there, never a refusal.
 * Spec: MAPPE-001, MAPPE-002, MAPPE-003, MAPPE-004
 * Invariants:
 *   - `Content-Type` is exactly the contract's media type of the format (`MARKDOWN_MEDIA_TYPE`, `PDF_MEDIA_TYPE`).
 *   - `Content-Disposition: attachment` with a plain ASCII file name (`pedagogisk-mappe-YYYY-MM-DD.md`), so no
 *     header quoting or encoding question arises and no title or name of a person reaches the header.
 *   - PRIVACY: nothing is written anywhere; the bytes are sent once and dropped (MAPPE-003).
 * Collaborators: ./mappeRoutes.ts (the caller), ../mappe/MappeRenderer.ts, ../mappe/pdf/mappeHtml.ts,
 *   ../mappe/pdf/PdfRenderer.ts, ../mappe/mappeWordCount.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/mappe/mappeRoutes.int.test.ts,
 *   apps/server/test/learningDesign/mappe/mappeExport.int.test.ts
 */
import {
  MARKDOWN_MEDIA_TYPE,
  PDF_MEDIA_TYPE,
  type MappeExportQuery,
  type MappePreview,
} from '@hvl-interaktiv/api-contract';
import type { Response } from 'express';
import { isLearningDesignError } from '../../http/learningDesignErrors.js';
import { t } from '../../i18n/translate.js';
import { isoDateInOslo } from '../mappe/mappeFormat.js';
import type { RenderedMappe } from '../mappe/MappeRenderer.js';
import { firstTopHeading } from '../mappe/mappeWordCount.js';
import { mappeHtmlDocument } from '../mappe/pdf/mappeHtml.js';
import type { PdfRenderer } from '../mappe/pdf/PdfRenderer.js';

/**
 * The preview of a made portfolio.
 * @param rendered - The portfolio.
 * @returns The counts against the set's limits; over a limit is a flag, never an error.
 * @spec MAPPE-002
 */
export function mappePreviewOf(rendered: RenderedMappe): MappePreview {
  const wordLimit = rendered.criteriaSet.limits.del1Words.value;
  const attachmentLimit = rendered.criteriaSet.limits.attachments.value;
  return {
    criteriaSet: rendered.criteriaSet.id,
    words: rendered.words,
    wordLimit,
    attachments: rendered.attachments,
    attachmentLimit,
    overLimit: rendered.words > wordLimit || rendered.attachments > attachmentLimit,
  };
}

/**
 * The file name of an export.
 * @param format - `md` or `pdf`.
 * @param now - When it was made.
 * @returns e.g. `pedagogisk-mappe-2026-10-29.pdf`.
 */
export const mappeFilename = (format: MappeExportQuery['format'], now: Date): string =>
  `pedagogisk-mappe-${isoDateInOslo(now)}.${format}`;

/** Seconds a person is asked to wait before trying a busy PDF export again. */
export const PDF_BUSY_RETRY_AFTER_SECONDS = 10;

async function printed(
  res: Response,
  rendered: RenderedMappe,
  request: { readonly userId: string; readonly pdf: PdfRenderer },
): Promise<Buffer> {
  const html = mappeHtmlDocument(rendered.markdown, {
    lang: rendered.locale,
    title: firstTopHeading(rendered.markdown) ?? t('mappe.pdfTitle', {}, rendered.locale),
  });
  try {
    return await request.pdf.render(html, request.userId);
  } catch (error) {
    // WHY: a busy answer is temporary (RFC 9110 §10.2.3); the error handler keeps this header on its JSON answer.
    if (isLearningDesignError(error, 'hvl:pdf-busy'))
      res.set('Retry-After', String(PDF_BUSY_RETRY_AFTER_SECONDS));
    throw error;
  }
}

/**
 * Sends a made portfolio as a file.
 * @param res - The answer.
 * @param rendered - The portfolio.
 * @param request - The format, the person (for the PDF slot), the PDF renderer and the moment.
 * @returns When the file is sent.
 * @throws HttpError 503 `hvl:pdf-busy` (with `Retry-After`) or `hvl:pdf-unavailable` from the PDF renderer;
 *   nothing is sent then.
 * @spec MAPPE-001
 */
export async function sendMappeFile(
  res: Response,
  rendered: RenderedMappe,
  request: {
    readonly format: MappeExportQuery['format'];
    readonly userId: string;
    readonly pdf: PdfRenderer;
    readonly now: Date;
  },
): Promise<void> {
  const body = request.format === 'md' ? rendered.markdown : await printed(res, rendered, request);
  res.set({
    'Content-Type': request.format === 'md' ? MARKDOWN_MEDIA_TYPE : PDF_MEDIA_TYPE,
    'Content-Disposition': `attachment; filename="${mappeFilename(request.format, request.now)}"`,
    // PRIVACY: the export is made on demand and kept nowhere, not even in a browser or proxy cache (MAPPE-003).
    'Cache-Control': 'no-store',
  });
  res.send(body);
}
