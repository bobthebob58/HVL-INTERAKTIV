/**
 * planner — the shape of the alignment planner's answer: one course's learning outcomes × phases, filled with the
 * author's activities, with the gaps and the activities that lack tags.
 *
 * Why: PED-031 shows an author, for one course, which outcomes each phase serves and where the gaps are, as an
 *      accessible table. D-088 fixes the model: rows are distinct outcomes, columns the phases in content order, two
 *      gap rules, and untagged activities listed rather than hidden.
 * Spec: PED-031
 * Invariants:
 *   - `phases` holds every phase key once, in content order; each row has one cell per phase, in the same order.
 *   - Rows are distinct outcomes (D-087), ordered by category (kunnskap, ferdigheiter, generell-kompetanse), then
 *     by text. An activity with several outcomes appears in several rows.
 *   - Only the author's own and co-authored activities appear; drafts are included and marked by `status`.
 *   - The answer names no person.
 * Collaborators: ./learningDesign.ts, ./studio.ts, ./content.ts, apps/server (W3), apps/web (PlannerTable).
 * Tests: packages/api-contract/test/learningDesignSchemas.test.ts
 */
import { z } from 'zod';
import { contentStatusSchema } from './content.js';
import { courseCodeSchema, learningOutcomeSchema } from './learningDesign.js';
import { PHASE_KEYS, phaseKeySchema } from './studio.js';

/** An activity in a planner cell or in the untagged list. */
export const plannerActivitySchema = z.strictObject({
  contentId: z.uuid(),
  title: z.string(),
  /** Drafts are shown and marked as drafts (D-088). */
  status: contentStatusSchema,
  /** The activity's own language tag, for the title's `lang` (UD-010). */
  language: z.string().optional(),
});
/** An activity in the planner. */
export type PlannerActivity = z.infer<typeof plannerActivitySchema>;

/** One cell: the activities of one phase that serve the row's outcome. Empty cells offer «Lag frå mønster». */
export const plannerCellSchema = z.strictObject({
  phase: phaseKeySchema,
  activities: z.array(plannerActivitySchema),
});
/** One planner cell. */
export type PlannerCell = z.infer<typeof plannerCellSchema>;

/** One row: an outcome and its cells, one per phase in the answer's phase order. */
export const plannerRowSchema = z.strictObject({
  outcome: learningOutcomeSchema,
  cells: z.array(plannerCellSchema).length(PHASE_KEYS.length),
});
/** One planner row. */
export type PlannerRow = z.infer<typeof plannerRowSchema>;

/**
 * A gap (D-088): an outcome without any *Etterarbeid* activity, or a phase without any activity at all. The web app
 * shows each with an icon and a text, never by colour alone.
 */
export const plannerGapSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('no-etterarbeid'), outcome: learningOutcomeSchema }),
  z.strictObject({ kind: z.literal('empty-phase'), phase: phaseKeySchema }),
]);
/** A planner gap. */
export type PlannerGap = z.infer<typeof plannerGapSchema>;

/** An activity with the course code that lacks a phase, outcomes or both, listed below the table (D-088). */
export const plannerUntaggedSchema = plannerActivitySchema.extend({
  missing: z.array(z.enum(['phase', 'outcomes'])).min(1),
});
/** An untagged activity. */
export type PlannerUntagged = z.infer<typeof plannerUntaggedSchema>;

/**
 * The planner for one course code (PED-031, D-088).
 * @spec PED-031
 */
export const plannerSchema = z.strictObject({
  courseCode: courseCodeSchema,
  /** Every phase key once, in content order. */
  phases: z
    .array(phaseKeySchema)
    .length(PHASE_KEYS.length)
    .refine((keys) => new Set(keys).size === keys.length, 'A phase is listed twice.'),
  rows: z.array(plannerRowSchema),
  gaps: z.array(plannerGapSchema),
  untagged: z.array(plannerUntaggedSchema),
});
/** The planner for one course. */
export type Planner = z.infer<typeof plannerSchema>;
