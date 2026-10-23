/**
 * rightsOfUse — cleans every value that H5P Core's "Rights of use" dialog writes into HTML, wherever it sits in
 * the parameters.
 *
 * Why: h5p.js `findCopyrights` walks the whole parameter tree, not only the fields the semantics define, and
 *      builds the dialog by joining strings: every `metadata` object (`buildMetadataCopyrights`), every file's
 *      `copyright` object (`MediaCopyright`), and for an image its `path` in `<img src="…">` and the sub-content's
 *      `alt` in `alt="…"` (`H5P.Thumbnail`). Lumi keeps keys the semantics do not define untouched, so an author
 *      could put any of these anywhere (D-039). Lumi's own text sanitiser runs after ours and turns `&quot;` back
 *      into `"`, so a quote in `alt` cannot be escaped as an entity.
 * Spec: SEC-008
 * Invariants:
 *   - Every `metadata` and `copyright` object anywhere is plain text, with `source` only as an http(s) URL
 *     (LumiTextSanitizer.sanitizeMetadata).
 *   - Every `path` string is free of `"`, `<`, `>`, backticks and control characters, and has no scheme other
 *     than http(s); otherwise the content is refused with 400 `hvl:unsafe-file-path`.
 *   - Every `alt` string is plain text without a straight double quote: `"` (also as an entity) becomes `”`.
 *   - Iterative, so deeply nested parameters cannot overflow the stack; values are changed in place.
 * Collaborators: ./lumiTextSanitizer.ts, ./SubContentPolicy.ts (calls it on every save).
 * Tests: apps/server/test/h5p/semantics/rightsOfUse.test.ts, apps/server/test/http/player.browser.int.test.ts
 */
import { H5pError } from '@lumieducation/h5p-server';
import { plainText, type LumiTextSanitizer } from './lumiTextSanitizer.js';

// SECURITY: a quote or angle bracket would leave `src="…"`; a control character can hide a scheme from checks.
// eslint-disable-next-line no-control-regex
const UNSAFE_PATH_CHARACTER = /["<>`\u0000-\u001f\u007f]/;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const WEB_SCHEME = /^https?:\/\//i;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Tells whether a file path is safe in an HTML attribute and as a link target.
 * @param path - A `path` value from the parameters, e.g. `images/photo-1a2b.png#tmp` or a video URL.
 * @returns True when H5P may use it as it is.
 */
export function isSafeFilePath(path: string): boolean {
  if (UNSAFE_PATH_CHARACTER.test(path)) return false;
  return !ANY_SCHEME.test(path) || WEB_SCHEME.test(path);
}

/**
 * The alternative text in a form that cannot leave a double-quoted attribute, even after Lumi's sanitiser.
 * @param alt - The author's text.
 * @returns Plain text with every straight double quote replaced by `”`.
 */
export function attributeSafeAlt(alt: string): string {
  return plainText(alt).replace(/"/g, '”');
}

/**
 * Cleans, in place, everything the "Rights of use" dialog renders, anywhere in the parameters.
 * @param params - Content parameters (content.json).
 * @param text - The sanitiser for metadata objects.
 * @throws H5pError `hvl:unsafe-file-path` (400) for a `path` that `isSafeFilePath` refuses.
 */
export function sanitizeRightsOfUse(params: unknown, text: LumiTextSanitizer): void {
  const pending: unknown[] = [params];
  while (pending.length > 0) {
    const node = pending.pop();
    if (typeof node !== 'object' || node === null) continue;
    if (Array.isArray(node)) {
      pending.push(...(node as unknown[]));
      continue;
    }
    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if ((key === 'metadata' || key === 'copyright') && isObject(value)) text.sanitizeMetadata(value);
      else if (key === 'path' && typeof value === 'string' && !isSafeFilePath(value))
        throw new H5pError('hvl:unsafe-file-path', {}, 400);
      else if (key === 'alt' && typeof value === 'string') record[key] = attributeSafeAlt(value);
      else pending.push(value);
    }
  }
}
