/**
 * learningDesignErrors — the stable error codes of the S5 routes (studio, patterns, learning design, collaboration,
 * safe editing and the mappe) with the HTTP status each one has.
 *
 * Why: the server answers every refusal with a stable `errorCode` and a translated message (./errors.ts), and the web
 *      app reacts to some codes (reload on a conflict, point to the Markdown export when the PDF is unavailable). One
 *      typed table keeps the server, the web app and the OpenAPI descriptions on the same codes and statuses.
 * Spec: DOC-012, PROD-001, PROD-007, PROD-013, PED-030, MAPPE-001
 * Invariants:
 *   - Every code starts with `hvl:` and has exactly one status; the server's message texts live in its locale files
 *     under `learningDesign.error` (apps/server/src/http/learningDesignErrors.ts maps each code to its key).
 *   - "Not available" stays one answer for unknown and invisible activities (404 `hvl:activity-unavailable`, D-066).
 *   - Answers with these codes never carry counts of learners or other people (D-093).
 *   - Statuses of 500 and above are deliberate: the server keeps their code and message instead of a generic fault.
 * Collaborators: ./errors.ts, apps/server/src/http/learningDesignErrors.ts, apps/web.
 * Tests: packages/api-contract/test/learningDesignErrors.test.ts, apps/server/test/http/learningDesignErrors.test.ts
 */

/** Each S5 error code and its HTTP status. */
export const LEARNING_DESIGN_ERROR_STATUS = {
  /** A library the pattern's skeleton needs is not installed (D-085). */
  'hvl:pattern-unavailable': 409,
  /** The phase or content type is not one the pattern offers, or a two-type pattern got none (D-085). */
  'hvl:pattern-choice-invalid': 400,
  /** The metadata changed since the `updatedAt` the author read (D-087). */
  'hvl:learning-design-conflict': 409,
  /** A structural save would invalidate other people's learner state: confirm the reset or save a copy (D-093). */
  'hvl:learner-state-reset-needed': 409,
  /** Only the owner may do this: add or remove co-authors (a co-author may remove themselves), list in the bank. */
  'hvl:owner-only': 403,
  /** The person cannot be added as a co-author: not findable HVL staff, e.g. a student author (D-090). */
  'hvl:coauthor-not-eligible': 400,
  /** The activity already has the most co-authors allowed (D-090). */
  'hvl:coauthor-limit': 409,
  /**
   * Not listable now: not published, or not shared with HVL or wider (D-091); a student owner gets
   * `hvl:sharing-not-allowed` instead.
   */
  'hvl:bank-not-eligible': 409,
  /** The person may view the activity but not copy it (D-092 `duplicateRules`). */
  'hvl:duplicate-not-allowed': 403,
  /** The copy could not be made completely and was removed; nothing was saved (D-092). */
  'hvl:duplicate-failed': 500,
  /** Too many requests in a short time, e.g. people searches (D-090). */
  'hvl:rate-limited': 429,
  /** More activities than a portfolio may include. */
  'hvl:mappe-too-many': 400,
  /** The criteria set is not in the content files (MAPPE-002). */
  'hvl:criteria-set-unknown': 400,
  /** No browser is available to make the PDF; the Markdown export still works (D-096). */
  'hvl:pdf-unavailable': 503,
  /** Every PDF slot is in use, or the person is already making one (D-096). */
  'hvl:pdf-busy': 503,
  /**
   * No portfolio yet: none of the mappe's template and criteria files is in the content (D-094); the page explains
   * it, and nothing can be exported until ALU adds them.
   */
  'hvl:mappe-not-ready': 409,
} as const;

/** A stable S5 error code. */
export type LearningDesignErrorCode = keyof typeof LEARNING_DESIGN_ERROR_STATUS;

/** Every S5 error code, in table order. */
export const LEARNING_DESIGN_ERROR_CODES = Object.freeze(
  Object.keys(LEARNING_DESIGN_ERROR_STATUS) as LearningDesignErrorCode[],
);

/**
 * Tells whether an error code is one of the S5 codes.
 * @param code - The `errorCode` of an error answer.
 * @returns True for a code in `LEARNING_DESIGN_ERROR_STATUS`.
 */
export const isLearningDesignErrorCode = (code: string): code is LearningDesignErrorCode =>
  Object.hasOwn(LEARNING_DESIGN_ERROR_STATUS, code);
