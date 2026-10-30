/**
 * GuideInline — renders the guide's inline nodes (text, strong, emphasis, links and citations) as React elements.
 *
 * Why: the guide's text arrives as a closed node tree (D-083), so the page needs no `innerHTML` (D-068). External
 *      links say where they go through `ExternalLink` (UD-007), and a citation is a numbered link to the page's
 *      reference list (PED-002).
 * Spec: PED-002, UD-007
 * Invariants:
 *   - Text is rendered as React text, never as markup.
 *   - SECURITY: a link target the contract forbids is rendered as plain text (./guideCitations.ts).
 *   - A same-site link is a plain Next.js link and a `mailto:` link a plain link (it opens the mail program, not
 *     another website); `https:` links go through `ExternalLink`.
 *   - A citation's accessible name is "Kjelde [n]": the visible "[n]" is part of it (WCAG 2.5.3).
 * Collaborators: ./GuideProse.tsx, ./GuideBlocks.tsx, ./guideCitations.ts, ../../../components/ExternalLink.tsx.
 * Tests: apps/web/test/features/guideNodes.test.tsx, apps/web/test/features/GuideView.test.tsx
 */
import type { GuideInlineNode } from '@hvl-interaktiv/api-contract';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ExternalLink } from '../../../components/ExternalLink';
import { t, type Locale } from '../../../i18n/translate';
import { isSafeGuideHref, isSameSiteHref, referenceAnchorId, type CitationNumbers } from './guideCitations';

/** What every inline renderer needs. */
export interface GuideInlineProps {
  readonly nodes: readonly GuideInlineNode[];
  readonly locale: Locale;
  /** The number each cited reference has in the page's list. */
  readonly citationNumber: CitationNumbers;
}

function Citation({
  citeKey,
  locale,
  citationNumber,
}: { readonly citeKey: string } & Omit<GuideInlineProps, 'nodes'>) {
  const number = citationNumber(citeKey);
  if (number === undefined) return null;
  return (
    <a href={`#${referenceAnchorId(citeKey)}`}>
      <span className="sr-only">{t('studio.citation', locale)} </span>
      {t('studio.citationNumber', locale, { number })}
    </a>
  );
}

function GuideLink({
  href,
  children,
  locale,
}: {
  readonly href: string;
  readonly children: ReactNode;
  readonly locale: Locale;
}) {
  if (!isSafeGuideHref(href)) return <>{children}</>;
  if (isSameSiteHref(href)) return <Link href={href}>{children}</Link>;
  // A11Y: WCAG 2.4.4: "opens an external website" would mislead for an e-mail address.
  if (/^mailto:/i.test(href)) return <a href={href}>{children}</a>;
  return (
    <ExternalLink href={href} locale={locale}>
      {children}
    </ExternalLink>
  );
}

function InlineNode({
  node,
  ...props
}: { readonly node: GuideInlineNode } & Omit<GuideInlineProps, 'nodes'>) {
  switch (node.type) {
    case 'text':
      return <>{node.value}</>;
    case 'strong':
      return (
        <strong>
          <GuideInline nodes={node.children} {...props} />
        </strong>
      );
    case 'emphasis':
      return (
        <em>
          <GuideInline nodes={node.children} {...props} />
        </em>
      );
    case 'link':
      return (
        <GuideLink href={node.href} locale={props.locale}>
          <GuideInline nodes={node.children} {...props} />
        </GuideLink>
      );
    case 'citation':
      return <Citation citeKey={node.key} {...props} />;
  }
}

/**
 * Renders inline nodes.
 * @param props - The nodes, the locale and the citation numbers.
 * @returns The text with its emphasis, links and citations.
 */
export function GuideInline({ nodes, ...props }: GuideInlineProps) {
  return (
    <>
      {nodes.map((node, index) => (
        // WHY: the nodes are a fixed tree that never reorders, so the position is a stable key.
        <InlineNode key={index} node={node} {...props} />
      ))}
    </>
  );
}
