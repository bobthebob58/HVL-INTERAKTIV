/**
 * guideCitations — how the guide's citations find their references: the number of each cited key, the `id` of its
 * entry in the reference list, and the check that a link target is one the guide may render.
 *
 * Why: a citation `[@key]` is shown as a numbered link to the reference list at the end of the page (PED-002, D-083);
 *      the guide page and a pattern's page each number their own list. The server already refuses unsafe link
 *      targets; the page checks again, so a target the contract forbids is never a link here.
 * Spec: PED-002, PED-010
 * Invariants:
 *   - Numbers start at 1 and follow the answer's reference list, which is in first-citation order.
 *   - SECURITY: only `https:` and `mailto:` (any case) and same-site paths that start with `/` but not `//` or `/\`
 *     pass (the contract's `guideHrefSchema`); anything else is rendered as its text.
 * Collaborators: ./GuideInline.tsx, ./ReferenceList.tsx, packages/api-contract/src/guideNodes.ts.
 * Tests: apps/web/test/features/GuideView.test.tsx, apps/web/test/features/guideNodes.test.tsx
 */
import type { Reference } from '@hvl-interaktiv/api-contract';

/** The number a citation shows, by reference key; undefined for a key the list does not hold. */
export type CitationNumbers = (key: string) => number | undefined;

/**
 * The citation numbers of a reference list.
 * @param references - The answer's references, in citation order.
 * @returns A lookup from key to its 1-based number.
 */
export function citationNumbers(references: readonly Pick<Reference, 'key'>[]): CitationNumbers {
  const numbers = new Map(references.map((reference, index) => [reference.key, index + 1]));
  return (key) => numbers.get(key);
}

/**
 * The `id` of a reference's entry in the list, which its citations link to.
 * @param key - The reference key, e.g. `guo2014`.
 * @returns e.g. `kjelde-guo2014`.
 */
export const referenceAnchorId = (key: string): string => `kjelde-${key}`;

const SAFE_HREF = /^(?:https:\/\/\S+|mailto:\S+|\/(?![/\\])\S*)$/i;

/**
 * Whether a link target may be rendered as a link.
 * @param href - The link node's target.
 * @returns True for `https:`, `mailto:` and same-site paths.
 */
export const isSafeGuideHref = (href: string): boolean => href.length <= 2000 && SAFE_HREF.test(href);

/**
 * Whether a link target is a page of this site, which opens without the "external site" note.
 * @param href - A safe link target.
 * @returns True for a path starting with a single `/`.
 */
export const isSameSiteHref = (href: string): boolean => href.startsWith('/');
