/**
 * Tests for a pattern's card in the catalogue on the guide page (from fixture patterns, never ALU's content): its
 * one-line purpose, its phases by the overview's labels, its content types by name, and its build time.
 *
 * Spec: PED-002, PED-010
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuideView } from '../../src/features/studio/GuideView';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import { fakeFetch } from '../support/fakeFetch';
import { resetNavigation } from '../support/nextNavigationMock';
import { NO_GUIDE, studioRoutes } from '../support/studioFixtures';

vi.mock('next/navigation', () => import('../support/nextNavigationMock'));

describe('[PED-002] a catalogue card', () => {
  afterEach(() => resetNavigation());

  it('[PED-002] shows its purpose, phases, content types and build time', async () => {
    // Arrange
    resetNavigation('/laeringsdesign');
    fakeFetch(studioRoutes(NO_GUIDE));
    // Act
    render(
      <LocaleProvider locale="nn">
        <GuideView />
      </LocaleProvider>,
    );
    const catalogue = await screen.findByRole('region', { name: 'Mønsterkatalogen' });
    // Assert
    const card = within(catalogue)
      .getByRole('heading', { level: 3, name: 'Mønster fixture-terms' })
      .closest('li') as HTMLElement;
    expect(within(card).getByText('Føremål fixture-terms.').tagName).toBe('P');
    expect([...card.querySelectorAll('dt, dd')].map((element) => element.textContent)).toEqual([
      'Fase',
      'Etter',
      'Innhaldstype',
      'Dra orda, Fyll inn orda',
      'Byggjetid',
      'om lag 15 minutt',
    ]);
  });
});
