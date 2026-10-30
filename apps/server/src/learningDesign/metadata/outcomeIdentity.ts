/**
 * outcomeIdentity — when two learning outcomes are the same, the order outcomes are shown in, and the distinct
 * outcomes of a list.
 *
 * Why: the planner's rows (PED-031) and the "already used in this course" checkboxes (PED-030) must recognise an
 *      outcome the author typed again with other spacing or capitals. D-087 fixes the identity: the same NKR
 *      category, and the same text after normalising; D-088 orders rows by category, then text.
 * Spec: PED-030, PED-031
 * Invariants:
 *   - Identity: category, plus the text in Unicode NFC, trimmed, inner whitespace collapsed to one space and lower
 *     cased; nothing else (no accent folding, so «lese» and «lèse» stay two outcomes).
 *   - Order: kunnskap, ferdigheiter, generell-kompetanse; within a category by the normalised text in Norwegian
 *     collation, then by the text itself, so the order is total and stable.
 *   - `distinctOutcomes` keeps, of each identity, the first outcome in that order, and never changes its text.
 * Collaborators: ./LearningDesignStore.ts, ./authorCourses.ts, ./plannerGrid.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/metadata/outcomeIdentity.test.ts
 */
import type { LearningOutcome, OutcomeCategory } from '@hvl-interaktiv/api-contract';

/** The NKR categories in the order rows and checkboxes show them (D-088). */
export const OUTCOME_CATEGORY_ORDER: readonly OutcomeCategory[] = [
  'kunnskap',
  'ferdigheiter',
  'generell-kompetanse',
];

// WHY: course codes and outcomes hold æ, ø and å, which a code-point sort puts in the wrong order (Å before Æ).
const collator = new Intl.Collator('nb', { sensitivity: 'variant', numeric: true });

/**
 * Compares two texts in Norwegian order, with numbers by value (`SYK110` before `SYK1100`).
 * @param a - One text.
 * @param b - The other.
 * @returns Negative, zero or positive, as `Array.prototype.sort` expects.
 */
export const compareNorwegian = (a: string, b: string): number => collator.compare(a, b);

/**
 * An outcome's text as its identity sees it (D-087).
 * @param text - The author's text.
 * @returns The text in NFC, trimmed, with inner whitespace collapsed and lower cased.
 */
export const normaliseOutcomeText = (text: string): string =>
  text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The identity of an outcome: two outcomes with the same key are the same outcome (D-087).
 * @param outcome - An outcome.
 * @returns A key such as `kunnskap|forklare blodtrykk`.
 */
export const outcomeKey = (outcome: LearningOutcome): string =>
  `${outcome.category}|${normaliseOutcomeText(outcome.text)}`;

/**
 * The order of outcomes: by category (D-088), then by normalised text, then by the text itself.
 * @param a - One outcome.
 * @param b - The other.
 * @returns Negative, zero or positive.
 */
export function compareOutcomes(a: LearningOutcome, b: LearningOutcome): number {
  const byCategory = OUTCOME_CATEGORY_ORDER.indexOf(a.category) - OUTCOME_CATEGORY_ORDER.indexOf(b.category);
  if (byCategory !== 0) return byCategory;
  return (
    compareNorwegian(normaliseOutcomeText(a.text), normaliseOutcomeText(b.text)) ||
    compareNorwegian(a.text, b.text) ||
    (a.text < b.text ? -1 : a.text > b.text ? 1 : 0)
  );
}

/**
 * The distinct outcomes of a list, in display order.
 * @param outcomes - Outcomes from any number of activities, in any order.
 * @returns One outcome per identity, sorted by `compareOutcomes`; each keeps the first text in that order.
 */
export function distinctOutcomes(outcomes: readonly LearningOutcome[]): LearningOutcome[] {
  const seen = new Set<string>();
  return [...outcomes].sort(compareOutcomes).filter((outcome) => {
    const key = outcomeKey(outcome);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
