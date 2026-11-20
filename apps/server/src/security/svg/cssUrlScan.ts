/**
 * cssUrlScan — finds the `url(...)` functions in CSS text in one pass.
 *
 * Why: the SVG rules must know every `url(` in a style text and what it points at, to keep in-document references
 *      and remove or refuse everything else (D-044). The scan is one pass over the text, so its time grows in step
 *      with the text's length, whatever the text holds; a single regular expression for the whole function cannot
 *      promise that (D-118).
 * Spec: SEC-001
 * Invariants:
 *   - A well-formed function is `url`, in any letter case, optional white space, `(`, optional white space, a
 *     double-quoted, single-quoted or bare value (a bare value has no quote, parenthesis or white space, and may be
 *     empty), optional white space and `)`. White space is what JavaScript's `\s` matches.
 *   - Every other `url(` is reported without a value, so the caller can refuse the text.
 *   - Functions are reported left to right and never overlap; a `url(` inside a well-formed function's value is
 *     part of that value.
 *   - Pure: no I/O, no DOM access.
 * Collaborators: ./svgRules.ts (the only caller).
 * Tests: apps/server/test/security/cssUrlScan.test.ts, apps/server/test/security/svgFinalCheck.test.ts
 */

/** One `url(` in a CSS text. */
export interface CssUrl {
  /** Index of the `u`. */
  readonly start: number;
  /** Index after the closing `)` of a well-formed function; otherwise index after the `(`. */
  readonly end: number;
  /** The value without its quotes, when the function is well formed; absent when it is not. */
  readonly value?: string;
}

const QUOTE_DOUBLE = 0x22;
const QUOTE_SINGLE = 0x27;
const PAREN_OPEN = 0x28;
const PAREN_CLOSE = 0x29;

/** The characters JavaScript's `\s` matches. */
const isWhiteSpace = (code: number): boolean =>
  code === 0x20 ||
  (code >= 0x09 && code <= 0x0d) ||
  code === 0xa0 ||
  code === 0x1680 ||
  (code >= 0x2000 && code <= 0x200a) ||
  code === 0x2028 ||
  code === 0x2029 ||
  code === 0x202f ||
  code === 0x205f ||
  code === 0x3000 ||
  code === 0xfeff;

const endsBareValue = (code: number): boolean =>
  code === QUOTE_DOUBLE ||
  code === QUOTE_SINGLE ||
  code === PAREN_OPEN ||
  code === PAREN_CLOSE ||
  isWhiteSpace(code);

function skipWhiteSpace(css: string, from: number): number {
  let at = from;
  while (at < css.length && isWhiteSpace(css.charCodeAt(at))) at += 1;
  return at;
}

/** Reads the value that starts at `at`: its text and the index after it, or undefined for an open quote. */
function readValue(css: string, at: number): { readonly text: string; readonly end: number } | undefined {
  const first = css.charCodeAt(at);
  if (first === QUOTE_DOUBLE || first === QUOTE_SINGLE) {
    const close = css.indexOf(css.charAt(at), at + 1);
    return close < 0 ? undefined : { text: css.slice(at + 1, close), end: close + 1 };
  }
  let end = at;
  while (end < css.length && !endsBareValue(css.charCodeAt(end))) end += 1;
  return { text: css.slice(at, end), end };
}

/**
 * Lists every `url(` of a CSS text.
 * @param css - CSS text without comments.
 * @returns The functions in text order; one without `value` is not well formed.
 * @example
 * scanCssUrls('a{fill:url( "#g" )}'); // [{ start: 7, end: 18, value: '#g' }]
 */
export function scanCssUrls(css: string): CssUrl[] {
  const found: CssUrl[] = [];
  let resume = 0;
  for (const word of css.matchAll(/url/gi)) {
    const start = word.index;
    // WHY: a `url` inside a function already read belongs to that function's value.
    if (start < resume) continue;
    const open = skipWhiteSpace(css, start + 3);
    if (css.charCodeAt(open) !== PAREN_OPEN) continue;
    const value = readValue(css, skipWhiteSpace(css, open + 1));
    const close = value ? skipWhiteSpace(css, value.end) : -1;
    if (value && css.charCodeAt(close) === PAREN_CLOSE) {
      found.push({ start, end: close + 1, value: value.text });
      resume = close + 1;
    } else {
      found.push({ start, end: open + 1 });
    }
  }
  return found;
}

/**
 * Rewrites the well-formed `url(...)` functions of a CSS text.
 * @param css - CSS text without comments.
 * @param replace - Given a function's value, the text to put in its place, or undefined to keep the function.
 * @returns The text with each replaced function swapped; everything else is unchanged.
 */
export function replaceCssUrls(css: string, replace: (value: string) => string | undefined): string {
  const pieces: string[] = [];
  let copied = 0;
  for (const url of scanCssUrls(css)) {
    const swap = url.value === undefined ? undefined : replace(url.value);
    if (swap === undefined) continue;
    pieces.push(css.slice(copied, url.start), swap);
    copied = url.end;
  }
  pieces.push(css.slice(copied));
  return pieces.join('');
}
