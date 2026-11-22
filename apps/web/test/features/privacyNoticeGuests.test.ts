/**
 * Content test for what the privacy notice tells a person who logs in with Feide from another institution than HVL:
 * their events from the activities are not stored and they are in no aggregate a teacher sees, while the answers
 * given so far are still kept so they can continue (D-138). The server's rule is pinned beside the words, so a
 * change on either side fails until both agree again.
 *
 * Spec: DATA-006
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRIVACY_SECTIONS } from '../../src/features/info/privacySections';
import { t, type Locale } from '../../src/i18n/translate';

const RULE = readFileSync(
  fileURLToPath(new URL('../../../server/src/xapi/learningDataScope.ts', import.meta.url)),
  'utf8',
);

/** What the sentence must say in each language: who, what is not stored, the aggregates, and what is kept. */
const SAYS: Readonly<Record<Locale, readonly string[]>> = {
  nn: [
    'frå ein annan institusjon enn HVL',
    'lagrar vi ikkje hendingar frå aktivitetane',
    'ikkje med i dei samla tala lærarane ser',
    'lagrar vi framleis',
  ],
  nb: [
    'fra en annen institusjon enn HVL',
    'lagrer vi ikke hendelser fra aktivitetene',
    'ikke med i de samlede tallene lærerne ser',
    'lagrer vi fortsatt',
  ],
  en: [
    'from another institution than HVL',
    'we do not store events from the activities',
    'not part of the aggregated numbers teachers see',
    'We still store the answers',
  ],
};

describe('[DATA-006] the privacy notice for a person from another Feide organisation', () => {
  it('[DATA-006] is shown with what is stored about a student, after the other sentences', () => {
    // Act
    const learners = PRIVACY_SECTIONS.find((section) => section.heading === 'privacy.learnersHeading');
    // Assert
    expect(learners?.texts.at(-1)).toBe('privacy.learners6');
  });

  it.each(Object.entries(SAYS) as [Locale, readonly string[]][])(
    '[DATA-006] in %s says that events are not stored, that they are in no aggregate, and that progress is kept',
    (locale, phrases) => {
      const text = t('privacy.learners6', locale);
      for (const phrase of phrases) expect(text).toContain(phrase);
    },
  );

  it('[DATA-006] says what the server does: in the portal only an HVL member’s play is recorded', () => {
    // Assert: the rule's own line, and that it leaves the saved state to everyone
    expect(RULE).toContain("if (principal.mode === 'portal') return principal.hvlMember;");
    expect(RULE).toMatch(/saved state .* is not decided\s+\*\s+here: it is kept for everyone/);
  });
});
