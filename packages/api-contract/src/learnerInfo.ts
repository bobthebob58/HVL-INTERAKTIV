/**
 * learnerInfo — what learners see of an activity's learning design before they start: the estimated minutes and a
 * one-line purpose, in the activity's language.
 *
 * Why: PED-032 shows students the time estimate and "why this matters" so they can plan and self-regulate. D-087
 *      gives learners these two fields only, and only after the View check: in `/app/play` through the
 *      `x-hvli-launch` header and in the portal's **Spel** tab through the activity summary.
 * Spec: PED-032, PED-030
 * Invariants:
 *   - PRIVACY and pedagogy: never the rationale, the course code or the outcomes, which are the author's (D-087).
 *   - A leaf module (imports only zod), so ./content.ts can use it without an import cycle.
 * Collaborators: ./content.ts (activity summary), ./learningDesign.ts (metadata), ./collaboration.ts (bank),
 *   apps/server/src/web/appLaunch.ts, apps/web/src/lti/launchHeader.ts.
 * Tests: packages/api-contract/test/learningDesignSchemas.test.ts
 */
import { z } from 'zod';

/** The fewest minutes an activity may be estimated at (D-087). */
export const MIN_STUDENT_MINUTES = 1;
/** The most minutes an activity may be estimated at (D-087). */
export const MAX_STUDENT_MINUTES = 600;
/** The longest learner purpose (D-087). */
export const LEARNER_PURPOSE_MAX_LENGTH = 200;

/** Estimated student minutes: a whole number from 1 to 600. */
export const estimatedStudentMinutesSchema = z
  .int()
  .min(MIN_STUDENT_MINUTES)
  .max(MAX_STUDENT_MINUTES)
  .describe('Estimated minutes a student needs, 1 to 600.');
/** Estimated student minutes. */
export type EstimatedStudentMinutes = z.infer<typeof estimatedStudentMinutesSchema>;

// WHY: learners see the purpose as one line before the activity, so a line break is refused rather than shown. Any
// other control character (a pasted tab) is refused too: the web app's strict launch-header parser refuses the whole
// `x-hvli-launch` header on one, which would turn the Canvas page into "no launch" for every learner (S5 W3 review).
/** The learner purpose: plain text on one line without control characters, trimmed, 1 to 200 characters. */
export const learnerPurposeSchema = z
  .string()
  .trim()
  .min(1)
  .max(LEARNER_PURPOSE_MAX_LENGTH)
  .regex(/^\P{Cc}*$/u)
  .describe(
    'One line on why the activity matters, shown to learners in the activity’s language; plain text.',
  );
/** A learner purpose. */
export type LearnerPurpose = z.infer<typeof learnerPurposeSchema>;

/**
 * The learner-facing part of an activity's learning design, as the `x-hvli-launch` header carries it (PED-032);
 * `language` is the activity's own language tag for the text's `lang` (UD-010).
 * @spec PED-032
 */
export const learnerInfoSchema = z.strictObject({
  estimatedStudentMinutes: estimatedStudentMinutesSchema.optional(),
  learnerPurpose: learnerPurposeSchema.optional(),
  language: z.string().optional(),
});
/** What learners see before an activity starts. */
export type LearnerInfo = z.infer<typeof learnerInfoSchema>;
