/**
 * ReferenceList — the numbered list of the references a page cites, at its end, each entry the target of its
 * citations' links.
 *
 * Why: every factual claim on the guide page has a reference (PED-002), and a pattern's page lists what its "why it
 *      works" cites (PED-010). A reference ALU has not checked yet (`verify`, Q17) says so in text.
 * Spec: PED-002, PED-010
 * Invariants:
 *   - The order is the answer's (first-citation order), so entry n is citation "[n]".
 *   - Each entry has the `id` its citations link to and takes focus when one is followed (WCAG 2.4.3).
 *   - Renders nothing for an empty list.
 * Collaborators: ./guideCitations.ts, ../GuideView.tsx, ../PatternDetailView.tsx.
 * Tests: apps/web/test/features/GuideView.test.tsx, apps/web/test/features/PatternDetailView.test.tsx
 */
import type { Reference } from '@hvl-interaktiv/api-contract';
import { useId } from 'react';
import { t, type Locale } from '../../../i18n/translate';
import { referenceAnchorId } from './guideCitations';

/**
 * The page's reference list.
 * @param props - The references in citation order and the locale.
 * @returns A section with its heading and the numbered list, or nothing.
 */
export function ReferenceList({
  references,
  locale,
}: {
  readonly references: readonly Reference[];
  readonly locale: Locale;
}) {
  const headingId = useId();
  if (references.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId}>{t('studio.referencesHeading', locale)}</h2>
      <ol className="list-decimal pl-6">
        {references.map((reference) => (
          // A11Y: tabIndex −1 lets a followed citation move focus here, so reading continues at the reference.
          <li key={reference.key} id={referenceAnchorId(reference.key)} tabIndex={-1} className="mb-2">
            {reference.text}
            {reference.verify ? (
              <span className="text-hvl-ink-muted"> {t('studio.referenceUnchecked', locale)}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
