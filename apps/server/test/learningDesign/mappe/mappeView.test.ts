/**
 * Tests for the pedagogisk mappe's view (D-094 probe P5 amendment): every key is present on every list item and no
 * value is empty (unknown fields get localised placeholders); dates and numbers are text in the portfolio's language;
 * the validator's result carries the reasons given; a renamed phase label reaches the portfolio with no code change.
 *
 * Spec: MAPPE-002, PED-001
 */
import { describe, expect, it } from 'vitest';
import { MAPPE_TEMPLATE_SCOPE } from '../../../src/learningDesign/mappe/mappeVariables.js';
import { mappeFormat } from '../../../src/learningDesign/mappe/mappeFormat.js';
import { mappeView } from '../../../src/learningDesign/mappe/mappeView.js';
import { studioContentWithMappe } from '../../support/mappeFixture.js';
import { RENAMED_FORARBEID_LABEL, studioContentWithRenamedLabel } from '../../support/renamedPhaseLabels.js';
import { BENCH_NOW, benchInputs, benchRender, sourceActivity } from './mappeRenderBench.js';

const viewOf = (inputs: ReturnType<typeof benchInputs>, locale: 'nn' | 'en' = 'nn') =>
  mappeView(
    {
      activities: inputs,
      criteriaSetTitle: 'Testsett 2025',
      wordLimit: 7500,
      attachmentLimit: 11,
      k: 5,
      now: BENCH_NOW,
      phases: [{ key: 'forarbeid', label: 'Forarbeid' }],
      resultsRecorded: false,
      words: 1234,
    },
    mappeFormat(locale),
  );

describe('[MAPPE-002] the view of a portfolio', () => {
  it('[MAPPE-002] has every key on every activity and course, and no empty value: placeholders stand in', () => {
    // Arrange
    const bare = sourceActivity({ title: '   ', publishedAt: null, status: 'draft' });
    // Act
    const view = viewOf(benchInputs({ activities: [{ activity: bare }] }));
    // Assert
    const activity = view.aktivitetar[0];
    expect(Object.keys(activity ?? {}).sort()).toEqual(
      [...MAPPE_TEMPLATE_SCOPE.lists.aktivitetar.values, 'uu_merknader'].sort(),
    );
    expect(Object.keys(view.emneoversikt[0] ?? {}).sort()).toEqual(
      [...MAPPE_TEMPLATE_SCOPE.lists.emneoversikt.values].sort(),
    );
    const texts = [
      ...MAPPE_TEMPLATE_SCOPE.values.map((name) => view[name]),
      ...MAPPE_TEMPLATE_SCOPE.lists.aktivitetar.values.map((name) => activity?.[name]),
    ];
    expect(texts.every((text) => typeof text === 'string' && text.trim() !== '')).toBe(true);
    expect(activity).toMatchObject({
      tittel: '[utan tittel]',
      fase: 'ingen fase vald',
      emne: 'ingen emnekode',
      grunngjeving: 'ingen grunngjeving skriven',
      publisert: 'ikkje publisert',
      status: 'utkast',
    });
    expect(view.forfattar).toBe('[namnet ditt]');
  });

  it('[MAPPE-002] writes dates and numbers as text in the portfolio’s language', () => {
    // Act
    const nn = viewOf(benchInputs());
    const en = viewOf(benchInputs(), 'en');
    // Assert
    expect([nn.dato, nn.ordgrense, nn.ordtal_del1]).toEqual([
      '29. oktober 2026',
      `7${String.fromCharCode(0xa0)}500`,
      `1${String.fromCharCode(0xa0)}234`,
    ]);
    expect([en.dato, en.ordgrense, en.aktivitetar[0]?.innhaldstype]).toEqual([
      '29 October 2026',
      '7,500',
      'Multiple Choice',
    ]);
  });

  it('[MAPPE-002] gives the validator’s result with the reason given for an error, and a warning needs none', () => {
    // Arrange
    const at = new Date('2026-10-10T08:00:00.000Z');
    const findings = [
      {
        severity: 'error' as const,
        message: 'Biletet manglar alternativ tekst.',
        acknowledgement: { reason: 'Pynt', at },
      },
      { severity: 'warning' as const, message: 'Lenketeksten seier ikkje kvar lenkja går.' },
    ];
    // Act
    const view = viewOf(benchInputs({ activities: [{ activity: sourceActivity(), findings }] }));
    // Assert
    const activity = view.aktivitetar[0];
    expect(activity?.uu_status).toBe(
      'Sjekken for universell utforming: feil: 1 (grunngjevne: 1), åtvaringar: 1.',
    );
    expect(activity?.uu_merknader).toEqual([
      {
        alvor: 'Feil',
        melding: 'Biletet manglar alternativ tekst.',
        uu_grunngjeving: 'grunngjeve 10. oktober 2026: «Pynt»',
      },
      {
        alvor: 'Åtvaring',
        melding: 'Lenketeksten seier ikkje kvar lenkja går.',
        uu_grunngjeving: 'treng inga grunngjeving',
      },
    ]);
  });
});

describe('[PED-001] phase labels in the portfolio', () => {
  it('[PED-001] a renamed phase label in phases.yaml reaches the portfolio with no code change', () => {
    // Arrange
    const content = { ...studioContentWithRenamedLabel(), mappe: studioContentWithMappe().mappe };
    const activity = sourceActivity({ phase: 'forarbeid', courseCode: 'SYK110' });
    // Act
    const rendered = benchRender({ content, activities: [{ activity }] }).markdown;
    // Assert
    expect(rendered).toContain(`**Fase:** ${RENAMED_FORARBEID_LABEL.nn}`);
    expect(rendered).toContain(`**SYK110:** 1 aktivitetar (${RENAMED_FORARBEID_LABEL.nn}: 1)`);
  });
});
