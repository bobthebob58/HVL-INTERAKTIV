/**
 * Tests for the header's main menu: «Læringsdesign» for everyone, the author links for signed-in authors only, the
 * fixed order, the current page marked with `aria-current`, and the labels in each language.
 *
 * Spec: UD-013, UD-006
 */
// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentNavHref, STUDIO_NAV_ITEMS, StudioNav } from '../../src/components/StudioNav';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const navigation = vi.hoisted(() => ({ pathname: '/' as string | null }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));

const me = (roles: readonly string[]) => ({
  'GET /api/me': { status: 200, body: { kind: 'portal', locale: 'nn', roles, dismissedNotices: [] } },
});
const SIGNED_OUT = { 'GET /api/me': { status: 401, body: errorBody(401, 'hvl:unauthenticated') } };

/** The menu's links as `label → href`, once the `/api/me` answer has arrived. */
const menuLinks = async (requests: readonly unknown[]) => {
  await waitFor(() => expect(requests).toHaveLength(1));
  const menu = screen.getByRole('navigation', { name: 'Hovudmeny' });
  return within(menu)
    .getAllByRole('link')
    .map((link) => `${link.textContent} → ${link.getAttribute('href')}`);
};

describe('[UD-013] the header’s main menu', () => {
  afterEach(() => {
    navigation.pathname = '/';
  });

  it('[UD-013] signed out, only Læringsdesign shows; the menu asks /api/me as a portal request', async () => {
    // Arrange
    const requests = fakeFetch(SIGNED_OUT);
    // Act
    render(<StudioNav locale="nn" />);
    // Assert
    expect(await menuLinks(requests)).toEqual(['Læringsdesign → /laeringsdesign']);
    expect(requests[0]).toMatchObject({ method: 'GET', path: '/api/me', credentials: 'same-origin' });
  });

  it('[UD-013] a signed-in author gets the planner, the bank and the portfolio, always in this order', async () => {
    // Arrange
    const requests = fakeFetch(me(['author']));
    // Act
    render(<StudioNav locale="nn" />);
    // Assert
    await screen.findByRole('link', { name: 'Planleggar' });
    expect(await menuLinks(requests)).toEqual([
      'Læringsdesign → /laeringsdesign',
      'Planleggar → /laeringsdesign/planlegg',
      'Innhaldsbank → /laeringsdesign/innhaldsbank',
      'Mappe → /mappe',
    ]);
  });

  it.each([
    ['a learner', me(['learner'])],
    ['a failed answer', { 'GET /api/me': { status: 500, body: errorBody(500, 'error.internal') } }],
  ])('[UD-013] %s gets only the public link', async (_case, routes) => {
    const requests = fakeFetch(routes);
    render(<StudioNav locale="nn" />);
    expect(await menuLinks(requests)).toEqual(['Læringsdesign → /laeringsdesign']);
  });

  it.each([
    ['/laeringsdesign', 'Læringsdesign', 'page'],
    ['/laeringsdesign/monster/fa-video', 'Læringsdesign', 'true'],
    ['/laeringsdesign/planlegg', 'Planleggar', 'page'],
    ['/mappe', 'Mappe', 'page'],
  ])(
    '[UD-006] on %s, %s is the current link (aria-current="%s") and no other',
    async (path, label, value) => {
      // Arrange
      navigation.pathname = path;
      fakeFetch(me(['admin']));
      // Act
      render(<StudioNav locale="nn" />);
      await screen.findByRole('link', { name: 'Mappe' });
      // Assert
      const current = screen.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'));
      expect(current.map((link) => [link.textContent, link.getAttribute('aria-current')])).toEqual([
        [label, value],
      ]);
    },
  );

  it('[UD-006] signed out on an author page, no link is current: the guide is not marked instead', async () => {
    navigation.pathname = '/laeringsdesign/planlegg';
    const requests = fakeFetch(SIGNED_OUT);
    render(<StudioNav locale="nn" />);
    await menuLinks(requests);
    expect(screen.getByRole('link', { name: 'Læringsdesign' }).hasAttribute('aria-current')).toBe(false);
  });

  it('[UD-013] the labels follow the page language', async () => {
    fakeFetch(me(['author']));
    render(<StudioNav locale="en" />);
    const menu = await screen.findByRole('navigation', { name: 'Main menu' });
    await within(menu).findByRole('link', { name: 'Portfolio' });
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Learning design', 'Planner', 'Content bank', 'Portfolio']);
  });

  it('[UD-006] the current link is the longest matching path, never a mere prefix of a word', () => {
    const hrefs = STUDIO_NAV_ITEMS.map((item) => item.href);
    expect(currentNavHref('/laeringsdesign/planlegg', hrefs)).toBe('/laeringsdesign/planlegg');
    expect(currentNavHref('/laeringsdesignx', hrefs)).toBeUndefined();
    expect(currentNavHref('/mapper', hrefs)).toBeUndefined();
    expect(currentNavHref(null, hrefs)).toBeUndefined();
  });
});
