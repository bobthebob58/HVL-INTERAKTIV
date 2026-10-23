/**
 * Tests for the check-and-publish tab: findings are fetched for the activity, the publish dialog publishes and the
 * findings are fetched again, and a published activity can return to draft with the `updatedAt` on screen.
 *
 * Spec: PROD-003, UD-022
 */
// @vitest-environment jsdom
import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiAuthProvider } from '../../src/api/ApiAuthContext';
import { CheckPanel } from '../../src/features/activity/CheckPanel';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const UPDATED = '2026-10-23T10:00:00.000Z';
const DETAIL: ContentDetail = {
  id: ID,
  title: 'Celler og vev',
  mainLibrary: 'H5P.Column',
  status: 'published',
  visibility: 'private',
  updatedAt: UPDATED,
  publishedAt: UPDATED,
  role: 'owner',
  mayEdit: true,
  mayPublish: true,
};
const FINDINGS = { updatedAt: UPDATED, findings: [] };

const show = (onStatusChange = vi.fn()) =>
  render(
    <ApiAuthProvider auth={{ kind: 'portal', csrfToken: 'csrf-1' }}>
      <CheckPanel
        detail={DETAIL}
        revision={0}
        onGoToField={() => undefined}
        onStatusChange={onStatusChange}
      />
    </ApiAuthProvider>,
  );

describe('[PROD-003] the check-and-publish tab', () => {
  it('[PROD-003] publishes through the dialog, announces it and fetches the findings again', async () => {
    // Arrange
    const onStatusChange = vi.fn();
    const requests = fakeFetch({
      [`GET /api/content/${ID}/findings`]: { status: 200, body: FINDINGS },
      [`POST /api/content/${ID}/publish`]: {
        status: 200,
        body: { status: 'published', updatedAt: UPDATED, publishedAt: UPDATED },
      },
    });
    show(onStatusChange);
    fireEvent.click(await screen.findByRole('button', { name: 'Publiser' }));
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Publiser no' }));
    // Assert
    expect(await screen.findByText('Aktiviteten er publisert.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onStatusChange).toHaveBeenCalledOnce();
    await waitFor(() => expect(requests.filter((request) => request.method === 'GET')).toHaveLength(2));
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      updatedAt: UPDATED,
      acknowledgements: [],
    });
  });

  it('[PROD-003] returns a published activity to draft with the updatedAt it shows', async () => {
    // Arrange
    const requests = fakeFetch({
      [`GET /api/content/${ID}/findings`]: { status: 200, body: FINDINGS },
      [`POST /api/content/${ID}/unpublish`]: { status: 200, body: { status: 'draft', updatedAt: UPDATED } },
    });
    show();
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Gjer om til utkast' }));
    // Assert
    expect(await screen.findByText(/eit utkast igjen/)).toBeTruthy();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({ updatedAt: UPDATED });
  });

  it('[PROD-003] an unpublish refused because the activity changed says so in plain language', async () => {
    fakeFetch({
      [`GET /api/content/${ID}/findings`]: { status: 200, body: FINDINGS },
      [`POST /api/content/${ID}/unpublish`]: { status: 409, body: errorBody(409, 'hvl:content-changed') },
    });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Gjer om til utkast' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Aktiviteten vart endra medan du sjekka han.',
    );
  });

  it('[PROD-003] a failed check can be tried again', async () => {
    // Arrange
    let calls = 0;
    fakeFetch({
      [`GET /api/content/${ID}/findings`]: () =>
        ++calls === 1 ? { status: 500, body: {} } : { status: 200, body: FINDINGS },
    });
    show();
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Sjekk på nytt' }));
    // Assert
    expect(
      await screen.findByText('Sjekken fann ingenting å rette. Aktiviteten kan publiserast.'),
    ).toBeTruthy();
  });
});
