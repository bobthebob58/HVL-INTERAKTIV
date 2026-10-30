/**
 * structuralChange — compares the structure signatures of an activity before and after an edit and says whether,
 * and where, the edit is structural.
 *
 * Why: D-093: a structural edit resets learners' saved progress (after the author confirms, if others have any), a
 *      text-only edit keeps it. Any difference in the node list or in a node's facts is structural; a text list
 *      (options, blanks, words, alternatives) is structural only when its length changes or one of its texts moves,
 *      so rewording an option in place is not, while adding, removing or reordering options is.
 * Spec: PROD-013
 * Invariants:
 *   - Structural: another main library; another number of nodes; a node with another path, library or
 *     `subContentId`; another `facts` string; a list of another length, or a list where a text of the old list now
 *     stands at a position where it did not stand before.
 *   - The answer names the first difference by kind and JSON path only, never by a text from the parameters.
 *   - Pure.
 * Collaborators: ./structureSignature.ts, ./LearnerStateGate.ts.
 * Tests: apps/server/test/learningDesign/safeEditing/structuralChange.test.ts,
 *   apps/server/test/learningDesign/safeEditing/structuralChangeRealTypes.test.ts
 */
import type { SignatureNode, StructureSignature } from './structureSignature.js';

/** The kind of the first structural difference found. */
export type StructuralDifferenceKind = 'main-library' | 'node-count' | 'node' | 'facts' | 'list';

/** Where an edit is structural. */
export interface StructuralDifference {
  readonly kind: StructuralDifferenceKind;
  /** The JSON path of the node ('' for the activity itself); for `list`, followed by `#` and the list's name. */
  readonly path: string;
}

/**
 * Tells whether a text list changed its structure.
 * @param before - The list before the edit.
 * @param after - The list after it.
 * @returns True when the length differs, or when a text of `before` now stands where it did not stand before
 *   (it moved, or another item was removed or inserted in front of it); false when texts only changed in place.
 * @example
 * isListStructural(['Ja', 'Nei'], ['Ja', 'Nei, aldri']); // false: reworded in place
 * isListStructural(['Ja', 'Nei'], ['Nei', 'Ja']); // true: moved
 */
export function isListStructural(before: readonly string[], after: readonly string[]): boolean {
  if (before.length !== after.length) return true;
  return after.some((text, index) => text !== before[index] && before.includes(text));
}

const sameNode = (a: SignatureNode, b: SignatureNode): boolean =>
  a.path === b.path && a.library === b.library && a.subContentId === b.subContentId;

function shapeDifference(before: SignatureNode, after: SignatureNode): StructuralDifference | null {
  if (before.shape.facts !== after.shape.facts) return { kind: 'facts', path: before.path };
  const names = new Set([...Object.keys(before.shape.lists), ...Object.keys(after.shape.lists)]);
  for (const name of [...names].sort()) {
    const changed = isListStructural(before.shape.lists[name] ?? [], after.shape.lists[name] ?? []);
    if (changed) return { kind: 'list', path: `${before.path}#${name}` };
  }
  return null;
}

/**
 * Finds the first structural difference between two signatures of the same activity.
 * @param before - The signature of the stored parameters.
 * @param after - The signature of the parameters the save would store.
 * @returns The difference, or null when the edit is not structural.
 * @spec PROD-013
 */
export function structuralDifference(
  before: StructureSignature,
  after: StructureSignature,
): StructuralDifference | null {
  if (before.mainLibrary !== after.mainLibrary) return { kind: 'main-library', path: '' };
  if (before.nodes.length !== after.nodes.length) return { kind: 'node-count', path: '' };
  for (const [index, old] of before.nodes.entries()) {
    const now = after.nodes[index];
    if (!now || !sameNode(old, now)) return { kind: 'node', path: old.path };
    const difference = shapeDifference(old, now);
    if (difference) return difference;
  }
  return null;
}
