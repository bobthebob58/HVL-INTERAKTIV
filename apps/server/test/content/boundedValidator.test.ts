/**
 * Unit tests of the guard in front of the pre-publish validator (D-127): content within the limits for one
 * activity reaches the validator unchanged, content past them gets one finding and is never read, the server's
 * publish flow carries the guard, and the mappe lists the finding.
 *
 * Spec: UD-020, SEC-005, MAPPE-002
 */
import { describe, expect, it } from 'vitest';
import { SIZE_RULE_ID, withinContentLimits } from '../../src/content/boundedValidator.js';
import { serverPublishingDeps } from '../../src/content/publishingDeps.js';
import { CONTENT_LIMITS } from '../../src/h5p/semantics/contentBudget.js';
import { mappeFindings } from '../../src/learningDesign/mappe/mappeFindings.js';
import type { ContentValidator, Finding, ValidationInput } from '../../src/validation/types.js';

const FOUND: Finding = {
  ruleId: 'V-IMG-ALT',
  severity: 'error',
  requirement: 'UD-021',
  path: 'media',
  message: 'Biletet manglar alternativ tekst.',
};
const input = (
  params: unknown,
  metadata = {},
  locale: ValidationInput['locale'] = 'nn',
): ValidationInput => ({
  mainLibrary: 'H5P.MultiChoice 1.16',
  params,
  metadata,
  locale,
});
const TOO_LONG = 'a'.repeat(CONTENT_LIMITS.textLength + 1);
/** A validator that notes what it was given. */
function noting(): { validator: ContentValidator; seen: ValidationInput[] } {
  const seen: ValidationInput[] = [];
  return { seen, validator: (given) => (seen.push(given), [FOUND]) };
}

describe('[UD-020] the limits for one activity in front of the validator', () => {
  it('[UD-020] content within the limits reaches the validator as it came, and its findings come back unchanged', () => {
    // Arrange
    const { validator, seen } = noting();
    const given = input({ question: '<p>Kva er ei celle?</p>' }, { title: 'Celler' });
    // Act
    const findings = withinContentLimits(validator)(given);
    // Assert
    expect(findings).toEqual([FOUND]);
    expect(seen).toEqual([given]);
  });

  it.each([
    ['a text past its length', { question: TOO_LONG }, {}],
    ['more values than one activity may hold', Array.from({ length: CONTENT_LIMITS.values }, () => 0), {}],
    ['a title past its length', { question: 'Kva?' }, { title: TOO_LONG }],
  ])('[SEC-005] %s gets the one finding, and the validator reads nothing', (_name, params, metadata) => {
    // Arrange
    const { validator, seen } = noting();
    // Act
    const findings = withinContentLimits(validator)(input(params, metadata));
    // Assert
    expect(findings).toEqual([
      {
        ruleId: SIZE_RULE_ID,
        severity: 'error',
        requirement: 'SEC-005',
        path: '',
        message: 'Aktiviteten er for stor til å bli sjekka. Del innhaldet på fleire aktivitetar.',
      },
    ]);
    expect(seen).toEqual([]);
  });

  it('[UD-020] the finding speaks the language asked for', () => {
    // Arrange
    const guarded = withinContentLimits(() => []);
    // Act
    const messages = (['nb', 'en'] as const).map(
      (locale) => guarded(input({ question: TOO_LONG }, {}, locale))[0]?.message,
    );
    // Assert
    expect(messages).toEqual([
      'Aktiviteten er for stor til å bli sjekket. Del innholdet på flere aktiviteter.',
      'The activity is too large to be checked. Split the content into several activities.',
    ]);
  });

  it('[UD-020] the server’s publish flow carries the guard, with a validator or without one', () => {
    // Arrange
    const { validator, seen } = noting();
    const withValidator = serverPublishingDeps({} as never, validator, {} as never);
    const without = serverPublishingDeps({} as never, undefined, {} as never);
    // Act
    const results = [
      withValidator.validator(input({ question: TOO_LONG })),
      without.validator(input({ question: TOO_LONG })),
      without.validator(input({ question: 'Kva?' })),
    ];
    // Assert
    expect(results.map((findings) => findings.map((finding) => finding.ruleId))).toEqual([
      [SIZE_RULE_ID],
      [SIZE_RULE_ID],
      [],
    ]);
    expect(seen).toEqual([]);
  });

  it('[MAPPE-002] the mappe lists an activity too large to be checked as such, not as one without findings', () => {
    // Arrange
    const row = {
      id: 'c1',
      mainLibrary: 'H5P.MultiChoice',
      params: { question: TOO_LONG },
      metadata: {},
      status: 'published',
      updatedAt: new Date('2026-11-21T12:00:00Z'),
    };
    // Act
    const findings = mappeFindings(
      withinContentLimits(() => []),
      row as never,
      [],
      'nn',
    );
    // Assert
    expect(findings).toEqual([
      {
        severity: 'error',
        message: 'Aktiviteten er for stor til å bli sjekka. Del innhaldet på fleire aktivitetar.',
      },
    ]);
  });
});
