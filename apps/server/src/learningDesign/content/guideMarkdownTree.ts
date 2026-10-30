/**
 * guideMarkdownTree — the one entry point that turns a Markdown text into the guide's closed node tree, with its
 * outline (headings, markers and citations, each with its line) and every problem by line.
 *
 * Why: the guide (`guide.{nn,nb,en}.md`) and each pattern's "why it works" are CommonMark that ALU writes (D-083);
 *      the loader checks them once at start-up and the routes hand the web app only the tree. The outline is what
 *      the three languages must share (D-082: the same headings, markers and citations in the same order).
 * Spec: PED-002, PED-010
 * Invariants:
 *   - Pure: no file, no network; a fresh parser per call (./guideMarkdownParser.ts).
 *   - `nodes` is meaningful only when `problems` is empty; every problem has a 1-based line when one exists.
 *   - Reference definitions (`[label]: address`) are refused, since they silently turn a citation into a link.
 * SPEC-DEVIATION: D-083 — PED-002 names MDX for the guide; this reads CommonMark into a closed node tree that the web
 *   app renders without HTML, so no content file ever runs as code.
 * Collaborators: ./guideMarkdownParser.ts, ./guideBlockNodes.ts, ./guideInlineNodes.ts, ./guideContent.ts,
 *   ./patternProse.ts.
 * Tests: apps/server/test/learningDesign/content/guideMarkdownTree.test.ts,
 *   apps/server/test/learningDesign/content/guideMarkdownRefused.test.ts
 */
import type { GuideBlockNode } from '@hvl-interaktiv/api-contract';
import { blocksUntil, type GuideBlockWalk, type GuideTreeMode } from './guideBlockNodes.js';
import type { GuideCitationAt } from './guideInlineNodes.js';
import {
  createGuideParser,
  referenceDefinitionProblems,
  type GuideParseEnv,
  type GuideTreeProblem,
} from './guideMarkdownParser.js';

/** What the three languages of a guide must share, in document order, each with its 1-based line. */
export interface GuideOutline {
  readonly headings: readonly { readonly level: 2 | 3; readonly line: number }[];
  readonly markers: GuideBlockWalk['markers'];
  readonly citations: readonly GuideCitationAt[];
}

/** A Markdown text as a node tree. */
export interface GuideTree {
  /** The block nodes; use them only when `problems` is empty. */
  readonly nodes: readonly GuideBlockNode[];
  readonly outline: GuideOutline;
  readonly problems: readonly GuideTreeProblem[];
}

/**
 * Parses a Markdown text into the guide's node tree.
 * @param source - The Markdown text.
 * @param mode - `guide` for a guide file; `prose` for a text that holds only paragraphs and lists.
 * @returns The nodes, the outline and every problem.
 * @spec PED-002
 * @example
 * const { nodes, problems } = buildGuideTree('## Kvifor\n\nTekst [@guo2014].', 'guide');
 */
export function buildGuideTree(source: string, mode: GuideTreeMode): GuideTree {
  const env: GuideParseEnv = {};
  // WHY: a byte-order mark would otherwise stand in front of the first heading's `#`.
  const text = source.replace(/^\uFEFF/, '');
  const walk: GuideBlockWalk = {
    tokens: createGuideParser().parse(text, env),
    mode,
    index: 0,
    problems: [],
    citations: [],
    headings: [],
    markers: [],
  };
  const nodes = blocksUntil(walk, 'top');
  walk.problems.push(...referenceDefinitionProblems(text, env));
  const { headings, markers, citations, problems } = walk;
  return { nodes, outline: { headings, markers, citations }, problems };
}
