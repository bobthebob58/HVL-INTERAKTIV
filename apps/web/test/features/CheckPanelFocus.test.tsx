/**
 * Tests for where keyboard focus goes on the check-and-publish tab when the control that had it goes away: **Sjekk på
 * nytt** after a retry that worked, and **Grunngje på nytt** behind its dialog after the server said the activity
 * changed (`hvl:content-changed`). Focus must land on the panel's main action, never on `body` (WCAG 2.4.3).
 *
 * Spec: UD-006, PROD-003
 */
// @vitest-environment jsdom
import type { ContentDetail, FindingsResponse } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiAuthProvider } from '../../src/api/ApiAuthContext';
import { CheckPanel } from '../../src/features/activity/CheckPanel';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const BEFORE = '2026-10-23T10:00:00.000Z';
const AFTER = '2026-10-23T10:05:00.000Z';
const PUBLISHED: ContentDetail = {
  id: ID,
  title: 'Videoen om celler',
  mainLibrary: 'H5P.InteractiveVideo',
  status: 'published',
  visibility: 'private',
  updatedAt: BEFORE,
  publishedAt: BEFORE,
  role: 'owner',
  mayEdit: true,
  mayPublish: true,
};
const UNEXPLAINED = {
  ruleId: 'V-VID-CAPTIONS',
  severity: 'error',
  requirement: 'UD-021',
  path: 'interactiveVideo.video.textTracks',
  message: 'Videoen manglar teksting.',
  acknowledgement: null,
} as const;
const findingsAt = (updatedAt: string): FindingsResponse => ({ updatedAt, findings: [UNEXPLAINED] });
const FINDINGS = `GET /api/content/${ID}/findings`;

/**
 * The panel inside a page that reloads the activity when asked, as ActivityView does, and counts the reloads. The
 * reloaded activity arrives a little after the findings, as `GET /api/content/:id` may in the browser.
 */
function Page({ next, onReload }: { readonly next: ContentDetail; readonly onReload: () => void }) {
  const [detail, setDetail] = useState(PUBLISHED);
  const reload = async () => {
    onReload();
    await new Promise((resolve) => setTimeout(resolve, 20));
    setDetail(next);
  };
  return (
    <ApiAuthProvider auth={{ kind: 'portal', csrfToken: 'csrf-1' }}>
      <CheckPanel detail={detail} revision={0} onGoToField={() => undefined} onStatusChange={reload} />
    </ApiAuthProvider>
  );
}

describe('[UD-006] focus when a focused control on the check-and-publish tab goes away', () => {
  it('[UD-006] a retry that works after a failed check puts focus on the main action', async () => {
    // Arrange
    let calls = 0;
    fakeFetch({
      [FINDINGS]: () => {
        calls += 1;
        return calls === 1
          ? { status: 500, body: errorBody(500, 'hvl:internal') }
          : { status: 200, body: findingsAt(BEFORE) };
      },
    });
    render(<Page next={PUBLISHED} onReload={() => undefined} />);
    const retry = await screen.findByRole('button', { name: 'Sjekk på nytt' });
    retry.focus();
    // Act
    fireEvent.click(retry);
    // Assert
    const main = await screen.findByRole('button', { name: 'Gjer om til utkast' });
    expect(retry.isConnected).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(main));
  });

  it('[UD-006] after a renew refused as changed, Avbryt puts focus on the main action and the activity is reloaded', async () => {
    // Arrange
    let changed = false;
    let reloads = 0;
    fakeFetch({
      [FINDINGS]: () => ({ status: 200, body: findingsAt(changed ? AFTER : BEFORE) }),
      [`POST /api/content/${ID}/publish`]: () => {
        changed = true;
        return { status: 409, body: errorBody(409, 'hvl:content-changed') };
      },
    });
    render(<Page next={{ ...PUBLISHED, updatedAt: AFTER }} onReload={() => (reloads += 1)} />);
    const opener = await screen.findByRole('button', { name: 'Grunngje på nytt' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Grunngje feila på nytt' });
    fireEvent.change(within(dialog).getByLabelText('Grunngjeving for feil 1'), {
      target: { value: 'Kjem frå Panopto.' },
    });
    // Act
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lagre grunngjevinga' }));
    expect(await within(dialog).findByText(/Aktiviteten vart endra/)).toBeTruthy();
    await waitFor(() => expect(opener.isConnected).toBe(false));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Grunngje på nytt' })).toBeTruthy());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Avbryt' }));
    // Assert
    expect(reloads).toBe(1);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Gjer om til utkast' })),
    );
    // WHY: findings and activity are of the same moment again, so the still-unexplained error is offered again.
    expect(screen.getByRole('button', { name: 'Grunngje på nytt' })).toBeTruthy();
  });
});
