/**
 * Component tests for ExternalLink: a visible icon hidden from assistive technology, and "(opnar ekstern nettstad)"
 * or "(opnar i ny fane)" in the page language as part of the link's accessible name.
 *
 * Spec: UD-007, UD-010
 */
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EXTERNAL_ICON, ExternalLink } from '../../src/components/ExternalLink';

describe('[UD-007] external links say where they go', () => {
  it.each([
    ['nn', 'Datatilsynet (opnar ekstern nettstad)'],
    ['nb', 'Datatilsynet (åpner ekstern nettside)'],
    ['en', 'Datatilsynet (opens an external website)'],
  ] as const)('[UD-007] in %s the accessible name ends with the hidden note', (locale, name) => {
    render(
      <ExternalLink href="https://www.datatilsynet.no/" locale={locale}>
        Datatilsynet
      </ExternalLink>,
    );
    expect(screen.getByRole('link', { name })).toHaveProperty('href', 'https://www.datatilsynet.no/');
  });

  it('[UD-007] shows an icon that assistive technology does not read', () => {
    // Act
    render(
      <ExternalLink href="https://www.hvl.no/" locale="nn">
        HVL
      </ExternalLink>,
    );
    // Assert
    const icon = screen.getByText(EXTERNAL_ICON);
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    const link = screen.getByRole('link');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.hasAttribute('target')).toBe(false);
  });

  it('[UD-007] a link that leaves the Canvas frame opens a new tab and says so', () => {
    // Act
    render(
      <ExternalLink href="/personvern" locale="nn" newTab external={false}>
        Personvern
      </ExternalLink>,
    );
    // Assert
    const link = screen.getByRole('link', { name: 'Personvern (opnar i ny fane)' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
