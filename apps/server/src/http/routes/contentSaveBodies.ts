/**
 * contentSaveBodies — reads the bodies that carry an activity's parameters: a save, «Lagre som ny versjon» and
 * the editor's check of pasted content. Their shape, and that what they hold is within the limits for one activity.
 *
 * Why: the body is the first place an activity's parameters arrive, and everything after it reads them: the
 *      publish gate's validator, the sub-content policy, Lumi's cleaning. The shape and the size are therefore
 *      settled here, before any of them runs (D-126).
 * Spec: H5P-006, SEC-005, PROD-012, PROD-013
 * Invariants:
 *   - A save body is `{ library: string, params: { params: object, metadata: object },
 *     confirmLearnerStateReset?: boolean }`; a copy body is `{ params: object, metadata: object }`. Anything else
 *     is 400 `error.badRequest`.
 *   - Parameters or metadata past a limit of ../../h5p/semantics/contentBudget.ts are 400
 *     `hvl:content-too-large`, before anything else reads them.
 *   - Pasted content (`action=filter`, a form field `libraryParameters` holding JSON) is held to the same limits
 *     and to the nesting limit before Lumi cleans it; a field that is no JSON is left for Lumi to refuse.
 * Collaborators: ./contentRoutes.ts, ./ajaxRoutes.ts, ../../h5p/semantics/contentBudget.ts,
 *   ../../h5p/semantics/nestingDepth.ts, ../HttpError.ts.
 * Tests: apps/server/test/http/contentSave.int.test.ts, apps/server/test/http/contentBudget.int.test.ts
 */
import type { ContentParameters, IContentMetadata } from '@lumieducation/h5p-server';
import { assertContentBudget } from '../../h5p/semantics/contentBudget.js';
import { assertNestingDepth } from '../../h5p/semantics/nestingDepth.js';
import type { SaveChoice } from '../../learningDesign/safeEditing/LearnerStateGate.js';
import { HttpError } from '../HttpError.js';

/** What H5P's editor gives as `content.params`. */
export interface EditedContent {
  readonly params: ContentParameters;
  readonly metadata: IContentMetadata;
}

/** A save as the editor page sends it. */
export interface SaveRequest extends EditedContent {
  readonly library: string;
  /** The author's answer to the save choice dialog (PROD-013). */
  readonly choice: SaveChoice;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads `{ params, metadata }` as H5P's editor gives them.
 * @param value - The body of a copy, or `params` of a save body.
 * @returns The parameters and the metadata.
 * @throws HttpError 400 `error.badRequest` for another shape; H5pError 400 `hvl:content-too-large` past a limit.
 * @spec SEC-005
 */
export function editedContent(value: unknown): EditedContent {
  if (!isObject(value) || !isObject(value.params) || !isObject(value.metadata)) {
    throw new HttpError(400, 'error.badRequest');
  }
  // SECURITY: first, so the validator, the policy and Lumi only ever read content within the limits (D-126).
  assertContentBudget(value.params);
  assertContentBudget(value.metadata);
  return { params: value.params, metadata: value.metadata as unknown as IContentMetadata };
}

/**
 * Reads the body of a save.
 * @param body - `req.body`.
 * @returns The library, the parameters, the metadata and the save choice.
 * @throws HttpError 400 `error.badRequest` for another shape; H5pError 400 `hvl:content-too-large` past a limit.
 * @spec H5P-006
 */
export function saveRequest(body: unknown): SaveRequest {
  if (!isObject(body) || typeof body.library !== 'string') throw new HttpError(400, 'error.badRequest');
  const confirm = body.confirmLearnerStateReset;
  if (confirm !== undefined && typeof confirm !== 'boolean') throw new HttpError(400, 'error.badRequest');
  const choice = { confirmLearnerStateReset: confirm === true };
  return { library: body.library, ...editedContent(body.params), choice };
}

/**
 * Checks the content the editor sends to have a paste filtered, before Lumi reads it.
 * @param body - The form body of `action=filter`; `libraryParameters` is JSON `{ library, params, metadata }`.
 * @throws H5pError 400 `hvl:content-too-deep` or `hvl:content-too-large` past a limit.
 * @spec SEC-005
 */
export function assertPasteWithinLimits(body: unknown): void {
  const field = isObject(body) ? body.libraryParameters : undefined;
  if (typeof field !== 'string') return;
  let pasted: unknown;
  try {
    pasted = JSON.parse(field);
  } catch {
    return; // WHY: Lumi answers a field that is no JSON with 400 `malformed-request`.
  }
  assertNestingDepth(pasted);
  assertContentBudget(pasted);
}
