/**
 * Tests for the names of the Innsikt tab's choices: the fixed periods equal the contract's and are named in each
 * locale, the portal's key equals the contract's, courses are named by their label, numbered when two share one, and
 * inside a sentence the portal is written in lower case.
 *
 * Spec: INS-006, INS-007, PROD-012
 */
import { DEFAULT_INSIGHT_PERIOD, INSIGHT_PERIODS, PORTAL_CONTEXT_KEY } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import {
  contextNameInText,
  contextOptions,
  PORTAL_CONTEXT,
} from '../../../src/features/insight/insightContextLabels';
import { DEFAULT_PERIOD, PERIODS, periodName } from '../../../src/features/insight/insightPeriods';
import { scopeSentence, scopeWords } from '../../../src/features/insight/insightScopeText';
import { plain, REPORT, scope } from './insightAnswers';

const A = '0192f0c4-0000-7000-8000-0000000000a1';
const B = '0192f0c4-0000-7000-8000-0000000000b2';

describe('[INS-007] the Innsikt tab’s choices by name', () => {
  it('[INS-006] offers exactly the contract’s fixed periods, 7 days first, and names them in each locale', () => {
    expect(PERIODS).toEqual([...INSIGHT_PERIODS]);
    expect(DEFAULT_PERIOD).toBe(DEFAULT_INSIGHT_PERIOD);
    expect(PERIODS.map((period) => periodName(period, 'nb'))).toEqual([
      'Siste 7 dager',
      'Siste 14 dager',
      'Siste 30 dager',
      'Siden semesterstart',
    ]);
    expect(periodName('semester', 'en')).toBe('Since the semester started');
  });

  it('[INS-007] keys the portal as the contract does, and names each course by its label', () => {
    // Act and assert
    expect(PORTAL_CONTEXT).toBe(PORTAL_CONTEXT_KEY);
    expect(
      contextOptions(
        [
          { key: 'portal', label: null },
          { key: `${A}:17`, label: 'SYK110' },
        ],
        'en',
      ),
    ).toEqual([
      { key: 'portal', label: 'The portal (played outside Canvas)' },
      { key: `${A}:17`, label: 'SYK110 in Canvas' },
    ]);
  });

  it('[INS-007] numbers courses that share a label, as two Canvas instances can (D-103)', () => {
    // Act
    const options = contextOptions(
      [
        { key: 'portal', label: null },
        { key: `${A}:17`, label: 'SYK110' },
        { key: `${B}:17`, label: 'SYK110' },
        { key: `${A}:9`, label: null },
        { key: `${B}:9`, label: null },
      ],
      'nn',
    );
    // Assert
    expect(options.map((option) => option.label)).toEqual([
      'Portalen (spelt utanom Canvas)',
      'SYK110 i Canvas (nr. 1)',
      'SYK110 i Canvas (nr. 2)',
      'Canvas-emne utan emnekode (nr. 1)',
      'Canvas-emne utan emnekode (nr. 2)',
    ]);
    expect(new Set(options.map((option) => option.label)).size).toBe(options.length);
  });

  it.each([
    ['nn', 'Viser portalen (spelt utanom Canvas), siste 7 dagar (frå 28. okt. 2026), versjon 3.'],
    ['nb', 'Viser portalen (spilt utenom Canvas), siste 7 dager (fra 28. okt. 2026), versjon 3.'],
    ['en', 'Showing the portal (played outside Canvas), last 7 days (from 28 Oct 2026), version 3.'],
  ] as const)(
    '[INS-007] in %s, the portal is in lower case inside the scope sentence',
    (locale, sentence) => {
      // Arrange
      const portal = { key: 'portal', label: null };
      // Act
      const words = scopeWords(scope(), locale);
      // Assert: the selector keeps its capital; the sentence does not
      expect(plain(scopeSentence({ ...REPORT, scope: scope() }, locale))).toBe(sentence);
      expect(words.context).toBe(contextNameInText(portal, locale));
      expect(contextNameInText({ key: `${A}:17`, label: 'SYK110' }, locale)).toBe(
        contextOptions([{ key: `${A}:17`, label: 'SYK110' }], locale)[0]?.label,
      );
    },
  );
});
