/**
 * Content tests for the privacy notice against docs/privacy/DATA-INVENTORY.md: every sentence that says what is kept
 * about a learner or an author, and for how long, is pinned to the inventory row it summarises. When a row's category
 * or retention changes, or a sentence loses its period, the test fails until the notice and the inventory agree again.
 * What the notice must not claim is tested in privacyNoticeScope.test.ts.
 *
 * Spec: DATA-006, DATA-002, DATA-009
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRIVACY_SECTIONS } from '../../src/features/info/privacySections';
import { t, type Locale, type MessageKey } from '../../src/i18n/translate';

const INVENTORY = readFileSync(
  fileURLToPath(new URL('../../../../docs/privacy/DATA-INVENTORY.md', import.meta.url)),
  'utf8',
);

/** The cells of one inventory row: purpose, category, legal basis, retention, location. */
function inventoryRow(section: string, field: string): readonly string[] {
  const body = INVENTORY.split(/^## /m).find((part) => part.startsWith(`${section}\n`)) ?? '';
  const row = body.split('\n').find((line) => line.startsWith(`| ${field} |`));
  if (!row) throw new Error(`no inventory row ${section} / ${field}`);
  return row
    .split('|')
    .slice(2, -1)
    .map((cell) => cell.trim());
}

/** One pinned sentence: the inventory row, what the row must say, and the words the sentence must hold. */
interface Pin {
  readonly key: MessageKey;
  readonly row: readonly [section: string, field: string];
  readonly category: RegExp;
  readonly retention: RegExp;
  readonly says: Readonly<Record<Locale, readonly string[]>>;
}

const PINS: readonly Pin[] = [
  {
    key: 'privacy.login1',
    row: ['Redis keys', 'session `idTokenEncrypted`'],
    category: /learner PII \(encrypted\)/,
    retention: /^Logout, 2 h idle or 12 h absolute$/,
    says: {
      nn: ['kryptert', '2 timar', '12 timar', 'namnet', 'e-postadressa', 'Feide-ID-en', 'loggar ut'],
      nb: ['kryptert', '2 timer', '12 timer', 'navnet', 'e-postadressen', 'Feide-ID-en', 'logger ut'],
      en: ['encrypted', '2 hours', '12 hours', 'name', 'e-mail address', 'Feide ID', 'log out'],
    },
  },
  {
    key: 'privacy.login2',
    row: ['LtiIdToken', '`claims`'],
    category: /^Learner PII$/,
    retention: /^24 h\b/,
    says: {
      nn: ['Canvas-ID-en', '24 timar'],
      nb: ['Canvas-ID-en', '24 timer'],
      en: ['Canvas ID', '24 hours'],
    },
  },
  {
    key: 'privacy.login3',
    row: ['GradeSyncJob', '`ltiSubEncrypted`'],
    category: /^Learner PII \(encrypted\)$/,
    retention: /^Set to null 30 days after success$/,
    says: {
      nn: ['Canvas-ID-en', 'kryptert', '30 dagar'],
      nb: ['Canvas-ID-en', 'kryptert', '30 dager'],
      en: ['Canvas ID', 'encrypted', '30 days'],
    },
  },
  {
    key: 'privacy.login4',
    row: ['AuthAuditEvent', '`ipHash`'],
    category: /^Pseudonymous \(stable key\)$/,
    retention: /^2 years$/,
    says: {
      nn: ['IP-adressa', 'misbruk', 'Mislukka', '2 år'],
      nb: ['IP-adressen', 'misbruk', 'Mislykkede', '2 år'],
      en: ['IP address', 'misuse', 'Failed', '2 years'],
    },
  },
  {
    key: 'privacy.login4',
    row: ['AuthAuditEvent', '`actorUserId`'],
    category: /learner rows: Pseudonymous \(stable key, by reference/,
    retention: /^2 years$/,
    says: { nn: ['nummer for kontoen'], nb: ['nummer for kontoen'], en: ['number for your account'] },
  },
  {
    key: 'privacy.staff2',
    row: ['AuthAuditEvent', '`actorUserId`'],
    category: /^Staff PII \(by reference\)/,
    retention: /^2 years$/,
    says: {
      nn: [
        'Innloggingar og utloggingar',
        'kontrollverdi av IP-adressa',
        'nummeret for kontoen',
        'utan IP-adressa',
        '2 år',
      ],
      nb: [
        'Innlogginger og utlogginger',
        'kontrollverdi av IP-adressen',
        'nummeret for kontoen',
        'uten IP-adressen',
        '2 år',
      ],
      en: [
        'Logins and logouts',
        'check value of your IP address',
        'account number',
        'without your IP address',
        '2 years',
      ],
    },
  },
  {
    key: 'privacy.howLong2',
    row: ['AuthAuditEvent', '`ipHash`'],
    category: /stable key/,
    retention: /^2 years$/,
    says: {
      nn: ['minst 5', 'innloggingsloggen', 'nøkkelen', '2 år'],
      nb: ['minst 5', 'innloggingsloggen', 'nøkkelen', '2 år'],
      en: ['at least 5', 'login log', 'key', '2 years'],
    },
  },
  {
    key: 'privacy.learners5',
    row: ['Identity', '`subjectHash`'],
    category: /^Pseudonymous \(stable key\)$/,
    retention: /learner rows: yearly purge/,
    says: {
      nn: ['Feide-ID-en', 'Canvas-ID-en', 'hemmeleg nøkkel'],
      nb: ['Feide-ID-en', 'Canvas-ID-en', 'hemmelig nøkkel'],
      en: ['Feide ID', 'Canvas ID', 'secret key'],
    },
  },
  {
    key: 'privacy.learners3',
    row: ['H5PUserData', '`data`'],
    category: /^Pseudonymous$/,
    retention: /^Yearly purge$/,
    says: { nn: ['svara'], nb: ['svarene'], en: ['answers'] },
  },
  {
    key: 'privacy.howLong1',
    row: ['H5PUserData', '`learnerKey`'],
    category: /^Pseudonymous$/,
    retention: /^Yearly purge$/,
    says: {
      nn: ['30 dagar', 'studieåret'],
      nb: ['30 dager', 'studieåret'],
      en: ['30 days', 'academic year'],
    },
  },
];

const LOCALES: readonly Locale[] = ['nn', 'nb', 'en'];
const shown = new Set(PRIVACY_SECTIONS.flatMap((section) => section.texts));

describe('[DATA-006] the privacy notice says what the data inventory holds true', () => {
  it.each(PINS.map((pin) => [pin.key, pin.row.join(' / '), pin] as const))(
    '[DATA-006] %s matches the inventory row %s',
    (_key, _row, pin) => {
      // Arrange
      const [, category, , retention] = inventoryRow(...pin.row);
      // Act
      const texts = LOCALES.map((locale) => [locale, t(pin.key, locale)] as const);
      // Assert
      expect(shown.has(pin.key)).toBe(true);
      expect(category).toMatch(pin.category);
      expect(retention).toMatch(pin.retention);
      for (const [locale, text] of texts) for (const word of pin.says[locale]) expect(text).toContain(word);
    },
  );

  it('[DATA-002] says that learner rows hold no name or e-mail, and never a national identity number', () => {
    expect(INVENTORY).toContain('Learner rows have no name or e-mail (database CHECK constraint, DATA-002).');
    expect(t('privacy.learners1', 'nn')).toContain('Fødselsnummeret ditt lagrar vi aldri');
    expect(t('privacy.learners1', 'en')).toContain('We never store your national identity number');
  });

  it('[DATA-009] says the service logs hold no personal data and last 30 days, as the inventory does', () => {
    expect(INVENTORY).toContain('They contain no personal data (`DATA-009`) and are kept for 30 days.');
    expect(t('privacy.howLong3', 'nn')).toContain('30 dagar');
    expect(t('privacy.howLong3', 'en')).toContain('30 days');
  });
});
