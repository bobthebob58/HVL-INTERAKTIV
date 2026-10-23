/**
 * validationContext — loads the pre-publish validator's configuration once at start-up: the pedagogical hint
 * thresholds from `content/laeringsdesign/hint-thresholds.yaml`, checked with zod, and the captioned media origins
 * from `CAPTIONED_MEDIA_ORIGINS`.
 *
 * Why: the validator is pure and takes its configuration as an argument (D-073). ALU edits the thresholds without
 *      code (spec 04 §5), so a typo or an impossible value must stop the server at boot with a message that names
 *      the key, instead of silently switching a hint off.
 * Spec: PED-020, UD-020
 * Invariants:
 *   - Every key in `HINT_THRESHOLD_KEYS` is required; unknown and repeated keys are refused, by name.
 *   - Values are range-checked; `minDecisionPoints` may not exceed `maxDecisionPoints`.
 *   - The returned context is frozen; the file is read once, synchronously, before the server listens.
 * Collaborators: ../validation/hintThresholds.ts (the keys), ../validation/types.ts (`ValidationContext`),
 *   ./env.ts (`CAPTIONED_MEDIA_ORIGINS`), content/laeringsdesign/README.md (the guide for ALU).
 * Tests: apps/server/test/config/validationContext.test.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isMap, parseDocument } from 'yaml';
import { z } from 'zod';
import type { HintThresholdKey } from '../validation/hintThresholds.js';
import type { HintThresholds, ValidationContext } from '../validation/types.js';
import type { Env } from './env.js';

/** Where the thresholds are, from this file's location in the repository. */
export const HINT_THRESHOLDS_FILE = fileURLToPath(
  new URL('../../../../content/laeringsdesign/hint-thresholds.yaml', import.meta.url),
);
const DISPLAY_NAME = 'content/laeringsdesign/hint-thresholds.yaml';

const minutes = (max: number) => z.number().positive().max(max);
const count = (min: number, max: number) => z.number().int().min(min).max(max);

// WHY: the ranges only refuse values no one could mean (0 minutes, 5 000 questions); ALU chooses within them.
const THRESHOLD_SHAPE = {
  maxVideoMinutes: minutes(180),
  maxMinutesWithoutInteraction: minutes(60),
  maxQuestionsPerSet: count(1, 100),
  minDecisionPoints: count(1, 20),
  maxDecisionPoints: count(1, 20),
  maxColumnActivities: count(1, 50),
  maxSlideWords: count(10, 2000),
  maxChapterWordsWithoutInteraction: count(100, 50_000),
} satisfies Record<HintThresholdKey, z.ZodType<number>>;

/** The schema of hint-thresholds.yaml. */
export const hintThresholdsSchema = z
  .strictObject(THRESHOLD_SHAPE)
  .refine((t) => t.minDecisionPoints <= t.maxDecisionPoints, {
    path: ['maxDecisionPoints'],
    message: 'must be at least minDecisionPoints',
  });

/** Thrown when the validator's configuration is invalid; start-up stops. */
export class InvalidValidationContextError extends Error {
  /**
   * @param problems - One line per problem, each naming the key, e.g. `maxVideoMinutes: Too big …`.
   * @param file - The file shown in the message.
   */
  constructor(
    readonly problems: readonly string[],
    file: string = DISPLAY_NAME,
  ) {
    super(
      `Invalid validator configuration in ${file}:\n${problems.map((p) => `  - ${p}`).join('\n')}\n` +
        'See content/laeringsdesign/README.md for what each threshold means.',
    );
    this.name = 'InvalidValidationContextError';
  }
}

const repeatedKeys = (contents: unknown): string[] => {
  if (!isMap(contents)) return [];
  const keys = contents.items.map((pair) => String(pair.key));
  return [...new Set(keys.filter((key, i) => keys.indexOf(key) !== i))];
};

/**
 * Parses and checks the thresholds.
 * @param source - The YAML text.
 * @param file - The file name shown in error messages.
 * @returns The thresholds.
 * @throws InvalidValidationContextError naming each bad, missing, unknown or repeated key, or the syntax error.
 */
export function parseHintThresholds(source: string, file: string = DISPLAY_NAME): HintThresholds {
  // WHY: repeated keys are allowed through the parser and reported by name below; YAML's own error does not name them.
  const document = parseDocument(source, { uniqueKeys: false });
  const syntax = document.errors[0];
  if (syntax)
    throw new InvalidValidationContextError([`YAML syntax: ${syntax.message.split('\n')[0]}`], file);
  const repeated = repeatedKeys(document.contents);
  if (repeated.length > 0) {
    throw new InvalidValidationContextError(
      repeated.map((key) => `${key}: appears more than once`),
      file,
    );
  }
  const result = hintThresholdsSchema.safeParse(document.toJS());
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(file)'}: ${issue.message}`,
    );
    throw new InvalidValidationContextError(problems, file);
  }
  return Object.freeze({ ...result.data });
}

/**
 * Loads the validator's configuration.
 * @param env - The parsed environment (only `CAPTIONED_MEDIA_ORIGINS` is read).
 * @param file - The thresholds file; defaults to the repository's `content/laeringsdesign/hint-thresholds.yaml`.
 * @returns The context for `validateContent` / `createContentValidator`.
 * @throws InvalidValidationContextError when the file is missing, unreadable or invalid.
 * @spec PED-020
 */
export function loadValidationContext(
  env: Pick<Env, 'CAPTIONED_MEDIA_ORIGINS'>,
  file: string = HINT_THRESHOLDS_FILE,
): ValidationContext {
  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown error';
    throw new InvalidValidationContextError([`cannot read the file (${code})`], file);
  }
  return Object.freeze({
    thresholds: parseHintThresholds(source, file === HINT_THRESHOLDS_FILE ? DISPLAY_NAME : file),
    captionedMediaOrigins: Object.freeze([...env.CAPTIONED_MEDIA_ORIGINS]),
  });
}
