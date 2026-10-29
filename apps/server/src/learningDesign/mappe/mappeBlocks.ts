/**
 * mappeBlocks — the Markdown blocks the server builds for a pedagogisk mappe's markers: the reader's guide (a table
 * from the criteria data) and the references (from the patterns of the chosen activities).
 *
 * Why: D-094 builds the reader's guide from the criteria data (criterion → chapter and attachment), as published HVL
 *      portfolios do, so switching the criteria set changes every criterion text and the guide (MAPPE-002). Spec 04
 *      §7 pre-fills the references from the research keys of the patterns the author used (spec 04 §3).
 * Spec: MAPPE-002
 * Invariants:
 *   - Every text from content or an author goes through `escapeMarkdownText`, which is safe in table cells and list
 *     items; only the table's and list's own syntax is written here.
 *   - A block starts and ends without blank lines; the renderer puts one blank line around it.
 *   - The references are each listed once, sorted by their text as a reference list is, whatever order the
 *     activities came in.
 * Collaborators: ./mappeRender.ts (places them), ./markdownEscape.ts, ../content/mappeContent.ts (the criteria),
 *   ../content/patternAccessors.ts and ../content/referencesContent.ts (the references).
 * Tests: apps/server/test/learningDesign/mappe/mappeRender.test.ts
 */
import { t, type Locale } from '../../i18n/translate.js';
import type { MappeCriteriaSet } from '../content/mappeContent.js';
import { citedReferences, findPattern } from '../content/patternAccessors.js';
import type { PatternContent } from '../content/patternContent.js';
import type { ReferencesContent } from '../content/referencesContent.js';
import { escapeMarkdownText } from './markdownEscape.js';

const cell = (text: string): string => escapeMarkdownText(text);

/**
 * The reader's guide: one row per criterion of the set, with where it is answered and which attachment documents it.
 * @param set - The chosen criteria set.
 * @param locale - The portfolio's language.
 * @returns A Markdown table.
 * @spec MAPPE-002
 */
export function readersGuideBlock(set: MappeCriteriaSet, locale: Locale): string {
  const header = ['criterion', 'chapter', 'attachment'] as const;
  const rows = set.criteria.map(
    (criterion) =>
      `| **${cell(criterion.id)}** ${cell(criterion.text[locale])} | ${cell(criterion.chapter[locale])} | ` +
      `${cell(criterion.attachment?.[locale] ?? t('mappe.placeholder.attachment', {}, locale))} |`,
  );
  return [
    `| ${header.map((column) => cell(t(`mappe.readersGuide.${column}`, {}, locale))).join(' | ')} |`,
    '| --- | --- | --- |',
    ...rows,
  ].join('\n');
}

/**
 * The references the chosen activities' patterns cite.
 * @param patternIds - The pattern of each chosen activity that came from one.
 * @param patterns - The loaded patterns.
 * @param references - The loaded references.
 * @param locale - The portfolio's language, for the text shown when there are none.
 * @returns A Markdown list, or a paragraph that asks the author to write the references.
 * @spec MAPPE-002
 */
export function referencesBlock(
  patternIds: readonly string[],
  patterns: PatternContent,
  references: ReferencesContent,
  locale: Locale,
): string {
  const texts = new Set<string>();
  for (const patternId of new Set(patternIds)) {
    const pattern = findPattern(patterns, patternId);
    for (const reference of pattern ? citedReferences(pattern, references) : []) texts.add(reference.text);
  }
  if (texts.size === 0) return escapeMarkdownText(t('mappe.references.none', {}, locale));
  return [...texts]
    .sort((a, b) => a.localeCompare(b, 'nb'))
    .map((text) => `- ${escapeMarkdownText(text)}`)
    .join('\n');
}
