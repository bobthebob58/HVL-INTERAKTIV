/**
 * Tests for the validator's messages: every rule's messages exist in nn, nb and en, and the PED messages name
 * their reference.
 *
 * Spec: UD-020, PED-020
 */
import { describe, expect, it } from 'vitest';
import en from '../../src/validation/locales/en.json' with { type: 'json' };
import { RULES } from '../../src/validation/ruleSet.js';
import { messageTemplate, validationMessage } from '../../src/validation/validationMessages.js';

const LOCALES = ['nn', 'nb', 'en'] as const;
const placeholders = (text: string | undefined): string[] =>
  [...(text ?? '').matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1] ?? '').sort();
const ruleMessages = RULES.flatMap((rule) => rule.messages.map((key) => ({ rule, key })));

describe('[UD-020] validator messages', () => {
  it.each(ruleMessages.map(({ rule, key }) => [rule.id, key] as const))(
    '[UD-020] %s has the message %s in nn, nb and en with the same placeholders',
    (_, key) => {
      // Arrange
      const templates = LOCALES.map((locale) => messageTemplate(key, locale));
      // Act and assert
      for (const template of templates) expect(template).toEqual(expect.any(String));
      for (const template of templates) expect(placeholders(template)).toEqual(placeholders(templates[0]));
    },
  );

  it('[UD-020] has no message that no rule uses', () => {
    const used = new Set<string>(ruleMessages.map(({ key }) => key));
    const defined = Object.entries(en).flatMap(([ruleId, group]) =>
      Object.keys(group).map((k) => `${ruleId}.${k}`),
    );
    expect(defined.filter((key) => !used.has(key))).toEqual([]);
  });

  it.each(
    ruleMessages
      .filter(({ rule }) => rule.requirement === 'PED-020')
      .flatMap(({ key }) => LOCALES.map((locale) => [key, locale] as const)),
  )('[PED-020] %s names its research reference in %s', (key, locale) => {
    expect(messageTemplate(key, locale)).toMatch(/\([\p{Lu}][\p{L}&,.\s-]+ (?:et al\. )?\d{4}\)/u);
  });

  it('[UD-020] fills placeholders and keeps unknown ones visible', () => {
    // Act
    const filled = validationMessage('PED-H04.tooMany', { count: 16, max: 15 }, 'en');
    const partial = validationMessage('PED-H04.tooMany', { count: 16 }, 'en');
    // Assert
    expect(filled).toContain('16 questions (recommended at most 15)');
    expect(partial).toContain('{{max}}');
  });

  it('[UD-020] speaks Nynorsk by default', () => {
    expect(validationMessage('V-LANG.missing')).toBe(messageTemplate('V-LANG.missing', 'nn'));
  });
});
