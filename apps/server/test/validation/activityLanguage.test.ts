/**
 * Tests for reading an activity's language from its stored metadata: the editor's field first, then h5p.json's,
 * never "undetermined" or something that is not a language tag.
 *
 * Spec: UD-010, UD-021
 */
import { describe, expect, it } from 'vitest';
import { activityLanguage } from '../../src/validation/activityLanguage.js';

describe('[UD-010] activity language', () => {
  it('[UD-010] prefers the editor’s defaultLanguage, then h5p.json’s language', () => {
    expect(activityLanguage({ defaultLanguage: 'nn', language: 'en' })).toBe('nn');
    expect(activityLanguage({ language: 'nb' })).toBe('nb');
    expect(activityLanguage({ defaultLanguage: 'und', language: 'en-GB' })).toBe('en-GB');
  });

  it('[UD-021] undetermined, blank, malformed or missing values count as not stated', () => {
    for (const metadata of [
      {},
      { language: 'und' },
      { defaultLanguage: ' ' },
      { language: 'nn"><x' },
      null,
      'nn',
    ]) {
      expect(activityLanguage(metadata)).toBeUndefined();
    }
  });
});
