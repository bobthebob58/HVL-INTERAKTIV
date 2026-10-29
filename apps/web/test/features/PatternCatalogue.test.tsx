/**
 * Tests for the pattern catalogue's filters on the guide page (from fixture patterns): a shared address restores the
 * filters, a changed filter is written into the address with `router.replace` (keeping the course, never scrolling),
 * focus stays on the control, the number of matches is announced in a status region, and a filter that matches
 * nothing offers «Vis alle mønstera», which moves focus back to the first filter; the phase matrix's filter link
 * moves focus to the catalogue's heading; and the way to a blank activity beside the patterns.
 *
 * Spec: PED-003, PROD-001
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuideView } from '../../src/features/studio/GuideView';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import { fakeFetch } from '../support/fakeFetch';
import { resetNavigation, routerCalls } from '../support/nextNavigationMock';
import { NO_GUIDE, studioRoutes } from '../support/studioFixtures';

vi.mock('next/navigation', () => import('../support/nextNavigationMock'));

/** Opens the guide page at an address and waits for the catalogue. */
const openAt = async (address: string) => {
  resetNavigation(address);
  fakeFetch(studioRoutes(NO_GUIDE));
  render(
    <LocaleProvider locale="nn">
      <GuideView />
    </LocaleProvider>,
  );
  return screen.findByRole('region', { name: 'Mønsterkatalogen' });
};

/** The names of the cards the catalogue shows. */
const cardNames = (catalogue: HTMLElement) =>
  within(catalogue)
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);

describe('[PED-003] the catalogue’s filters', () => {
  afterEach(() => resetNavigation());

  it('[PED-003] a shared address restores the filters and shows only the matching patterns', async () => {
    // Act
    const catalogue = await openAt('/laeringsdesign?fase=etterarbeid&tid=30&emne=SYK110');
    // Assert
    expect(cardNames(catalogue)).toEqual(['Mønster fixture-terms']);
    expect((within(catalogue).getByRole('combobox', { name: 'Fase' }) as HTMLSelectElement).value).toBe(
      'etterarbeid',
    );
    expect(
      (within(catalogue).getByRole('combobox', { name: 'Lengste byggjetid' }) as HTMLSelectElement).value,
    ).toBe('30');
    expect(within(catalogue).getByRole('status').textContent).toBe('Viser 1 av 4 mønster.');
    expect(within(catalogue).getByRole('link', { name: 'Mønster fixture-terms' }).getAttribute('href')).toBe(
      '/laeringsdesign/monster/fixture-terms?fase=etterarbeid&emne=SYK110',
    );
  });

  it('[PED-003] writes a changed filter into the address, keeps the course, keeps focus and announces the count', async () => {
    // Arrange
    const catalogue = await openAt('/laeringsdesign?emne=SYK110');
    const type = within(catalogue).getByRole('combobox', { name: 'Innhaldstype' }) as HTMLSelectElement;
    type.focus();
    // Act
    fireEvent.change(type, { target: { value: 'H5P.QuestionSet' } });
    // Assert
    expect(routerCalls).toEqual([
      {
        method: 'replace',
        href: '/laeringsdesign?type=H5P.QuestionSet&emne=SYK110#monsterkatalog',
        options: { scroll: false },
      },
    ]);
    expect(window.location.search).toBe('?type=H5P.QuestionSet&emne=SYK110');
    expect(document.activeElement).toBe(type);
    expect(type.value).toBe('H5P.QuestionSet');
    expect(cardNames(catalogue)).toEqual(['Mønster fixture-quiz']);
    expect(within(catalogue).getByRole('status').textContent).toBe('Viser 1 av 4 mønster.');
  });

  it('[PED-003] ignores values in the address it does not know, and offers a build-time limit the address names', async () => {
    // Act
    const catalogue = await openAt('/laeringsdesign?fase=samling&type=H5P.DragQuestion&tid=45');
    // Assert
    expect((within(catalogue).getByRole('combobox', { name: 'Fase' }) as HTMLSelectElement).value).toBe('');
    expect(
      (within(catalogue).getByRole('combobox', { name: 'Innhaldstype' }) as HTMLSelectElement).value,
    ).toBe('');
    const time = within(catalogue).getByRole('combobox', { name: 'Lengste byggjetid' });
    expect(
      within(time)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'Inga grense',
      'Høgst 15 minutt',
      'Høgst 30 minutt',
      'Høgst 45 minutt',
      'Høgst 60 minutt',
      'Høgst 120 minutt',
    ]);
    expect(cardNames(catalogue)).toHaveLength(3);
  });

  it('[PED-003] says when nothing matches, and «Vis alle mønstera» clears the filters but the course and moves focus', async () => {
    // Arrange
    const catalogue = await openAt('/laeringsdesign?fase=underveis&tid=15&emne=SYK110');
    // Act
    const noMatch = within(catalogue).getByText('Ingen mønster passar til filtra.');
    fireEvent.click(within(catalogue).getByRole('button', { name: 'Vis alle mønstera' }));
    // Assert
    expect(noMatch).toBeTruthy();
    expect(routerCalls.at(-1)?.href).toBe('/laeringsdesign?emne=SYK110#monsterkatalog');
    expect(cardNames(catalogue)).toHaveLength(4);
    expect(document.activeElement).toBe(within(catalogue).getByRole('combobox', { name: 'Fase' }));
    expect(within(catalogue).getByRole('status').textContent).toBe('Viser 4 av 4 mønster.');
  });

  it('[PED-003] the phase matrix’s filter link moves focus to the catalogue’s heading, but not on a click for a new tab', async () => {
    // Arrange
    const catalogue = await openAt('/laeringsdesign');
    const heading = within(catalogue).getByRole('heading', { level: 2, name: 'Mønsterkatalogen' });
    const link = screen.getByRole('link', { name: 'Alle mønstera for Etter i katalogen' });
    // WHY: jsdom cannot navigate; in the app, Next.js's router does after the click.
    const stopNavigation = (event: Event) => event.preventDefault();
    window.addEventListener('click', stopNavigation);
    // Act
    link.focus();
    fireEvent.click(link, { ctrlKey: true });
    const afterNewTabClick = document.activeElement;
    fireEvent.click(link);
    window.removeEventListener('click', stopNavigation);
    // Assert
    expect(afterNewTabClick).toBe(link);
    expect(document.activeElement).toBe(heading);
    expect(link.getAttribute('href')).toBe('/laeringsdesign?fase=etterarbeid#monsterkatalog');
  });

  it('[PED-003] an address the page comes back to later wins over a filter the catalogue wrote before', async () => {
    // Arrange
    const page = () => (
      <LocaleProvider locale="nn">
        <GuideView />
      </LocaleProvider>
    );
    resetNavigation('/laeringsdesign?fase=underveis');
    fakeFetch(studioRoutes(NO_GUIDE));
    const { rerender } = render(page());
    const catalogue = await screen.findByRole('region', { name: 'Mønsterkatalogen' });
    const phase = within(catalogue).getByRole('combobox', { name: 'Fase' }) as HTMLSelectElement;
    fireEvent.change(phase, { target: { value: 'forarbeid' } });
    // Act: a matrix link (or the back button) brings back the first address
    window.history.pushState(null, '', '/laeringsdesign?fase=underveis#monsterkatalog');
    rerender(page());
    // Assert
    expect(phase.value).toBe('underveis');
    expect(cardNames(catalogue)).toEqual(['Mønster fixture-case']);
  });

  it('[PED-003] shows a pattern that cannot be created now with an icon and a sentence, not colour alone', async () => {
    // Act
    const catalogue = await openAt('/laeringsdesign');
    // Assert
    const quiz = within(catalogue).getByRole('heading', { name: 'Mønster fixture-quiz' }).closest('li');
    expect(quiz?.textContent).toContain(
      '⚠ Ikkje tilgjengeleg no: ein innhaldstype som mønsteret treng, er ikkje installert.',
    );
  });

  it('[PROD-001] the catalogue offers a blank activity at /aktivitet/ny', async () => {
    // Act
    const catalogue = await openAt('/laeringsdesign?fase=etterarbeid');
    // Assert
    const blank = within(catalogue).getByRole('link', { name: 'Eller lag ein tom aktivitet utan mønster' });
    expect(blank.getAttribute('href')).toBe('/aktivitet/ny');
  });
});
