/**
 * markupDepth — tells whether a text holds more open tags at once than a limit, at a cost that grows in step
 * with the text's length.
 *
 * Why: every HTML text of an activity is read by htmlparser2: by Lumi's cleaning and ours (sanitize-html) on a
 *      save, and by the validator and the structure signature afterwards. That parser keeps the open tags in a
 *      list it adds to at the front, so reading one tag costs as much as there are tags open, and a text whose
 *      tags are never closed costs the square of its length. The editor nests fewer than twenty tags; a limit
 *      far above that keeps every later reading of the text in step with its length (D-126).
 * Spec: SEC-005, PROD-012
 * Invariants:
 *   - Counted by htmlparser2 itself, in the HTML mode sanitize-html and ../../validation/richText.ts use: one more
 *     for every tag it opens, one less for every tag it closes, so tags it closes by itself (`<p>` before `<p>`)
 *     and tags that never stay open (`<br>`) count as the parser treats them, in this version and in a later one.
 *   - The text is fed in pieces of `PIECE` characters and no piece follows once the limit is passed, so the work
 *     is bounded by the text's length times a number that depends on the limit and `PIECE` only.
 *   - A text without `<` holds no tag and is not parsed.
 * Collaborators: ./contentBudget.ts (the only caller).
 * Tests: apps/server/test/h5p/semantics/markupDepth.test.ts
 */
import { Parser } from 'htmlparser2';

/** Characters fed to the parser at a time; at most a third of them open a tag. */
const PIECE = 2048;

/**
 * Tells whether a text ever has more tags open at once than a limit.
 * @param text - An H5P text parameter: HTML or plain text.
 * @param limit - The most tags that may be open at once.
 * @returns True when the parser has more than `limit` tags open at some point of the text.
 * @example
 * opensMoreTagsThan('<p>Hei <strong>du</strong></p>', 100); // false: two tags open at most
 * @spec SEC-005
 */
export function opensMoreTagsThan(text: string, limit: number): boolean {
  if (!text.includes('<')) return false;
  let open = 0;
  let passed = false;
  // UPSTREAM: https://github.com/fb55/htmlparser2/blob/v12.0.0/src/Parser.ts adds each open tag with `unshift`; the pieces bound what one `write` can cost.
  const parser = new Parser({
    onopentagname() {
      open += 1;
      if (open > limit) passed = true;
    },
    onclosetag() {
      open -= 1;
    },
  });
  for (let at = 0; at < text.length && !passed; at += PIECE) parser.write(text.slice(at, at + PIECE));
  // WHY: the end can still open a tag the last piece left unfinished; nothing is fed after the limit is passed.
  if (!passed) parser.end();
  return passed;
}
