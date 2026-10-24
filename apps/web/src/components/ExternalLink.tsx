/**
 * ExternalLink — a link to another website that says so: a visible icon and hidden text for screen readers.
 *
 * Why: HVL's rule and UD-007 ask links to say where they go. An outside site is marked with an arrow icon (hidden
 *      from assistive technology) and "(opnar ekstern nettstad)" in the page language, read after the link text.
 *      `newTab` is for links that leave a Canvas iframe; it says "(opnar i ny fane)" instead of hiding the change.
 * Spec: UD-007, UD-010
 * Invariants:
 *   - The hidden text is part of the accessible name; the icon is `aria-hidden`.
 *   - A new tab always gets `rel="noopener noreferrer"`, so the opened page cannot reach this window.
 * Collaborators: ../i18n/translate.ts, ./SiteHeader.tsx, ./SiteFooter.tsx, the pages under ../app.
 * Tests: apps/web/test/components/ExternalLink.test.tsx
 */
import type { ReactNode } from 'react';
import { t, type Locale } from '../i18n/translate';

const NEW_TAB = '_blank';
const NO_REFERRER = 'noopener noreferrer';

/** The icon shown after an external link's text (a north-east arrow). */
export const EXTERNAL_ICON = '↗';

/** What the link needs. */
export interface ExternalLinkProps {
  readonly href: string;
  readonly locale: Locale;
  readonly children: ReactNode;
  /** Open in a new tab; true for links that leave the Canvas frame. */
  readonly newTab?: boolean;
  /** False for a link to our own site: no "external site" text or icon, so without `newTab` a plain link. */
  readonly external?: boolean;
  readonly className?: string;
}

/**
 * A link that announces where it goes.
 * @param props - Address, locale, text and whether it opens a new tab.
 * @returns The link.
 */
export function ExternalLink({
  href,
  locale,
  children,
  newTab = false,
  external = true,
  className,
}: ExternalLinkProps) {
  const notes = [
    external ? t('link.external', locale) : undefined,
    newTab ? t('link.newTab', locale) : undefined,
  ]
    .filter((note) => note !== undefined)
    .join(' ');
  // SECURITY: a new tab cannot reach this window (`noopener`), and no link sends our address on (`noreferrer`).
  const target = newTab ? NEW_TAB : undefined;
  const rel = newTab || external ? NO_REFERRER : undefined;
  return (
    <a href={href} className={className} target={target} rel={rel}>
      {children}
      {external || newTab ? (
        <span aria-hidden="true" className="ml-1 inline-block no-underline">
          {EXTERNAL_ICON}
        </span>
      ) : null}
      {notes !== '' ? <span className="sr-only"> {notes}</span> : null}
    </a>
  );
}
