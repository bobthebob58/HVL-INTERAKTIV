/**
 * Tests for the publish dialog's learning-design prompt on the activity page (D-087): it says what is missing, never
 * blocks publishing, and its link closes the dialog, opens the **Læringsdesign** tab and moves focus to its heading.
 *
 * Spec: PED-030, UD-006
 */
// @vitest-environment jsdom
import type { LearningDesign } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityView } from '../../src/features/activity/ActivityView';
import { fakeFetch, type FakeAnswer } from '../support/fakeFetch';
import { DETAIL, ID, METADATA_PATH, OVERVIEW, STORED } from './learningDesignFixtures';

const EMPTY: LearningDesign = { outcomes: [], updatedAt: null };
const PUBLISHED = { status: 'published', updatedAt: DETAIL.updatedAt, publishedAt: DETAIL.updatedAt };

const openDialog = async (metadata: FakeAnswer) => {
  const requests = fakeFetch({
    'GET /auth/session': { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'c' } },
    [`GET /api/content/${ID}`]: { status: 200, body: DETAIL },
    [`GET /api/content/${ID}/findings`]: { status: 200, body: { updatedAt: DETAIL.updatedAt, findings: [] } },
    [`POST /api/content/${ID}/publish`]: { status: 200, body: PUBLISHED },
    [`GET ${METADATA_PATH}`]: metadata,
    'GET /api/studio': { status: 200, body: OVERVIEW },
    'GET /api/learning-design/course-codes': { status: 200, body: { inUse: [], fromCanvas: [] } },
  });
  render(<ActivityView contentId={ID} />);
  fireEvent.click(await screen.findByRole('tab', { name: 'Sjekk og publiser' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Publiser' }));
  return { requests, dialog: screen.getByRole('dialog') };
};

describe('[PED-030] the learning-design prompt when publishing', () => {
  it.each([
    ['neither a phase nor outcomes', EMPTY, 'Læringsdesignet har verken fase eller læringsutbytte.'],
    ['no phase', { ...STORED, phase: undefined }, 'Læringsdesignet har ingen fase.'],
    ['no outcomes', { ...STORED, outcomes: [] }, 'Læringsdesignet har ingen læringsutbytte.'],
  ])(
    '[PED-030] says when the learning design has %s, with icon and text',
    async (_what, metadata, message) => {
      // Act
      const { dialog } = await openDialog({ status: 200, body: metadata });
      // Assert
      const status = await within(dialog).findByText(message);
      expect(status.closest('[role="status"]')).not.toBeNull();
      expect(status.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('ℹ︎');
      expect(within(dialog).getByRole('link', { name: 'Fyll ut læringsdesignet' }).getAttribute('href')).toBe(
        `/aktivitet/${ID}?fane=learning-design`,
      );
    },
  );

  it('[PED-030] never blocks publishing: the activity publishes with the prompt on screen', async () => {
    // Arrange
    const { requests, dialog } = await openDialog({ status: 200, body: EMPTY });
    await within(dialog).findByRole('link', { name: 'Fyll ut læringsdesignet' });
    // Act
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publiser no' }));
    // Assert
    expect(await screen.findByText('Aktiviteten er publisert.')).toBeTruthy();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      updatedAt: DETAIL.updatedAt,
      acknowledgements: [],
    });
  });

  it.each([
    ['phase and outcomes are set', { status: 200, body: STORED }],
    ['the metadata cannot be read', { status: 500, body: {} }],
  ])('[PED-030] says nothing when %s', async (_what, metadata) => {
    // Arrange
    const { requests, dialog } = await openDialog(metadata);
    // Act
    await waitFor(() => expect(requests.some((request) => request.path === METADATA_PATH)).toBe(true));
    // Assert
    expect(within(dialog).queryByRole('link', { name: 'Fyll ut læringsdesignet' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Publiser no' })).toBeTruthy();
  });

  it('[UD-006] the link closes the dialog, opens the Læringsdesign tab and moves focus to its heading', async () => {
    // Arrange
    const { dialog } = await openDialog({ status: 200, body: EMPTY });
    const link = await within(dialog).findByRole('link', { name: 'Fyll ut læringsdesignet' });
    // Act
    fireEvent.click(link);
    // Assert
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Læringsdesign' }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'Læringsdesign for aktiviteten' }),
      ),
    );
  });
});
