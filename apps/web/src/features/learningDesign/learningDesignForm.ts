/**
 * learningDesignForm — the **Læringsdesign** tab's form state: made from the stored metadata, checked against
 * D-087's limits with a message per field, and turned into the full-replace body.
 *
 * Why: PED-030's fields are optional, but each has a limit (D-087), and the server checks every one again. Checking
 *      here first lets the form list every problem in an error summary linked to its field (UD-013, WCAG 3.3.1)
 *      instead of answering one 400. Keeping it free of React makes the rules testable on their own.
 * Spec: PED-030, UD-013
 * Invariants:
 *   - The limits mirror packages/api-contract (`MAX_OUTCOMES`, `OUTCOME_MAX_LENGTH`, `RATIONALE_MAX_LENGTH`,
 *     `MAX_STUDENT_MINUTES`, `LEARNER_PURPOSE_MAX_LENGTH`); the web app imports only types from the contract, so a
 *     test keeps the copies equal. A length is counted after trimming, as the server counts it.
 *   - An empty text or minutes field is left out of the body, never sent as `""`; the outcomes keep their order.
 *   - In the learner purpose a tab or other control character (not a line break, which is refused) becomes a space:
 *     learners see the purpose on the Canvas page, whose strict launch parser refuses one (PED-032, D-087).
 *   - Outcome identity is D-087's: the same category and the same text after NFC, trimming, collapsed whitespace
 *     and lower case (the server's apps/server/src/learningDesign/metadata/outcomeIdentity.ts).
 *   - Every outcome draft has a stable `key`, so React keeps its inputs and focus when another is removed.
 * Collaborators: ./LearningDesignFormView.tsx, ./OutcomeFields.tsx, ./UsedOutcomeChoices.tsx,
 *   ../../config/studioFilters.ts (`normaliseCourseCode`), ../../components/ErrorSummary.tsx.
 * Tests: apps/web/test/features/learningDesignForm.test.ts
 */
import type {
  LearningDesign,
  LearningDesignUpdate,
  LearningOutcome,
  OutcomeCategory,
  PhaseKey,
} from '@hvl-interaktiv/api-contract';
import type { FieldError } from '../../components/ErrorSummary';
import { normaliseCourseCode } from '../../config/studioFilters';
import { t, type Locale } from '../../i18n/translate';

/** The most outcomes an activity may have (the contract's `MAX_OUTCOMES`). */
export const MAX_OUTCOMES = 20;
/** The longest outcome (the contract's `OUTCOME_MAX_LENGTH`). */
export const OUTCOME_MAX = 300;
/** The longest rationale (the contract's `RATIONALE_MAX_LENGTH`). */
export const RATIONALE_MAX = 1000;
/** The most student minutes (the contract's `MAX_STUDENT_MINUTES`); the fewest is 1. */
export const MINUTES_MAX = 600;
/** The longest learner purpose (the contract's `LEARNER_PURPOSE_MAX_LENGTH`). */
export const PURPOSE_MAX = 200;
/** The NKR categories in the order the select lists them. */
export const OUTCOME_CATEGORIES: readonly OutcomeCategory[] = [
  'kunnskap',
  'ferdigheiter',
  'generell-kompetanse',
];

/** One outcome in the form, with a stable key for React and for its field `id`. */
export interface OutcomeDraft extends LearningOutcome {
  readonly key: string;
}

/** The form's values, as typed. */
export interface LearningDesignForm {
  /** A phase key, or `''` for none. */
  readonly phase: PhaseKey | '';
  readonly courseCode: string;
  readonly outcomes: readonly OutcomeDraft[];
  readonly rationale: string;
  /** As typed; a whole number of 1–600 when valid. */
  readonly minutes: string;
  readonly purpose: string;
}

/** The `id`s of the form's fields, for labels and the error summary. */
export interface FormFieldIds {
  readonly courseCode: string;
  readonly rationale: string;
  readonly minutes: string;
  readonly purpose: string;
  /** The text input of one outcome. */
  readonly outcome: (key: string) => string;
}

/**
 * The form for stored metadata.
 * @param design - The stored metadata (or the empty one).
 * @param keyOf - The key of the outcome at an index; `s0`, `s1`, … by default. After a save the form passes the
 *   keys it had, so React keeps the same inputs.
 * @returns The form's values.
 */
export const formFrom = (
  design: LearningDesign,
  keyOf: (index: number) => string = (index) => `s${index}`,
): LearningDesignForm => ({
  phase: design.phase ?? '',
  courseCode: design.courseCode ?? '',
  outcomes: design.outcomes.map((outcome, index) => ({ ...outcome, key: keyOf(index) })),
  rationale: design.rationale ?? '',
  minutes: design.estimatedStudentMinutes === undefined ? '' : String(design.estimatedStudentMinutes),
  purpose: design.learnerPurpose ?? '',
});

/**
 * The identity of an outcome (D-087).
 * @param outcome - An outcome.
 * @returns A key such as `kunnskap|forklare blodtrykk`.
 */
export const outcomeIdentity = (outcome: LearningOutcome): string =>
  `${outcome.category}|${outcome.text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()}`;

// WHY: control characters other than line breaks, e.g. a tab pasted from a document; line breaks get their own message.
const CONTROL_EXCEPT_LINE_BREAKS = /[^\P{Cc}\r\n]+/gu;

/**
 * The learner purpose as it is checked and sent: control characters other than line breaks become a space, then
 * the text is trimmed.
 * @param value - As typed.
 * @returns The purpose to check and send.
 */
export const purposeText = (value: string): string => value.replace(CONTROL_EXCEPT_LINE_BREAKS, ' ').trim();

/**
 * The minutes as a number, when the typed value is a whole number of 1–600.
 * @param value - As typed.
 * @returns The minutes, or undefined.
 */
export const parsedMinutes = (value: string): number | undefined => {
  const minutes = /^\s*\d{1,3}\s*$/.test(value) ? Number(value) : NaN;
  return minutes >= 1 && minutes <= MINUTES_MAX ? minutes : undefined;
};

/**
 * Every problem with the form's values, one per field, in the form's order.
 * @param form - The values.
 * @param ids - The fields' `id`s.
 * @param locale - The page's locale.
 * @returns The problems; empty when the form can be saved.
 */
export function formProblems(form: LearningDesignForm, ids: FormFieldIds, locale: Locale): FieldError[] {
  const problems: FieldError[] = [];
  const add = (fieldId: string, message: string) => problems.push({ fieldId, message });
  if (form.courseCode.trim() !== '' && !normaliseCourseCode(form.courseCode))
    add(ids.courseCode, t('learningDesign.courseCodeInvalid', locale));
  form.outcomes.forEach((outcome, index) => {
    const count = outcome.text.trim().length;
    const values = { number: index + 1, count, max: OUTCOME_MAX };
    if (count === 0) add(ids.outcome(outcome.key), t('learningDesign.outcomeMissing', locale, values));
    else if (count > OUTCOME_MAX)
      add(ids.outcome(outcome.key), t('learningDesign.outcomeTooLong', locale, values));
  });
  const rationale = form.rationale.trim().length;
  if (rationale > RATIONALE_MAX)
    add(
      ids.rationale,
      t('learningDesign.rationaleTooLong', locale, { count: rationale, max: RATIONALE_MAX }),
    );
  if (form.minutes.trim() !== '' && parsedMinutes(form.minutes) === undefined)
    add(ids.minutes, t('learningDesign.minutesInvalid', locale, { max: MINUTES_MAX }));
  const purpose = purposeText(form.purpose);
  if (purpose.length > PURPOSE_MAX)
    add(ids.purpose, t('learningDesign.purposeTooLong', locale, { count: purpose.length, max: PURPOSE_MAX }));
  else if (/[\r\n]/.test(purpose)) add(ids.purpose, t('learningDesign.purposeOneLine', locale));
  return problems;
}

/**
 * The full-replace body for a valid form.
 * @param form - Values that `formProblems` found no problem in.
 * @param updatedAt - The `updatedAt` the form was made from (null when nothing was stored).
 * @returns The body of `PUT /api/content/:id/learning-design`.
 */
export function updateFrom(form: LearningDesignForm, updatedAt: string | null): LearningDesignUpdate {
  const courseCode = normaliseCourseCode(form.courseCode);
  const minutes = parsedMinutes(form.minutes);
  const rationale = form.rationale.trim();
  const purpose = purposeText(form.purpose);
  return {
    ...(form.phase ? { phase: form.phase } : {}),
    ...(courseCode ? { courseCode } : {}),
    outcomes: form.outcomes.map(({ text, category }) => ({ text: text.trim(), category })),
    ...(rationale ? { rationale } : {}),
    ...(minutes !== undefined ? { estimatedStudentMinutes: minutes } : {}),
    ...(purpose ? { learnerPurpose: purpose } : {}),
    updatedAt,
  };
}
