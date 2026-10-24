/**
 * Tests for the Canvas page: the ltik is read from the address bar once and removed from it at once (also from
 * Next.js's router state), the title carries the activity's language, the frames carry
 * it, authors get **Rediger** with the formative notice (API calls with the Bearer ltik), and a page without an ltik
 * says to open the activity again from Canvas.
 *
 * Spec: LTI-006, LTI-003, PROD-011
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LtiPlayView } from '../../src/features/lti/LtiPlayView';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import { resetTakenLtikForTests, takeLtik, withoutLtik } from '../../src/features/lti/ltikFromAddress';
import type { AppLaunch } from '../../src/lti/launchHeader';
import { fakeFetch } from '../support/fakeFetch';

const LAUNCH: AppLaunch = {
  contentId: '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f',
  title: 'Celler og vev',
  mayEdit: true,
  locale: 'nn',
};
const ME = { status: 200, body: { kind: 'lti', locale: 'nn', roles: ['author'], dismissedNotices: [] } };

const openAt = (address: string) => {
  resetTakenLtikForTests();
  window.history.replaceState(null, '', address);
};

afterEach(() => openAt('/'));

describe('[LTI-003] the ltik on the Canvas page', () => {
  it('[LTI-003] is taken from the address bar once, removed from it, and the same value is kept', () => {
    // Arrange
    openAt('/app/play?ltik=secret.token&x=1#top');
    // Act
    const first = takeLtik();
    const again = takeLtik();
    // Assert
    expect(first).toBe('secret.token');
    expect(again).toBe('secret.token');
    expect(window.location.search).toBe('?x=1');
    expect(window.location.hash).toBe('#top');
    expect(withoutLtik('https://tool.example/app/play?ltik=a&ltik=b')).toBe('/app/play');
  });

  it('[LTI-003] then hands the clean address to Next.js’s router, without its marker, once its hooks are in', async () => {
    // Arrange
    openAt('/app/play?ltik=secret.token');
    window.history.replaceState({ __NA: true, tree: 'root' }, '', window.location.href);
    const original = window.history.replaceState.bind(window.history);
    const calls: unknown[][] = [];
    takeLtik();
    // WHY: stands in for Next.js's patched replaceState, which its root effect installs after the page's effect.
    window.history.replaceState = (...args: Parameters<History['replaceState']>) => {
      calls.push(args);
      original(...args);
    };
    try {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 0));
      // Assert
      expect(calls).toEqual([[{ tree: 'root' }, '', '/app/play']]);
    } finally {
      window.history.replaceState = original;
    }
  });

  it('[LTI-003] without an ltik the page says to open the activity again from Canvas', () => {
    openAt('/app/play');
    render(<LtiPlayView launch={LAUNCH} />);
    expect(screen.getByRole('heading', { name: 'Opne aktiviteten frå Canvas' })).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
  });
});

describe('[LTI-006] the Canvas page for an author', () => {
  it('[LTI-006] shows Spel and Rediger, and the frames carry the ltik in their query', () => {
    // Arrange
    openAt('/app/play?ltik=abc');
    fakeFetch({ 'GET /api/me': ME });
    // Act
    render(<LtiPlayView launch={LAUNCH} />);
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Celler og vev' })).toBeTruthy();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Spel', 'Rediger']);
    expect(screen.getByTitle('Spel: Celler og vev').getAttribute('src')).toBe('/lti/play?ltik=abc');
    expect(window.location.search).toBe('');
  });

  it('[PROD-011] the editor tab has the notice, and its API calls carry the Bearer ltik', async () => {
    // Arrange
    openAt('/app/play?ltik=abc');
    const requests = fakeFetch({ 'GET /api/me': ME });
    render(<LtiPlayView launch={LAUNCH} />);
    // Act
    fireEvent.click(screen.getByRole('tab', { name: 'Rediger' }));
    // Assert
    expect(screen.getByTitle('Rediger: Celler og vev').getAttribute('src')).toBe('/lti/edit?ltik=abc');
    expect(await screen.findByRole('region', { name: /Til undervegsvurdering/ })).toBeTruthy();
    await waitFor(() => expect(requests[0]?.headers.Authorization).toBe('Bearer abc'));
  });

  it('[UD-010] the title carries the activity’s language when the page is in another one', () => {
    // Arrange
    openAt('/app/play?ltik=abc');
    // Act
    render(
      <LocaleProvider locale="en">
        <LtiPlayView launch={{ ...LAUNCH, mayEdit: false, locale: 'en', language: 'nn' }} />
      </LocaleProvider>,
    );
    // Assert
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('lang')).toBe('nn');
    expect(screen.getByTitle('Play: Celler og vev')).toBeTruthy();
  });

  it('[LTI-006] a learner gets the player without tabs', () => {
    openAt('/app/play?ltik=abc');
    render(<LtiPlayView launch={{ ...LAUNCH, mayEdit: false }} />);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByTitle('Spel: Celler og vev')).toBeTruthy();
  });
});
