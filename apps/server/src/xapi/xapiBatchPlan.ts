/**
 * xapiBatchPlan — decides, without I/O, which statements of one learner's batch become `XapiStatement` rows: each
 * item checked on its own, duplicates and replays dropped, timestamps in batch order.
 *
 * Why: D-115 checks every item of a batch on its own, so one odd statement never blocks the others; the bridge
 *      resends what a lost answer or the `pagehide` flush left unacknowledged, so a statement ID already stored is
 *      skipped; and the replay rule needs the batch's own earlier rows. Keeping this pure lets the rules be tested on
 *      probe P1's real statements of all ten types (`[DATA-012]`).
 * Spec: DATA-012, LTI-011
 * Invariants:
 *   - An item that fails the contract's item schema is counted `invalid` and never read further (D-115).
 *   - A `statementId` already stored, or repeated earlier in the batch, is counted `duplicate`; the first wins.
 *   - `timestamp` is `receivedAt` plus the item's place in the batch in milliseconds, so the batch's order is a
 *     strict order and the browser's clock is never read (D-102, D-115).
 *   - A root `completed` is checked by the replay rule unless the main library is exempt (BranchingScenario).
 *   - Every item is counted exactly once: stored, or under one discard reason.
 * Collaborators: ./xapiStatementRow.ts, ./xapiReplayRule.ts, ./XapiIngest.ts, @hvl-interaktiv/api-contract
 *   (`xapiStatementItemSchema`).
 * Tests: apps/server/test/xapi/xapiBatchPlan.test.ts, apps/server/test/xapi/xapiBatchItems.test.ts
 */
import { xapiStatementItemSchema, type XapiStatementItem } from '@hvl-interaktiv/api-contract';
import type { XapiStatement } from '../generated/prisma/client.js';
import { ReplayState, viewIdOf, type ReplayHistory } from './xapiReplayRule.js';
import {
  classifyXapiItem,
  xapiStatementRow,
  type XapiBatchFacts,
  type XapiDiscardReason,
} from './xapiStatementRow.js';

/** Main libraries whose root `completed` is never a replay (D-115). */
export const REPLAY_EXEMPT_LIBRARIES: readonly string[] = ['H5P.BranchingScenario'];

/** A batch's items after the contract's item schema: the parsed item, or undefined for an invalid one. */
export type ParsedXapiItems = readonly (XapiStatementItem | undefined)[];

/** What a batch's plan needs. */
export interface XapiBatchInput {
  readonly items: ParsedXapiItems;
  readonly facts: XapiBatchFacts;
  /** The main library's machine name, e.g. `H5P.CoursePresentation`, for the replay exemption. */
  readonly mainLibrary: string;
  /** Statement IDs of the batch that are stored already, in lower case. */
  readonly storedIds: ReadonlySet<string>;
  readonly history: ReplayHistory;
  /** When the server received the batch. */
  readonly receivedAt: Date;
}

/** The rows to insert and how many items each reason discarded. */
export interface XapiBatchPlan {
  readonly rows: readonly XapiStatement[];
  readonly discarded: Readonly<Record<XapiDiscardReason, number>>;
}

/**
 * Parses each item of a batch on its own with the contract's item schema.
 * @param statements - The envelope's `statements`, unchecked.
 * @returns One entry per statement: the parsed item, or undefined when it is invalid.
 * @spec LTI-011
 */
export function parseXapiItems(statements: readonly unknown[]): ParsedXapiItems {
  return statements.map((statement) => {
    const parsed = xapiStatementItemSchema.safeParse(statement);
    return parsed.success ? parsed.data : undefined;
  });
}

/**
 * The statement IDs and page loads a batch names, for reading what is stored already.
 * @param items - The parsed items.
 * @returns The lower-case statement IDs and the distinct `viewId`s.
 */
export function batchKeys(items: ParsedXapiItems): { statementIds: string[]; viewIds: string[] } {
  const valid = items.filter((item): item is XapiStatementItem => item !== undefined);
  return {
    statementIds: [...new Set(valid.map((item) => item.statementId.toLowerCase()))],
    viewIds: [...new Set(valid.map((item) => viewIdOf(item.attemptId)))],
  };
}

/**
 * Plans the rows of one learner's batch.
 * @param input - The parsed items, the server's facts, what is stored already and the receive time.
 * @returns The rows to insert, in batch order, and the discard counts.
 * @spec DATA-012
 */
export function planXapiBatch(input: XapiBatchInput): XapiBatchPlan {
  const { facts, receivedAt } = input;
  const discarded: Record<XapiDiscardReason, number> = {
    invalid: 0,
    duplicate: 0,
    otherActivity: 0,
    notStored: 0,
    noSubContentId: 0,
    notRootResult: 0,
    replay: 0,
  };
  const rows: XapiStatement[] = [];
  const seen = new Set(input.storedIds);
  const replays = new ReplayState(input.history);
  const exempt = REPLAY_EXEMPT_LIBRARIES.includes(input.mainLibrary);
  input.items.forEach((item, index) => {
    if (item === undefined) return void (discarded.invalid += 1);
    const id = item.statementId.toLowerCase();
    if (seen.has(id)) return void (discarded.duplicate += 1);
    seen.add(id);
    const verdict = classifyXapiItem(item, facts);
    if (verdict.kind === 'discard') return void (discarded[verdict.reason] += 1);
    // WHY: the item's place in the batch keeps the bridge's order as a strict order of stored times (D-115).
    const row = xapiStatementRow(item, facts, new Date(receivedAt.getTime() + index));
    if (verdict.rootResult && !exempt && replays.isReplay(row)) return void (discarded.replay += 1);
    replays.record(row);
    rows.push(row);
  });
  return { rows, discarded };
}
