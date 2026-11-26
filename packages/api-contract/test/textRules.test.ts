/**
 * Tests of the rule for text typed by a person (D-142): which characters a one-line text and a free text may
 * hold, and that every request field of typed text keeps the rule.
 *
 * Spec: PED-030, PED-032, UD-022, PROD-007
 */
import { describe, expect, it } from 'vitest';
import {
  FREE_TEXT_PATTERN,
  ONE_LINE_TEXT_PATTERN,
  acknowledgementInputSchema,
  learnerPurposeSchema,
  learningDesignUpdateSchema,
  peopleQuerySchema,
} from '../src/index.js';

/** Characters nobody types on purpose, by what they do. */
const NEVER: readonly (readonly [string, string])[] = [
  ['U+0000, which PostgreSQL cannot store', '\u0000'],
  ['an escape character', '\u001B'],
  ['DEL', '\u007F'],
  ['a C1 control (next line)', '\u0085'],
  ['the line separator', ' '],
  ['the paragraph separator', ' '],
  ['a right-to-left override', '‮'],
  ['a left-to-right isolate', '⁦'],
  ['a right-to-left mark', '‏'],
  ['the Arabic letter mark', '؜'],
];
const LINE_PARTS = ['\t', '\n', '\r'];
const TEXT = 'Øv på blodtrykk – «kvifor»? 👩‍⚕️ lærings­utbyte é 100 %';

describe('[PED-030] the characters of typed text', () => {
  it.each(NEVER)('[PED-030] neither kind of text holds %s', (_what, character) => {
    // Act + Assert: at the start, inside and at the end
    for (const text of [`${character}a`, `a${character}b`, `a${character}`]) {
      expect(ONE_LINE_TEXT_PATTERN.test(text)).toBe(false);
      expect(FREE_TEXT_PATTERN.test(text)).toBe(false);
    }
  });

  it('[PED-030] a tab and a line break are text in a free text only; ordinary text is text in both', () => {
    // Act + Assert
    for (const part of LINE_PARTS) {
      expect(FREE_TEXT_PATTERN.test(`a${part}b`)).toBe(true);
      expect(ONE_LINE_TEXT_PATTERN.test(`a${part}b`)).toBe(false);
    }
    // WHY: a soft hyphen, the joiner inside an emoji and a combining accent are text, not controls.
    expect([
      ONE_LINE_TEXT_PATTERN.test(TEXT),
      FREE_TEXT_PATTERN.test(TEXT),
      FREE_TEXT_PATTERN.test(''),
    ]).toEqual([true, true, true]);
  });

  it('[PED-030] both patterns read a long text in one pass', () => {
    // Arrange: text a backtracking pattern would read many times before it fails at the end
    const long = `${'a\tb\n '.repeat(100_000)}\u0000`;
    // Act
    const started = performance.now();
    const results = [FREE_TEXT_PATTERN.test(long), ONE_LINE_TEXT_PATTERN.test(long)];
    // Assert
    expect(results).toEqual([false, false]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe('[PED-032] every request field of typed text keeps the rule', () => {
  const design = (fields: Record<string, unknown>) =>
    learningDesignUpdateSchema.safeParse({ outcomes: [], updatedAt: null, ...fields }).success;
  const reason = (fields: Record<string, unknown>) =>
    acknowledgementInputSchema.safeParse({
      ruleId: 'UD-001',
      path: 'params.text',
      reason: 'Fordi',
      ...fields,
    }).success;
  const outcome = (text: string) => ({ outcomes: [{ text, category: 'kunnskap' }] });

  it.each(NEVER)('[PED-032] %s is refused in every field', (_what, character) => {
    // Arrange
    const text = `Kvifor${character}dette`;
    // Act + Assert
    expect(learnerPurposeSchema.safeParse(text).success).toBe(false);
    expect(design({ learnerPurpose: text })).toBe(false);
    expect(design({ rationale: text })).toBe(false);
    expect(design(outcome(text))).toBe(false);
    expect(reason({ reason: text })).toBe(false);
    expect(reason({ ruleId: text })).toBe(false);
    expect(reason({ path: text })).toBe(false);
    expect(peopleQuerySchema.safeParse({ q: text }).success).toBe(false);
  });

  it('[PED-032] line breaks stay in the rationale, an outcome and a reason, and out of the one-line fields', () => {
    // Arrange
    const lines = 'Fyrste linje\nandre\tlinje\r\ntredje';
    // Act + Assert
    expect([design({ rationale: lines }), design(outcome(lines)), reason({ reason: lines })]).toEqual([
      true,
      true,
      true,
    ]);
    expect(learnerPurposeSchema.safeParse(lines).success).toBe(false);
    expect([reason({ ruleId: 'UD\n001' }), reason({ path: 'a\tb' })]).toEqual([false, false]);
    expect(peopleQuerySchema.safeParse({ q: 'Kari\nNordmann' }).success).toBe(false);
  });

  it('[PED-032] ordinary text is taken as before, trimmed', () => {
    // Act + Assert
    expect(learnerPurposeSchema.parse(`  ${TEXT} `)).toBe(TEXT);
    expect(design({ rationale: TEXT, learnerPurpose: TEXT, ...outcome(TEXT) })).toBe(true);
    expect(reason({ reason: TEXT })).toBe(true);
    expect(peopleQuerySchema.parse({ q: ' Kari Nordmann ' })).toEqual({ q: 'Kari Nordmann' });
  });
});
