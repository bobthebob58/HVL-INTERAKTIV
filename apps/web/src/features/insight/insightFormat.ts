/**
 * insightFormat — writes insight values as the tab shows them: a share as a whole percentage, a median with one
 * decimal, a count as a whole number, a suppressed cell as «< k» and a value that is not available in words.
 *
 * Why: INS-006 shows a value about fewer than k learners as «< k» and never as a number (D-106); the API answer has
 *      no value for it, so the text is made from k alone. One module formats every cell, so the tab, its summaries,
 *      the shortlist and the tests agree, and numbers follow the reader's locale (a comma decimal in nn and nb).
 * Spec: INS-006, INS-008, INS-001, PROD-012
 * Invariants:
 *   - A suppressed cell gives «< k» and nothing derived from a value; it has none (packages/api-contract).
 *   - `null` (D-115: the type cannot send it) is "not available", never 0.
 *   - Percentages are whole numbers; a share above 0 % that rounds to 0 % still says 0 %, as the server's own value.
 * Collaborators: ../../i18n/formatDate.ts (`INTL_LOCALE`), ../../i18n/translate.ts, ./CellValue.tsx,
 *   ./insightSummaries.ts, ./shortlistEntries.ts.
 * Tests: apps/web/test/features/insight/insightFormat.test.ts
 */
import { INTL_LOCALE } from '../../i18n/formatDate';
import { t, type Locale } from '../../i18n/translate';

/** A cell of any kind: shown with its value, or suppressed without one. */
export type AnyCell = { readonly suppressed: false; readonly value: number } | { readonly suppressed: true };

/** How a shown value is written. */
export type ValueKind = 'count' | 'percent' | 'median' | 'minutes';

/** The kinds by name, for JSX props (DOC-009 allows no string literal in JSX). */
export const KIND = {
  count: 'count',
  percent: 'percent',
  median: 'median',
  minutes: 'minutes',
} as const satisfies Record<ValueKind, ValueKind>;

const numberFormat = (locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat =>
  new Intl.NumberFormat([...INTL_LOCALE[locale]], options);

/**
 * The value of a cell, or undefined when it is suppressed or not available.
 * @param cell - A cell, or null for "not available".
 * @returns The shown value.
 */
export const shownValue = (cell: AnyCell | null): number | undefined =>
  cell && !cell.suppressed ? cell.value : undefined;

/**
 * The text of a suppressed value.
 * @param k - The minimum group size of the view.
 * @returns «< k», e.g. `< 5`.
 * @spec INS-006
 */
export const suppressedText = (k: number): string => `< ${k}`;

/**
 * Writes a shown value.
 * @param value - The value.
 * @param kind - Count, share (as a percentage), median or minutes.
 * @param locale - The page locale.
 * @returns For example `38 %`, `1,5`, `4,5 min` or `12`.
 */
export function formatValue(value: number, kind: ValueKind, locale: Locale): string {
  if (kind === 'percent')
    return numberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value);
  if (kind === 'count') return numberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const median = numberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return kind === 'minutes' ? t('insight.participation.minutes', locale, { value: median }) : median;
}

/**
 * Writes a cell as the tab shows it.
 * @param cell - The cell, or null when the type cannot send the value.
 * @param kind - How a shown value is written.
 * @param k - The minimum group size of the view.
 * @param locale - The page locale.
 * @returns The value, «< k», or «Ikkje tilgjengeleg».
 * @spec INS-006
 */
export function cellText(cell: AnyCell | null, kind: ValueKind, k: number, locale: Locale): string {
  if (cell === null) return t('insight.notAvailable', locale);
  if (cell.suppressed) return suppressedText(k);
  return formatValue(cell.value, kind, locale);
}

/**
 * Writes a time in a video.
 * @param seconds - Seconds from the start, or null for the summary task at the end.
 * @param locale - The page locale.
 * @returns For example `5:07`, or «Slutten».
 */
export function videoTime(seconds: number | null, locale: Locale): string {
  if (seconds === null) return t('insight.video.end', locale);
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * Joins the answers a gap accepts with the locale's "or", in parts, so each answer can carry the activity's language.
 * @param answers - The accepted answers.
 * @param locale - The page locale.
 * @returns For example «mitokondrie», « eller », «mitokondria»; `answer` is true for the quoted answers.
 */
export function acceptedAnswerParts(
  answers: readonly string[],
  locale: Locale,
): { readonly text: string; readonly answer: boolean }[] {
  const quoted = answers.map((answer) => `«${answer}»`);
  return new Intl.ListFormat([...INTL_LOCALE[locale]], { type: 'disjunction' })
    .formatToParts(quoted)
    .map((part) => ({ text: part.value, answer: part.type === 'element' }));
}
