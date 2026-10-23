/**
 * richText — reads an H5P text parameter (HTML from CKEditor, or plain text) into what the rules check: its
 * plain text, heading levels, links and tables.
 *
 * Why: headings, link texts and table headers (V-HEADING-ORDER, V-LINK-TEXT, V-TABLE-HEADERS) need real HTML
 *      parsing, not regular expressions. htmlparser2 is synchronous and pinned (D-073), so the validator stays pure.
 * Spec: UD-020, UD-021
 * Invariants:
 *   - Never throws: htmlparser2 is forgiving, and malformed HTML yields what it could read.
 *   - Entities are decoded (`&amp;` → `&`); block elements separate words; whitespace is collapsed.
 *   - Plain text without tags is read the same way, so every string has one representation.
 *   - Only `<a>` elements with an `href` are links.
 * Collaborators: htmlparser2 (`Parser`), ./contentWalker.ts (parses every string once).
 * Tests: apps/server/test/validation/richText.test.ts
 */
import { Parser } from 'htmlparser2';

/** A link in rich text. */
export interface RichTextLink {
  /** The visible link text (plain). */
  readonly text: string;
  readonly href: string;
}

/** What the rules need from a piece of rich text. */
export interface RichText {
  /** Plain text with collapsed whitespace. */
  readonly text: string;
  /** Heading levels in document order, e.g. `[2, 3, 3, 2]`. */
  readonly headings: readonly number[];
  readonly links: readonly RichTextLink[];
  /** One entry per `<table>`: whether it has any `<th>` cell. */
  readonly tables: readonly { readonly hasHeaderCell: boolean }[];
}

const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'address',
  'blockquote',
  'br',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'td',
  'th',
  'tr',
  'ul',
]);

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * Parses rich text.
 * @param html - An H5P text parameter: HTML or plain text.
 * @returns Its plain text, headings, links and tables.
 */
export function parseRichText(html: string): RichText {
  const parts: string[] = [];
  const headings: number[] = [];
  const links: RichTextLink[] = [];
  const tables: { hasHeaderCell: boolean }[] = [];
  const openTables: { hasHeaderCell: boolean }[] = [];
  let link: { href: string; parts: string[] } | undefined;
  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (BLOCK_TAGS.has(name)) parts.push(' ');
        const level = /^h([1-6])$/.exec(name)?.[1];
        if (level) headings.push(Number(level));
        // WHY: an <a> without href is an anchor (CKEditor's "Anchor" button), not a link anyone follows.
        if (name === 'a' && attributes.href !== undefined) link = { href: attributes.href, parts: [] };
        if (name === 'table') openTables.push({ hasHeaderCell: false });
        const table = openTables.at(-1);
        if (name === 'th' && table) table.hasHeaderCell = true;
      },
      ontext(text) {
        parts.push(text);
        link?.parts.push(text);
      },
      onclosetag(name) {
        if (BLOCK_TAGS.has(name)) parts.push(' ');
        if (name === 'a' && link) {
          links.push({ text: collapse(link.parts.join('')), href: link.href.trim() });
          link = undefined;
        }
        const table = name === 'table' ? openTables.pop() : undefined;
        if (table) tables.push(table);
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
  );
  parser.write(html);
  parser.end();
  return { text: collapse(parts.join('')), headings, links, tables };
}

/**
 * The plain text of an H5P text parameter.
 * @param value - HTML or plain text.
 * @returns The text without tags, entities decoded, whitespace collapsed.
 */
export const plainTextOf = (value: string): string => parseRichText(value).text;

/**
 * Counts the words in plain text: runs of characters that contain a letter or a digit.
 * @param text - Plain text, e.g. from `plainTextOf`.
 * @returns The number of words.
 */
export const countWords = (text: string): number =>
  text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
