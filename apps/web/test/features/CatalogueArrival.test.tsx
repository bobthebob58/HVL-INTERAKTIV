/**
 * Tests for arriving at the guide page's catalogue by its address (`#monsterkatalog`, as the planner's «Lag frå
 * mønster» and a pattern page's way back link to it): once the content has loaded, the catalogue's heading takes
 * focus, only that first time, and an address without the fragment leaves focus alone.
 *
 * Spec: PED-031, PED-003, UD-006
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuideView } from '../../src/features/studio/GuideView';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import { fakeFetch } from '../support/fakeFetch';
import { resetNavigation } from '../support/nextNavigationMock';
import { NO_GUIDE, studioRoutes } from '../support/studioFixtures';

vi.mock('next/navigation', () => import('../support/nextNavigationMock'));

/** The guide page in a language. */
const page = (locale: 'nn' | 'en') => (
  <LocaleProvider locale={locale}>
    <GuideView />
  </LocaleProvider>
);

/** Opens the guide page at an address and waits for the catalogue. */
const openAt = async (address: string) => {
  resetNavigation(address);
  fakeFetch(studioRoutes(NO_GUIDE));
  const { rerender } = render(page('nn'));
  const catalogue = await screen.findByRole('region', { name: 'Mønsterkatalogen' });
  const heading = within(catalogue).getByRole('heading', { level: 2, name: 'Mønsterkatalogen' });
  return { catalogue, heading, rerender };
};

describe('[PED-031] arriving at the catalogue from the planner', () => {
  afterEach(() => resetNavigation());

  it('[PED-031] the planner’s «Lag frå mønster» address lands on the filtered catalogue with focus on its heading', async () => {
    // Act
    const { catalogue, heading } = await openAt('/laeringsdesign?fase=underveis&emne=SYK110#monsterkatalog');
    // Assert
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
    expect(within(catalogue).getByRole('status').textContent).toBe('Viser 1 av 4 mønster.');
  });

  it('[UD-006] takes focus only the first time: a filter changed afterwards keeps focus on its control', async () => {
    // Arrange
    const { catalogue, heading } = await openAt('/laeringsdesign#monsterkatalog');
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
    const phase = within(catalogue).getByRole('combobox', { name: 'Fase' }) as HTMLSelectElement;
    phase.focus();
    // Act
    fireEvent.change(phase, { target: { value: 'forarbeid' } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Assert
    expect(window.location.hash).toBe('#monsterkatalog');
    expect(document.activeElement).toBe(phase);
  });

  it('[UD-006] does not take focus again when the content loads again in another language', async () => {
    // Arrange
    const { heading, rerender } = await openAt('/laeringsdesign#monsterkatalog');
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
    // Act
    rerender(page('en'));
    const again = await screen.findByRole('heading', { level: 2, name: 'Pattern catalogue' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Assert
    expect(document.activeElement).not.toBe(again);
  });

  it('[UD-006] leaves focus alone when the address does not point at the catalogue', async () => {
    // Act
    const { heading } = await openAt('/laeringsdesign?fase=underveis');
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Assert
    expect(document.activeElement).not.toBe(heading);
    expect(document.activeElement).toBe(document.body);
  });
});
