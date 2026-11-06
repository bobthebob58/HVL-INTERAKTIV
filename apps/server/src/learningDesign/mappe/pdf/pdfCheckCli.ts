/**
 * pdfCheckCli — `node --import tsx src/learningDesign/mappe/pdf/pdfCheckCli.ts [--out <file>] [--require-sandbox]`:
 * runs the PDF availability probe, then prints one sample pedagogisk mappe through the export's own HTML and renderer.
 *
 * Why: the image's smoke test must show that the mappe PDF prints inside the container with Chromium's sandbox on and
 *      with æ, ø and å embedded (MAPPE-004, D-096, D-110 amendment of 2026-11-05). It runs the same `mappeHtml` and
 *      `PdfRenderer` an export runs, with a fixed Nynorsk sample instead of a person's activities, so it needs no
 *      database, login or content.
 * Spec: MAPPE-004
 * Invariants:
 *   - Reads only the `PDF_*` and `LOG_LEVEL` settings; the sample holds no personal data.
 *   - The last stdout line is one JSON object: `pdfCheck`, `available`, `sandbox`, `reason` and `bytes` (0 when
 *     nothing was printed); the PDF goes only to `--out`.
 *   - Exit code 0 only when the PDF printed (and, with `--require-sandbox`, with the sandbox on); otherwise 1.
 * Collaborators: ./pdfAvailability.ts, ./mappeHtml.ts, ./PdfRenderer.ts, ../../../config/env.ts,
 *   deploy/smoke/smokeChecks.sh (runs it in the app container).
 * Tests: apps/server/test/learningDesign/mappe/pdfAvailability.test.ts (the probe); deploy/smoke/dockerSmoke.sh
 *   checks its PDF with pdftotext, pdffonts and pdfinfo.
 */
import { writeFile } from 'node:fs/promises';
import { loadEnvPart } from '../../../config/env.js';
import { createLogger } from '../../../logging/logger.js';
import { mappeHtmlDocument } from './mappeHtml.js';
import { logPdfAvailability } from './pdfAvailability.js';
import { PdfRenderer } from './PdfRenderer.js';

// The sample's title; the smoke test reads it back from the PDF.
const SAMPLE_TITLE = 'Pedagogisk mappe: Blåbærsyltetøy';

const SAMPLE_MARKDOWN = `# ${SAMPLE_TITLE}

## Del 1: Undervisningspraksis

æ ø å Æ Ø Å — Lærar, øving, årsplan.

| Fase | Aktivitet |
|---|---|
| Førebuing | Spørsmål før samlinga |
| Etterarbeid | Refleksjon over øvinga |
`;

const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : undefined;
const requireSandbox = args.includes('--require-sandbox');

const env = loadEnvPart([
  'PDF_BROWSER_EXECUTABLE',
  'PDF_ALLOW_NO_SANDBOX',
  'PDF_MAX_CONCURRENCY',
  'LOG_LEVEL',
]);
const logger = createLogger({ level: env.LOG_LEVEL });
const found = await logPdfAvailability({ env, logger });
let bytes = 0;
if (found.available) {
  const renderer = new PdfRenderer({ env, logger });
  try {
    const html = mappeHtmlDocument(SAMPLE_MARKDOWN, { lang: 'nn', title: SAMPLE_TITLE });
    const pdf = await renderer.render(html, 'pdf-check');
    if (out) await writeFile(out, pdf);
    bytes = pdf.length;
  } catch {
    // PRIVACY: the renderer has logged its own reason line; this summary says only that nothing printed.
    bytes = 0;
  } finally {
    await renderer.close();
  }
}
process.stdout.write(`${JSON.stringify({ pdfCheck: 'done', ...found, bytes })}\n`);
process.exitCode = bytes > 0 && (found.sandbox || !requireSandbox) ? 0 : 1;
