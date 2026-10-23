/**
 * languageRule (V-LANG) — the activity states its language (`metadata.defaultLanguage`).
 *
 * Why: WCAG 3.1.1 (Language of Page): H5P sets the `lang` attribute from this field, and screen readers choose
 *      their pronunciation by it. Nynorsk read with an English voice is hard to follow.
 * Spec: UD-021
 * Invariants:
 *   - Missing, blank and `und` (H5P's "undetermined") count as not stated.
 *   - The path is `metadata.defaultLanguage`, which points into the metadata, not the params.
 * Collaborators: ValidationInput.metadata.
 * Tests: apps/server/test/validation/rules/languageRule.test.ts
 */
import type { ValidationRule } from '../rule.js';

/** V-LANG: the activity needs a language. */
export const languageRule: ValidationRule = {
  id: 'V-LANG',
  requirement: 'UD-021',
  severity: 'warning',
  messages: ['V-LANG.missing'],
  check(scope) {
    const language = scope.metadata.defaultLanguage;
    const stated = typeof language === 'string' && language.trim() !== '' && language.trim() !== 'und';
    return stated ? [] : [{ path: 'metadata.defaultLanguage', message: 'V-LANG.missing' }];
  },
};
