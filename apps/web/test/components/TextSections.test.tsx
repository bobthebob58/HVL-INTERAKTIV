/**
 * Component tests for the help page and the privacy notice: both exist in nn, nb and en, steps are numbered lists,
 * and the privacy notice says what is stored, what logging in and Canvas keep, why, how long and who sees what,
 * with the group size of 5.
 *
 * Spec: DATA-006, UD-013, UD-002
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextSections } from '../../src/components/TextSections';
import { HELP_SECTIONS } from '../../src/features/info/helpSections';
import { PRIVACY_SECTIONS } from '../../src/features/info/privacySections';
import { t, type Locale } from '../../src/i18n/translate';

const LOCALES: readonly Locale[] = ['nn', 'nb', 'en'];

describe('[DATA-006] the privacy notice', () => {
  it.each(LOCALES)('[DATA-006] in %s covers what, why, how long and who sees what', (locale) => {
    // Act
    render(<TextSections sections={PRIVACY_SECTIONS} locale={locale} />);
    // Assert
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(PRIVACY_SECTIONS.map((section) => t(section.heading, locale)));
    expect(headings).toHaveLength(8);
    for (const section of PRIVACY_SECTIONS) {
      for (const key of section.texts) expect(t(key, locale)).not.toBe(key);
    }
  });

  it.each([
    ['nn', /minst 5 studentar/],
    ['nb', /minst 5 studenter/],
    ['en', /at least 5 students/],
  ] as const)('[DATA-006] in %s says teachers see only groups of at least 5 learners', (locale, text) => {
    render(<TextSections sections={PRIVACY_SECTIONS} locale={locale} />);
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });
});

describe('[UD-013] the help page', () => {
  it.each(LOCALES)('[UD-013] in %s explains creating and checking as numbered steps', (locale) => {
    // Act
    render(<TextSections sections={HELP_SECTIONS} locale={locale} />);
    // Assert
    const lists = screen.getAllByRole('list');
    expect(lists.map((list) => list.tagName)).toEqual(['OL', 'OL']);
    expect(within(lists[0] as HTMLElement).getAllByRole('listitem')).toHaveLength(4);
    for (const section of HELP_SECTIONS) {
      for (const key of [section.heading, ...section.texts]) expect(t(key, locale)).not.toBe(key);
    }
  });
});
