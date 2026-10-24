/**
 * Component tests for the site footer: the **Personvern** link to the privacy notice on every page, in the page
 * language (which the link carries, `?lang=`), and in Canvas opening a new tab with the hidden "(opnar i ny fane)".
 *
 * Spec: DATA-006, UD-007
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from '../../src/components/SiteFooter';

describe('[DATA-006] the footer links to the privacy notice', () => {
  it.each([
    ['nn', 'Personvern'],
    ['nb', 'Personvern'],
    ['en', 'Privacy'],
  ] as const)('[DATA-006] in %s the footer has the link "%s"', (locale, name) => {
    render(<SiteFooter locale={locale} />);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name }).getAttribute('href')).toBe(
      `/personvern?lang=${locale}`,
    );
  });

  it('[DATA-006] in the Canvas player the link opens a new tab in the page language and says so', () => {
    // Act
    render(<SiteFooter locale="nn" inCanvas />);
    // Assert
    const link = screen.getByRole('link', { name: 'Personvern (opnar i ny fane)' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('href')).toBe('/personvern?lang=nn');
    // Act: an English launch
    render(<SiteFooter locale="en" inCanvas />);
    // Assert: the new tab has no launch, so the link names the language
    const english = screen.getByRole('link', { name: 'Privacy (opens in a new tab)' });
    expect(english.getAttribute('href')).toBe('/personvern?lang=en');
  });
});
