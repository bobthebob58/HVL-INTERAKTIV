/**
 * PatternFacts — a pattern's facts on its page: its phases, content types, build time and the time it takes students.
 *
 * Why: before choosing a pattern an author needs to know where it fits and what it costs (PED-010: build and student
 *      minutes). Phase labels come from the content (PED-001); content-type names from the locale files.
 * Spec: PED-010, PED-001
 * Invariants:
 *   - A description list, so each value is read with its name (WCAG 1.3.1).
 *   - A phase is named only by its content label, never by its key: without the labels (`GET /api/studio` failed)
 *     the phases' value is a neutral text that says so.
 * Collaborators: ../PatternDetailView.tsx, ../../../i18n/contentTypeName.ts.
 * Tests: apps/web/test/features/PatternDetailView.test.tsx
 */
import type { PatternDetail } from '@hvl-interaktiv/api-contract';
import { contentTypeName } from '../../../i18n/contentTypeName';
import { t, type Locale } from '../../../i18n/translate';

/**
 * A pattern's facts.
 * @param props - The pattern, its phases' labels in its own order (undefined when they could not be loaded), and the
 *   locale.
 * @returns The description list.
 */
export function PatternFacts({
  pattern,
  phaseNames,
  locale,
}: {
  readonly pattern: PatternDetail;
  readonly phaseNames: readonly string[] | undefined;
  readonly locale: Locale;
}) {
  const facts: readonly (readonly [string, string])[] = [
    [t('studio.cardPhases', locale), phaseNames?.join(', ') ?? t('patterns.phasesUnavailable', locale)],
    [
      t('studio.cardTypes', locale),
      pattern.contentTypes.map((type) => contentTypeName(type, locale)).join(', '),
    ],
    [t('studio.cardBuildTime', locale), t('studio.aboutMinutes', locale, { minutes: pattern.buildMinutes })],
    [
      t('patterns.studentTime', locale),
      t('studio.aboutMinutes', locale, { minutes: pattern.studentMinutes }),
    ],
  ];
  return (
    <dl className="mb-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {facts.map(([name, value]) => [
        <dt key={`${name}-name`} className="font-bold">
          {name}
        </dt>,
        <dd key={`${name}-value`} className="m-0">
          {value}
        </dd>,
      ])}
    </dl>
  );
}
