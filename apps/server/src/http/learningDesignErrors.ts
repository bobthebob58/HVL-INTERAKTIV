/**
 * learningDesignErrors — raises the S5 refusals (studio, patterns, learning design, collaboration, safe editing and
 * the mappe) with the status and stable code the API contract fixes, and a translated message.
 *
 * Why: the contract's `LEARNING_DESIGN_ERROR_STATUS` gives each S5 code its status, so the server and the web app
 *      agree on it (D-099); this table adds each code's locale key, so a route raises `learningDesignError(code)` and
 *      never picks a status or a message itself. It is apart from ./authErrors.ts so that the S5 workstreams do not
 *      all edit one shared table.
 * Spec: PROD-012, PROD-001, PROD-007, PROD-013, PED-030, MAPPE-001
 * Invariants:
 *   - Every contract code has exactly one key under `learningDesign.error`; `satisfies` makes a missing code or an
 *     unknown key a compile error, and doc-lint keeps nn, nb and en in step.
 *   - Codes with a status of 500 or above are deliberate: ./h5pErrorResponse.ts keeps their code and message instead
 *     of answering `error.generic`. A message never carries counts of learners (D-093) or internal details.
 *   - One refusal has a second wording: from Canvas, `hvl:learner-state-reset-needed` keeps its status and code but
 *     says `safeEditing.resetNeededCanvas`, as Canvas has no «Lagre som ny versjon» (D-098,
 *     ../learningDesign/safeEditing/resetNeededWording.ts).
 * Collaborators: @hvl-interaktiv/api-contract (`LEARNING_DESIGN_ERROR_STATUS`), ./HttpError.ts,
 *   ./h5pErrorResponse.ts, ../i18n/locales/*.json, ../learningDesign/safeEditing/resetNeededWording.ts.
 * Tests: apps/server/test/http/learningDesignErrors.test.ts
 */
import {
  isLearningDesignErrorCode,
  LEARNING_DESIGN_ERROR_STATUS,
  type LearningDesignErrorCode,
} from '@hvl-interaktiv/api-contract';
import type { MessageKey } from '../i18n/translate.js';
import { HttpError } from './HttpError.js';

/** The locale key of each S5 error code. */
export const LEARNING_DESIGN_ERROR_KEYS = {
  'hvl:pattern-unavailable': 'learningDesign.error.patternUnavailable',
  'hvl:pattern-choice-invalid': 'learningDesign.error.patternChoiceInvalid',
  'hvl:learning-design-conflict': 'learningDesign.error.learningDesignConflict',
  'hvl:learner-state-reset-needed': 'learningDesign.error.learnerStateResetNeeded',
  'hvl:owner-only': 'learningDesign.error.ownerOnly',
  'hvl:coauthor-not-eligible': 'learningDesign.error.coauthorNotEligible',
  'hvl:coauthor-limit': 'learningDesign.error.coauthorLimit',
  'hvl:bank-not-eligible': 'learningDesign.error.bankNotEligible',
  'hvl:duplicate-not-allowed': 'learningDesign.error.duplicateNotAllowed',
  'hvl:duplicate-failed': 'learningDesign.error.duplicateFailed',
  'hvl:rate-limited': 'learningDesign.error.rateLimited',
  'hvl:mappe-too-many': 'learningDesign.error.mappeTooMany',
  'hvl:criteria-set-unknown': 'learningDesign.error.criteriaSetUnknown',
  'hvl:pdf-unavailable': 'learningDesign.error.pdfUnavailable',
  'hvl:pdf-busy': 'learningDesign.error.pdfBusy',
  'hvl:mappe-not-ready': 'learningDesign.error.mappeNotReady',
} as const satisfies Record<LearningDesignErrorCode, MessageKey>;

/**
 * Builds the error for an S5 refusal.
 * @param code - Which refusal, from the API contract.
 * @returns An HttpError with the code's contract status, locale key and machine code.
 * @example
 * throw learningDesignError('hvl:learning-design-conflict'); // 409, translated, errorCode as given
 */
export function learningDesignError(code: LearningDesignErrorCode): HttpError {
  return new HttpError(LEARNING_DESIGN_ERROR_STATUS[code], LEARNING_DESIGN_ERROR_KEYS[code], {}, code);
}

/**
 * Tells whether an error is a given S5 refusal.
 * @param error - Anything thrown.
 * @param code - The refusal to test for.
 * @returns True when `error` came from `learningDesignError(code)`.
 */
export const isLearningDesignError = (error: unknown, code: LearningDesignErrorCode): boolean =>
  error instanceof HttpError && error.errorCode === code;

/**
 * Tells whether a 5xx answer is a deliberate S5 refusal (no PDF browser, every PDF slot busy, a failed duplicate)
 * rather than a fault.
 * @param code - The answer's machine code.
 * @param status - The answer's HTTP status.
 * @returns True when the code is an S5 code whose contract status is exactly `status` and at least 500.
 */
export const isDeliberateLearningDesignFault = (code: string, status: number): boolean =>
  status >= 500 && isLearningDesignErrorCode(code) && LEARNING_DESIGN_ERROR_STATUS[code] === status;
