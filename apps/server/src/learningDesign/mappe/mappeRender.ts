/**
 * mappeRender — renders a loaded pedagogisk mappe template with a view: each text segment through Mustache with the
 * Markdown escaper, each block marker replaced by the server's block, and Del 1's words and the suggested attachments
 * counted between their markers.
 *
 * Why: D-094 renders the portfolio with Mustache 4.2.0 and a Markdown escaper, so a title such as `# x` or `[a](b)`
 *      stays text, and counts Del 1 without the reader's guide and the references. The count appears inside Del 1
 *      (`{{ordtal_del1}}`), so the template is rendered twice: once to count, once with the count; a number is one
 *      word however many digits it has (./mappeWordCount.ts), so the second render has the same count.
 * Spec: MAPPE-002
 * Invariants:
 *   - `Mustache.render(source, view, undefined, { escape, tags })` exactly as probe P5 found safe: the escape and
 *     the delimiters are per call, `Mustache.escape` and `Mustache.tags` are never assigned, and no partials map is
 *     passed (`{}` would resolve prototype names).
 *   - The blocks are never part of a counted part, wherever their markers stand.
 *   - The output has no run of more than one blank line and ends with one line break.
 * Collaborators: ./MappeRenderer.ts (the caller), ./markdownEscape.ts, ./mappeWordCount.ts, ./mappeBlocks.ts,
 *   ../content/mappeTemplateTags.ts (`MAPPE_TAGS`), ../content/mappeContent.ts (the template).
 * Tests: apps/server/test/learningDesign/mappe/mappeRender.test.ts
 */
import Mustache from 'mustache';
import type { MappeTemplate } from '../content/mappeContent.js';
import { MAPPE_TAGS } from '../content/mappeTemplateTags.js';
import { escapeMarkdownValue } from './markdownEscape.js';
import type { MappeBlockMarker, MappeView } from './mappeVariables.js';
import { countListItems, countMarkdownWords } from './mappeWordCount.js';

/** A rendered portfolio and what its preview tells. */
export interface RenderedMappeMarkdown {
  /** The whole portfolio as Markdown. */
  readonly markdown: string;
  /** Words in Del 1, without the blocks (the reader's guide and the references). */
  readonly words: number;
  /** Top-level items of the suggested attachment list. */
  readonly attachments: number;
}

const BLOCK_MARKERS: ReadonlySet<string> = new Set<MappeBlockMarker>(['lesarrettleiing', 'referansar']);

/**
 * Renders a template once with a view.
 * @param template - The loaded template in the portfolio's language.
 * @param view - The view (./mappeView.ts).
 * @param blocks - The Markdown of each block marker.
 * @returns The Markdown and the counts of this render.
 * @spec MAPPE-002
 */
export function renderMappeOnce(
  template: MappeTemplate,
  view: MappeView,
  blocks: Readonly<Record<MappeBlockMarker, string>>,
): RenderedMappeMarkdown {
  const output: string[] = [];
  const del1: string[] = [];
  const attachmentList: string[] = [];
  let inDel1 = false;
  let inAttachments = false;
  for (const segment of template.segments) {
    if (segment.kind === 'text') {
      // SECURITY: per-call escape and delimiters (probe P5); the Markdown escaper keeps every value plain text.
      const text = Mustache.render(segment.source, view, undefined, {
        escape: escapeMarkdownValue,
        tags: MAPPE_TAGS,
      });
      output.push(text);
      if (inDel1) del1.push(text);
      if (inAttachments) attachmentList.push(text);
    } else if (BLOCK_MARKERS.has(segment.marker)) {
      output.push(`\n${blocks[segment.marker as MappeBlockMarker]}\n\n`);
    } else {
      inDel1 = segment.marker === 'del1_start' ? true : segment.marker === 'del1_slutt' ? false : inDel1;
      inAttachments =
        segment.marker === 'vedlegg_start'
          ? true
          : segment.marker === 'vedlegg_slutt'
            ? false
            : inAttachments;
      output.push('\n');
    }
  }
  const markdown = `${output
    .join('')
    .replace(/\n(?:[ \t]*\n){2,}/g, '\n\n')
    .trim()}\n`;
  return {
    markdown,
    words: countMarkdownWords(del1.join('\n')),
    attachments: countListItems(attachmentList.join('\n')),
  };
}

/**
 * Renders a portfolio: first to count Del 1's words, then with the count in the view.
 * @param template - The loaded template in the portfolio's language.
 * @param viewWithWords - Builds the view for a word count.
 * @param blocks - The Markdown of each block marker.
 * @returns The final Markdown and its counts.
 * @spec MAPPE-002
 */
export function renderMappe(
  template: MappeTemplate,
  viewWithWords: (words: number) => MappeView,
  blocks: Readonly<Record<MappeBlockMarker, string>>,
): RenderedMappeMarkdown {
  const counted = renderMappeOnce(template, viewWithWords(0), blocks);
  return renderMappeOnce(template, viewWithWords(counted.words), blocks);
}
