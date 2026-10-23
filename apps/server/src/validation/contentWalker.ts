/**
 * contentWalker — finds the activity and every nested sub-content in H5P parameters by shape, and collects each
 * one's own text with its path.
 *
 * Why: UD-020 asks for a walk through nested sub-content without a semantics lookup (which is asynchronous in
 *      Lumi, D-073). H5P stores sub-content as `{ library: "H5P.Name 1.2", params, subContentId }`, in lists or
 *      groups at any depth, so any object with a library string and `params` is a node.
 * Spec: UD-020
 * Invariants:
 *   - Pure and deterministic: nodes come in pre-order, keys in insertion order (as JSON.parse returns them).
 *   - Each string belongs to exactly one node: the walk of a node stops at its sub-content.
 *   - User-interface labels (`l10n`, `UI`, `texts`, `a11y`, `confirmCheck`, `confirmRetry`) and file
 *     references (`path`, `mime`, `copyright`, `subContentId`) are not authored text and are not collected.
 *   - Input is never mutated; cycles and nesting deeper than MAX_DEPTH are not followed.
 * Collaborators: ./contentKinds.ts, ./contentPath.ts, ./richText.ts, ./validateContent.ts.
 * Tests: apps/server/test/validation/contentWalker.test.ts
 */
import { machineNameOf, mainMachineNameOf } from './contentKinds.js';
import { isWithin, pathOf } from './contentPath.js';
import { asObject, asString, type ParamObject } from './paramReaders.js';
import { parseRichText, type RichText } from './richText.js';

/** A string parameter of a node, with its parsed text. */
export interface StringField {
  /** Path from the params root, e.g. `content[0].content.params.text`. */
  readonly path: string;
  readonly value: string;
  readonly rich: RichText;
}

/** The activity itself or one sub-content inside it. */
export interface ContentNode {
  /** As written, e.g. `H5P.Image 1.1`. */
  readonly library: string;
  /** e.g. `H5P.Image`; `undefined` only for a main library string that is not a library reference. */
  readonly machineName: string | undefined;
  /** The node's own parameters. */
  readonly params: unknown;
  /** Path of `params` from the params root: `''` for the activity, e.g. `questions[2].params` otherwise. */
  readonly path: string;
  /** The node's authored strings, excluding those of its sub-content. */
  readonly strings: readonly StringField[];
}

// WHY: content.json from H5P nests about 15 levels deep; a limit keeps hostile input from exhausting the stack.
const MAX_DEPTH = 100;
const LABEL_GROUPS: ReadonlySet<string> = new Set([
  'l10n',
  'UI',
  'texts',
  'a11y',
  'confirmCheck',
  'confirmRetry',
]);
const REFERENCE_KEYS: ReadonlySet<string> = new Set(['path', 'mime', 'copyright', 'subContentId', 'library']);

interface WalkState {
  readonly nodes: ContentNode[];
  readonly seen: WeakSet<object>;
}

/**
 * Tells whether an object is H5P sub-content.
 * @param value - Any parameter object.
 * @returns The library string when `value` has a library reference and `params`, else `undefined`.
 */
export function subContentLibraryOf(value: ParamObject): string | undefined {
  const library = asString(value.library);
  return library !== undefined && 'params' in value && machineNameOf(library) ? library : undefined;
}

function visitNode(
  library: string,
  machineName: string | undefined,
  params: unknown,
  path: string,
  state: WalkState,
  depth: number,
): void {
  const strings: StringField[] = [];
  state.nodes.push({ library, machineName, params, path, strings });
  scan(params, path, strings, state, depth);
}

function scan(value: unknown, path: string, strings: StringField[], state: WalkState, depth: number): void {
  if (depth > MAX_DEPTH) return;
  if (typeof value === 'string') {
    strings.push({ path, value, rich: parseRichText(value) });
    return;
  }
  if (value === null || typeof value !== 'object' || state.seen.has(value)) return;
  state.seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item: unknown, index) => scan(item, pathOf(path, index), strings, state, depth + 1));
    return;
  }
  const object = asObject(value) ?? {};
  const library = subContentLibraryOf(object);
  if (library !== undefined) {
    visitNode(library, machineNameOf(library), object.params, pathOf(path, 'params'), state, depth + 1);
    return;
  }
  for (const [key, child] of Object.entries(object)) {
    if (LABEL_GROUPS.has(key) || REFERENCE_KEYS.has(key)) continue;
    scan(child, pathOf(path, key), strings, state, depth + 1);
  }
}

/**
 * Walks an activity's parameters.
 * @param mainLibrary - The activity's library, e.g. `H5P.Column 1.18` (a bare `H5P.Column` is accepted too).
 * @param params - The activity's parameters (content.json).
 * @returns The activity first, then every sub-content in pre-order.
 */
export function walkContent(mainLibrary: string, params: unknown): readonly ContentNode[] {
  const state: WalkState = { nodes: [], seen: new WeakSet() };
  visitNode(mainLibrary, mainMachineNameOf(mainLibrary), params, '', state, 0);
  return state.nodes;
}

/**
 * The nodes at or below a path, e.g. everything inside one InteractiveBook chapter.
 * @param nodes - All nodes from `walkContent`.
 * @param paramsPath - The `path` of the enclosing node.
 * @returns The enclosing node and its descendants, in walk order.
 */
export function nodesWithin(nodes: readonly ContentNode[], paramsPath: string): readonly ContentNode[] {
  return nodes.filter((node) => isWithin(node.path, paramsPath));
}
