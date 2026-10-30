/**
 * xapiStatementShape — the parts of an H5P xAPI statement the S6 grade bridge reads, and how probe P1 found them
 * written: the extension IRIs, the verbs, the anonymous actor and P1's rule for the root activity.
 *
 * Why: the browser test and the curated fixtures (../../fixtures/xapi/) describe statements in the same terms, so a
 *      fact the test pins and a fact step 3's mapper reads cannot drift apart (D-102, D-115).
 * Spec: H5P-009
 * Invariants:
 *   - The root rule is P1's: object.id is the content ID, no h5p-subContentId extension, no parent, and a category
 *     naming the main library. Each condition alone misclassifies a statement P1 observed. For `answered` and
 *     `completed` it is D-115's root result; D-115 also takes a root `attempted` without a category for the root
 *     (InteractiveBook without a cover), a case these fixtures do not hold.
 *   - Nothing here reads or keeps personal data; H5P's actor is anonymous in our player (finding F4).
 * Collaborators: ./xapiCapture.ts, ./xapiFindings.ts, ../../support/xapiFixtures.ts.
 * Tests: ../xapiQuestionTypes.browser.int.test.ts, ../xapiContainerTypes.browser.int.test.ts
 */

/** An activity reference in `context.contextActivities`. */
export interface XapiActivityRef {
  readonly id: string;
}

/** The xAPI statement as H5P dispatches it (the fields the bridge reads; others pass through). */
export interface XapiStatement {
  readonly actor?: unknown;
  readonly verb: { readonly id: string; readonly display?: Record<string, string> };
  readonly object: {
    readonly id: string;
    readonly objectType?: string;
    readonly definition?: {
      readonly interactionType?: string;
      readonly extensions?: Record<string, unknown>;
    };
  };
  readonly context?: {
    readonly contextActivities?: {
      readonly category?: readonly XapiActivityRef[];
      readonly parent?: readonly XapiActivityRef[];
    };
    readonly extensions?: Record<string, unknown>;
  };
  readonly result?: {
    readonly score?: {
      readonly min?: number;
      readonly max: number;
      readonly raw: number;
      /** Absent when `max` is 0 (H5P Core's setScoredResult). */
      readonly scaled?: number;
    };
    readonly success?: boolean;
    readonly completion?: boolean;
    readonly duration?: string;
    readonly response?: string | number;
  };
  readonly [key: string]: unknown;
}

/** The extension that names the activity's content ID. */
export const LOCAL_CONTENT_ID = 'http://h5p.org/x-api/h5p-local-content-id';
/** The extension that names a sub-content item. */
export const SUB_CONTENT_ID = 'http://h5p.org/x-api/h5p-subContentId';
/** Where the xAPI verbs live. */
export const VERB_BASE = 'http://adlnet.gov/expapi/verbs/';
/** The verbs LTI-011 accepts, which are exactly the verbs P1 saw (finding F6). */
export const ACCEPTED_VERBS = ['answered', 'completed', 'attempted', 'interacted', 'progressed'] as const;
/** H5P's anonymous user, the actor of every statement in our player (finding F4). */
export const ANONYMOUS_ACTOR = { name: '', mbox: 'mailto:', objectType: 'Agent' };
/** The top-level keys P1 saw: no `id` and no `timestamp` (finding F6). */
export const STATEMENT_KEYS = ['actor', 'context', 'object', 'result', 'verb'];

/**
 * The verb's last path segment.
 * @param statement - A statement.
 * @returns For example `answered`.
 */
export function verbOf(statement: XapiStatement): string {
  return statement.verb.id.slice(statement.verb.id.lastIndexOf('/') + 1);
}

/**
 * The sub-content item a statement is about, from the extension.
 * @param statement - A statement.
 * @returns Its subContentId, or undefined for one without the extension.
 */
export function subContentIdOf(statement: XapiStatement): string | undefined {
  const value = statement.object.definition?.extensions?.[SUB_CONTENT_ID];
  return typeof value === 'string' ? value : undefined;
}

/**
 * The library a statement names in `context.contextActivities.category`, as `H5P.Name-1.2`.
 * @param statement - A statement.
 * @returns The library, or undefined when the statement has no category.
 */
export function libraryOf(statement: XapiStatement): string | undefined {
  return statement.context?.contextActivities?.category?.[0]?.id.replace('http://h5p.org/libraries/', '');
}

/**
 * P1's root rule: a statement about the activity itself, never about a sub-content item or a restore event.
 * @param statement - A statement.
 * @param contentId - The activity's content ID.
 * @param mainLibrary - The main library as `H5P.Name-1.2`.
 * @returns Whether all four conditions hold.
 */
export function isRootStatement(statement: XapiStatement, contentId: string, mainLibrary: string): boolean {
  return (
    statement.object.id === contentId &&
    subContentIdOf(statement) === undefined &&
    !statement.context?.contextActivities?.parent?.length &&
    libraryOf(statement) === mainLibrary
  );
}
