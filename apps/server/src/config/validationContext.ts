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
 *   ./env.ts (`CAPTIONED_MEDIA_ORIGINS`), ../learningDesign/content/yamlContentFile.ts (the YAML reading and
 *   problem reporting shared with the studio content, D-082), content/laeringsdesign/README.md (the guide for ALU).
 * Tests: apps/server/test/config/validationContext.test.ts
 */
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { contentDisplayPath, formatKeyedContentProblem } from '../learningDesign/content/contentProblem.js';
import {
  parseYamlContent,
  readYamlContentFile,
  type ContentLoadResult,
} from '../learningDesign/content/yamlContentFile.js';
import type { HintThresholdKey } from '../validation/hintThresholds.js';
import type { HintThresholds, ValidationContext } from '../validation/types.js';
import type { Env } from './env.js';

/** Where the thresholds are, from this file's location in the repository. */
export const HINT_THRESHOLDS_FILE = fileURLToPath(
  new URL('../../../../content/laeringsdesign/hint-thresholds.yaml', import.meta.url),
);
const DISPLAY_NAME = contentDisplayPath(HINT_THRESHOLDS_FILE);

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

const thresholdsOrThrow = (result: ContentLoadResult<HintThresholds>, file: string): HintThresholds => {
  if (!result.ok)
    throw new InvalidValidationContextError(result.problems.map(formatKeyedContentProblem), file);
  return result.value;
};

/**
 * Parses and checks the thresholds.
 * @param source - The YAML text.
 * @param file - The file name shown in error messages.
 * @returns The thresholds.
 * @throws InvalidValidationContextError naming each bad, missing, unknown or repeated key with its line, or the
 *   syntax error.
 */
export function parseHintThresholds(source: string, file: string = DISPLAY_NAME): HintThresholds {
  return thresholdsOrThrow(parseYamlContent(source, hintThresholdsSchema, file), file);
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
  return Object.freeze({
    thresholds: thresholdsOrThrow(readYamlContentFile(file, hintThresholdsSchema), contentDisplayPath(file)),
    captionedMediaOrigins: Object.freeze([...env.CAPTIONED_MEDIA_ORIGINS]),
  });
}
