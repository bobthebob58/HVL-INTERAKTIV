/**
 * Scope tests for the privacy notice: no sentence claims that less is kept than the server keeps, or more. No sentence
 * says flatly that an ID is not stored (the Canvas ID is kept for 24 hours after a launch and, encrypted, for grade
 * sync), none says that what survives the yearly purge cannot be linked to the learner, and a check value of the IP
 * address is promised only for the events the server records it with (apps/server/src/auth/audit/AuthAuditRecorder.ts).
 *
 * Spec: DATA-006
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRIVACY_SECTIONS } from '../../src/features/info/privacySections';
import { t, type Locale } from '../../src/i18n/translate';

const LOCALES: readonly Locale[] = ['nn', 'nb', 'en'];

/** How each locale says "we do not store", how it names an ID, and the words that limit a denial to recognition. */
const DENIAL: Readonly<
  Record<Locale, { readonly denies: RegExp; readonly id: RegExp; readonly scope: string }>
> = {
  nn: {
    denies: /lagrar vi (ikkje|aldri)|vi lagrar (ikkje|aldri)|blir (ikkje|aldri) lagra/,
    id: /ID-en/,
    scope: 'Til dette ',
  },
  nb: {
    denies: /lagrer vi (ikke|aldri)|vi lagrer (ikke|aldri)|blir (ikke|aldri) lagret/,
    id: /ID-en/,
    scope: 'Til dette ',
  },
  en: { denies: /\b(do not|don’t|never) store|is (not|never) stored/, id: /\bID\b/, scope: 'For this ' },
};

/** Every sentence of the notice in one locale. */
function sentences(locale: Locale): readonly string[] {
  return PRIVACY_SECTIONS.flatMap((section) => section.texts.map((key) => t(key, locale))).flatMap((text) =>
    text.split(/(?<=[.!?])\s+/),
  );
}

/** The `audit.record(…)` calls in one server source file, one line each. */
function auditCalls(path: string): readonly string[] {
  const source = readFileSync(fileURLToPath(new URL(`../../../server/src/${path}`, import.meta.url)), 'utf8');
  return source.split('\n').filter((line) => line.includes('audit.record('));
}

describe('[DATA-006] the privacy notice claims neither less nor more than is kept', () => {
  it.each(LOCALES)(
    '[DATA-006] in %s says that an ID is not stored only for recognising a returning user',
    (locale) => {
      // WHY: login2 and login3 say the Canvas ID is kept after a launch and for grade sync; a flat denial contradicts them.
      const { denies, id, scope } = DENIAL[locale];
      const flat = sentences(locale).filter(
        (line) => denies.test(line) && id.test(line) && !line.startsWith(scope),
      );
      expect(flat).toEqual([]);
      expect(t('privacy.learners5', locale)).toContain(scope);
    },
  );

  it.each(LOCALES)('[DATA-006] in %s never claims that what survives the purge is unlinkable', (locale) => {
    // WHY: the 2-year login log keeps keyed IP hashes under a key that is not rotated yearly (inventory, D-055).
    const all = sentences(locale).join(' ');
    expect(all).not.toMatch(/kan ikkje koplast til deg|kan ikke kobles til deg|cannot be linked to you/);
  });

  it.each(LOCALES)(
    '[DATA-006] in %s does not limit the logged Canvas launches to where you may edit',
    (locale) => {
      // WHY: onResourceLink.ts records `launch.lti.author` for every launch in a teacher or author role, before the View
      // and Edit checks, and onDeepLinking.ts for every Deep Linking launch.
      expect(t('privacy.staff2', locale)).not.toMatch(/der du kan redigere|where you may edit/);
    },
  );

  it('[DATA-006] promises an IP check value for Feide logins, logouts and failed launches only, as the server records', () => {
    // Arrange
    const withIp = [
      'auth/feide/completeFeideLogin.ts',
      'auth/feide/feideLoginRoutes.ts',
      'lti/http/ltiErrorPages.ts',
    ];
    const withoutIp = ['lti/launch/onResourceLink.ts', 'lti/launch/onDeepLinking.ts'];
    // Act
    const hashed = withIp.flatMap(auditCalls);
    const unhashed = withoutIp.flatMap(auditCalls);
    const staff = {
      nn: t('privacy.staff2', 'nn'),
      nb: t('privacy.staff2', 'nb'),
      en: t('privacy.staff2', 'en'),
    };
    // Assert: logins, logouts and failed launches pass the address; author launches and account links do not
    expect(hashed.length).toBeGreaterThanOrEqual(5);
    for (const call of hashed) expect(call).toMatch(/\bip\b/);
    expect(unhashed.length).toBeGreaterThanOrEqual(4);
    for (const call of unhashed) expect(call).not.toMatch(/\bip\b/);
    // Assert: the notice says so, instead of "logged the same way" as logins
    expect(staff.nn).toContain('men utan IP-adressa');
    expect(staff.nb).toContain('men uten IP-adressen');
    expect(staff.en).toContain('but without your IP address');
    for (const text of Object.values(staff))
      expect(text).not.toMatch(/på same måte|på samme måte|the same way/);
  });
});
