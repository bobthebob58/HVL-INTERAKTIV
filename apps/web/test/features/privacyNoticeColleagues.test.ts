/**
 * Content test for the privacy notice's sentence on what colleagues see of staff (D-090, D-091, D-092): it is shown on
 * /personvern, and it agrees with the data inventory's `User.coAuthorSearchableAt` row on who can be found, by whom
 * and for how long. A change on either side fails until both agree again, as in ./privacyNotice.test.ts.
 *
 * Spec: DATA-006, PROD-007
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRIVACY_SECTIONS } from '../../src/features/info/privacySections';
import { t, type Locale } from '../../src/i18n/translate';

const INVENTORY = readFileSync(
  fileURLToPath(new URL('../../../../docs/privacy/DATA-INVENTORY.md', import.meta.url)),
  'utf8',
);

/** The `User.coAuthorSearchableAt` row's cells: field, purpose, category, legal basis, retention, location. */
const searchableRow = (): readonly string[] =>
  (INVENTORY.split('\n').find((line) => line.startsWith('| `coAuthorSearchableAt` |')) ?? '')
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

/** The words each language's sentence must hold: the name, the three places it is seen, 13 months, Feide. */
const SAYS: Readonly<Record<Locale, readonly string[]>> = {
  nn: ['namnet', 'medforfattarar', 'innhaldsbanken', 'kopiar', '13 månader', 'Feide'],
  nb: ['navnet', 'medforfattere', 'innholdsbanken', 'kopier', '13 måneder', 'Feide'],
  en: ['your name', 'co-authors', 'content bank', 'copies', '13 months', 'Feide'],
};

describe('[DATA-006] the privacy notice says what colleagues see of staff', () => {
  it.each(Object.keys(SAYS) as Locale[])(
    '[DATA-006] in %s, privacy.staff3 is shown and matches the coAuthorSearchableAt row',
    (locale) => {
      // Arrange
      const [, purpose, category, , retention] = searchableRow();
      // Act
      const text = t('privacy.staff3', locale);
      // Assert
      expect(PRIVACY_SECTIONS.some((section) => section.texts.includes('privacy.staff3'))).toBe(true);
      expect(category).toBe('Staff PII');
      expect(retention).toMatch(/not searchable after 13 months/);
      expect(purpose).toMatch(/never changed by an LTI launch/);
      for (const word of SAYS[locale]) expect(text).toContain(word);
    },
  );
});
