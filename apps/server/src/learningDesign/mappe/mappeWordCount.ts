/**
 * mappeWordCount — counts the words of rendered pedagogisk mappe Markdown as a reader sees them, and the items of
 * the suggested attachment list.
 *
 * Why: HVL limits Del 1 to 7 500 words without the references (MAPPE-002, D-094), and the page announces the count
 *      from the preview. Counting the Markdown source would count `**`, `|` and `#`; counting what markdown-it reads as
 *      text counts what the teacher will see in the PDF.
 * Spec: MAPPE-002
 * Invariants:
 *   - A word is a run of characters between spaces or line breaks that holds at least one letter or digit, as a word
 *     processor counts; a no-break space joins (so `7 500` written with one is one word), and a lone dash is no word.
 *   - Uses its own markdown-it instance with HTML off, never shared with the guide's (D-083) or the PDF's.
 *   - Pure.
 * Collaborators: ./mappeRender.ts (the caller), markdown-it 14.3.3.
 * Tests: apps/server/test/learningDesign/mappe/mappeRender.test.ts
 */
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });

// WHY: every white space but the no-break ones (U+00A0, U+2007 figure space, U+202F narrow no-break space).
const WORD_BREAK = /[\t\n\v\f\r \u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000\ufeff]+/u;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * Counts the words of plain text.
 * @param text - The text.
 * @returns How many words it has.
 */
export function countTextWords(text: string): number {
  return text.split(WORD_BREAK).filter((word) => HAS_LETTER_OR_DIGIT.test(word)).length;
}

/**
 * Counts the words a reader sees in Markdown: headings, paragraphs, lists, tables and link texts, not the syntax.
 * @param source - Rendered Markdown.
 * @returns How many words it has.
 * @spec MAPPE-002
 */
export function countMarkdownWords(source: string): number {
  const parts: string[] = [];
  for (const token of markdown.parse(source, {})) {
    if (token.type === 'code_block' || token.type === 'fence') parts.push(token.content);
    for (const child of token.children ?? []) {
      if (child.type === 'text' || child.type === 'code_inline') parts.push(child.content);
      else if (child.type === 'softbreak' || child.type === 'hardbreak') parts.push(' ');
    }
    parts.push(' ');
  }
  return countTextWords(parts.join(''));
}

/**
 * Counts the items of the outermost lists in Markdown, e.g. the suggested attachments.
 * @param source - Rendered Markdown.
 * @returns How many top-level list items it has; a nested item is not counted.
 * @spec MAPPE-002
 */
export function countListItems(source: string): number {
  let depth = 0;
  let items = 0;
  for (const token of markdown.parse(source, {})) {
    if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') depth += 1;
    else if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') depth -= 1;
    else if (token.type === 'list_item_open' && depth === 1) items += 1;
  }
  return items;
}

/**
 * The text of the first level-1 heading, for the PDF's title.
 * @param source - Rendered Markdown.
 * @returns The heading's text, or undefined when there is none.
 * @spec MAPPE-004
 */
export function firstTopHeading(source: string): string | undefined {
  const tokens = markdown.parse(source, {});
  const open = tokens.findIndex((token) => token.type === 'heading_open' && token.tag === 'h1');
  const inline = open === -1 ? undefined : tokens[open + 1];
  const text = (inline?.children ?? [])
    .filter((child) => child.type === 'text' || child.type === 'code_inline')
    .map((child) => child.content)
    .join('')
    .trim();
  return text || undefined;
}
