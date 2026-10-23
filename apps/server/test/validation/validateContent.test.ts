/**
 * Tests for the validator engine: the rule set, nested paths, determinism, purity of input, unknown libraries and
 * robustness on malformed parameters.
 *
 * Spec: UD-020, UD-021, PED-020
 */
import { describe, expect, it } from 'vitest';
import { compareFindings, orderFindings } from '../../src/validation/findingOrder.js';
import { MissingHintThresholdError } from '../../src/validation/hintThresholds.js';
import { RULES } from '../../src/validation/ruleSet.js';
import type { Finding, ValidationInput } from '../../src/validation/types.js';
import { createContentValidator, validateContent } from '../../src/validation/validateContent.js';
import { fixturesOf, inputOf, TEST_CONTEXT } from './support/ruleFixtures.js';

const UD_RULES = ['V-IMG-ALT', 'V-IMG-ALT-LENGTH', 'V-VID-CAPTIONS', 'V-VID-TRANSCRIPT', 'V-HOTSPOT-ORDER'];
const UD_RULES_2 = [
  'V-TABLE-HEADERS',
  'V-HEADING-ORDER',
  'V-LINK-TEXT',
  'V-LANG',
  'V-COLOUR-WORDS',
  'V-BRANCH-COLOUR',
];
const PED_RULES = Array.from({ length: 11 }, (_, i) => `PED-H${String(i + 1).padStart(2, '0')}`);

const sub = (library: string, params: unknown) => ({ library, params, subContentId: 's' });
const image = (alt: string) =>
  sub('H5P.Image 1.1', { file: { path: 'images/a.png' }, decorative: false, alt });
const input = (
  mainLibrary: string,
  params: unknown,
  locale: ValidationInput['locale'] = 'nn',
): ValidationInput => ({
  mainLibrary,
  params,
  metadata: { title: 'T', defaultLanguage: 'nn' },
  locale,
});

/** Several findings of every severity: images, a vague link, a long video and retry turned off. */
const busy = input('H5P.Column 1.18', {
  content: [10, 2, 1]
    .map((n) => ({ content: image(`IMG_${n}`) }))
    .concat([
      { content: sub('H5P.AdvancedText 1.1', { text: '<p><a href="https://x.no">her</a></p>' }) },
      { content: sub('H5P.MultiChoice 1.16', { answers: [], behaviour: { enableRetry: false } }) },
    ]),
});

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

describe('[UD-020] validateContent', () => {
  it('[UD-020] runs the 11 rules of UD-021 and the 11 of spec 04 §5, and pedagogy never blocks publishing', () => {
    // Act
    const ids = RULES.map((rule) => rule.id);
    // Assert
    expect(ids).toEqual([...UD_RULES, ...UD_RULES_2, ...PED_RULES]);
    for (const rule of RULES)
      expect(rule.requirement).toBe(rule.id.startsWith('PED-') ? 'PED-020' : 'UD-021');
    expect(RULES.filter((r) => r.id.startsWith('PED-')).map((r) => r.severity)).not.toContain('error');
  });

  it('[UD-020] reports nested sub-content with paths from the params root, in the requested language', () => {
    // Arrange
    const [fixture] = fixturesOf('V-IMG-ALT').filter((f) => f.name.includes('interactive-book'));
    if (!fixture) throw new Error('fixture missing');
    // Act
    const [nn] = validateContent(inputOf(fixture, 'nn'), TEST_CONTEXT);
    const [en] = validateContent(inputOf(fixture, 'en'), TEST_CONTEXT);
    // Assert
    expect(nn).toEqual({
      ruleId: 'V-IMG-ALT',
      severity: 'error',
      requirement: 'UD-021',
      path: 'chapters[0].params.content[0].content.params.alt',
      message: expect.stringContaining('«bilde»'),
    });
    expect(en?.message).toContain('“bilde” looks like a file name');
  });

  it('[UD-020] is deterministic and sorted by severity, path (indices as numbers) and rule', () => {
    // Act
    const first = validateContent(busy, TEST_CONTEXT);
    const second = validateContent(structuredClone(busy), TEST_CONTEXT);
    // Assert
    expect(second).toEqual(first);
    expect([...first].sort(compareFindings)).toEqual(first);
    expect(first.map((f) => [f.severity, f.path])).toEqual([
      ['error', 'content[0].content.params.alt'],
      ['error', 'content[1].content.params.alt'],
      ['error', 'content[2].content.params.alt'],
      ['warning', 'content[3].content.params.text'],
      ['hint', 'content[4].content.params.behaviour.enableRetry'],
    ]);
  });

  it('[UD-020] never changes its input', () => {
    // Arrange
    const frozen = deepFreeze(structuredClone(busy));
    // Act and assert
    expect(() => validateContent(frozen, TEST_CONTEXT)).not.toThrow();
    expect(frozen).toEqual(busy);
  });

  it('[UD-020] ignores libraries it has no rules for, but checks known sub-content inside them', () => {
    // Arrange: an unknown container with an image-like object that is not sub-content, and a real image
    const unknown = input('H5P.SomethingNew 2.0', { file: { path: 'a.png' }, alt: '', inner: [image('')] });
    // Act
    const findings = validateContent(unknown, TEST_CONTEXT);
    // Assert
    expect(findings.map((f) => [f.ruleId, f.path])).toEqual([['V-IMG-ALT', 'inner[0].params.alt']]);
  });

  it.each([null, 42, 'text', [], { content: 'not a list' }, { content: [null, 7, { content: null }] }])(
    '[UD-020] does not throw on malformed parameters (%j)',
    (params) => {
      expect(() => validateContent(input('H5P.Column 1.18', params), TEST_CONTEXT)).not.toThrow();
    },
  );

  it('[UD-020] keeps one finding per rule and path', () => {
    // Arrange
    const finding: Finding = {
      ruleId: 'V-X',
      severity: 'warning',
      requirement: 'UD-021',
      path: 'a',
      message: 'm',
    };
    // Act and assert
    expect(orderFindings([finding, { ...finding, message: 'n' }, { ...finding, path: 'b' }])).toHaveLength(2);
  });

  it('[PED-020] refuses a context without the thresholds instead of guessing them', () => {
    const context = { thresholds: {}, captionedMediaOrigins: [] };
    expect(() => validateContent(input('H5P.Column 1.18', {}), context)).toThrow(MissingHintThresholdError);
  });

  it('[UD-020] binds the start-up context for the findings and publish APIs', () => {
    const validator = createContentValidator(TEST_CONTEXT);
    expect(validator(busy)).toEqual(validateContent(busy, TEST_CONTEXT));
  });
});
