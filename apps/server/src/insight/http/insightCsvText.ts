/**
 * insightCsvText — writes one insight view as the text of its CSV file (INS-009) and names the file: the
 * formative-use note, the scope, then one row per value, in the person's language.
 *
 * Why: INS-009 exports insight as CSV with the same suppression (INS-006). The rows come from the already suppressed
 *      report (../export/insightCsvRows.ts), so the file holds nothing the tab does not; this module only adds the
 *      words and writes the text. D-105 has the CSV say that the scores are formative, and the file must still make
 *      sense when it is opened alone, so the period, context, version and k are written into it.
 * Spec: INS-009, INS-006, PROD-011, PROD-012
 * Invariants:
 *   - RFC 4180: comma-separated, CRLF line ends, a field with a comma, quote or line break quoted and its quotes
 *     doubled; UTF-8 with a byte-order mark, so spreadsheet programs read æ, ø and å.
 *   - SECURITY: a field that a spreadsheet could run as a formula (it starts, after any white space, with `=`, `+`,
 *     `-` or `@`, or starts with a tab or carriage return) gets a leading `'` (OWASP's CSV injection advice); labels
 *     hold authors' and learners' text, so every field is guarded.
 *   - PRIVACY: a suppressed value is `< k` and nothing else (INS-006). The file name holds only a fixed word, the
 *     period and the date: no title, course or person, and only ASCII letters, digits, `-` and `.`.
 *   - Every word comes from the locale files (`insight.csv.*`, and `notice.formativeUse.body`, PROD-011's notice).
 *   - The completion rate's measure names its base (INS-001: the course's NRPS count, or "of those who started"), as
 *     the tab does, so the file is not read against the wrong denominator when it is opened alone.
 * Collaborators: ../export/insightCsvRows.ts, ../insightReport.ts, ../../i18n/translate.ts,
 *   ../../learningDesign/mappe/mappeFormat.ts (`isoDateInOslo`), ./insightRoutes.ts.
 * Tests: apps/server/test/insight/http/insightCsvText.test.ts,
 *   apps/server/test/insight/http/insightSuppressionApi.property.test.ts
 */
import { PORTAL_CONTEXT_KEY, type InsightScope } from '@hvl-interaktiv/api-contract';
import { t, type Locale, type MessageKey } from '../../i18n/translate.js';
import { isoDateInOslo } from '../../learningDesign/mappe/mappeFormat.js';
import { insightCsvRows, type InsightCsvSection } from '../export/insightCsvRows.js';
import type { InsightReport } from '../insightReport.js';

/** The byte-order mark that starts the file. */
export const CSV_BOM = '﻿';
/** The line end (RFC 4180). */
export const CSV_EOL = '\r\n';

type Section = InsightCsvSection | 'note' | 'scope';
type Line = readonly [
  section: Section,
  item: string,
  part: string,
  label: string,
  measure: string,
  value: string,
];

// SECURITY: what a spreadsheet may read as the start of a formula (OWASP, "CSV Injection").
const FORMULA_START = /^\s*[=+\-@]|^[\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

/**
 * One CSV field, guarded against formula injection and quoted when needed.
 * @param text - The field's text.
 * @returns The field as it is written between commas.
 * @spec INS-009
 */
export function csvField(text: string): string {
  const guarded = FORMULA_START.test(text) ? `'${text}` : text;
  return NEEDS_QUOTES.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

/** INS-001: the completion rate's words name its base, as the tab's do: the course's NRPS count or who started. */
const RATE_OF_BASE = { course: 'completionRateOfCourse', started: 'completionRateOfStarted' } as const;

/** A measure's words; a key the locale files lack is written as the key itself. */
function measureText(measure: string, locale: Locale): string {
  const key = `insight.csv.measure.${measure}` as MessageKey;
  const text = t(key, {}, locale);
  return text === key ? measure : text;
}

/** The measure key a row is written with: the completion rate's names its base, every other is the row's own. */
function rowMeasure(measure: string, base: InsightReport['participation']['completionBase']): string {
  return measure === 'completionRate' && base !== null ? RATE_OF_BASE[base] : measure;
}

/** The note and scope lines that start the file, so it is understood when opened alone. */
function leadingLines(scope: InsightScope, locale: Locale): Line[] {
  const say = (key: MessageKey, params: Record<string, string | number> = {}) => t(key, params, locale);
  const context =
    scope.context.key === PORTAL_CONTEXT_KEY ? say('insight.csv.portal') : (scope.context.label ?? '');
  return [
    ['note', '', '', say('notice.formativeUse.body'), say('insight.csv.note.formative'), ''],
    [
      'note',
      '',
      '',
      say('insight.csv.note.suppressedText', { k: scope.k }),
      say('insight.csv.note.suppressed'),
      '',
    ],
    ['scope', '', '', '', say('insight.csv.scope.activity'), scope.contentId],
    ['scope', '', '', '', say('insight.csv.scope.contentVersion'), String(scope.contentVersion)],
    ['scope', '', '', '', say('insight.csv.scope.currentVersion'), String(scope.currentVersion)],
    [
      'scope',
      '',
      '',
      say(`insight.csv.period.${scope.period}`),
      say('insight.csv.scope.period'),
      scope.period,
    ],
    ['scope', '', '', '', say('insight.csv.scope.periodStart'), scope.periodStart],
    ['scope', '', '', '', say('insight.csv.scope.periodEnd'), scope.periodEnd],
    ['scope', '', '', context, say('insight.csv.scope.context'), scope.context.key],
    ['scope', '', '', '', say('insight.csv.scope.minimumGroupSize'), String(scope.k)],
  ];
}

/**
 * The CSV text of one view.
 * @param report - The view, already suppressed.
 * @param locale - The language of the header, the sections, the measures and the note.
 * @returns The file's text: byte-order mark, header, note, scope and value rows, each line ended by CRLF.
 * @example
 * res.send(insightCsvText(report, principal.locale));
 * @spec INS-009
 */
export function insightCsvText(report: InsightReport, locale: Locale): string {
  const column = (name: 'section' | 'item' | 'part' | 'label' | 'measure' | 'value') =>
    t(`insight.csv.column.${name}`, {}, locale);
  const header = (['section', 'item', 'part', 'label', 'measure', 'value'] as const).map(column);
  const base = report.participation.completionBase;
  const values: Line[] = insightCsvRows(report).map((row) => [
    row.section,
    row.item,
    row.part,
    row.label,
    measureText(rowMeasure(row.measure, base), locale),
    row.value,
  ]);
  const lines = [...leadingLines(report.scope, locale), ...values].map(([section, ...rest]) => [
    t(`insight.csv.section.${section}`, {}, locale),
    ...rest,
  ]);
  return CSV_BOM + [header, ...lines].map((line) => line.map(csvField).join(',')).join(CSV_EOL) + CSV_EOL;
}

/**
 * The file name of a view's CSV.
 * @param scope - The view's scope.
 * @param locale - The language of the fixed word.
 * @returns e.g. `innsikt-7d-2026-11-04.csv`: the word, the period and the date the view was computed, in Oslo.
 * @spec INS-009
 */
export function insightCsvFilename(scope: InsightScope, locale: Locale): string {
  const name = `${t('insight.csv.filename', {}, locale)}-${scope.period}-${isoDateInOslo(new Date(scope.periodEnd))}`;
  // SECURITY: the name goes into a header between quotes; only these characters can reach it.
  return `${name.replace(/[^a-z0-9-]/gi, '-')}.csv`;
}
