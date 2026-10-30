/**
 * xapiRootTests — D-115's tests on one statement: which activity and part it is about, whether it is the root
 * activity's, whether it is a root result, and whether a stored row is a gradable result.
 *
 * Why: H5P marks neither the root nor attempts, and probe P1 found that no single test finds the root: H5P's own (no
 *      parent) takes InteractiveBook's chapter `completed`, and LTI-012's (no `subContentId`) takes DragText's
 *      context-less `interacted` and every child of content saved without `subContentId`s. D-115 combines three
 *      structural tests, adds the main library's category for a result, and keeps them in this one server module,
 *      which the mapper, the replay rule and the grade enqueuer all read.
 * Spec: DATA-012, LTI-011, LTI-012
 * Invariants:
 *   - SPEC-DEVIATION: D-115 — root means: `object.id` is the content ID with no `?subContentId=`, no
 *     `h5p-subContentId` extension, and no `contextActivities.parent`; LTI-012's "no `subContentId`" alone is not it.
 *   - A root result is a root `answered` or `completed` whose `category[0].id` names the main library
 *     (`http://h5p.org/libraries/<machineName>-<major>.<minor>`); a root `attempted` needs no category.
 *   - A stored row is a root result exactly when it has no `subContentId` and its verb is `answered` or `completed`
 *     (the mapper stores no other root `answered` or `completed`); it is gradable when `scoreMax` is above 0, since
 *     a replay is never stored.
 *   - Content IDs compare without regard to case: H5P writes them as stored (lower case), a UUID in any case is one.
 * Collaborators: ./xapiStatementRow.ts, ./xapiReplayRule.ts, @hvl-interaktiv/api-contract (`xapi.ts`), the grade
 *   enqueuer (S6 step 3, through `isGradableResult`).
 * Tests: apps/server/test/xapi/xapiRootTests.test.ts, apps/server/test/xapi/xapiBatchPlan.test.ts
 */
import {
  H5P_LOCAL_CONTENT_ID_EXTENSION,
  H5P_SUBCONTENT_ID_EXTENSION,
  XAPI_VERB_NAMESPACE,
  type XapiStatementItem,
  type XapiVerb,
} from '@hvl-interaktiv/api-contract';

/** Where H5P's category IRIs of libraries start. */
export const H5P_LIBRARY_CATEGORY_PREFIX = 'http://h5p.org/libraries/';
/** How `object.id` names a part of the activity. */
const SUB_CONTENT_QUERY = '?subContentId=';

/** The verbs of a root result (D-115). */
const RESULT_VERBS: readonly string[] = ['answered', 'completed'];

/**
 * The category IRI H5P gives statements of a main library.
 * @param ubername - The main library with its version, e.g. `H5P.MultiChoice 1.16` (`mainLibraryUbername`).
 * @returns e.g. `http://h5p.org/libraries/H5P.MultiChoice-1.16`, or undefined when the version is unknown.
 */
export function mainLibraryCategory(ubername: string): string | undefined {
  const match = /^([\w.]+) (\d+\.\d+)$/.exec(ubername);
  return match ? `${H5P_LIBRARY_CATEGORY_PREFIX}${match[1] ?? ''}-${match[2] ?? ''}` : undefined;
}

/**
 * The verb a statement stores, the last segment of its IRI.
 * @param item - A parsed statement.
 * @returns e.g. `answered`.
 */
export const verbOf = (item: Pick<XapiStatementItem, 'verb'>): XapiVerb =>
  item.verb.id.slice(XAPI_VERB_NAMESPACE.length) as XapiVerb;

const lower = (text: string): string => text.toLowerCase();
const objectBase = (item: XapiStatementItem): string => item.object.id.split(SUB_CONTENT_QUERY, 1)[0] ?? '';

/**
 * The part of the activity a statement is about: the `h5p-subContentId` extension, else the `?subContentId=` of
 * `object.id` (D-115).
 * @param item - A parsed statement.
 * @returns The sub-content ID, or undefined when the statement names none (or an empty one).
 */
export function subContentIdOf(item: XapiStatementItem): string | undefined {
  const fromExtension = item.object.definition?.extensions?.[H5P_SUBCONTENT_ID_EXTENSION];
  if (fromExtension) return fromExtension;
  const at = item.object.id.indexOf(SUB_CONTENT_QUERY);
  const fromObject = at < 0 ? '' : item.object.id.slice(at + SUB_CONTENT_QUERY.length);
  return fromObject === '' ? undefined : fromObject;
}

/**
 * Tells whether a statement is about the given activity: its `object.id` names it, and so does its
 * `h5p-local-content-id` extension when it has one.
 * @param item - A parsed statement.
 * @param contentId - The batch's activity.
 * @returns False for a statement about another activity, which the server discards (D-115).
 */
export function isAboutContent(item: XapiStatementItem, contentId: string): boolean {
  const local = item.object.definition?.extensions?.[H5P_LOCAL_CONTENT_ID_EXTENSION];
  return (
    lower(objectBase(item)) === lower(contentId) && (local === undefined || lower(local) === lower(contentId))
  );
}

/**
 * D-115's root test: the three structural conditions together.
 * @param item - A parsed statement about `contentId`.
 * @param contentId - The batch's activity.
 * @returns True when the statement is the root activity's own.
 * @spec LTI-012
 */
export function isRootStatement(item: XapiStatementItem, contentId: string): boolean {
  const parents = item.context?.contextActivities?.parent ?? [];
  return (
    lower(item.object.id) === lower(contentId) &&
    item.object.definition?.extensions?.[H5P_SUBCONTENT_ID_EXTENSION] === undefined &&
    parents.length === 0
  );
}

/**
 * D-115's root result: a root `answered` or `completed` from the activity's main library.
 * @param item - A parsed statement about `contentId`.
 * @param contentId - The batch's activity.
 * @param category - The main library's category (`mainLibraryCategory`); undefined matches nothing.
 * @returns True for a root result, gradable or not.
 * @spec LTI-012
 */
export function isRootResult(
  item: XapiStatementItem,
  contentId: string,
  category: string | undefined,
): boolean {
  return (
    RESULT_VERBS.includes(verbOf(item)) &&
    isRootStatement(item, contentId) &&
    category !== undefined &&
    item.context?.contextActivities?.category?.[0]?.id === category
  );
}

/** The fields of a stored `XapiStatement` that say whether it is a gradable result. */
export interface StoredResultFacts {
  readonly subContentId: string | null;
  readonly verb: string;
  readonly scoreMax: number | null;
}

/**
 * Tells whether a stored row is a stored root result.
 * @param row - A stored `XapiStatement`.
 * @returns True for a root `answered` or `completed`, which the mapper stores only as a root result.
 */
export const isStoredRootResult = (row: Pick<StoredResultFacts, 'subContentId' | 'verb'>): boolean =>
  row.subContentId === null && RESULT_VERBS.includes(row.verb);

/**
 * Tells whether a stored row is a gradable root result, the only kind that queues a score (D-104, D-115).
 * @param row - A stored `XapiStatement` (replays are never stored).
 * @returns True for a stored root result whose `scoreMax` is above 0.
 * @spec LTI-012
 */
export const isGradableResult = (row: StoredResultFacts): boolean =>
  isStoredRootResult(row) && row.scoreMax !== null && row.scoreMax > 0;
