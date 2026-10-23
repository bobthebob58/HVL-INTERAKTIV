/**
 * acknowledgementCoverage — which validator errors an author has explained, and whether a publish may go ahead.
 *
 * Why: PROD-003 blocks publishing on an error unless the author gives a reason, and asks again after 14 days; UD-022
 *      stores that reason. D-074 says an error is covered by an acknowledgement for the same rule and path younger
 *      than 14 days, or by one in the request. Kept pure so the rules are tested without a database or a clock.
 * Spec: PROD-003, UD-022
 * Invariants:
 *   - Only errors can be acknowledged or block; warnings and hints never block and never carry an acknowledgement.
 *   - An acknowledgement covers only the same `(ruleId, path)`; it holds while it is younger than 14 days.
 *   - A requested acknowledgement that names no current error makes the whole request invalid.
 *   - Requested acknowledgements for the same `(ruleId, path)` collapse into the first one.
 * Collaborators: ./ContentPublisher.ts, ./PublishedSaveGate.ts, ../validation/types.ts.
 * Tests: apps/server/test/content/acknowledgementCoverage.test.ts
 */
import type { Finding } from '../validation/types.js';

/** How long an acknowledgement covers an error: 14 days (PROD-003). */
export const ACKNOWLEDGEMENT_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

/** An acknowledgement as stored (`ValidationAcknowledgement`). */
export interface StoredAcknowledgement {
  readonly ruleId: string;
  readonly path: string;
  readonly reason: string;
  readonly at: Date;
}

/** An acknowledgement an author sends with a publish request. */
export interface RequestedAcknowledgement {
  readonly ruleId: string;
  readonly path: string;
  readonly reason: string;
}

/** A finding with the acknowledgement that still covers it, if any (the answer shape of the findings API). */
export interface CoveredFinding extends Finding {
  readonly acknowledgement: {
    readonly reason: string;
    readonly at: string;
    readonly expiresAt: string;
  } | null;
}

/** What a publish request leads to. */
export type PublishDecision =
  | { readonly kind: 'invalid' }
  | { readonly kind: 'blocked'; readonly findings: readonly CoveredFinding[] }
  | { readonly kind: 'allowed'; readonly acknowledgements: readonly RequestedAcknowledgement[] };

const keyOf = (item: { readonly ruleId: string; readonly path: string }): string =>
  JSON.stringify([item.ruleId, item.path]);

const isError = (finding: Finding): boolean => finding.severity === 'error';

/**
 * Tells whether an acknowledgement still holds.
 * @param acknowledgement - When it was given.
 * @param now - The current moment.
 * @returns True while it is younger than 14 days.
 */
export const stillHolds = (acknowledgement: Pick<StoredAcknowledgement, 'at'>, now: Date): boolean =>
  now.getTime() - acknowledgement.at.getTime() < ACKNOWLEDGEMENT_LIFETIME_MS;

/**
 * Annotates findings with the newest stored acknowledgement that still covers each error.
 * @param findings - The validator's findings for the stored or submitted activity.
 * @param stored - Acknowledgements stored for the activity (any age, any order).
 * @param now - The current moment.
 * @returns The findings in their order, each with its acknowledgement or null.
 * @spec UD-022
 */
export function withAcknowledgements(
  findings: readonly Finding[],
  stored: readonly StoredAcknowledgement[],
  now: Date,
): CoveredFinding[] {
  const newest = new Map<string, StoredAcknowledgement>();
  for (const ack of stored.filter((a) => stillHolds(a, now))) {
    const known = newest.get(keyOf(ack));
    if (!known || known.at < ack.at) newest.set(keyOf(ack), ack);
  }
  return findings.map((finding) => {
    const ack = isError(finding) ? newest.get(keyOf(finding)) : undefined;
    const acknowledgement = ack
      ? {
          reason: ack.reason,
          at: ack.at.toISOString(),
          expiresAt: new Date(ack.at.getTime() + ACKNOWLEDGEMENT_LIFETIME_MS).toISOString(),
        }
      : null;
    return { ...finding, acknowledgement };
  });
}

/**
 * Tells whether an annotated list still holds an error that nobody has explained.
 * @param findings - Findings from `withAcknowledgements`.
 * @param requested - Acknowledgements that come with the request, if any.
 * @returns True when at least one error is neither stored-acknowledged nor in `requested`.
 */
export function hasUncoveredError(
  findings: readonly CoveredFinding[],
  requested: readonly RequestedAcknowledgement[] = [],
): boolean {
  const asked = new Set(requested.map(keyOf));
  return findings.some((f) => isError(f) && f.acknowledgement === null && !asked.has(keyOf(f)));
}

/**
 * Decides a publish request (D-074).
 * @param findings - The validator's findings for the stored activity (never the client's).
 * @param stored - Acknowledgements stored for the activity.
 * @param requested - Acknowledgements in the request.
 * @param now - The current moment.
 * @returns `invalid` when a requested acknowledgement names no current error, `blocked` with the annotated
 *   findings when an error is still uncovered, else `allowed` with the acknowledgements to store.
 * @spec PROD-003
 */
export function decidePublish(
  findings: readonly Finding[],
  stored: readonly StoredAcknowledgement[],
  requested: readonly RequestedAcknowledgement[],
  now: Date,
): PublishDecision {
  const errors = new Set(findings.filter(isError).map(keyOf));
  if (requested.some((ack) => !errors.has(keyOf(ack)))) return { kind: 'invalid' };
  const covered = withAcknowledgements(findings, stored, now);
  if (hasUncoveredError(covered, requested)) return { kind: 'blocked', findings: covered };
  const unique = new Map<string, RequestedAcknowledgement>();
  for (const ack of requested) if (!unique.has(keyOf(ack))) unique.set(keyOf(ack), ack);
  return { kind: 'allowed', acknowledgements: [...unique.values()] };
}
