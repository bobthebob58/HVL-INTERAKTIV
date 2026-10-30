/**
 * learningDesign — the shapes of an activity's learning-design metadata (`GET` and `PUT
 * /api/content/:contentId/learning-design`), the course-code suggestions and the outcomes already used in a course.
 *
 * Why: PED-030 lets authors tag each activity with phase, course code, learning outcomes, rationale and student
 *      minutes; D-087 adds the learner purpose and the pattern, normalises the course code, and makes `PUT` a full
 *      replace guarded by the `updatedAt` the author read.
 * Spec: PED-030, PED-031, PED-032
 * Invariants:
 *   - Limits (D-087): at most 20 outcomes of 1–300 characters, a rationale of at most 1 000 characters, 1–600
 *     student minutes and a learner purpose of at most 200 characters on one line.
 *   - Texts are trimmed; an empty optional text is left out, never sent as `""`.
 *   - A course code is normalised before it is checked (NFC, trimmed, upper case, no spaces, D-087).
 *   - `patternId` is read only: the `PUT` body has no such field, so a strict parse refuses it.
 *   - Outcome categories follow NKR with `generell-kompetanse` hyphenated (the database enum uses `_`).
 * Collaborators: ./learnerInfo.ts, ./studio.ts, ./planner.ts, ./collaboration.ts,
 *   apps/server/src/learningDesign/http/learningDesignRoutes.ts, apps/web.
 * Tests: packages/api-contract/test/learningDesignSchemas.test.ts
 */
import { z } from 'zod';
import { estimatedStudentMinutesSchema, learnerPurposeSchema } from './learnerInfo.js';
import { patternIdSchema, phaseKeySchema } from './studio.js';

/** The most outcomes one activity may have (D-087). */
export const MAX_OUTCOMES = 20;
/** The longest outcome text (D-087). */
export const OUTCOME_MAX_LENGTH = 300;
/** The longest rationale (PED-030). */
export const RATIONALE_MAX_LENGTH = 1000;
/** A normalised course code (D-087): a letter or digit, then 1 to 19 letters, digits or hyphens. */
export const COURSE_CODE_PATTERN = /^[A-ZÆØÅ0-9][A-ZÆØÅ0-9-]{1,19}$/;

/** A learning-outcome category of the Norwegian qualifications framework (NKR). */
export const outcomeCategorySchema = z.enum(['kunnskap', 'ferdigheiter', 'generell-kompetanse']);
/** An NKR category. */
export type OutcomeCategory = z.infer<typeof outcomeCategorySchema>;

/**
 * One læringsutbyte in the author's words, with its NKR category.
 * @spec PED-030
 */
export const learningOutcomeSchema = z.strictObject({
  text: z.string().trim().min(1).max(OUTCOME_MAX_LENGTH),
  category: outcomeCategorySchema,
});
/** One learning outcome. */
export type LearningOutcome = z.infer<typeof learningOutcomeSchema>;

/**
 * A course code, normalised then checked (D-087): ` syk 110 ` becomes `SYK110`.
 * @spec PED-030
 */
export const courseCodeSchema = z
  .string()
  .normalize('NFC')
  .trim()
  .toUpperCase()
  .overwrite((code) => code.replace(/\s+/g, ''))
  .regex(COURSE_CODE_PATTERN)
  .describe('A course code such as `SYK110`; normalised (NFC, trimmed, upper case, spaces removed) first.');
/** A normalised course code. */
export type CourseCode = z.infer<typeof courseCodeSchema>;

/** A rationale: trimmed, 1 to 1 000 characters. */
const rationaleSchema = z.string().trim().min(1).max(RATIONALE_MAX_LENGTH);

const editableFields = {
  phase: phaseKeySchema.optional(),
  courseCode: courseCodeSchema.optional(),
  outcomes: z.array(learningOutcomeSchema).max(MAX_OUTCOMES),
  rationale: rationaleSchema
    .optional()
    .describe('Why this design for these outcomes (PED-030); never for learners.'),
  estimatedStudentMinutes: estimatedStudentMinutesSchema.optional(),
  learnerPurpose: learnerPurposeSchema.optional(),
};

/**
 * `GET` and `PUT /api/content/:contentId/learning-design` → 200: the metadata. `updatedAt` is null while none has
 * been stored; a `PUT` sends it back.
 * @spec PED-030
 */
export const learningDesignSchema = z.strictObject({
  ...editableFields,
  /** The pattern the activity was created from (D-085); read only. */
  patternId: patternIdSchema.optional(),
  updatedAt: z.iso.datetime().nullable(),
});
/** An activity's learning-design metadata. */
export type LearningDesign = z.infer<typeof learningDesignSchema>;

/**
 * `PUT /api/content/:contentId/learning-design` body: every editable field (a left-out field is cleared) and the
 * `updatedAt` read; a stale one answers 409 `hvl:learning-design-conflict` (D-087). The stored `patternId` is
 * kept, since it is not editable.
 * @spec PED-030
 */
export const learningDesignUpdateSchema = z.strictObject({
  ...editableFields,
  updatedAt: z.iso.datetime().nullable(),
});
/** The body of a learning-design `PUT`. */
export type LearningDesignUpdate = z.infer<typeof learningDesignUpdateSchema>;

/** The query of a request about one course: `?courseCode=SYK110`. */
export const courseCodeQuerySchema = z.strictObject({ courseCode: courseCodeSchema });
/** The query of a request about one course. */
export type CourseCodeQuery = z.infer<typeof courseCodeQuerySchema>;

/**
 * The author's course codes: those in their own and co-authored activities' metadata (the planner's choice, D-088),
 * and the course labels of their own Canvas placements (suggestions, D-087); each list sorted, without repeats.
 * @spec PED-030
 */
export const courseCodeSuggestionsSchema = z.strictObject({
  inUse: z.array(courseCodeSchema),
  fromCanvas: z.array(courseCodeSchema),
});
/** The author's course codes. */
export type CourseCodeSuggestions = z.infer<typeof courseCodeSuggestionsSchema>;

/**
 * The distinct outcomes the author already uses for one course code (D-087: same category and same text after
 * normalising), offered as checkboxes; ordered by category, then text.
 * @spec PED-030
 */
export const courseOutcomesSchema = z.strictObject({
  courseCode: courseCodeSchema,
  outcomes: z.array(learningOutcomeSchema),
});
/** The outcomes already used in a course. */
export type CourseOutcomes = z.infer<typeof courseOutcomesSchema>;
