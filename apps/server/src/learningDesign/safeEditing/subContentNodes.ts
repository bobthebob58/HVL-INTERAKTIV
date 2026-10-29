/**
 * subContentNodes — recognises H5P sub-content nodes in an activity's parameters, names their library the one way
 * the structure signature compares, and reads parameter values without trusting their JSON type.
 *
 * Why: the structure signature (PROD-013, D-093) walks parameters that came from the editor or from storage. A node
 *      is an object whose `library` is `H5P.Name major.minor`; the library is compared as `Name major.minor`, so a
 *      patch version or the `Name-1.2` spelling never counts as a change. Parameters are author data: a field may
 *      hold any JSON type, so every reader here falls back to an empty value instead of throwing.
 * Spec: PROD-013
 * Invariants:
 *   - A node is an object (not an array) whose `library` is a string `Name major.minor` (space or hyphen).
 *   - `libraryKey` keeps only `Name major.minor`; anything it cannot read is returned trimmed, unchanged.
 *   - The readers never throw and never return a value of another type than they promise.
 * Collaborators: ./structureSignature.ts, ./nodeShapes.ts, ./leafShapes.ts, ./containerShapes.ts.
 * Tests: apps/server/test/learningDesign/safeEditing/structureSignature.test.ts
 */
import { plainTextOf } from '../../validation/richText.js';

// WHY: content.json writes `H5P.MultiChoice 1.16`; Lumi's ubernames use a hyphen (`H5P.MultiChoice-1.16`).
const LIBRARY_NAME = /^([A-Za-z][\w.]*)[ -](\d+)\.(\d+)(?:\.\d+)?$/;

/** A sub-content node as H5P nests it in the parameters: `{ library, params, subContentId, metadata }`. */
export interface SubContentNode {
  readonly library: string;
  readonly params?: unknown;
  readonly subContentId?: unknown;
}

/**
 * Tells whether a value is a plain JSON object (not an array, not null).
 * @param value - Any parameter value.
 * @returns True for an object that is not an array.
 */
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Tells whether a value is a sub-content node.
 * @param value - Any parameter value.
 * @returns True for an object whose `library` names a library and its version.
 */
export const isSubContentNode = (value: unknown): value is SubContentNode =>
  isObject(value) && typeof value.library === 'string' && LIBRARY_NAME.test(value.library.trim());

/**
 * The library of a node or an activity as the signature compares it.
 * @param library - e.g. `H5P.MultiChoice 1.16`, `H5P.MultiChoice-1.16` or `H5P.MultiChoice 1.16.4`.
 * @returns `H5P.MultiChoice 1.16`, or the trimmed input when it names no version.
 */
export function libraryKey(library: string): string {
  const match = LIBRARY_NAME.exec(library.trim());
  return match ? `${match[1] ?? ''} ${match[2] ?? ''}.${match[3] ?? ''}` : library.trim();
}

/**
 * The machine name of a library key.
 * @param key - From `libraryKey`, e.g. `H5P.MultiChoice 1.16`.
 * @returns e.g. `H5P.MultiChoice`.
 */
export const machineNameOf = (key: string): string => key.split(' ')[0] ?? key;

/**
 * Reads an object field.
 * @param value - Any parameter value.
 * @returns The value when it is an object, else an empty object.
 */
export const objectOf = (value: unknown): Record<string, unknown> => (isObject(value) ? value : {});

/**
 * Reads a list field.
 * @param value - Any parameter value.
 * @returns The value when it is an array, else an empty list.
 */
export const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

/**
 * Reads a text field as a learner reads it: tags removed, entities decoded, whitespace collapsed.
 * @param value - Any parameter value; HTML from CKEditor or plain text.
 * @returns The plain text, or '' for a value that is not a string.
 */
export const plainTextOfValue = (value: unknown): string =>
  // WHY: the editor may send back the stored HTML re-serialised (another tag, an entity for a character); only the
  // text a learner reads tells whether an option or a blank is the same.
  typeof value === 'string' ? plainTextOf(value) : '';

/**
 * Reads a number field.
 * @param value - Any parameter value.
 * @returns The value when it is a finite number, else undefined.
 */
export const numberOf = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
