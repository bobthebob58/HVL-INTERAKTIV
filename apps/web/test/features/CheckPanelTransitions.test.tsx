/**
 * Tests for the check-and-publish tab's status changes: a published activity with an error whose reason has run out
 * (or that never had one) offers the publish dialog again for a new reason; keyboard focus stays on the panel's main
 * action when the status changes; and a second press while unpublishing sends no second request.
 *
 * Spec: PROD-003, UD-022, UD-006
 */
// @vitest-environment jsdom
import type { ContentDetail, FindingsResponse } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiAuthProvider } from '../../src/api/ApiAuthContext';
import { CheckPanel } from '../../src/features/activity/CheckPanel';
import { t } from '../../src/i18n/translate';
import { fakeFetch } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const UPDATED = '2026-10-23T10:00:00.000Z';
const PUBLISHED: ContentDetail = {
  id: ID,
  title: 'Videoen om celler',
  mainLibrary: 'H5P.InteractiveVideo',
  status: 'published',
  visibility: 'private',
  updatedAt: UPDATED,
  publishedAt: UPDATED,
  role: 'owner',
  mayEdit: true,
  mayPublish: true,
};
const DRAFT: ContentDetail = { ...PUBLISHED, status: 'draft', publishedAt: null };
const CAPTIONS = {
  ruleId: 'V-VID-CAPTIONS',
  severity: 'error',
  requirement: 'UD-021',
  path: 'interactiveVideo.video.textTracks',
  message: 'Videoen manglar teksting.',
} as const;
/** The reason given 15 days ago no longer holds: the server reports no acknowledgement (D-074). */
const EXPIRED: FindingsResponse = { updatedAt: UPDATED, findings: [{ ...CAPTIONS, acknowledgement: null }] };
const RENEWED: FindingsResponse = {
  updatedAt: UPDATED,
  findings: [
    {
      ...CAPTIONS,
      acknowledgement: { reason: 'Kjem', at: UPDATED, expiresAt: '2026-11-06T10:00:00.000Z' },
    },
  ],
};
const PUBLISH = `POST /api/content/${ID}/publish`;
const FINDINGS = `GET /api/content/${ID}/findings`;

/** The panel inside a page that reloads the activity when the status changes, as ActivityView does. */
function Page({ start, next }: { readonly start: ContentDetail; readonly next: ContentDetail }) {
  const [detail, setDetail] = useState(start);
  return (
    <ApiAuthProvider auth={{ kind: 'portal', csrfToken: 'csrf-1' }}>
      <CheckPanel
        detail={detail}
        revision={0}
        onGoToField={() => undefined}
        onStatusChange={async () => setDetail(next)}
      />
    </ApiAuthProvider>
  );
}

describe('[PROD-003] status changes on the check-and-publish tab', () => {
  it('[UD-022] a published activity whose reason ran out offers the dialog again and stores a new reason', async () => {
    // Arrange
    let published = false;
    const requests = fakeFetch({
      [FINDINGS]: () => ({ status: 200, body: published ? RENEWED : EXPIRED }),
      [PUBLISH]: () => {
        published = true;
        return { status: 200, body: { status: 'published', updatedAt: UPDATED, publishedAt: UPDATED } };
      },
    });
    render(<Page start={PUBLISHED} next={PUBLISHED} />);
    const renew = await screen.findByRole('button', { name: 'Grunngje på nytt' });
    expect(screen.getByText(/nokre feil har inga grunngjeving som gjeld/)).toBeTruthy();
    // Act
    fireEvent.click(renew);
    const dialog = screen.getByRole('dialog', { name: 'Grunngje feila på nytt' });
    expect(within(dialog).getByText(/Den nye grunngjevinga gjeld i 14 dagar/)).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Publiser no' })).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Grunngjeving for feil 1'), {
      target: { value: 'Tekstinga kjem frå Panopto.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lagre grunngjevinga' }));
    // Assert
    expect(
      await screen.findByText('Grunngjevinga er lagra. Aktiviteten er framleis publisert.'),
    ).toBeTruthy();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      updatedAt: UPDATED,
      acknowledgements: [
        { ruleId: CAPTIONS.ruleId, path: CAPTIONS.path, reason: 'Tekstinga kjem frå Panopto.' },
      ],
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Grunngje på nytt' })).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Gjer om til utkast' }));
  });

  it.each(['nn', 'nb', 'en'] as const)(
    '[UD-022] in %s the renew note does not say that a reason ran out',
    (locale) => {
      // WHY: an error that never had a reason (a rule added in a later release) also comes with `acknowledgement: null`.
      expect(t('publish.renewNeeded', locale)).not.toMatch(
        /gjeld ikkje lenger|gjelder ikke lenger|no longer holds/,
      );
    },
  );

  it('[UD-022] the reason field is labelled shortly and described by the error’s message', async () => {
    fakeFetch({ [FINDINGS]: { status: 200, body: EXPIRED } });
    render(<Page start={PUBLISHED} next={PUBLISHED} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Grunngje på nytt' }));
    const field = screen.getByLabelText('Grunngjeving for feil 1');
    const description = (field.getAttribute('aria-describedby') ?? '').split(' ');
    expect(document.getElementById(description[0] ?? '')?.textContent).toBe('Videoen manglar teksting.');
  });

  it.each([
    ['publishing a draft', DRAFT, PUBLISHED, 'Publiser', 'Gjer om til utkast'],
    ['returning to draft', PUBLISHED, DRAFT, 'Gjer om til utkast', 'Publiser'],
  ] as const)(
    '[UD-006] after %s focus stays on the same button',
    async (_case, start, next, before, after) => {
      // Arrange
      fakeFetch({
        [FINDINGS]: { status: 200, body: { updatedAt: UPDATED, findings: [] } },
        [PUBLISH]: { status: 200, body: { status: 'published', updatedAt: UPDATED, publishedAt: UPDATED } },
        [`POST /api/content/${ID}/unpublish`]: { status: 200, body: { status: 'draft', updatedAt: UPDATED } },
      });
      render(<Page start={start} next={next} />);
      const button = await screen.findByRole('button', { name: before });
      button.focus();
      // Act
      fireEvent.click(button);
      const submit = screen.queryByRole('button', { name: 'Publiser no' });
      if (submit) fireEvent.click(submit);
      // Assert
      expect(await screen.findByRole('button', { name: after })).toBe(button);
      await waitFor(() => expect(document.activeElement).toBe(button));
    },
  );

  it('[PROD-003] a second press while unpublishing sends no second request', async () => {
    // Arrange
    let answer: (value: Response) => void = () => undefined;
    const requests = fakeFetch({ [FINDINGS]: { status: 200, body: { updatedAt: UPDATED, findings: [] } } });
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (path, init) =>
      String(path).endsWith('/unpublish')
        ? new Promise<Response>((resolve) => {
            requests.push({
              method: 'POST',
              path: String(path),
              headers: {},
              body: undefined,
              credentials: undefined,
            });
            answer = resolve;
          })
        : realFetch(path, init);
    render(<Page start={PUBLISHED} next={DRAFT} />);
    const button = await screen.findByRole('button', { name: 'Gjer om til utkast' });
    // Act
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('true'));
    fireEvent.click(button);
    answer(Response.json({ status: 'draft', updatedAt: UPDATED }));
    // Assert
    expect(await screen.findByText(/eit utkast igjen/)).toBeTruthy();
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
