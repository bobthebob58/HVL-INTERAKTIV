/**
 * Tests for the guide page's content (from a fixture guide, never ALU's text): the sections in the guide's order with
 * the phase matrix and the catalogue at their markers, boxes as labelled sections, citations as numbered links to the
 * reference list at the end, external links that say so; the draft banner; and the matrix and catalogue alone before a
 * guide is written. Phase labels on the page are the overview's.
 *
 * Spec: PED-002, PED-001
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuideView } from '../../src/features/studio/GuideView';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import { fakeFetch } from '../support/fakeFetch';
import { resetNavigation } from '../support/nextNavigationMock';
import { GUIDE, NO_GUIDE, OVERVIEW, studioRoutes } from '../support/studioFixtures';

vi.mock('next/navigation', () => import('../support/nextNavigationMock'));

const renderGuide = () =>
  render(
    <LocaleProvider locale="nn">
      <GuideView />
    </LocaleProvider>,
  );

/** The page's headings and landmarks-of-interest, in document order, as `tag: text`. */
const outline = () =>
  [...document.querySelectorAll('h1, h2, h3, h4, table, section[id]')].map((element) =>
    element.tagName === 'TABLE'
      ? 'table'
      : `${element.tagName.toLowerCase()}: ${element.firstChild?.textContent}`,
  );

describe('[PED-002] the guide page', () => {
  afterEach(() => resetNavigation());

  it('[PED-002] shows the guide’s sections in order, with the matrix and the catalogue at their markers and the references last', async () => {
    // Arrange
    fakeFetch(studioRoutes());
    // Act
    renderGuide();
    await screen.findByRole('heading', { level: 2, name: 'Første del' });
    // Assert
    expect(outline()).toEqual([
      'h1: Studentaktiv læring med «HVL læringsdesign»',
      'h2: Første del',
      'h3: Kva dette betyr for aktiviteten din',
      'table',
      'h3: Andre del',
      'section: Mønsterkatalogen',
      'h2: Mønsterkatalogen',
      'h3: Mønster fixture-video',
      'h3: Mønster fixture-case',
      'h3: Mønster fixture-terms',
      'h3: Mønster fixture-quiz',
      'h2: Kjelder',
    ]);
  });

  it('[PED-002] renders a box as a section labelled «Kva dette betyr for aktiviteten din» and its section, holding its prose', async () => {
    // Arrange
    fakeFetch(studioRoutes());
    // Act
    renderGuide();
    const box = await screen.findByRole('region', { name: 'Kva dette betyr for aktiviteten din Første del' });
    // Assert
    expect(box.tagName).toBe('SECTION');
    expect(within(box).getByRole('listitem').textContent).toBe('Punkt i boksen');
  });

  it('[PED-002] numbers citations by the reference list and links each to its entry, which says when it is unchecked', async () => {
    // Arrange
    fakeFetch(studioRoutes());
    // Act
    renderGuide();
    const first = await screen.findByRole('link', { name: 'Kjelde [1]' });
    // Assert
    expect(first.getAttribute('href')).toBe('#kjelde-ref-a');
    expect(screen.getByRole('link', { name: 'Kjelde [2]' }).getAttribute('href')).toBe('#kjelde-ref-b');
    const list = screen.getByRole('region', { name: 'Kjelder' });
    const entries = within(list).getAllByRole('listitem');
    expect(entries.map((entry) => entry.id)).toEqual(['kjelde-ref-a', 'kjelde-ref-b']);
    expect(entries[0]?.textContent).toBe(
      'Forfattar, A. (2026). Den første kjelda. (ikkje kontrollert mot kjelda enno)',
    );
    expect(entries[1]?.textContent).toBe('Forfattar, B. (2026). Den andre kjelda.');
  });

  it('[PED-002] marks an external link as one, and keeps a same-site link plain', async () => {
    // Arrange
    fakeFetch(studioRoutes());
    // Act
    renderGuide();
    const external = await screen.findByRole('link', { name: 'ALU (opnar ekstern nettstad)' });
    // Assert
    expect(external.getAttribute('href')).toBe('https://www.hvl.no/alu');
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');
    const internal = screen.getByRole('link', { name: 'eit mønster' });
    expect(internal.getAttribute('href')).toBe('/laeringsdesign/monster/fixture-video');
    expect(internal.getAttribute('rel')).toBeNull();
  });

  it('[PED-002] shows the draft banner while the content is proposed, and not once ALU has confirmed it', async () => {
    // Act
    fakeFetch(studioRoutes());
    const { unmount } = renderGuide();
    const banner = await screen.findByRole('note');
    unmount();
    fakeFetch(
      studioRoutes({ ...GUIDE, status: 'confirmed-by-alu' }, { ...OVERVIEW, status: 'confirmed-by-alu' }),
    );
    renderGuide();
    await screen.findByRole('heading', { level: 2, name: 'Første del' });
    // Assert
    expect(banner.textContent).toBe(
      '✎ Utkast: Tekstane, fasane og mønstera her er forslag som ALU ikkje har godkjent enno.',
    );
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('[PED-002] before a guide is written, says so and shows the matrix and the catalogue anyway', async () => {
    // Arrange
    fakeFetch(studioRoutes(NO_GUIDE));
    // Act
    renderGuide();
    await screen.findByRole('region', { name: 'Mønsterkatalogen' });
    // Assert
    expect(
      screen.getByText('Rettleiinga er ikkje skriven enno. Her er fasane og mønsterkatalogen.'),
    ).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Fasane rundt samlinga' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Kjelder' })).toBeNull();
  });

  it('[PED-001] names the phases with the labels the overview gives, so a renamed label shows in the matrix and the filter', async () => {
    // Arrange
    const renamed = {
      ...OVERVIEW,
      phases: OVERVIEW.phases.map((p, i) =>
        i === 0 ? { ...p, label: { nn: 'Førebuing', nb: 'Forberedelse', en: 'Preparation' } } : p,
      ),
    };
    fakeFetch(studioRoutes(NO_GUIDE, renamed));
    // Act
    renderGuide();
    const table = await screen.findByRole('table', { name: 'Fasane rundt samlinga' });
    // Assert
    expect(within(table).getByRole('columnheader', { name: 'Førebuing' })).toBeTruthy();
    const phaseFilter = screen.getByRole('combobox', { name: 'Fase' });
    expect(within(phaseFilter).getByRole('option', { name: 'Førebuing' })).toBeTruthy();
  });

  it('[PED-002] says the content could not be loaded when the overview fails', async () => {
    fakeFetch({ ...studioRoutes(), 'GET /api/studio': { status: 500, body: {} } });
    renderGuide();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Klarte ikkje å hente innhaldet. Last sida på nytt.',
    );
  });
});
