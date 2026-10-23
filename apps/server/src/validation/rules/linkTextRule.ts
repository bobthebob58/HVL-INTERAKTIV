/**
 * linkTextRule (V-LINK-TEXT) — link texts say where they lead: not «klikk her», «her», "click here", «les meir»,
 * nor a bare URL.
 *
 * Why: WCAG 2.4.4 (Link Purpose): screen-reader users often list a page's links out of context, where «her» or a
 *      long address tells them nothing.
 * Spec: UD-021
 * Invariants:
 *   - Links in every authored rich-text field are checked, and `H5P.Link` sub-content, whose title is the link
 *     text (an empty title shows the bare URL).
 *   - Texts are compared in lower case, without surrounding punctuation; one finding per field.
 * Collaborators: ../richText.ts (links), ../contentWalker.ts (authored strings).
 * Tests: apps/server/test/validation/rules/linkTextRule.test.ts
 */
import { pathOf } from '../contentPath.js';
import { asString, fieldAt } from '../paramReaders.js';
import { plainTextOf } from '../richText.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';

const VAGUE: ReadonlySet<string> = new Set([
  'klikk her',
  'trykk her',
  'her',
  'les meir',
  'les mer',
  'meir',
  'mer',
  'lenke',
  'lenkje',
  'click here',
  'here',
  'read more',
  'more',
  'link',
]);
const BARE_URL = /^(?:https?:\/\/|www\.)\S+$/i;

/**
 * Judges one link text.
 * @param text - The link text (plain).
 * @returns `vague` or `bareUrl` for a poor link text, `undefined` for a good one.
 */
export function linkTextProblem(text: string): 'vague' | 'bareUrl' | undefined {
  const normalised = text
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}/]+$/gu, '');
  if (BARE_URL.test(text.trim()) || normalised === '') return 'bareUrl';
  return VAGUE.has(normalised) ? 'vague' : undefined;
}

const hitFor = (path: string, text: string): RuleHit | undefined => {
  const problem = linkTextProblem(text);
  if (problem === 'vague') return { path, message: 'V-LINK-TEXT.vague', values: { text: text.trim() } };
  return problem === 'bareUrl' ? { path, message: 'V-LINK-TEXT.bareUrl' } : undefined;
};

/** V-LINK-TEXT: links must say where they lead. */
export const linkTextRule: ValidationRule = {
  id: 'V-LINK-TEXT',
  requirement: 'UD-021',
  severity: 'warning',
  messages: ['V-LINK-TEXT.vague', 'V-LINK-TEXT.bareUrl'],
  check(scope) {
    const inText = scope.nodes
      .flatMap((node) => node.strings)
      .map((field) => field.rich.links.map((link) => hitFor(field.path, link.text)).find((hit) => hit));
    const linkTitles = nodesOf(scope, 'H5P.Link').map((node) =>
      hitFor(pathOf(node.path, 'title'), plainTextOf(asString(fieldAt(node.params, 'title')) ?? '')),
    );
    return [...inText, ...linkTitles].filter((hit): hit is RuleHit => hit !== undefined);
  },
};
