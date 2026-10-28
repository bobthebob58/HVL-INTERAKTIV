/**
 * Component tests for the site chrome: the header with the site name, the main menu and **Hjelp** in the same place
 * and order on every portal page, the logo slot, the `main#main` skip link target, and the Canvas variant whose help
 * link opens a new tab and which has no main menu.
 *
 * Spec: UD-013, UD-006, UD-007
 */
// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PortalChrome } from '../../src/components/PortalChrome';
import { SiteHeader } from '../../src/components/SiteHeader';
import { BRAND_LOGOS, brandLogo } from '../../src/config/branding';
import { LtiChrome } from '../../src/features/lti/LtiChrome';
import { errorBody, fakeFetch, type RecordedRequest } from '../support/fakeFetch';

let requests: RecordedRequest[] = [];
beforeEach(() => {
  // WHY: the portal header's main menu asks who is signed in; these tests see a signed-out visitor.
  requests = fakeFetch({ 'GET /api/me': { status: 401, body: errorBody(401, 'hvl:unauthenticated') } });
});

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

  it('[UD-013] orders the site name, the main menu and Hjelp the same way on every portal page', async () => {
    // Act
    render(<SiteHeader locale="nn" />);
    await waitFor(() => expect(requests).toHaveLength(1));
    // Assert
    const banner = screen.getByRole('banner');
    expect(
      within(banner)
        .getAllByRole('navigation')
        .map((nav) => nav.getAttribute('aria-label')),
    ).toEqual(['Hovudmeny', 'Hjelp og informasjon']);
    expect(
      within(banner)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['HVL Interaktiv', 'Læringsdesign', 'Hjelp']);
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
    expect(screen.queryByRole('navigation', { name: 'Hovedmeny' })).toBeNull();
    expect(requests).toEqual([]);
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
