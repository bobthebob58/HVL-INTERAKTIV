/**
 * rule — the shape every validator rule has: what it is (ID, severity, requirement), which messages it may use,
 * and a pure check over the walked content.
 *
 * Why: UD-020 puts each rule in its own file under ./rules/; one interface lets the engine run them all the same
 *      way and lets the tests check, for every rule, its fixtures and that its messages exist in nn, nb and en.
 * Spec: UD-020, UD-021, PED-020
 * Invariants:
 *   - A rule's `check` is pure: it reads the scope and returns hits, nothing else.
 *   - Every hit's `message` is one of the rule's `messages`.
 *   - `PED-H*` rules have severity `warning` or `hint`, never `error` (spec 04 §5).
 * Collaborators: ./ruleSet.ts, ./validateContent.ts, ./validationMessages.ts, ./contentWalker.ts.
 * Tests: apps/server/test/validation/validateContent.test.ts
 */
import type { ContentNode } from './contentWalker.js';
import type { FindingSeverity, ValidationContext, ValidationMetadata } from './types.js';
import type { MessageValues, ValidationMessageKey } from './validationMessages.js';

/** What a rule sees. */
export interface RuleScope {
  /** The activity first, then every sub-content (contentWalker). */
  readonly nodes: readonly ContentNode[];
  readonly metadata: ValidationMetadata;
  readonly context: ValidationContext;
}

/** One problem a rule found, before it is localised. */
export interface RuleHit {
  /** Path from the params root (or `metadata.<field>`). */
  readonly path: string;
  readonly message: ValidationMessageKey;
  /** Values for the message's `{{placeholders}}`. */
  readonly values?: MessageValues;
}

/** A validator rule. */
export interface ValidationRule {
  /** e.g. `V-IMG-ALT` or `PED-H05`. */
  readonly id: string;
  readonly requirement: 'UD-021' | 'PED-020';
  readonly severity: FindingSeverity;
  /** Every message key the rule may report. */
  readonly messages: readonly ValidationMessageKey[];
  /**
   * Finds the rule's problems.
   * @param scope - The walked content, its metadata and the configuration.
   * @returns The hits, in any order (the engine sorts).
   */
  check(scope: RuleScope): readonly RuleHit[];
}

/**
 * The nodes of the given content types.
 * @param scope - The rule's scope.
 * @param machineNames - e.g. `H5P.Image`.
 * @returns The matching nodes, in walk order.
 */
export const nodesOf = (scope: RuleScope, ...machineNames: readonly string[]): readonly ContentNode[] =>
  scope.nodes.filter((node) => node.machineName !== undefined && machineNames.includes(node.machineName));
