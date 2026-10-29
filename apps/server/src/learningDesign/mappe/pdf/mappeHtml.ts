/**
 * mappeHtml — turns a rendered pedagogisk mappe (Markdown) into the semantic HTML document Chromium prints as a tagged
 * PDF: the document language, a title, real headings, lists and tables with header scopes, and no images.
 *
 * Why: MAPPE-004 asks for a PDF with document language, a title, a heading outline and real text, from the same
 *      semantic HTML (D-096). Chromium tags the PDF from the HTML's elements, so the HTML must already be accessible:
 *      markdown-it writes no `scope`, so header cells get `scope="col"` and the first cell of each body row becomes a
 *      row header with `scope="row"` (D-096 probe amendment).
 * Spec: MAPPE-004
 * Invariants:
 *   - A fresh markdown-it with `html: false` (raw HTML stays text) and the image rule off: the document holds no
 *     image, since even an aborted one paints a placeholder box (D-096 probe amendment).
 *   - `lang` is the portfolio's language; the `<title>` is HTML-escaped, so a title can never close the element.
 *   - The style uses only the HVL design tokens: the body-font stack (Liberation Serif where Georgia is missing),
 *     line height 1.5, left-aligned text, colours from the palette (CLAUDE.md §1).
 *   - Pure: no file, no network; the document refers to nothing outside itself.
 * Collaborators: ./PdfRenderer.ts (prints it), ../../http/mappeAnswers.ts (calls both), packages/design-tokens.
 * Tests: apps/server/test/learningDesign/mappe/mappeHtml.test.ts,
 *   apps/server/test/learningDesign/mappe/mappePdf.browser.int.test.ts
 */
import tokens from '@hvl-interaktiv/design-tokens/tokens.json' with { type: 'json' };
import MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import type { Locale } from '../../../i18n/translate.js';

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false }).disable(['image']);

// A11Y: WCAG 1.4.8 and HVL's rules: line height 1.5, left-aligned, never justified; underline only on links.
// WHY: Chromium 141's tagged-PDF outline drops the space where a heading wraps («emneom»); `pre-wrap` on the
// headings keeps it, and a one-line Markdown heading renders the same (D-096 amendment 2026-10-29 on wrapped
// headings).
const STYLE = `@page { size: A4; margin: 20mm 18mm; }
body { font-family: ${tokens.font.body.value}; line-height: ${tokens.lineHeight.body.value}; color: ${tokens.color.ink.value}; text-align: left; }
h1, h2, h3, h4, h5, h6, th { font-family: ${tokens.font.ui.value}; color: ${tokens.color['primary-dark'].value}; line-height: 1.25; }
h1, h2, h3, h4, h5, h6 { white-space: pre-wrap; }
a { color: ${tokens.color['primary-dark'].value}; }
blockquote { margin-left: 0; padding-left: 12px; border-left: 4px solid ${tokens.color.band.value}; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid ${tokens.color['ink-muted'].value}; padding: 4px 6px; text-align: left; vertical-align: top; }
thead th { background: ${tokens.color.band.value}; }`;

/** Gives header cells `scope="col"` and turns the first cell of each body row into a row header. */
function withHeaderScopes(tokenList: Token[]): Token[] {
  let inBody = false;
  let firstCell = false;
  let closeAsHeader = false;
  for (const token of tokenList) {
    if (token.type === 'tbody_open') inBody = true;
    else if (token.type === 'tbody_close') inBody = false;
    else if (token.type === 'tr_open') firstCell = true;
    else if (token.type === 'th_open') token.attrSet('scope', 'col');
    else if (token.type === 'td_open' && inBody && firstCell) {
      // A11Y: WCAG 1.3.1: the criterion (or first column) names its row, so a cell is read with both its headers.
      token.tag = 'th';
      token.attrSet('scope', 'row');
      firstCell = false;
      closeAsHeader = true;
    } else if (token.type === 'td_open') firstCell = false;
    else if (token.type === 'td_close' && closeAsHeader) {
      token.tag = 'th';
      closeAsHeader = false;
    }
  }
  return tokenList;
}

/**
 * The HTML document of a portfolio.
 * @param source - The rendered Markdown.
 * @param options - The portfolio's language and title.
 * @returns A complete, self-contained HTML document.
 * @spec MAPPE-004
 */
export function mappeHtmlDocument(
  source: string,
  options: { readonly lang: Locale; readonly title: string },
): string {
  const body = markdown.renderer.render(withHeaderScopes(markdown.parse(source, {})), markdown.options, {});
  const title = markdown.utils.escapeHtml(options.title);
  return `<!DOCTYPE html>
<html lang="${options.lang}">
<head><meta charset="utf-8"><title>${title}</title><style>${STYLE}</style></head>
<body>
${body}</body>
</html>
`;
}
