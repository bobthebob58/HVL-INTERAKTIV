/**
 * paramReaders — safe readers for untyped H5P parameters (content.json), so rules never throw on odd shapes.
 *
 * Why: the validator runs on anything an author saved, including half-filled or hand-edited parameters. A rule
 *      that met `null` where it expected an object would crash the publish request instead of reporting nothing.
 * Spec: UD-020
 * Invariants:
 *   - Readers never throw and never mutate their input; a wrong type reads as `undefined` or an empty list.
 *   - Numbers must be finite; `NaN` and `Infinity` read as `undefined`.
 * Collaborators: ./contentWalker.ts and every rule under ./rules/.
 * Tests: apps/server/test/validation/contentWalker.test.ts (through the walker and the rules).
 */

/** A JSON object of parameters (never an array). */
export type ParamObject = Readonly<Record<string, unknown>>;

/**
 * Reads a value as a JSON object.
 * @param value - Any parameter value.
 * @returns The object, or `undefined` for arrays, `null` and primitives.
 */
export const asObject = (value: unknown): ParamObject | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as ParamObject) : undefined;

/**
 * Reads a value as a list.
 * @param value - Any parameter value.
 * @returns The array, or an empty list for anything else.
 */
export const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

/**
 * Reads a value as a string.
 * @param value - Any parameter value.
 * @returns The string, or `undefined`.
 */
export const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * Reads a value as a finite number.
 * @param value - Any parameter value.
 * @returns The number, or `undefined`.
 */
export const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * Follows object keys and list indices from `value`.
 * @param value - Where to start, e.g. a node's params.
 * @param keys - Keys and indices, e.g. `'interactiveVideo', 'video', 'files'`.
 * @returns What is found there, or `undefined` as soon as a step is missing.
 * @example fieldAt(params, 'interactiveVideo', 'video', 'files', 0, 'path')
 */
export function fieldAt(value: unknown, ...keys: readonly (string | number)[]): unknown {
  let current: unknown = value;
  for (const key of keys) {
    if (typeof key === 'number') current = Array.isArray(current) ? (current as unknown[])[key] : undefined;
    else current = asObject(current)?.[key];
    if (current === undefined) return undefined;
  }
  return current;
}
