/**
 * PatternCard — one pattern in the catalogue: its name (a link to its page), its one-line purpose, its phases,
 * content types and build time, and whether it can be created now.
 *
 * Why: the catalogue shows each pattern as a card with name, phase, content type, purpose and time to build
 *      (PED-002 §5, PED-010). A pattern whose content type is not installed is still shown, and says so (D-085).
 * Spec: PED-002, PED-010, UD-003
 * Invariants:
 *   - The name is the card's heading (`h3`, below the catalogue's `h2`) and its only link; the link carries the
 *     catalogue's phase and course to the pattern's page, which creation pre-fills (D-088).
 *   - Phase labels come from the content (PED-001); the unavailable state is an icon and a sentence, not colour.
 * Collaborators: ./PatternCatalogue.tsx, ../../../config/paths.ts (`patternPath`), ../../../i18n/contentTypeName.ts.
 * Tests: apps/web/test/features/PatternCard.test.tsx, apps/web/test/features/PatternCatalogue.test.tsx
 */
import type { Phase, PatternSummary } from '@hvl-interaktiv/api-contract';
import Link from 'next/link';
import { patternPath, type StudioFilters } from '../../../config/paths';
import { contentTypeName } from '../../../i18n/contentTypeName';
import { t, type Locale } from '../../../i18n/translate';

/** The icon before the unavailable sentence (a warning sign); the sentence carries the meaning. */
export const UNAVAILABLE_ICON = '⚠';

/** What a card needs. */
export interface PatternCardProps {
  readonly pattern: PatternSummary;
  readonly phases: readonly Phase[];
  readonly filters: StudioFilters;
  readonly locale: Locale;
}

/**
 * One pattern's card.
 * @param props - The pattern, the phases (for their labels), the catalogue's filters and the locale.
 * @returns The card as a list item.
 */
export function PatternCard({ pattern, phases, filters, locale }: PatternCardProps) {
  const phaseLabels = pattern.phases.map(
    (key) => phases.find((phase) => phase.key === key)?.label[locale] ?? key,
  );
  const phase = filters.phase && pattern.phases.includes(filters.phase) ? filters.phase : undefined;
  return (
    <li className="rounded bg-hvl-surface p-4 text-hvl-ink">
      <h3 className="mb-2">
        <Link href={patternPath(pattern.id, { phase, course: filters.course })}>{pattern.name[locale]}</Link>
      </h3>
      <p>{pattern.purpose[locale]}</p>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3">
        <dt className="font-bold">{t('studio.cardPhases', locale)}</dt>
        <dd className="m-0">{phaseLabels.join(', ')}</dd>
        <dt className="font-bold">{t('studio.cardTypes', locale)}</dt>
        <dd className="m-0">
          {pattern.contentTypes.map((type) => contentTypeName(type, locale)).join(', ')}
        </dd>
        <dt className="font-bold">{t('studio.cardBuildTime', locale)}</dt>
        <dd className="m-0">{t('studio.aboutMinutes', locale, { minutes: pattern.buildMinutes })}</dd>
      </dl>
      {pattern.available ? null : (
        <p className="m-0 mt-2">
          <span aria-hidden="true">{UNAVAILABLE_ICON} </span>
          {t('studio.unavailable', locale)}
        </p>
      )}
    </li>
  );
}
