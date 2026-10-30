/**
 * nodeShapes — the part of one node's parameters that the structure signature compares: a rule's facts and text
 * lists, nothing for a stateless library, or all of the parameters for a stateful library without a rule.
 *
 * Why: D-093 (amendment of probe P3) sorts libraries into three kinds. A library with a rule (./leafShapes.ts,
 *      ./containerShapes.ts) is compared on what its learner state points into. A stateless library
 *      (./statelessLibraries.ts) is compared on its position only. Any other library keeps state in a way no probe
 *      has examined, so any change of its parameters is structural, which errs on the strict side.
 * Spec: PROD-013
 * Invariants:
 *   - Rules are chosen by machine name; stateless libraries by `Name major.minor`.
 *   - A stateful library without a rule is compared on canonical JSON of its parameters: keys sorted (PostgreSQL's
 *     jsonb reorders them), every string as plain text (markup the editor re-serialises is no change), and each
 *     nested sub-content node replaced by a marker, because that node is compared on its own entry.
 *   - The node's `metadata` (its title) is never compared.
 * Collaborators: ./leafShapes.ts, ./containerShapes.ts, ./statelessLibraries.ts, ./subContentNodes.ts,
 *   ./structureSignature.ts.
 * Tests: apps/server/test/learningDesign/safeEditing/structureSignature.test.ts
 */
import { CONTAINER_SHAPE_RULES } from './containerShapes.js';
import { LEAF_SHAPE_RULES, type ShapeFacts, type ShapeRule } from './leafShapes.js';
import { isStatelessLibrary } from './statelessLibraries.js';
import { isObject, isSubContentNode, machineNameOf, objectOf, plainTextOfValue } from './subContentNodes.js';

/** What the signature compares of one node. */
export interface NodeShape {
  /** Compared exactly: canonical JSON of the rule's facts, or of the whole parameters without a rule. */
  readonly facts: string;
  /** Text lists of a rule, compared by length and position (./structuralChange.ts). */
  readonly lists: Readonly<Record<string, readonly string[]>>;
}

/** What a stateless node is compared on beyond its position: nothing. */
const POSITION_ONLY: NodeShape = Object.freeze({ facts: '', lists: Object.freeze({}) });

/** Stands for a nested sub-content node inside a library's canonical parameters. */
const NESTED_NODE = '§sub-content';

// SECURITY: a Map, so a library named like an Object.prototype member (`constructor 1.0`) finds no rule.
const RULES: ReadonlyMap<string, ShapeRule> = new Map(
  Object.entries({ ...LEAF_SHAPE_RULES, ...CONTAINER_SHAPE_RULES }),
);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'string') return plainTextOfValue(value);
  if (!isObject(value)) return value ?? null;
  if (isSubContentNode(value)) return NESTED_NODE;
  const keys = Object.keys(value).sort();
  return keys.map((key) => [key, canonical(value[key])]);
}

/**
 * Canonical JSON of a value: object keys sorted, strings as plain text, nested sub-content nodes as a marker.
 * @param value - Parameters or a rule's facts.
 * @returns A string that is equal for two values exactly when the signature treats them as the same.
 */
export const canonicalJson = (value: unknown): string => JSON.stringify(canonical(value) ?? null);

const fromFacts = (shape: ShapeFacts): NodeShape => ({
  facts: shape.facts === undefined ? '' : canonicalJson(shape.facts),
  lists: shape.lists ?? {},
});

/**
 * The compared part of one node's (or the activity's own) parameters.
 * @param library - The node's library as `Name major.minor`.
 * @param params - The node's `params`; anything that is not an object reads as `{}`.
 * @returns The shape.
 * @spec PROD-013
 */
export function shapeOf(library: string, params: unknown): NodeShape {
  const rule = RULES.get(machineNameOf(library));
  if (rule) return fromFacts(rule(objectOf(params)));
  if (isStatelessLibrary(library)) return POSITION_ONLY;
  return { facts: canonicalJson(params), lists: {} };
}
