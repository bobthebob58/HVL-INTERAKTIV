/**
 * guideMarkdownParser — the markdown-it parser the guide's node builder reads tokens from, the check of a link's
 * target, and the problems of reference definitions, which leave no token of their own.
 *
 * Why: D-083 (amendment of 2026-10-28, probe P5) parses the guide with `html: true` so raw HTML shows up as tokens the
 *      builder can refuse by line, lets every link through markdown-it so the builder's own check names the line of
 *      a bad one, and refuses reference definitions, which would silently turn a citation `[@key]` into a link.
 * Spec: PED-002
 * Invariants:
 *   - A fresh parser per document (markdown-it keeps rule state); only `parse` is ever called, never `render`, so
 *     `html: true` opens no HTML path: every token outside the builder's allowlist is refused.
 *   - SECURITY: a link target passes only as `https:` or `mailto:` (any case) or a same-site path that starts with `/`
 *     but not `//` or `/\`, also after percent-decoding; the contract's `guideHrefSchema` is the same rule.
 * Collaborators: ./guideMarkdownTree.ts, ./guideInlineNodes.ts, @hvl-interaktiv/api-contract (`guideHrefSchema`),
 *   markdown-it 14.3.3.
 * Tests: apps/server/test/learningDesign/content/guideMarkdownTree.test.ts,
 *   apps/server/test/learningDesign/content/guideMarkdownRefused.test.ts
 */
import { guideHrefSchema } from '@hvl-interaktiv/api-contract';
import MarkdownIt from 'markdown-it';

/** One problem in a Markdown text, before the loader adds the file. */
export interface GuideTreeProblem {
  /** The 1-based line, when the problem has one. */
  readonly line?: number;
  /** What is wrong, in plain English, for ALU. */
  readonly message: string;
}

/** What markdown-it leaves in `env` after a parse: the reference definitions it found. */
export interface GuideParseEnv {
  references?: Record<string, unknown>;
}

/**
 * A new parser with the guide's options (D-083 amendment).
 * @returns The parser; use it for one document.
 * @spec PED-002
 */
export function createGuideParser(): MarkdownIt {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false });
  // SECURITY: markdown-it would silently turn `javascript:` links into text and let `http:` and `data:` through.
  // Every link instead reaches `linkTargetProblem`, which refuses all but the safe targets and names the line.
  md.validateLink = () => true;
  return md;
}

const decoded = (href: string): string => {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
};

/**
 * Why a link target is refused, if it is.
 * @param href - The target as markdown-it normalised it (percent-encoded, IDN hosts in punycode).
 * @returns A message for ALU, or undefined for a safe target.
 * @spec PED-002
 */
export function linkTargetProblem(href: string): string | undefined {
  const plain = decoded(href);
  // SECURITY: browsers read `//host` and `/\host` as another site; `/%2F` decodes to the same, so both forms count.
  const leavesSite = /^\/[/\\]/.test(href) || /^\/[/\\]/.test(plain);
  if (!leavesSite && guideHrefSchema.safeParse(href).success) return undefined;
  if (/^http:/i.test(href)) return `links to ${href}: use an https: address`;
  return (
    `links to ${href.slice(0, 80)}: a link goes to an https: address, a mailto: address, or a page of this site ` +
    'that starts with a single /'
  );
}

const escapedLabel = (label: string) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One problem per reference definition (`[label]: target`) markdown-it found.
 * @param source - The Markdown text.
 * @param env - The `env` the parse filled.
 * @returns The problems, at the definition's line when it can be found.
 * @spec PED-002
 */
export function referenceDefinitionProblems(source: string, env: GuideParseEnv): GuideTreeProblem[] {
  const lines = source.split(/\r\n|\r|\n/);
  return Object.keys(env.references ?? {}).map((label) => {
    // WHY: markdown-it upper-cases the label it keeps, so the line is found ignoring case.
    const pattern = new RegExp(`^ {0,3}\\[${escapedLabel(label).replace(/\s+/g, '\\s+')}\\]:`, 'i');
    const index = lines.findIndex((line) => pattern.test(line));
    return {
      ...(index >= 0 ? { line: index + 1 } : {}),
      message:
        'is a reference definition ([…]: address), which would silently turn a citation into a link; cite as ' +
        '[@key] and put the reference in references.yaml',
    };
  });
}
