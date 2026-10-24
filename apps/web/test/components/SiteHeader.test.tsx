/**
 * Component tests for the site chrome: the header with the site name and **Hjelp** in the same place on every page,
 * the logo slot, the `main#main` skip link target, and the Canvas variant whose help link opens a new tab.
 *
 * Spec: UD-013, UD-006, UD-007
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PortalChrome } from '../../src/components/PortalChrome';
import { SiteHeader } from '../../src/components/SiteHeader';
import { BRAND_LOGOS, brandLogo } from '../../src/config/branding';
import { LtiChrome } from '../../src/features/lti/LtiChrome';

describe('[UD-013] the site header', () => {
  it('[UD-013] shows the site name as a home link and Hjelp in a labelled navigation', () => {
    // Act
    render(<SiteHeader locale="nn" />);
    // Assert
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('link', { name: 'HVL Interaktiv, startside' }).getAttribute('href')).toBe(
      '/',
    );
    const nav = within(banner).getByRole('navigation', { name: 'Hjelp og informasjon' });
    expect(within(nav).getByRole('link', { name: 'Hjelp' }).getAttribute('href')).toBe('/hjelp?lang=nn');
  });

  it('[UD-013] shows text until HVL supplies a logo, for every locale', () => {
    expect(BRAND_LOGOS).toEqual({});
    expect(brandLogo('nn')).toBeUndefined();
    render(<SiteHeader locale="en" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('HVL Interaktiv')).toBeTruthy();
  });

  it('[UD-007] in Canvas, Hjelp opens a new tab and says so, and the site name is not a link', () => {
    // Act
    render(<SiteHeader locale="nb" inCanvas />);
    // Assert
    const help = screen.getByRole('link', { name: 'Hjelp (åpner i ny fane)' });
    expect(help.getAttribute('target')).toBe('_blank');
    expect(help.getAttribute('href')).toBe('/hjelp?lang=nb');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});

describe('[UD-006] the page chrome', () => {
  it.each([
    ['portal', PortalChrome],
    ['Canvas', LtiChrome],
  ] as const)(
    '[UD-006] the %s chrome has header, one main#main and footer, in that order',
    (_name, Chrome) => {
      // Act
      render(
        <Chrome locale="nn">
          <h1>Side</h1>
        </Chrome>,
      );
      // Assert
      const main = screen.getByRole('main');
      expect(main.id).toBe('main');
      expect(main.tabIndex).toBe(-1);
      const landmarks = [screen.getByRole('banner'), main, screen.getByRole('contentinfo')];
      for (let i = 1; i < landmarks.length; i++) {
        const previous = landmarks[i - 1] as Node;
        expect(
          previous.compareDocumentPosition(landmarks[i] as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    },
  );
});
