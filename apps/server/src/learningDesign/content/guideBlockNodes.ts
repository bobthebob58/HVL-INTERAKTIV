/**
 * guideBlockNodes — walks markdown-it's block tokens into the guide's closed block nodes: headings, paragraphs,
 * lists, boxes (blockquotes) and the two marker lines, refusing every other block by line.
 *
 * Why: D-083 turns the guide's CommonMark into a closed tree that the web app renders without HTML. The walk reads
 *      only tokens (never `render`), so anything outside the allowlist below becomes a problem with the file's line
 *      instead of reaching a page (probe P5 pins the tokens).
 * Spec: PED-002, PED-010
 * Invariants:
 *   - `guide` mode, top level: `##` and `###` headings written with `#` (a setext heading made with `===` or `---` is
 *     refused, because ALU may have meant a rule), paragraphs, bullet and numbered lists (the start number is
 *     ignored), boxes, and a marker: a top-level paragraph that is only `{{phase-matrix}}` or `{{pattern-catalogue}}`.
 *   - A list item and a box hold only paragraphs and lists; a heading or a box inside one is refused.
 *   - `prose` mode (a pattern's "why it works") allows only paragraphs and lists.
 *   - Refused blocks (raw HTML, code, rules, tables, any other token) are skipped whole, so one problem is reported
 *     per construct; the nodes returned with a problem are never used.
 * Collaborators: ./guideMarkdownTree.ts (the caller), ./guideInlineNodes.ts, @hvl-interaktiv/api-contract
 *   (`GUIDE_MARKER_NAMES`, the node types).
 * Tests: apps/server/test/learningDesign/content/guideMarkdownTree.test.ts,
 *   apps/server/test/learningDesign/content/guideMarkdownRefused.test.ts
 */
import { GUIDE_MARKER_NAMES, type GuideBlockNode, type GuideProseNode } from '@hvl-interaktiv/api-contract';
import type { Token } from 'markdown-it';
import { buildInlineNodes, type GuideInlineSink } from './guideInlineNodes.js';

/** Which blocks a text may hold: the whole guide, or paragraphs and lists only. */
export type GuideTreeMode = 'guide' | 'prose';
/** A marker's name. */
export type GuideMarkerName = (typeof GUIDE_MARKER_NAMES)[number];

/** The walk's state and what it records besides the nodes. */
export interface GuideBlockWalk extends GuideInlineSink {
  readonly tokens: readonly Token[];
  readonly mode: GuideTreeMode;
  index: number;
  readonly headings: { readonly level: 2 | 3; readonly line: number }[];
  readonly markers: { readonly name: GuideMarkerName; readonly line: number }[];
}

/** Where a block stands: at the top level, in a box or in a list item. */
export type GuideBlockPlace = 'top' | 'box' | 'item';

const REFUSED: Readonly<Record<string, string>> = {
  html_block: 'holds HTML; write < as &lt; when you mean the character',
  fence: 'holds a code block, which the guide does not show',
  code_block: 'holds an indented code block (a line indented by four spaces); remove the indent',
  hr: 'holds a horizontal rule (---, *** or ___), which the guide does not show',
  table_open: 'holds a table, which the guide does not show; write the content as a list',
};

const MARKER_LINE = /^\{\{([^{}]*)\}\}$/;
const MARKERS = GUIDE_MARKER_NAMES.map((name) => `{{${name}}}`).join(' and ');

const lineOf = (token: Token | undefined): number => (token?.map?.[0] ?? 0) + 1;

function skip(walk: GuideBlockWalk): void {
  let depth = 0;
  do {
    depth += walk.tokens[walk.index]?.nesting ?? 0;
    walk.index += 1;
  } while (depth > 0 && walk.index < walk.tokens.length);
}

function refuse(walk: GuideBlockWalk, message: string): undefined {
  walk.problems.push({ line: lineOf(walk.tokens[walk.index]), message });
  skip(walk);
  return undefined;
}

function markerOf(
  walk: GuideBlockWalk,
  inline: Token,
  place: GuideBlockPlace,
): GuideBlockNode | 'none' | undefined {
  if (walk.mode !== 'guide' || place !== 'top') return 'none';
  const children = (inline.children ?? []).filter((child) => child.type !== 'text' || child.content !== '');
  const only = children.length === 1 && children[0]?.type === 'text' ? children[0].content : '';
  const name = MARKER_LINE.exec(only)?.[1];
  if (name === undefined) return 'none';
  const line = lineOf(inline);
  if (!(GUIDE_MARKER_NAMES as readonly string[]).includes(name)) {
    walk.problems.push({ line, message: `{{${name}}} is not a marker; the markers are ${MARKERS}` });
    return undefined;
  }
  walk.markers.push({ name: name as GuideMarkerName, line });
  return { type: 'marker', name: name as GuideMarkerName };
}

function heading(walk: GuideBlockWalk, token: Token, place: GuideBlockPlace): GuideBlockNode | undefined {
  if (walk.mode === 'prose')
    return refuse(walk, 'holds a heading; this text holds paragraphs and lists only');
  if (place !== 'top') return refuse(walk, 'holds a heading inside a list or a box');
  if (!token.markup.startsWith('#'))
    return refuse(walk, 'holds a heading underlined with === or ---; write ## or ### before the heading');
  const level = Number(token.tag.slice(1));
  if (level !== 2 && level !== 3)
    return refuse(
      walk,
      `holds a level-${level} heading (${'#'.repeat(level)}); the guide's headings are ## and ###, since the ` +
        "page's own title is its only #",
    );
  const line = lineOf(token);
  const children = buildInlineNodes(walk.tokens[walk.index + 1] as Token, walk);
  walk.index += 3;
  if (children.length === 0) walk.problems.push({ line, message: 'holds an empty heading' });
  walk.headings.push({ level, line });
  return { type: 'heading', level, children };
}

function paragraph(walk: GuideBlockWalk, place: GuideBlockPlace): GuideBlockNode | undefined {
  const inline = walk.tokens[walk.index + 1] as Token;
  walk.index += 3;
  const marker = markerOf(walk, inline, place);
  if (marker !== 'none') return marker;
  const children = buildInlineNodes(inline, walk);
  return children.length === 0 ? undefined : { type: 'paragraph', children };
}

function list(walk: GuideBlockWalk, token: Token): GuideBlockNode {
  const close = token.type.replace('_open', '_close');
  const items: { type: 'listItem'; children: GuideProseNode[] }[] = [];
  walk.index += 1;
  while (walk.index < walk.tokens.length && walk.tokens[walk.index]?.type !== close) {
    const item = walk.tokens[walk.index] as Token;
    const before = walk.problems.length;
    walk.index += 1;
    const children = blocksUntil(walk, 'item', 'list_item_close') as GuideProseNode[];
    // WHY: an item emptied by a refused block already has its problem; a second one would only repeat it.
    if (children.length === 0 && walk.problems.length === before)
      walk.problems.push({ line: lineOf(item), message: 'holds an empty list item' });
    items.push({ type: 'listItem', children });
  }
  walk.index += 1;
  return { type: 'list', ordered: token.type === 'ordered_list_open', items };
}

function box(walk: GuideBlockWalk, token: Token, place: GuideBlockPlace): GuideBlockNode | undefined {
  if (walk.mode === 'prose') return refuse(walk, 'holds a box (a line starting with >); this text cannot');
  if (place !== 'top')
    return refuse(walk, 'holds a box (a line starting with >) inside a list or another box');
  const before = walk.problems.length;
  walk.index += 1;
  const children = blocksUntil(walk, 'box', 'blockquote_close') as GuideProseNode[];
  if (children.length === 0 && walk.problems.length === before)
    walk.problems.push({ line: lineOf(token), message: 'holds an empty box' });
  return { type: 'box', children };
}

function block(walk: GuideBlockWalk, place: GuideBlockPlace): GuideBlockNode | undefined {
  const token = walk.tokens[walk.index] as Token;
  switch (token.type) {
    case 'heading_open':
      return heading(walk, token, place);
    case 'paragraph_open':
      return paragraph(walk, place);
    case 'bullet_list_open':
    case 'ordered_list_open':
      return list(walk, token);
    case 'blockquote_open':
      return box(walk, token, place);
    default:
      return refuse(walk, REFUSED[token.type] ?? `holds ${token.type}, which the guide does not show`);
  }
}

/**
 * Walks blocks until the closing token of the container they are in, or to the end of the document.
 * @param walk - The walk; its `index` is moved past the closing token.
 * @param place - Where the blocks are: the top level, a box or a list item.
 * @param closeType - The container's closing token type; none at the top level.
 * @returns The nodes; meaningful only when the walk has no problem.
 * @spec PED-002
 */
export function blocksUntil(
  walk: GuideBlockWalk,
  place: GuideBlockPlace,
  closeType?: string,
): GuideBlockNode[] {
  const nodes: GuideBlockNode[] = [];
  while (walk.index < walk.tokens.length) {
    if (closeType && walk.tokens[walk.index]?.type === closeType) {
      walk.index += 1;
      break;
    }
    const node = block(walk, place);
    if (node) nodes.push(node);
  }
  return nodes;
}
