/**
 * Tests for the phase matrix (from a fixture overview): an accessible table with a caption, the phases as column
 * headers with the *samling* between the first and the second, the aspects as row headers, the recommended patterns
 * taken from the patterns' own phases, and a filter link per phase that keeps the course.
 *
 * Spec: PED-002, PED-003
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhaseMatrix } from '../../src/features/studio/PhaseMatrix';
import { OVERVIEW } from '../support/studioFixtures';

describe('[PED-002] the phase matrix', () => {
  it('[PED-002] is a captioned table in a labelled, focusable region, with the samling between the first two phases', () => {
    // Act
    render(<PhaseMatrix overview={OVERVIEW} filters={{}} locale="nn" />);
    // Assert
    const region = screen.getByRole('region', { name: 'Fasane rundt samlinga' });
    expect(region.getAttribute('tabindex')).toBe('0');
    const table = within(region).getByRole('table', { name: 'Fasane rundt samlinga' });
    const columns = within(table).getAllByRole('columnheader');
    expect(columns.map((header) => [header.textContent, header.getAttribute('scope')])).toEqual([
      ['Før', 'col'],
      ['Samlinga', 'col'],
      ['Mellom', 'col'],
      ['Etter', 'col'],
    ]);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['Kva fasen er', 'Pedagogisk føremål', 'Tilrådde mønster', 'Plassering i Canvas']);
    expect(
      within(table).getByText('Den synkrone økta. Her lagar du ingen aktivitet.').closest('td')?.rowSpan,
    ).toBe(4);
  });

  it('[PED-002] recommends each phase’s patterns from the patterns’ own phases, linked with the phase and course', () => {
    // Act
    render(<PhaseMatrix overview={OVERVIEW} filters={{ course: 'SYK110' }} locale="nn" />);
    // Assert
    const quizLinks = screen.getAllByRole('link', { name: 'Mønster fixture-quiz' });
    expect(quizLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/laeringsdesign/monster/fixture-quiz?fase=forarbeid&emne=SYK110',
      '/laeringsdesign/monster/fixture-quiz?fase=etterarbeid&emne=SYK110',
    ]);
    expect(screen.getAllByRole('link', { name: 'Mønster fixture-case' })).toHaveLength(1);
  });

  it('[PED-003] gives each phase a link that filters the catalogue by it and keeps the other filters', () => {
    // Act
    render(
      <PhaseMatrix overview={OVERVIEW} filters={{ type: 'H5P.QuestionSet', course: 'SYK110' }} locale="nn" />,
    );
    // Assert
    const link = screen.getByRole('link', { name: 'Alle mønstera for Mellom i katalogen' });
    expect(link.getAttribute('href')).toBe(
      '/laeringsdesign?fase=underveis&type=H5P.QuestionSet&emne=SYK110#monsterkatalog',
    );
  });
});
