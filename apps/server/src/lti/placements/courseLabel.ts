/**
 * courseLabel — decides what of a launch's course label (`context.label`) a placement may keep: the label when it is a
 * course code, else nothing.
 *
 * Why: D-087 suggests the course labels of an author's Canvas placements as course codes (PED-030). Canvas sandbox
 *      courses often carry a teacher's name in their label, and a name must not be stored (DATA-002). The 2026-10-28
 *      contracts amendment of D-087 therefore keeps a label only when, normalised, it is a course code with a digit:
 *      HVL course codes have one, names rarely do.
 * Spec: PED-030, DATA-002
 * Invariants:
 *   - Control characters (Unicode `Cc`) are removed first, then the label is cut to 255 characters by code point
 *     (the column's size), never inside a surrogate pair.
 *   - The result is kept only when, after D-087's normalisation (NFC, trimmed, upper case, inner spaces removed),
 *     it matches the contract's course-code pattern and contains a digit; anything else, including a value that is
 *     not a string, gives null.
 *   - Pure: no I/O, and the label is never logged.
 * Collaborators: ./LtiPlacementRecorder.ts (stores the result), ../../learningDesign/metadata/authorCourses.ts
 *   (reads it back, normalised), @hvl-interaktiv/api-contract (`courseCodeSchema`).
 * Tests: apps/server/test/lti/placements/courseLabel.test.ts
 */
import { courseCodeSchema } from '@hvl-interaktiv/api-contract';

/** The longest stored label, in code points (`LtiPlacement.contextLabel` is `VarChar(255)`). */
export const COURSE_LABEL_MAX_CODE_POINTS = 255;

const CONTROL_CHARACTERS = /\p{Cc}/gu;

/**
 * The course label a placement keeps from a launch.
 * @param label - The launch's `context.label` claim, untrusted (any type).
 * @returns The cleaned label when it is a course code with a digit, else null.
 * @example
 * placementCourseLabel('SYK110'); // 'SYK110'
 * placementCourseLabel('Sandkasse Kari Nordmann'); // null
 * @spec PED-030
 */
export function placementCourseLabel(label: unknown): string | null {
  if (typeof label !== 'string') return null;
  const cleaned = [...label.replace(CONTROL_CHARACTERS, '')].slice(0, COURSE_LABEL_MAX_CODE_POINTS).join('');
  const code = courseCodeSchema.safeParse(cleaned);
  // PRIVACY: a label that is not a course code may hold a teacher's name (D-087), so nothing of it is kept.
  return code.success && /[0-9]/.test(code.data) ? cleaned : null;
}
