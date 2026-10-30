/**
 * markdownEscape — turns untrusted plain text (an activity title, a learning outcome, a rationale) into Markdown that
 * renders as exactly that text, for the pedagogisk mappe.
 *
 * Why: the portfolio is a Markdown document rendered from a Mustache template (D-094). Titles and texts come from
 *      authors, so a title such as `# x`, `[a](b)` or `<script>` must stay text: it must not add a heading to the
 *      outline and the word count, a link or HTML to the export, or a cell to the reader's guide table. Mustache's
 *      own escaper is for HTML and leaves every Markdown character alone.
 * Spec: MAPPE-002
 * Invariants:
 *   - Rendered by a CommonMark renderer (with or without raw HTML, with GFM tables and strikethrough), the result is
 *     one run of inline text equal to the input with each run of line breaks and control characters turned into one
 *     space and its ends trimmed, wherever on a line the template puts it: at the start, after `## `, `- ` or `> `,
 *     in a table cell, or in link text. Code spans, link destinations and HTML attributes are not such places.
 *   - Letters (æ, ø, å too), digits, spaces and the punctuation of ordinary prose (. , : ; ? ! ' " ( ) / % « » –)
 *     inside the text are never escaped, so the downloaded Markdown stays readable.
 *   - A string never makes it throw; a value that is not text, a number or a boolean throws (a template bug).
 *   - Blank text gives '', and so does a missing value in Mustache: a template must not need a value to be
 *     non-empty for its own syntax to hold (`**{{x}}**` alone on a line becomes a thematic break when x is blank).
 * Collaborators: the mappe renderer passes `escapeMarkdownValue` to `Mustache.render` as the per-render `escape`
 *   option (probe P5 shows the call).
 * Tests: apps/server/test/learningDesign/mappe/markdownEscape.test.ts,
 *   apps/server/test/learningDesign/mappe/mustacheTemplateTags.test.ts
 */

// SECURITY: a line break would end the template's line and let the rest of the value start a block (a heading, a
// list, a table row); spaces before it would make a hard break. Control characters (Cc: C0, DEL, C1) are not text.
// So each run of white space that holds a control becomes one space; a run of plain spaces stays as written.
// WHY: one pass over maximal runs is linear; `\s*\p{Cc}` would backtrack quadratically on a long run of spaces.
const SPACE_RUN = /[\s\p{Cc}]+/gu;
const CONTROL = /\p{Cc}/u;

// SECURITY: characters that make inline structure wherever they stand: backslash (escapes, hard break), code
// spans, emphasis, Mustache-like braces, link and image brackets, raw HTML and autolinks (<), table cells (|),
// strikethrough (~) and ATX heading marks, including a closing run such as `Tittel #`. Backslash-escaping any
// ASCII punctuation is literal in CommonMark, so the rendered text keeps the character.
const INLINE_SYNTAX = /[\\`*_{}[\]<|~#]/g;

// SECURITY: `&amp;` or `&#60;` would be decoded into another character; an escaped `&` keeps the text as written.
const ENTITY_START = /&(?=#?[0-9A-Za-z]+;)/g;

// SECURITY: block syntax only counts at the start of a line, which is where a template may put the value:
// a list (- + 1. 1)), a block quote (>), a setext underline (= -), a thematic break (- - -) and a GFM table
// delimiter row (:-: under a template line that holds a |).
const BLOCK_START = /^[-+=>:]/;
const ORDERED_LIST_START = /^(\d+)([.)])(?=\s|$)/;

// SECURITY: a GFM table splits cells before inline parsing and treats any `|` right after a `\` as escaped, so a
// value ending in `\\` placed straight before the template's `|` would merge two cells. The entity for `\` is
// decoded after the split, so a trailing backslash is written as `&#92;`.
const TRAILING_BACKSLASH = /\\\\$/;

/**
 * Escapes plain text so that, placed inline in a Markdown document, it renders as that text and never as structure.
 * @param text - Untrusted text; line breaks become spaces and the ends are trimmed (a hard break or indented code
 *   could otherwise appear).
 * @returns Markdown source for the text; ordinary prose comes back unchanged.
 * @example escapeMarkdownText('# Quiz [1](x)') === '\\# Quiz \\[1\\](x)'
 * @spec MAPPE-002
 */
export function escapeMarkdownText(text: string): string {
  // WHY: trim after the replacement, so a break at either end cannot leave a leading space (indented code at
  // four) or a trailing one.
  const oneLine = text.replace(SPACE_RUN, (run) => (CONTROL.test(run) ? ' ' : run)).trim();
  const inline = oneLine.replace(INLINE_SYNTAX, '\\$&').replace(ENTITY_START, '\\&');
  // WHY: `(` `)` `!` and `.` are left alone in the middle of the text; with `[` and `]` escaped no link or image
  // can form, and `.` or `)` only make a list right after leading digits, handled here.
  return inline
    .replace(BLOCK_START, '\\$&')
    .replace(ORDERED_LIST_START, '$1\\$2')
    .replace(TRAILING_BACKSLASH, '&#92;');
}

/**
 * Mustache's `escape` option for the portfolio: escapes a template value for Markdown.
 * @param value - What the template's `{{name}}` tag resolved to; Mustache passes numbers and booleans as they are
 *   when a custom escape is set, and never calls it for null or undefined (those render as nothing).
 * @returns The value as escaped Markdown text.
 * @throws TypeError when the value is an object, an array, a symbol or a function: a tag that names a section or a
 *   list as a value is a template bug, and `[object Object]` must not reach a portfolio.
 * @spec MAPPE-002
 */
export function escapeMarkdownValue(value: unknown): string {
  if (typeof value === 'string') return escapeMarkdownText(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return escapeMarkdownText(String(value));
  }
  throw new TypeError(`a portfolio template value must be text or a number, not ${typeof value}`);
}
