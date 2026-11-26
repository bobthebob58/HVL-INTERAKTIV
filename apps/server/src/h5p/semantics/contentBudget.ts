/**
 * contentBudget — how much text and how many settings one activity may hold, measured in one pass before
 * anything else reads the content.
 *
 * Why: files have size limits (SEC-005), but the parameters of an activity were bounded only by the size of the
 *      request. Every step of a save reads them: the sub-content policy, Lumi's cleaning, the validator, the
 *      structure signature. Each is written for content an author makes in the editor, a megabyte at the very
 *      most; a limit far above that, checked first, gives every later step content of a known largest size and
 *      shape (D-126).
 * Spec: SEC-005, PROD-012
 * Invariants:
 *   - One iterative pass; it stops at the first limit passed, so a refusal costs no more than the limits allow.
 *   - `CONTENT_LIMITS`: characters of all strings and keys together, values (every object, list and leaf), the
 *     length of one string, the tags one string has open at once (./markupDepth.ts), the length of a key, the
 *     length of a string under a key named `library` (Lumi reads every such string with a pattern of its own),
 *     and the paths of all values together: the validator builds a path for what it reads, so their sum bounds
 *     the memory of one check (D-127). A path is counted as its keys and indices with their separators.
 *   - Past a limit: 400 `hvl:content-too-large`, naming the kind of limit (`whole`, `text` or `markup`) and never
 *     a value from the content.
 *   - The input is never changed.
 * Collaborators: ./markupDepth.ts, ./SubContentPolicy.ts (every save), ./editorFormParams.ts (opening and import),
 *   ../libraries/packageManifest.ts (content.json of a package), ../../http/routes/contentRoutes.ts (first on a
 *   save), ../../learningDesign/safeEditing/LearnerStateGate.ts (the stored version),
 *   ../../http/h5pErrorResponse.ts (the messages).
 * Tests: apps/server/test/h5p/semantics/contentBudget.test.ts, apps/server/test/http/contentBudget.int.test.ts
 */
import { H5pError } from '@lumieducation/h5p-server';
import { opensMoreTagsThan } from './markupDepth.js';

/** The most one activity's parameters, or its metadata, may hold (D-126). */
export const CONTENT_LIMITS = Object.freeze({
  /** Characters of all strings and keys together. */
  characters: 4_000_000,
  /** Objects, lists and leaf values together. */
  values: 200_000,
  /** Characters of one string. */
  textLength: 200_000,
  /** Tags one string has open at once. */
  openTags: 100,
  /** Characters of one key. */
  keyLength: 256,
  /** Characters of a string under a key named `library` (a real one is `H5P.Name 1.2`). */
  libraryNameLength: 255,
  /** Characters of the paths of all values together (`a.b[3].c` is the path of one value). */
  pathCharacters: 50_000_000,
});

/** The kind of limit a refusal names: the content as a whole, one text's length, or one text's markup. */
export type ContentLimitKind = 'whole' | 'text' | 'markup';

/** The limit a string passes on its own, if any. */
function textLimit(text: string): ContentLimitKind | undefined {
  if (text.length > CONTENT_LIMITS.textLength) return 'text';
  return opensMoreTagsThan(text, CONTENT_LIMITS.openTags) ? 'markup' : undefined;
}

/**
 * Finds the first limit a value passes.
 * @param content - Parsed JSON: content parameters or metadata.
 * @returns The kind of the limit, or undefined when the value is within every limit.
 * @spec SEC-005
 */
export function contentLimitPassed(content: unknown): ContentLimitKind | undefined {
  let characters = 0;
  let values = 1;
  let paths = 0;
  const pending: unknown[] = [content];
  /** The length of the path of each pending value, in step with `pending`. */
  const pathLengths: number[] = [0];
  while (pending.length > 0) {
    const node = pending.pop();
    const pathLength = pathLengths.pop() ?? 0;
    paths += pathLength;
    if (paths > CONTENT_LIMITS.pathCharacters) return 'whole';
    if (typeof node === 'string') {
      characters += node.length;
      const passed = textLimit(node);
      if (passed) return passed;
    } else if (typeof node === 'object' && node !== null) {
      const keys = Array.isArray(node) ? undefined : Object.keys(node);
      // WHY: counted before the children are queued, so a list of a million items costs one comparison.
      values += keys ? keys.length : (node as unknown[]).length;
      if (values > CONTENT_LIMITS.values) return 'whole';
      for (const key of keys ?? []) {
        const child = (node as Record<string, unknown>)[key];
        characters += key.length;
        if (key.length > CONTENT_LIMITS.keyLength) return 'whole';
        // SECURITY: checked before any pattern, ours or Lumi's, reads the string (./libraryReferences.ts).
        if (key === 'library' && typeof child === 'string' && child.length > CONTENT_LIMITS.libraryNameLength)
          return 'whole';
        pending.push(child);
        pathLengths.push(pathLength + key.length + 1);
      }
      (keys ? [] : (node as unknown[])).forEach((child, index) => {
        pending.push(child);
        pathLengths.push(pathLength + String(index).length + 2);
      });
    }
    if (characters > CONTENT_LIMITS.characters) return 'whole';
  }
  return undefined;
}

/**
 * Throws when a value passes a limit.
 * @param content - Parsed JSON: content parameters or metadata.
 * @throws H5pError `hvl:content-too-large` (400), with the kind of limit as `limit`.
 * @spec SEC-005
 */
export function assertContentBudget(content: unknown): void {
  const limit = contentLimitPassed(content);
  if (limit) throw new H5pError('hvl:content-too-large', { limit }, 400);
}
