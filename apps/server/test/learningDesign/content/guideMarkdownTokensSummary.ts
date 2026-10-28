/**
 * guideMarkdownTokensSummary — the guide's markdown-it parser and compact, readable summaries of its token streams,
 * for the P5 probe tests.
 *
 * Why: probe P5 pins the exact tokens markdown-it 14.3.3 produces for every guide convention and every refused
 *      construct, so the guide's node-tree builder (D-083) is written from facts. A summary such as
 *      `heading_open h2 @0-1` keeps a whole token stream in one readable `toEqual`.
 * Spec: PED-002
 * Invariants:
 *   - The parser uses the options D-083 fixes (`html: false`, `linkify: false`, `typographer: false`) unless a test
 *     passes an override to show an alternative.
 *   - A summary never hides a token: every block token and every inline child appears, in order.
 * Collaborators: markdown-it 14.3.3.
 * Tests: apps/server/test/learningDesign/content/guideMarkdownTokens.test.ts,
 *   apps/server/test/learningDesign/content/guideMarkdownTokensMarkers.test.ts,
 *   apps/server/test/learningDesign/content/guideMarkdownTokensRefused.test.ts
 */
import MarkdownIt, { type Options, type Token } from 'markdown-it';

/** The parser options D-083 fixes for the guide. */
export const GUIDE_PARSER_OPTIONS = { html: false, linkify: false, typographer: false } as const;

/**
 * Creates a markdown-it parser with the guide's options.
 * @param overrides - Options that replace the guide's, to show an alternative (for example `html: true`).
 * @returns A new parser; markdown-it parsers keep rule state, so each test gets its own.
 */
export const guideParser = (overrides: Options = {}): MarkdownIt =>
  new MarkdownIt({ ...GUIDE_PARSER_OPTIONS, ...overrides });

/**
 * Summarises block-level tokens as `type tag @start-end`, plus ` hidden` for a tight list's paragraphs.
 * @param tokens - The result of `md.parse`.
 * @returns One string per token; `@start-end` is `token.map` (0-based, end exclusive) and is absent when null.
 */
export function blockSummary(tokens: Token[]): string[] {
  return tokens.map((token) => {
    const map = token.map ? ` @${token.map[0]}-${token.map[1]}` : '';
    return `${token.type}${token.tag ? ` ${token.tag}` : ''}${map}${token.hidden ? ' hidden' : ''}`;
  });
}

/**
 * Summarises one token's inline children: text-like tokens with their content, links and images with their target.
 * @param token - An `inline` token (or an `image`, whose children are its alt text).
 * @returns One string per child, such as `text "Om rettleiinga"`, `link_open https://x.no` or `softbreak`.
 */
export function inlineSummary(token: Token | undefined): string[] {
  return (token?.children ?? []).map((child) => {
    if (child.type === 'link_open') return `link_open ${child.attrGet('href') ?? ''}`;
    if (child.type === 'image')
      return `image ${child.attrGet('src') ?? ''} alt=${JSON.stringify(child.content)}`;
    return child.content === '' && !['text', 'code_inline', 'html_inline'].includes(child.type)
      ? child.type
      : `${child.type} ${JSON.stringify(child.content)}`;
  });
}

/**
 * Returns the inline tokens of a parse, in document order.
 * @param tokens - The result of `md.parse`.
 */
export const inlineTokens = (tokens: Token[]): Token[] => tokens.filter((token) => token.type === 'inline');

/**
 * Parses Markdown with the guide's parser and summarises the inline children of its only inline token.
 * @param source - One paragraph or heading of Markdown.
 * @param md - The parser; the guide's by default.
 */
export const inlineOf = (source: string, md: MarkdownIt = guideParser()): string[] =>
  inlineSummary(inlineTokens(md.parse(source, {}))[0]);
