/**
 * validateContent — the pre-publish validator: inspects an activity's H5P parameters for universal-design
 * problems (UD-021) and pedagogical hints (PED-H01…PED-H11) and returns localised findings.
 *
 * Why: authors should hear about missing alt texts, captions or explanations before learners meet them. The
 *      function is pure and deterministic, so it runs on save, on publish (where the server re-validates and never
 *      trusts the client, D-074) and in tests with the same result (UD-020, D-073).
 * Spec: UD-020, UD-021, PED-020
 * Invariants:
 *   - No I/O, no clock, no randomness, no environment: configuration comes in as `context` (D-073); the input is
 *     never mutated. ESLint and a test that reads this folder's imports enforce it.
 *   - Sub-content is found by shape at any depth (./contentWalker.ts); paths are relative to the params root.
 *   - Rules for a content type only look at nodes of that type, so a library no rule knows yields no type-specific
 *     findings; its text is still checked by the text rules (links, headings, tables, colour words), and known
 *     sub-content inside it is checked as usual.
 *   - Output is sorted, with at most one finding per rule and path (./findingOrder.ts).
 *   - `PED-*` findings are warnings or hints; only `V-*` errors can block publishing (PROD-003).
 * Collaborators: ./contentWalker.ts, ./ruleSet.ts, ./validationMessages.ts, ./findingOrder.ts; callers: the
 *   findings and publish APIs (through `ContentValidator`), wired with ../config/validationContext.ts.
 * Tests: apps/server/test/validation/validateContent.test.ts, apps/server/test/validation/rules/
 */
import { walkContent } from './contentWalker.js';
import { orderFindings } from './findingOrder.js';
import type { RuleScope } from './rule.js';
import { RULES } from './ruleSet.js';
import type { ContentValidator, Finding, ValidationContext, ValidationInput } from './types.js';
import { validationMessage } from './validationMessages.js';

/**
 * Inspects authored H5P parameters for universal design and pedagogical problems.
 * Pure and deterministic: no I/O, so it can run on save, on publish, and in tests.
 * @param input - The activity: main library, params (content.json), metadata and the message locale.
 * @param context - Hint thresholds and captioned media origins, loaded once at start-up.
 * @returns The findings, sorted by severity, path and rule.
 * @throws MissingHintThresholdError when `context` lacks a threshold (a wiring error; the loader rules it out).
 * @spec UD-020
 */
export function validateContent(input: ValidationInput, context: ValidationContext): Finding[] {
  const scope: RuleScope = {
    nodes: walkContent(input.mainLibrary, input.params),
    metadata: input.metadata,
    context,
  };
  const findings = RULES.flatMap((rule) =>
    rule.check(scope).map((hit): Finding => ({
      ruleId: rule.id,
      severity: rule.severity,
      requirement: rule.requirement,
      path: hit.path,
      message: validationMessage(hit.message, hit.values, input.locale),
    })),
  );
  return orderFindings(findings);
}

/**
 * Binds the validator to its start-up configuration, in the form the findings and publish APIs take.
 * @param context - From `loadValidationContext` (../config/validationContext.ts).
 * @returns A `ContentValidator`.
 * @spec UD-020
 */
export const createContentValidator =
  (context: ValidationContext): ContentValidator =>
  (input) =>
    validateContent(input, context);
