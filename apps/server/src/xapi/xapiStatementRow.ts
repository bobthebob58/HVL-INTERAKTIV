/**
 * xapiStatementRow — the DATA-012 mapper: decides whether one parsed statement is stored (D-115) and turns it into
 * an `XapiStatement` row with only the minimal fields, the rest of the statement dropped.
 *
 * Why: LTI-011 stores "the minimal fields defined in DATA-012". Who the learner is, which course, which version and
 *      when come from the server (the principal, the launch, the activity and the receive time), never from the
 *      body; D-115 decides which statements are stored at all, since `interacted` and `progressed` serve no INS
 *      requirement and probe P1 found several kinds of statements that no rule should count.
 * Spec: DATA-012, LTI-011
 * Invariants:
 *   - PRIVACY: a row holds exactly DATA-012's fields and `academicYear` (D-107); no actor, name, mailbox, question
 *     text, choice, feedback or extension survives (DATA-012). `learnerKey` and `contextId` come from the request's
 *     principal, `contentVersion` from the server's check, never from a statement.
 *   - SPEC-DEVIATION: D-115 — stored: a root `attempted`; an `answered` of the root (a root result) or of a part with
 *     a `subContentId`; a root result `completed` (replays are dropped by ./xapiReplayRule.ts). Discarded:
 *     `interacted`, `progressed`, a part's `attempted` or `completed`, a part without a `subContentId`, a root
 *     `answered` or `completed` that is not the main library's, and anything about another activity.
 *   - `id` is the bridge's `statementId` in lower case (the database's UUID form), so a statement sent twice is one
 *     row; `timestamp` is given by the caller (receive time plus the item's place in its batch).
 *   - `response` keeps D-115's caps (choice and fill-in only, 100 characters a gap, nothing over 1 000);
 *     `durationMs` is null when absent, unreadable or over 24 hours.
 * Collaborators: ./xapiRootTests.ts, ./xapiDuration.ts, ./xapiBatchPlan.ts, @hvl-interaktiv/api-contract
 *   (`storedXapiResponse`).
 * Tests: apps/server/test/xapi/xapiStatementRow.test.ts, apps/server/test/xapi/xapiBatchPlan.test.ts
 */
import { storedXapiResponse, type XapiStatementItem } from '@hvl-interaktiv/api-contract';
import type { XapiStatement } from '../generated/prisma/client.js';
import { durationMsOf } from './xapiDuration.js';
import { isAboutContent, isRootResult, isRootStatement, subContentIdOf, verbOf } from './xapiRootTests.js';

/** What every row of one batch shares, all decided by the server. */
export interface XapiBatchFacts {
  /** The activity, as stored (lower-case UUID). */
  readonly contentId: string;
  /** The version the page was rendered with, checked against the activity's current version (D-093, D-115). */
  readonly contentVersion: number;
  /** `<platformId>:<contextId>` of the launch (D-103), or null for a portal play. */
  readonly contextId: string | null;
  /** The learner's pseudonym (DATA-002). */
  readonly learnerKey: string;
  /** The academic year of the secret behind `learnerKey` (D-107). */
  readonly academicYear: number;
  /** The main library's category IRI (`mainLibraryCategory`); undefined when its version is unknown. */
  readonly mainCategory: string | undefined;
}

/** Why an item was not stored; counted in the log, never with its content. */
export type XapiDiscardReason =
  'invalid' | 'duplicate' | 'otherActivity' | 'notStored' | 'noSubContentId' | 'notRootResult' | 'replay';

/** Whether a parsed item is stored, and if so whether it is a root result. */
export type XapiItemVerdict =
  | { readonly kind: 'store'; readonly rootResult: boolean }
  | { readonly kind: 'discard'; readonly reason: XapiDiscardReason };

const store = (rootResult: boolean): XapiItemVerdict => ({ kind: 'store', rootResult });
const discard = (reason: XapiDiscardReason): XapiItemVerdict => ({ kind: 'discard', reason });

/**
 * D-115's decision for one parsed statement, before the replay rule.
 * @param item - A statement that passed the contract's item schema.
 * @param facts - The batch's activity and main library.
 * @returns Store (and whether it is a root result) or discard with the reason.
 * @spec LTI-011
 */
export function classifyXapiItem(item: XapiStatementItem, facts: XapiBatchFacts): XapiItemVerdict {
  if (!isAboutContent(item, facts.contentId)) return discard('otherActivity');
  const verb = verbOf(item);
  // SPEC-DEVIATION: D-115 — LTI-011 accepts these verbs, but no INS requirement reads them, so none is stored.
  if (verb === 'interacted' || verb === 'progressed') return discard('notStored');
  if (isRootStatement(item, facts.contentId)) {
    if (verb === 'attempted') return store(false);
    return isRootResult(item, facts.contentId, facts.mainCategory) ? store(true) : discard('notRootResult');
  }
  // WHY: a part's `attempted` and `completed` (InteractiveBook's chapters, sent twice) serve no INS requirement.
  if (verb !== 'answered') return discard('notStored');
  // WHY: content saved without subContentIds names no part; its answers cannot be grouped per question (D-115).
  return subContentIdOf(item) === undefined ? discard('noSubContentId') : store(false);
}

/**
 * The DATA-012 row of a statement that is stored.
 * @param item - A statement that `classifyXapiItem` stores.
 * @param facts - The batch's server-side facts.
 * @param timestamp - The receive time plus the item's place in its batch, in milliseconds (D-115).
 * @returns The row, with nothing from the statement beyond DATA-012's fields.
 * @spec DATA-012
 */
export function xapiStatementRow(
  item: XapiStatementItem,
  facts: XapiBatchFacts,
  timestamp: Date,
): XapiStatement {
  const result = item.result;
  const score = result?.score;
  return {
    id: item.statementId.toLowerCase(),
    contentId: facts.contentId,
    subContentId: subContentIdOf(item) ?? null,
    contentVersion: facts.contentVersion,
    contextId: facts.contextId,
    learnerKey: facts.learnerKey,
    verb: verbOf(item),
    scoreRaw: score?.raw ?? null,
    scoreMax: score?.max ?? null,
    scaled: score?.scaled ?? null,
    success: result?.success ?? null,
    completion: result?.completion ?? null,
    // PRIVACY: only choice indices and short gap text, capped (DATA-012, D-115); other answers are never kept.
    response: storedXapiResponse(result?.response, item.object.definition?.interactionType),
    durationMs: durationMsOf(result?.duration),
    attemptId: item.attemptId,
    timestamp,
    // SPEC-DEVIATION: D-107 — a field outside DATA-012's list: the year of the key's secret, which the purge reads.
    academicYear: facts.academicYear,
  };
}
