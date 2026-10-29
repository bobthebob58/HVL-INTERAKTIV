/**
 * mappeMarkdownFacts — reads the structure of a rendered pedagogisk mappe (Markdown) the way a reader meets it: its
 * headings, the rows of its reader's guide and whether any template syntax is left, so the tests of the repository's
 * own template can check structure without naming ALU's texts.
 *
 * Why: `content/mappe/` holds ALU's drafts (D-082, Q17), whose headings, prompts and criterion texts change with every
 *      edit. The tests of the real content therefore assert what must hold for any template that loads: one guide row
 *      per criterion of the set (MAPPE-002), the same headings in every language (PROD-012) and in the PDF outline
 *      (MAPPE-004), and every tag filled in.
 * Spec: MAPPE-002, MAPPE-004, PROD-012
 * Invariants:
 *   - The reader's guide is found by its header row, which is the server's own locale text
 *     (`mappe.readersGuide.*`), never by a heading ALU writes.
 *   - Pure: parses with its own markdown-it instance with HTML on, so raw HTML would show up as tokens.
 * Collaborators: markdown-it 14.3.3, ../../../src/i18n/translate.ts.
 * Tests: apps/server/test/learningDesign/mappe/mappeRealContent.test.ts,
 *   apps/server/test/learningDesign/mappe/mappeRealContent.int.test.ts,
 *   apps/server/test/learningDesign/mappe/mappeRealContentPdf.browser.int.test.ts
 */
import MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import { t, type Locale } from '../../../src/i18n/translate.js';

const markdown = new MarkdownIt({ html: true, linkify: false, typographer: false });

const inlineText = (token: Token | undefined): string =>
  (token?.children ?? []).map((child) => child.content).join('');

/** One heading of a rendered portfolio. */
export interface MappeHeading {
  readonly level: number;
  readonly text: string;
}

/**
 * The headings of rendered Markdown, in order.
 * @param source - The rendered portfolio.
 * @returns Each heading's level and plain text.
 */
export function mappeHeadings(source: string): MappeHeading[] {
  const tokens = markdown.parse(source, {});
  return tokens.flatMap((token, index) =>
    token.type === 'heading_open'
      ? [{ level: Number(token.tag.slice(1)), text: inlineText(tokens[index + 1]) }]
      : [],
  );
}

/**
 * The body rows of the reader's guide: the table whose header row is the server's guide header in the language.
 * @param source - The rendered portfolio.
 * @param locale - The portfolio's language.
 * @returns Each body row's cells as plain text, or undefined when no such table exists.
 */
export function readersGuideRows(source: string, locale: Locale): string[][] | undefined {
  const header = ['criterion', 'chapter', 'attachment'].map((column) =>
    t(`mappe.readersGuide.${column}` as 'mappe.readersGuide.criterion', {}, locale),
  );
  const tokens = markdown.parse(source, {});
  const rows: string[][] = [];
  let row: string[] | undefined;
  let table: 'header' | 'other' | undefined;
  let found = false;
  for (const [index, token] of tokens.entries()) {
    if (token.type === 'table_open') table = undefined;
    else if (token.type === 'tr_open') row = [];
    else if ((token.type === 'th_open' || token.type === 'td_open') && row)
      row.push(inlineText(tokens[index + 1]));
    else if (token.type === 'tr_close' && row) {
      if (table === undefined) table = row.join('|') === header.join('|') ? 'header' : 'other';
      else if (table === 'header') rows.push(row);
      row = undefined;
    } else if (token.type === 'table_close' && table === 'header') found = true;
    if (found) break;
  }
  return found ? rows : undefined;
}

/**
 * What a reader would see of the template's own syntax: tags not filled in, raw HTML and empty headings.
 * @param source - The rendered portfolio.
 * @returns A description of each leftover; empty when there is none.
 */
export function templateLeftovers(source: string): string[] {
  const leftovers = [...source.matchAll(/\{\{[^}]*\}?\}?/g)].map((match) => `tag ${match[0]}`);
  for (const token of markdown.parse(source, {})) {
    if (token.type === 'html_block') leftovers.push(`HTML ${token.content.trim()}`);
    for (const child of token.children ?? []) {
      if (child.type === 'html_inline' || child.type === 'image')
        leftovers.push(`${child.type} ${child.content}`);
    }
  }
  for (const heading of mappeHeadings(source)) {
    if (heading.text.trim() === '') leftovers.push(`an empty level-${heading.level} heading`);
  }
  return leftovers;
}
