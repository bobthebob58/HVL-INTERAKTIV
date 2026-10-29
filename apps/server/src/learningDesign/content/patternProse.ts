/**
 * patternProse — a pattern's "why it works" as the guide's prose nodes (paragraphs and lists with citations), and the
 * load-time check that each language's text builds into them.
 *
 * Why: a pattern's page shows why it works with its citations, built like the guide (PED-010, D-083), so the web
 *      app renders a closed tree and never HTML. The text is Markdown in `pattern.yaml`; a heading, a box, raw HTML
 *      or an unsafe link in it must stop `content:check` with the file, the line and the key, not fail a request.
 * Spec: PED-010, PED-002
 * Invariants:
 *   - Prose mode: paragraphs and lists only, with the guide's inline rules (./guideInlineNodes.ts).
 *   - A problem names the YAML line and key of the language's text (`whyItWorks.nb`) and the line inside the text.
 *   - `patternProseNodes` is called only on texts that passed `patternProseProblems` at start-up.
 * SPEC-DEVIATION: D-083 — PED-011 lists MDX among a pattern's files; "why it works" is CommonMark inside
 *   `pattern.yaml`, built into the guide's prose nodes.
 * Collaborators: ./patternFolder.ts (runs the check), ./guideMarkdownTree.ts, ./contentSource.ts, ./patternYaml.ts,
 *   ../http/studioContentAnswers.ts (builds the nodes for the pattern route).
 * Tests: apps/server/test/learningDesign/content/patternProse.test.ts
 */
import type { GuideProseNode } from '@hvl-interaktiv/api-contract';
import type { ContentProblem } from './contentProblem.js';
import { problemAt, type ContentSource } from './contentSource.js';
import { CONTENT_LANGUAGES } from './contentText.js';
import { buildGuideTree } from './guideMarkdownTree.js';
import type { PatternFile } from './patternYaml.js';

/**
 * A "why it works" text as prose nodes.
 * @param markdown - One language's text, already checked at start-up.
 * @returns Its paragraphs and lists.
 * @throws Error when the text has a problem (it cannot, once the content has loaded).
 * @spec PED-010
 */
export function patternProseNodes(markdown: string): GuideProseNode[] {
  const tree = buildGuideTree(markdown, 'prose');
  if (tree.problems.length > 0) throw new Error('a pattern text that did not pass the content check');
  // WHY: prose mode refuses every block but paragraphs and lists, so the nodes are prose nodes.
  return tree.nodes as GuideProseNode[];
}

/**
 * Checks that each language's "why it works" builds into prose nodes.
 * @param pattern - The loaded pattern.yaml.
 * @returns Every problem, at the line and key of the language's text.
 * @spec PED-010
 */
export function patternProseProblems(pattern: ContentSource<PatternFile>): ContentProblem[] {
  return CONTENT_LANGUAGES.flatMap((language) =>
    buildGuideTree(pattern.value.whyItWorks[language], 'prose').problems.map(({ line, message }) =>
      problemAt(
        pattern,
        ['whyItWorks', language],
        line === undefined ? message : `line ${line} of the text ${message}`,
      ),
    ),
  );
}
