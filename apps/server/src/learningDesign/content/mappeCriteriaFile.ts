/**
 * mappeCriteriaFile — the schema of one language's pedagogisk mappe criteria file
 * (`content/mappe/criteria.<language>.yaml`): the criteria sets, each with its title, limits and criteria.
 *
 * Why: HVL revises the merit criteria for every call (next in 2027), so a new set must be a content change only
 *      (MAPPE-002). D-094 keeps each set's limits beside its criteria: the Del 1 word limit (7 500 in the 2025 call)
 *      and the attachment limit (11), both marked *(verify)* until ALU confirms them.
 * Spec: MAPPE-002
 * Invariants:
 *   - Strict: an unknown key is a problem at its own line; every text is trimmed, non-empty and one line.
 *   - A criterion ID is text such as `"1.1"`: YAML would read 1.10 as the number 1.1, so a number is refused with
 *     advice to quote it.
 *   - Set IDs are unique in a file, and criterion IDs are unique in a set.
 *   - A limit left out takes its default with `verify: true`; a limit given names its value and its verify flag.
 * Collaborators: ./mappeCriteria.ts (reads the files and compares the languages), ./contentText.ts,
 *   @hvl-interaktiv/api-contract (`criteriaSetIdSchema`).
 * Tests: apps/server/test/learningDesign/content/mappeCriteria.test.ts
 */
import { criteriaSetIdSchema } from '@hvl-interaktiv/api-contract';
import { z } from 'zod';
import { contentText } from './contentText.js';

/** The Del 1 word limit when a set names none: "inntil 7500 ord" in HVL's 2023 and 2025 calls *(verify)*. */
export const DEFAULT_DEL1_WORDS = 7500;
/** The attachment limit when a set names none: "inntil 11 vedlegg" in HVL's 2025 call *(verify)*. */
export const DEFAULT_ATTACHMENTS = 11;

/** One limit and whether ALU still has to confirm it. */
export interface MappeLimit {
  readonly value: number;
  /** True until ALU has confirmed the value for the call (Q17). */
  readonly verify: boolean;
}

/** One criterion in one language. */
export interface MappeCriterionFileEntry {
  /** e.g. `1.1`. */
  readonly id: string;
  /** The criterion's text, as HVL words it. */
  readonly text: string;
  /** Where in the portfolio it is answered, e.g. `Del 1, kap. 2.1`. */
  readonly chapter: string;
  /** Which attachment documents it, as a hint the teacher replaces; optional. */
  readonly attachment?: string;
}

/** One criteria set in one language. */
export interface MappeCriteriaFileSet {
  readonly id: string;
  readonly title: string;
  readonly limits: { readonly del1Words: MappeLimit; readonly attachments: MappeLimit };
  readonly criteria: readonly MappeCriterionFileEntry[];
}

/** One language's criteria file. */
export interface MappeCriteriaFile {
  readonly version: 1;
  readonly sets: readonly MappeCriteriaFileSet[];
}

const criterionId = z
  .string({
    error: (issue) =>
      typeof issue.input === 'number'
        ? 'must be text: write the ID in quotes, like "1.1" (YAML reads 1.10 as the number 1.1)'
        : undefined,
  })
  .regex(
    /^[0-9A-Za-z][0-9A-Za-z.-]{0,15}$/,
    'is not a criterion ID: use digits, letters and dots, like "1.1"',
  );

const limit = (fallback: number, max: number) =>
  z
    .strictObject({ value: z.int().min(1).max(max), verify: z.boolean() })
    .default({ value: fallback, verify: true });

const limits = z
  .strictObject({
    del1Words: limit(DEFAULT_DEL1_WORDS, 100_000),
    attachments: limit(DEFAULT_ATTACHMENTS, 100),
  })
  .default({
    del1Words: { value: DEFAULT_DEL1_WORDS, verify: true },
    attachments: { value: DEFAULT_ATTACHMENTS, verify: true },
  });

/** Adds a problem at the second and later list items whose `id` repeats an earlier one. */
const uniqueIds =
  (what: string) => (items: readonly { readonly id: string }[], context: z.core.$RefinementCtx) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.id)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `repeats the ${what} ID "${item.id}"`,
        });
      }
      seen.add(item.id);
    });
  };

const criterion = z.strictObject({
  id: criterionId,
  text: contentText({ maxLength: 600 }),
  chapter: contentText({ maxLength: 120 }),
  attachment: contentText({ maxLength: 200 }).optional(),
});

const criteriaSet = z.strictObject({
  id: criteriaSetIdSchema,
  title: contentText({ maxLength: 120 }),
  limits,
  criteria: z.array(criterion).min(1, 'lists no criteria').superRefine(uniqueIds('criterion')),
});

/**
 * The schema of a criteria file.
 * @spec MAPPE-002
 */
export const mappeCriteriaFileSchema: z.ZodType<MappeCriteriaFile> = z.strictObject({
  version: z.literal(1),
  sets: z.array(criteriaSet).min(1, 'lists no criteria sets').superRefine(uniqueIds('criteria set')),
});
