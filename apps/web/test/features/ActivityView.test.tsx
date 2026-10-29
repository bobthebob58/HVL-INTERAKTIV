/**
 * Tests for the activity page: the tabs follow the server's rights, every frame has a title, the document title names
 * the activity, the editor tab carries the formative notice, every save in the editor refreshes the page and is
 * announced, "Gå til feltet" opens the editor at the field, and a title in another language carries its `lang`.
 *
 * Spec: PROD-003, PROD-011, LTI-006, UD-006, UD-010
 */
// @vitest-environment jsdom
import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityView } from '../../src/features/activity/ActivityView';
import { CONTENT_SAVED, GO_TO_FIELD } from '../../src/messaging/frameMessages';
import { errorBody, fakeFetch, type FakeRoutes } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const DETAIL: ContentDetail = {
  id: ID,
  title: 'Celler og vev',
  mainLibrary: 'H5P.Column',
  status: 'draft',
  visibility: 'private',
  updatedAt: '2026-10-23T10:00:00.000Z',
  publishedAt: null,
  role: 'owner',
  mayEdit: true,
  mayPublish: true,
};
const FINDING = {
  ruleId: 'V-IMG-ALT',
  severity: 'error',
  requirement: 'UD-021',
  path: 'content[1].content.params.alt',
  message: 'Biletet manglar alternativ tekst.',
  acknowledgement: null,
};
const routes = (detail: ContentDetail = DETAIL): FakeRoutes => ({
  'GET /auth/session': { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'csrf-1' } },
  [`GET /api/content/${ID}`]: { status: 200, body: detail },
  [`GET /api/content/${ID}/findings`]: {
    status: 200,
    body: { updatedAt: detail.updatedAt, findings: [FINDING] },
  },
  'GET /api/me': {
    status: 200,
    body: { kind: 'portal', locale: 'nn', roles: ['author'], dismissedNotices: [] },
  },
});

describe('[LTI-006] the activity page', () => {
  it('[LTI-006] an author gets Spel, Rediger, Læringsdesign and Sjekk og publiser, and the player frame has a title', async () => {
    fakeFetch(routes());
    render(<ActivityView contentId={ID} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Celler og vev' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Spel', 'Rediger', 'Læringsdesign', 'Sjekk og publiser']);
    expect(screen.getByTitle('Spel: Celler og vev').getAttribute('src')).toBe(`/h5p/play/${ID}`);
    // WHY: the page names itself in an effect after the activity loads, which may run after the heading shows.
    await waitFor(() => expect(document.title).toBe('Celler og vev – HVL Interaktiv'));
  });

  it('[UD-010] the heading carries the activity’s language only when it differs from the page’s', async () => {
    fakeFetch(routes({ ...DETAIL, language: 'en' }));
    const { unmount } = render(<ActivityView contentId={ID} />);
    expect((await screen.findByRole('heading', { level: 1 })).getAttribute('lang')).toBe('en');
    unmount();
    fakeFetch(routes({ ...DETAIL, language: 'nn' }));
    render(<ActivityView contentId={ID} />);
    expect((await screen.findByRole('heading', { level: 1 })).hasAttribute('lang')).toBe(false);
  });

  it('[LTI-006] someone who may only view gets the player alone', async () => {
    fakeFetch(routes({ ...DETAIL, role: null, mayEdit: false, mayPublish: false }));
    render(<ActivityView contentId={ID} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Spel']);
  });

  it('[PROD-011] the editor tab frames the editor with the formative-use notice', async () => {
    // Arrange
    fakeFetch(routes());
    render(<ActivityView contentId={ID} />);
    // Act
    fireEvent.click(await screen.findByRole('tab', { name: 'Rediger' }));
    // Assert
    expect(screen.getByTitle('Rediger: Celler og vev').getAttribute('src')).toBe(`/h5p/edit/${ID}`);
    expect(await screen.findByRole('region', { name: /Til undervegsvurdering/ })).toBeTruthy();
  });

  it('[PROD-003] "Gå til feltet" opens the editor tab and posts the path to the editor frame', async () => {
    // Arrange
    fakeFetch(routes());
    render(<ActivityView contentId={ID} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Sjekk og publiser' }));
    expect(screen.queryByTitle('Rediger: Celler og vev')).toBeNull();
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Gå til feltet' }));
    const frame = screen.getByTitle('Rediger: Celler og vev') as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow as Window, 'postMessage');
    fireEvent.load(frame);
    // Assert
    expect(screen.getByRole('tab', { name: 'Rediger' }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith({ type: GO_TO_FIELD, path: FINDING.path }, window.location.origin),
    );
  });

  it('[PROD-003] a save in the editor fetches the activity and its findings again and says so', async () => {
    // Arrange
    const requests = fakeFetch(routes());
    render(<ActivityView contentId={ID} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Sjekk og publiser' }));
    await screen.findByText(/Biletet manglar alternativ tekst/);
    fireEvent.click(screen.getByRole('tab', { name: 'Rediger' }));
    const frame = screen.getByTitle('Rediger: Celler og vev') as HTMLIFrameElement;
    const findingsBefore = requests.filter((request) => request.path.endsWith('/findings')).length;
    // Act
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: CONTENT_SAVED, contentId: ID },
          origin: window.location.origin,
          source: frame.contentWindow,
        }),
      );
    });
    // Assert
    expect(await screen.findByText('Endringane er lagra. Sjekk og publiser er oppdatert.')).toBeTruthy();
    await waitFor(() =>
      expect(requests.filter((request) => request.path.endsWith('/findings')).length).toBe(
        findingsBefore + 1,
      ),
    );
  });

  it('[PROD-003] a second save is announced again, although the words are the same', async () => {
    // Arrange
    fakeFetch(routes());
    render(<ActivityView contentId={ID} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Rediger' }));
    const frame = screen.getByTitle('Rediger: Celler og vev') as HTMLIFrameElement;
    const save = () =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: CONTENT_SAVED, contentId: ID },
            origin: window.location.origin,
            source: frame.contentWindow,
          }),
        );
      });
    const region = () =>
      screen.getAllByRole('status').find((element) => element.textContent?.startsWith('Endr'));
    // Act
    save();
    const first = region()?.textContent;
    save();
    const second = region()?.textContent;
    // Assert
    expect(first).toBe('Endringane er lagra. Sjekk og publiser er oppdatert.');
    expect(second?.trim()).toBe(first);
    expect(second).not.toBe(first);
  });

  it('[LTI-006] signed out: the login link returns to this activity; unavailable: one message', async () => {
    fakeFetch({ 'GET /auth/session': { status: 401, body: errorBody(401, 'hvl:unauthenticated') } });
    const { unmount } = render(<ActivityView contentId={ID} />);
    expect((await screen.findByRole('link', { name: 'Logg inn med Feide' })).getAttribute('href')).toBe(
      `/auth/feide/login?returnTo=%2Faktivitet%2F${ID}`,
    );
    unmount();
    fakeFetch({
      ...routes(),
      [`GET /api/content/${ID}`]: { status: 404, body: errorBody(404, 'hvl:activity-unavailable') },
    });
    render(<ActivityView contentId={ID} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Aktiviteten er ikkje tilgjengeleg.');
  });
});
