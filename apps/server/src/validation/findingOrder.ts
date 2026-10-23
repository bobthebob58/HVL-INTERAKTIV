/**
 * findingOrder — puts findings in one stable order and keeps one finding per rule and path.
 *
 * Why: UD-020 asks for deterministic output: the same content gives the same list, byte for byte, so tests,
 *      caches and the publish check (D-074) can compare lists. Acknowledgements are keyed on (rule, path), so two
 *      findings with the same key would be ambiguous.
 * Spec: UD-020
 * Invariants:
 *   - Order: severity (error, warning, hint), then path (`comparePaths`, indices as numbers), then rule ID, then
 *     message, all compared by code unit, never by locale.
 *   - Of findings with the same rule and path, the first in that order is kept.
 * Collaborators: ./contentPath.ts, ./validateContent.ts.
 * Tests: apps/server/test/validation/validateContent.test.ts
 */
import { comparePaths } from './contentPath.js';
import type { Finding, FindingSeverity } from './types.js';

const SEVERITY_RANK: Readonly<Record<FindingSeverity, number>> = { error: 0, warning: 1, hint: 2 };

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Compares two findings in the validator's order.
 * @param a - First finding.
 * @param b - Second finding.
 * @returns A negative number, zero or a positive number, as `Array.prototype.sort` expects.
 */
export const compareFindings = (a: Finding, b: Finding): number =>
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
  comparePaths(a.path, b.path) ||
  byCodeUnit(a.ruleId, b.ruleId) ||
  byCodeUnit(a.message, b.message);

/**
 * Sorts findings and removes repeats of a rule at the same path.
 * @param findings - Findings in any order (not changed).
 * @returns A new, sorted list with at most one finding per rule and path.
 */
export function orderFindings(findings: readonly Finding[]): Finding[] {
  const seen = new Set<string>();
  return [...findings].sort(compareFindings).filter((finding) => {
    const key = `${finding.ruleId}\u0000${finding.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
