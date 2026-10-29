/**
 * Unit tests for the save choice dialog's texts: translated in each language, and the Canvas variant without the
 * copy choice but with the pointer to the portal.
 *
 * Spec: PROD-013, PROD-012
 */
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../../src/i18n/translate.js';
import { saveChoiceMessages } from '../../../src/learningDesign/safeEditing/saveChoiceMessages.js';

describe('[PROD-013] saveChoiceMessages', () => {
  it.each(LOCALES)('[PROD-012] every text is translated in %s, none falls back to its key', (language) => {
    const texts = [saveChoiceMessages(language, false), saveChoiceMessages(language, true)].flatMap(
      Object.values,
    );
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.filter((text) => text.startsWith('safeEditing.'))).toEqual([]);
  });

  it('[PROD-013] the portal offers «Lagre som ny versjon»; Canvas offers reset or cancel and points to the portal', () => {
    // Act
    const portal = saveChoiceMessages('nn', false);
    const canvas = saveChoiceMessages('nn', true);
    // Assert
    expect(Object.keys(portal).sort()).toEqual([
      'body',
      'cancel',
      'cancelled',
      'reset',
      'resetAndSaved',
      'saveAsCopy',
      'saveAsCopyHint',
      'savedAsCopy',
      'title',
    ]);
    expect(Object.keys(canvas).sort()).toEqual([
      'body',
      'cancel',
      'cancelled',
      'canvasPointer',
      'reset',
      'resetAndSaved',
      'title',
    ]);
  });

  it('[PROD-012] the three languages differ, so no language shows another one’s text', () => {
    const bodies = LOCALES.map((language) => saveChoiceMessages(language, false).body);
    expect(new Set(bodies).size).toBe(LOCALES.length);
  });
});
