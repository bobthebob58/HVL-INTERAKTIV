/**
 * deepFreeze — freezes a value loaded from `content/` and every object and array inside it.
 *
 * Why: the studio's content is loaded once at start-up and shared by every request (D-082); a route that changed it
 *      by mistake would change what every later visitor sees. Frozen data makes such a write throw in strict mode.
 * Spec: PED-001
 * Invariants:
 *   - Plain objects and arrays are frozen at every depth, also inside an object that is already frozen (a section
 *     loader may return a shallowly frozen value); strings, numbers, booleans and null are left as they are.
 *   - Each object is visited once, so shared or circular references end.
 *   - Returns the same value it was given (no copy), typed as before.
 *   - Meant for plain data (YAML, JSON, Markdown trees): `Object.freeze` throws on a typed array or Buffer with
 *     elements, and does not freeze the entries of a Map or Set.
 * Collaborators: ./yamlContentFile.ts, ./loadStudioContent.ts.
 * Tests: apps/server/test/learningDesign/content/yamlContentFile.test.ts
 */

const freezeOnce = (value: unknown, seen: WeakSet<object>): void => {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  Object.freeze(value);
  for (const inner of Object.values(value)) freezeOnce(inner, seen);
};

/**
 * Freezes a value and everything inside it.
 * @param value - Data built from content files (plain objects, arrays and scalars).
 * @returns The same value, frozen.
 */
export function deepFreeze<T>(value: T): T {
  freezeOnce(value, new WeakSet());
  return value;
}
