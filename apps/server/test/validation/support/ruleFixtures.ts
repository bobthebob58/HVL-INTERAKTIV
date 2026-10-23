/**
 * ruleFixtures — loads the validator's content fixtures (apps/server/test/fixtures/content/<ruleId>/*.json) and runs
 * one rule on them, for the per-rule tests.
 *
 * Why: UD-021 and PED-020 ask for positive and negative fixtures per rule. Each fixture is a whole activity in the
 *      real H5P parameter shape with the hits it must produce, so a test is "this activity gives exactly these hits".
 * Spec: UD-021, PED-020
 * Invariants:
 *   - `positive-*.json` fixtures expect at least one hit, `negative-*.json` none (checked in contentFixtures.test.ts).
 *   - Tests use TEST_CONTEXT (the thresholds of spec 04 §5), not the editable YAML, so ALU's tuning cannot break them.
 *   - Hits and expectations are compared in one order (path, then message).
 * Collaborators: apps/server/test/fixtures/content/README.md, ../../../src/validation/contentWalker.ts.
 * Tests: apps/server/test/validation/contentFixtures.test.ts and every apps/server/test/validation/rules/*.test.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparePaths } from '../../../src/validation/contentPath.js';
import { walkContent } from '../../../src/validation/contentWalker.js';
import type { ValidationRule } from '../../../src/validation/rule.js';
import type {
  ValidationContext,
  ValidationInput,
  ValidationMetadata,
} from '../../../src/validation/types.js';

/** Where the fixtures are. */
export const FIXTURES_DIR = fileURLToPath(new URL('../../fixtures/content', import.meta.url));

/** The thresholds of spec 04 §5, fixed for tests. */
export const TEST_CONTEXT: ValidationContext = {
  thresholds: {
    maxVideoMinutes: 15,
    maxMinutesWithoutInteraction: 4,
    maxQuestionsPerSet: 15,
    minDecisionPoints: 2,
    maxDecisionPoints: 4,
    maxColumnActivities: 3,
    maxSlideWords: 150,
    maxChapterWordsWithoutInteraction: 1500,
  },
  captionedMediaOrigins: [],
};

/** An expected hit: where, and which message key. */
export interface ExpectedHit {
  readonly path: string;
  readonly message: string;
}

/** One fixture file. */
export interface RuleFixture {
  /** File name without `.json`, e.g. `positive-empty-alt-in-column`. */
  readonly name: string;
  readonly description: string;
  readonly mainLibrary: string;
  readonly metadata: ValidationMetadata;
  /** Overrides of TEST_CONTEXT, e.g. captioned origins. */
  readonly context?: { readonly captionedMediaOrigins?: readonly string[] };
  readonly params: unknown;
  readonly expected: readonly ExpectedHit[];
}

const byPathThenMessage = (a: ExpectedHit, b: ExpectedHit): number =>
  comparePaths(a.path, b.path) || (a.message < b.message ? -1 : a.message > b.message ? 1 : 0);

/**
 * The rule IDs that have a fixture folder.
 * @returns Folder names, sorted.
 */
export const fixtureRuleIds = (): string[] =>
  readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

/**
 * Loads the fixtures of one rule.
 * @param ruleId - e.g. `V-IMG-ALT`.
 * @returns Its fixtures, sorted by file name, with `expected` in comparison order.
 */
export function fixturesOf(ruleId: string): RuleFixture[] {
  const folder = join(FIXTURES_DIR, ruleId);
  return readdirSync(folder)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const data = JSON.parse(readFileSync(join(folder, file), 'utf8')) as Omit<RuleFixture, 'name'>;
      return {
        ...data,
        name: file.replace(/\.json$/, ''),
        expected: [...data.expected].sort(byPathThenMessage),
      };
    });
}

/**
 * The context a fixture runs with.
 * @param fixture - A fixture.
 * @returns TEST_CONTEXT with the fixture's overrides.
 */
export const contextOf = (fixture: RuleFixture): ValidationContext => ({
  ...TEST_CONTEXT,
  captionedMediaOrigins: fixture.context?.captionedMediaOrigins ?? TEST_CONTEXT.captionedMediaOrigins,
});

/**
 * Runs one rule on a fixture.
 * @param rule - The rule under test.
 * @param fixture - The activity.
 * @returns The rule's hits as path and message key, in comparison order.
 */
export function hitsOf(rule: ValidationRule, fixture: RuleFixture): ExpectedHit[] {
  const scope = { nodes: walkContent(fixture.mainLibrary, fixture.params), metadata: fixture.metadata };
  return rule
    .check({ ...scope, context: contextOf(fixture) })
    .map((hit) => ({ path: hit.path, message: hit.message }))
    .sort(byPathThenMessage);
}

/**
 * The validator input for a fixture.
 * @param fixture - The activity.
 * @param locale - The message language.
 * @returns A `ValidationInput`.
 */
export const inputOf = (fixture: RuleFixture, locale: ValidationInput['locale'] = 'nn'): ValidationInput => ({
  mainLibrary: fixture.mainLibrary,
  params: fixture.params,
  metadata: fixture.metadata,
  locale,
});
