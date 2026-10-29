/**
 * structureSignature — what an activity's parameters look like to a learner's saved state: every sub-content node
 * with its position, library and `subContentId`, and the answer shape of each node.
 *
 * Why: PROD-013 keeps learners' saved progress after a text-only edit and asks the author before a structural edit
 *      resets it (D-093). Probe P3 showed that every one of the ten types restores state by position (a slide, an
 *      element, an option, a blank, a node index), so two signatures that differ anywhere mean that a resumed
 *      learner could see someone else's answer, lose input or meet a crash. ./structuralChange.ts compares two.
 * Spec: PROD-013
 * Invariants:
 *   - A pre-order walk of the parameters: the activity itself first (path '', the main library), then every node
 *     (an object whose `library` names a version, ./subContentNodes.ts) as it is reached, recording its JSON path,
 *     its library as `Name major.minor`, its `subContentId` (null when missing) and its shape (./nodeShapes.ts).
 *   - Object keys are walked in sorted order and arrays in order, so PostgreSQL's jsonb key order (the stored
 *     parameters) and the editor's (the new ones) give the same signature.
 *   - Pure: no I/O, the input is never changed; a value nested deeper than 300 levels is a RangeError (the editor's
 *     save refuses more than 256 before this runs, semantics/nestingDepth.ts).
 * Collaborators: ./nodeShapes.ts, ./subContentNodes.ts, ./structuralChange.ts, ./LearnerStateGate.ts.
 * Tests: apps/server/test/learningDesign/safeEditing/structureSignature.test.ts,
 *   apps/server/test/learningDesign/safeEditing/structuralChangeRealTypes.test.ts
 */
import { shapeOf, type NodeShape } from './nodeShapes.js';
import { isObject, isSubContentNode, libraryKey } from './subContentNodes.js';

const MAX_DEPTH = 300;

/** One node of the signature (or the activity itself, at path ''). */
export interface SignatureNode {
  /** JSON path in the parameters, e.g. `presentation.slides[1].elements[0].action`; '' for the activity. */
  readonly path: string;
  /** `Name major.minor`. */
  readonly library: string;
  /** The node's `subContentId`, or null (always null for the activity). */
  readonly subContentId: string | null;
  /** What is compared of the node's parameters. */
  readonly shape: NodeShape;
}

/** The structure of an activity's parameters, in pre-order. */
export interface StructureSignature {
  /** The main library as `Name major.minor`. */
  readonly mainLibrary: string;
  /** The activity first, then every sub-content node. */
  readonly nodes: readonly SignatureNode[];
}

const childPath = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`);

function walk(value: unknown, path: string, nodes: SignatureNode[], depth: number): void {
  if (depth > MAX_DEPTH) throw new RangeError(`parameters nest deeper than ${MAX_DEPTH} levels`);
  if (Array.isArray(value)) {
    value.forEach((item: unknown, index) => walk(item, `${path}[${index}]`, nodes, depth + 1));
    return;
  }
  if (!isObject(value)) return;
  if (isSubContentNode(value)) {
    const library = libraryKey(value.library);
    const subContentId = typeof value.subContentId === 'string' ? value.subContentId : null;
    nodes.push({ path, library, subContentId, shape: shapeOf(library, value.params) });
  }
  for (const key of Object.keys(value).sort()) walk(value[key], childPath(path, key), nodes, depth + 1);
}

/**
 * Computes the structure signature of an activity's parameters.
 * @param params - The parameters (content.json), as stored or as the editor will store them.
 * @param mainLibrary - The activity's main library, e.g. `H5P.CoursePresentation 1.28`.
 * @returns The signature.
 * @throws RangeError when the parameters nest deeper than 300 levels.
 * @example
 * const changed = structuralDifference(structureSignature(stored, main), structureSignature(edited, main)) !== null;
 * @spec PROD-013
 */
export function structureSignature(params: unknown, mainLibrary: string): StructureSignature {
  const main = libraryKey(mainLibrary);
  const nodes: SignatureNode[] = [
    { path: '', library: main, subContentId: null, shape: shapeOf(main, params) },
  ];
  // WHY: the activity's own parameters are not a node object, so the walk starts at their fields.
  if (isObject(params)) {
    for (const key of Object.keys(params).sort()) walk(params[key], key, nodes, 1);
  }
  return { mainLibrary: main, nodes };
}
