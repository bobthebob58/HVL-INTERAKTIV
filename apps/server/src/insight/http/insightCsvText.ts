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
 *   - The file follows its language (./insightCsvFields.ts, D-136): `;` between fields and a decimal comma in nn
 *     and nb, `,` and a decimal point in en; CRLF line ends; UTF-8 with a byte-order mark, so spreadsheet programs
 *     read æ, ø and å.
 *   - SECURITY: every field is quoted and guarded against formulas wherever a cell could start in it; labels hold
 *     authors' and learners' text, so no field is left out (./insightCsvFields.ts).
 *   - A question that is not in the activity's current content is written without its ID, which came with the
 *     learners' answers, and with a neutral name; a question of the activity keeps the ID the author's content
 *     gives it (D-136).
 *   - PRIVACY: a suppressed value is `< k` and nothing else (INS-006). The file name holds only a fixed word, the
 *     period and the date: no title, course or person, and only ASCII letters, digits, `-` and `.`.
 *   - Every word comes from the locale files (`insight.csv.*`, and `notice.formativeUse.body`, PROD-011's notice).
 *   - The completion rate's measure names its base (INS-001: the course's NRPS count, or "of those who started"), as
 *     the tab does, so the file is not read against the wrong denominator when it is opened alone.
 * Collaborators: ../export/insightCsvRows.ts, ./insightCsvFields.ts, ../insightReport.ts,
 *   ../../i18n/translate.ts, ../../learningDesign/mappe/mappeFormat.ts (`isoDateInOslo`), ./insightRoutes.ts.
 * Tests: apps/server/test/insight/http/insightCsvText.test.ts,
 *   apps/server/test/insight/http/insightSuppressionApi.property.test.ts
 */
import { PORTAL_CONTEXT_KEY, type InsightScope } from '@hvl-interaktiv/api-contract';
import { t, type Locale, type MessageKey } from '../../i18n/translate.js';
import { isoDateInOslo } from '../../learningDesign/mappe/mappeFormat.js';
import { insightCsvRows, type InsightCsvSection } from '../export/insightCsvRows.js';
import type { InsightReport } from '../insightReport.js';
import { CSV_DIALECTS, csvField, csvNumber } from './insightCsvFields.js';

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
 * @param locale - The language of the header, the sections, the measures and the note, and of the file's
 *   separator and decimal mark.
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
  const dialect = CSV_DIALECTS[locale];
  const values: Line[] = insightCsvRows(report).map((row) => [
    row.section,
    row.item,
    row.part,
    // PRIVACY: a question outside the current content has no text of the author's; its name is ours (D-136).
    row.unlisted === undefined
      ? row.label
      : t('insight.csv.unlistedQuestion', { number: row.unlisted }, locale),
    measureText(rowMeasure(row.measure, base), locale),
    csvNumber(row.value, dialect),
  ]);
  const lines = [...leadingLines(report.scope, locale), ...values].map(([section, ...rest]) => [
    t(`insight.csv.section.${section}`, {}, locale),
    ...rest,
  ]);
  const written = [header, ...lines].map((line) => line.map(csvField).join(dialect.separator));
  return CSV_BOM + written.join(CSV_EOL) + CSV_EOL;
}

/**
 * The file name of a view's CSV.
 * @param scope - The view's scope.
 * @param locale - The language of the fixed word.
 * @returns e.g. `innsikt-7d-2026-11-04.csv`: the word, the period and the date the view was computed, in Oslo, which
 *   is its period's end and not included in it.
 * @spec INS-009
 */
export function insightCsvFilename(scope: InsightScope, locale: Locale): string {
  const name = `${t('insight.csv.filename', {}, locale)}-${scope.period}-${isoDateInOslo(new Date(scope.periodEnd))}`;
  // SECURITY: the name goes into a header between quotes; only these characters can reach it.
  return `${name.replace(/[^a-z0-9-]/gi, '-')}.csv`;
}
