/**
 * hintThresholds — the names of the pedagogical hint thresholds and how rules read them from the context.
 *
 * Why: the thresholds live in `content/laeringsdesign/hint-thresholds.yaml` so ALU can tune them without code
 *      (spec 04 §5). The start-up loader checks that file against these names, and the rules read them here, so a
 *      renamed key fails at start-up rather than silently switching a hint off.
 * Spec: PED-020
 * Invariants:
 *   - `HINT_THRESHOLD_KEYS` is the complete list: the loader requires each key and refuses any other.
 *   - `thresholdOf` never invents a default.
 * Collaborators: ../config/validationContext.ts (loads and checks the YAML), the PED rules under ./rules/.
 * Tests: apps/server/test/config/validationContext.test.ts
 */
import type { ValidationContext } from './types.js';

/** Every threshold the hint rules read, in the order of spec 04 §5. */
export const HINT_THRESHOLD_KEYS = [
  'maxVideoMinutes',
  'maxMinutesWithoutInteraction',
  'maxQuestionsPerSet',
  'minDecisionPoints',
  'maxDecisionPoints',
  'maxColumnActivities',
  'maxSlideWords',
  'maxChapterWordsWithoutInteraction',
] as const;

/** The name of one threshold. */
export type HintThresholdKey = (typeof HINT_THRESHOLD_KEYS)[number];

/** Thrown when the context lacks a threshold, which the start-up loader rules out. */
export class MissingHintThresholdError extends Error {
  /**
   * @param key - The missing threshold.
   */
  constructor(readonly key: HintThresholdKey) {
    super(
      `The validation context has no hint threshold "${key}" (see content/laeringsdesign/hint-thresholds.yaml).`,
    );
    this.name = 'MissingHintThresholdError';
  }
}

/**
 * Reads one threshold.
 * @param context - The validation context.
 * @param key - The threshold's name.
 * @returns Its value.
 * @throws MissingHintThresholdError when the context lacks it (a wiring error, not an author's mistake).
 */
export function thresholdOf(context: ValidationContext, key: HintThresholdKey): number {
  const value = context.thresholds[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new MissingHintThresholdError(key);
  return value;
}
