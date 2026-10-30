/**
 * guideInlineNodes — turns the children of one markdown-it `inline` token (a paragraph's or heading's text) into the
 * guide's closed inline nodes: text, strong, emphasis, link and citation, refusing everything else by line.
 *
 * Why: the guide and the patterns' "why it works" texts are Markdown that ALU writes (D-083); the web app renders
 *      only the closed node tree, so every inline construct outside it must stop `content:check` with the file and
 *      the line (probe P5 pins the tokens this reads).
 * Spec: PED-002, PED-010
 * Invariants:
 *   - Allowed: text, strong, emphasis, link (to a safe target, ./guideMarkdownParser.ts) and soft break, which
 *     becomes a space. Adjacent text is merged; empty text is dropped; a link title is dropped.
 *   - Refused: inline code, raw HTML, images, strikethrough, hard breaks, `{{` anywhere (markers are whole lines),
 *     a `[@` that is not a citation of a well-formed key, a citation inside a link's text, and a link without text
 *     (spaces alone count as none).
 *   - A citation `[@key]` becomes a citation node and is recorded with its line, for the reference check.
 *   - Lines: the inline token's first line plus the line breaks before a child. A link whose address or title
 *     spans lines leaves no break token, so such a link is refused (D-083 amendment).
 * Collaborators: ./guideBlockNodes.ts (the caller), ./guideMarkdownParser.ts, ./referencesContent.ts
 *   (`REFERENCE_KEY_PATTERN`), @hvl-interaktiv/api-contract (the node types).
 * Tests: apps/server/test/learningDesign/content/guideMarkdownTree.test.ts,
 *   apps/server/test/learningDesign/content/guideMarkdownRefused.test.ts
 */
import type { GuideInlineNode, GuideLinkContentNode } from '@hvl-interaktiv/api-contract';
import type { Token } from 'markdown-it';
import { linkTargetProblem, type GuideTreeProblem } from './guideMarkdownParser.js';
import { REFERENCE_KEY_PATTERN } from './referencesContent.js';

/** A citation found in a text, with its 1-based line. */
export interface GuideCitationAt {
  readonly key: string;
  readonly line: number;
}

/** Where the inline builder reports what it finds. */
export interface GuideInlineSink {
  readonly problems: GuideTreeProblem[];
  readonly citations: GuideCitationAt[];
}

type Frame =
  | { readonly kind: 'root' | 'strong' | 'emphasis'; readonly children: GuideInlineNode[] }
  | { readonly kind: 'link'; readonly href: string; readonly children: GuideInlineNode[] };

const REFUSED: Readonly<Record<string, string>> = {
  code_inline:
    'holds inline code (text between backticks), which the guide does not show; write it as plain text',
  html_inline: 'holds HTML; write < as &lt; when you mean the character',
  image: 'holds an image, which the guide does not show',
  s_open: 'holds struck-through text (~~ … ~~), which the guide does not show',
  hardbreak:
    'ends a line with two spaces or a backslash (a hard line break); start a new paragraph with an empty line instead',
};

const MARKER_BRACES =
  'holds {{, which only a marker line may hold: {{phase-matrix}} or {{pattern-catalogue}} alone on its own line';
const LINK_SPLIT = 'has a link whose address or title runs over more than one line; write it on one line';
const CITATION = /^\[@([^\]\s]*)\]/;

const newlines = (text: string): number => text.split('\n').length - 1;

/**
 * Builds the inline nodes of one `inline` token.
 * @param inline - A markdown-it `inline` token.
 * @param sink - Receives problems and citations.
 * @returns The nodes; meaningful only when no problem was added.
 * @spec PED-002
 */
export function buildInlineNodes(inline: Token, sink: GuideInlineSink): GuideInlineNode[] {
  const firstLine = (inline.map?.[0] ?? 0) + 1;
  const problemsBefore = sink.problems.length;
  let line = firstLine;
  let counted = 0;
  const stack: Frame[] = [{ kind: 'root', children: [] }];
  const top = () => stack[stack.length - 1] as Frame;
  const problem = (message: string) => sink.problems.push({ line, message });

  const appendText = (value: string) => {
    if (value === '') return;
    const siblings = top().children;
    const last = siblings[siblings.length - 1];
    if (last?.type === 'text') siblings[siblings.length - 1] = { type: 'text', value: last.value + value };
    else siblings.push({ type: 'text', value });
  };

  const addText = (content: string) => {
    if (content.includes('{{')) problem(MARKER_BRACES);
    let index = 0;
    for (let at = content.indexOf('[@'); at >= 0; at = content.indexOf('[@', index)) {
      appendText(content.slice(index, at));
      const match = CITATION.exec(content.slice(at));
      const key = match?.[1] ?? '';
      index = at + (match ? match[0].length : 2);
      if (!match || !REFERENCE_KEY_PATTERN.test(key)) {
        problem(
          match
            ? `holds [@${key}], which is not a citation: cite a key from references.yaml, like [@guo2014]`
            : 'starts a citation with [@ but does not end it with ]',
        );
        appendText(content.slice(at, index));
      } else if (stack.some((frame) => frame.kind === 'link')) {
        problem(`has the citation [@${key}] inside a link's text; put the citation after the link`);
      } else {
        top().children.push({ type: 'citation', key });
        sink.citations.push({ key, line });
      }
    }
    appendText(content.slice(index));
  };

  const close = () => {
    const frame = stack.pop();
    if (!frame || stack.length === 0) return;
    // A11Y: `[ ](https://…)` would be a link nobody can see or name, so text of spaces alone counts as none.
    if (frame.children.every((child) => child.type === 'text' && child.value.trim() === '')) {
      if (frame.kind === 'link') problem('has a link without text');
      return;
    }
    if (frame.kind === 'link')
      top().children.push({
        type: 'link',
        href: frame.href,
        children: frame.children as GuideLinkContentNode[],
      });
    else if (frame.kind !== 'root') top().children.push({ type: frame.kind, children: frame.children });
  };

  for (const child of inline.children ?? []) {
    const refused = REFUSED[child.type];
    if (refused) problem(refused);
    if (child.type === 'text') addText(child.content);
    else if (child.type === 'softbreak') appendText(' ');
    else if (child.type === 'strong_open') stack.push({ kind: 'strong', children: [] });
    else if (child.type === 'em_open') stack.push({ kind: 'emphasis', children: [] });
    else if (child.type === 'link_open') {
      const href = child.attrGet('href') ?? '';
      const target = linkTargetProblem(href);
      if (target) problem(target);
      stack.push({ kind: 'link', href, children: [] });
    } else if (['strong_close', 'em_close', 'link_close'].includes(child.type)) close();
    else if (!refused && child.type !== 's_close')
      problem(`holds ${child.type}, which the guide does not show`);
    // WHY: an inline child has no map; its line is the paragraph's first line plus the breaks before it (P5).
    const breaks = child.type === 'softbreak' || child.type === 'hardbreak' ? 1 : 0;
    const inside = child.type === 'html_inline' ? newlines(child.content) : 0;
    line += breaks + inside;
    counted += breaks + inside;
  }
  while (stack.length > 1) close();

  if (newlines(inline.content) > counted) {
    const split = /\]\([^)]*\n/.exec(inline.content);
    if (split || sink.problems.length === problemsBefore)
      sink.problems.push({
        line: firstLine + (split ? newlines(inline.content.slice(0, split.index)) : 0),
        message: LINK_SPLIT,
      });
  }
  return top().children;
}
