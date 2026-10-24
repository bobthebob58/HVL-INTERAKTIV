/**
 * Content tests for the texts of a refused save of a published activity (`error.publishedSaveBlocked`,
 * `page.editor.blockedSave`, `page.editor.blockedSaveCanvas`): the remedy they name must exist for the error at hand.
 * «Grunngje på nytt» explains only errors the stored version already has, since **Sjekk og publiser** checks the
 * stored version and a refused save stores nothing (D-074 amendment); an error new in the change is fixed, or, where
 * the activity's page can be reached, explained by publishing again from draft. In Canvas, fixing is the way.
 *
 * Spec: UD-013, PROD-003
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/i18n/translate.js';

type Locale = 'nn' | 'nb' | 'en';
const KEYS = [
  'error.publishedSaveBlocked',
  'page.editor.blockedSave',
  'page.editor.blockedSaveCanvas',
] as const;

/** How each locale names the renew button, the published version, a new error and the way back to draft. */
const WORDS: Readonly<Record<Locale, Record<'renew' | 'published' | 'newError' | 'draft' | 'fix', RegExp>>> =
  {
    nn: {
      renew: /Grunngje på nytt/,
      published: /i den publiserte versjonen/,
      newError: /ny i endringa/,
      draft: /«Gjer om til utkast»/,
      fix: /må du rette/,
    },
    nb: {
      renew: /Begrunn på nytt/,
      published: /i den publiserte versjonen/,
      newError: /ny i endringen/,
      draft: /«Gjør om til utkast»/,
      fix: /må du rette/,
    },
    en: {
      renew: /Explain again/,
      published: /in the published version/,
      newError: /new in your change/,
      draft: /“Return to draft”/,
      fix: /must be fixed/,
    },
  };

const sentences = (text: string): string[] => text.split(/(?<=[.!?])\s+/);
const cases = (['nn', 'nb', 'en'] as const).flatMap((locale) => KEYS.map((key) => [locale, key] as const));

describe('[UD-013] a refused save of a published activity names remedies that exist', () => {
  it.each(cases)(
    '[UD-013] in %s, %s offers «Grunngje på nytt» only for an error the published version has',
    (locale, key) => {
      // Arrange
      const words = WORDS[locale];
      // Act
      const naming = sentences(t(key, {}, locale)).filter((sentence) => words.renew.test(sentence));
      // Assert
      expect(naming.length).toBeGreaterThan(0);
      for (const sentence of naming) expect(sentence).toMatch(words.published);
    },
  );

  it.each(cases)('[UD-013] in %s, %s says what to do with an error new in the change', (locale, key) => {
    // Arrange
    const words = WORDS[locale];
    // Act
    const newError = sentences(t(key, {}, locale)).filter((sentence) => words.newError.test(sentence));
    // Assert: the Canvas editor has no Sjekk og publiser, so there the new error is fixed
    expect(newError).toHaveLength(1);
    expect(newError[0]).not.toMatch(words.renew);
    expect(newError[0]).toMatch(key.endsWith('Canvas') ? words.fix : words.draft);
  });
});
