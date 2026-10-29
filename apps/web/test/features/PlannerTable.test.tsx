/**
 * Tests for the planner's markup (D-088): a `<table>` with a caption, column headers for the phases and row headers
 * for the outcomes, inside a focusable labelled region; activities with their status in text; empty cells linking
 * to the catalogue with a full accessible name; gaps and untagged activities shown with an icon and text.
 *
 * Spec: PED-031, UD-003
 */
// @vitest-environment jsdom
import type { PhaseKey, Planner } from '@hvl-interaktiv/api-contract';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlannerGaps } from '../../src/features/planner/PlannerGaps';
import { PlannerTable } from '../../src/features/planner/PlannerTable';
import { PlannerUntagged } from '../../src/features/planner/PlannerUntagged';
import { OVERVIEW } from './learningDesignFixtures';

const K1 = { text: 'Forklare blodtrykk', category: 'kunnskap' as const };
const F1 = { text: 'Måle puls', category: 'ferdigheiter' as const };
const ALFA = { contentId: '00000000-0000-4000-8000-000000000001', title: 'Alfa', status: 'draft' as const };
const BETA = {
  contentId: '00000000-0000-4000-8000-000000000002',
  title: 'Beta',
  status: 'published' as const,
  language: 'en',
};
const PLANNER: Planner = {
  courseCode: 'SYK110',
  phases: ['forarbeid', 'underveis', 'etterarbeid'],
  rows: [
    {
      outcome: K1,
      cells: [
        { phase: 'forarbeid', activities: [ALFA] },
        { phase: 'underveis', activities: [] },
        { phase: 'etterarbeid', activities: [BETA] },
      ],
    },
    {
      outcome: F1,
      cells: [
        { phase: 'forarbeid', activities: [ALFA] },
        { phase: 'underveis', activities: [] },
        { phase: 'etterarbeid', activities: [] },
      ],
    },
  ],
  gaps: [
    { kind: 'no-etterarbeid', outcome: F1 },
    { kind: 'empty-phase', phase: 'underveis' },
  ],
  untagged: [
    {
      contentId: '00000000-0000-4000-8000-000000000003',
      title: 'Delta',
      status: 'draft',
      missing: ['phase'],
    },
  ],
};
const phaseLabel = (phase: PhaseKey) => OVERVIEW.phases.find((p) => p.key === phase)?.label.nn ?? phase;

describe('[PED-031] the planner table', () => {
  it('[PED-031] is a captioned table with phase column headers and outcome row headers in a focusable region', () => {
    // Act
    render(<PlannerTable planner={PLANNER} phaseLabel={phaseLabel} />);
    // Assert
    const region = screen.getByRole('region', { name: 'Læringsutbytte og fasar i SYK110' });
    expect(region.getAttribute('tabindex')).toBe('0');
    const table = within(region).getByRole('table', { name: 'Læringsutbytte og fasar i SYK110' });
    const columns = within(table).getAllByRole('columnheader');
    expect(columns.map((th) => [th.textContent, th.getAttribute('scope')])).toEqual([
      ['Læringsutbytte', 'col'],
      ['Testfase før', 'col'],
      ['Testfase mellom', 'col'],
      ['Testfase etter', 'col'],
    ]);
    const rows = within(table).getAllByRole('rowheader');
    expect(rows.map((th) => [th.textContent, th.getAttribute('scope')])).toEqual([
      ['Forklare blodtrykkKunnskap', 'row'],
      ['Måle pulsFerdigheiter', 'row'],
    ]);
  });

  it('[PED-031] a cell links each activity with its status in text and its own language', () => {
    // Act
    render(<PlannerTable planner={PLANNER} phaseLabel={phaseLabel} />);
    // Assert
    const [, firstRow] = screen.getAllByRole('row');
    const cells = within(firstRow as HTMLElement).getAllByRole('cell');
    const beta = within(cells[2] as HTMLElement).getByRole('link', { name: 'Beta' });
    expect(beta.getAttribute('href')).toBe(`/aktivitet/${BETA.contentId}`);
    expect(beta.getAttribute('lang')).toBe('en');
    expect(cells[2]?.textContent).toContain('Publisert');
    expect(cells[0]?.textContent).toContain('Utkast');
  });

  it('[PED-031] an empty cell offers «Lag frå mønster» for its phase and course, named with phase and outcome', () => {
    // Act
    render(<PlannerTable planner={PLANNER} phaseLabel={phaseLabel} />);
    // Assert
    const link = screen.getByRole('link', { name: 'Lag frå mønster i Testfase etter for «Måle puls»' });
    expect(link.getAttribute('href')).toBe('/laeringsdesign?fase=etterarbeid&emne=SYK110#monsterkatalog');
    expect(screen.getAllByRole('link', { name: /^Lag frå mønster/ })).toHaveLength(3);
  });

  it('[UD-003] the missing etterarbeid of an outcome is marked in its cell with an icon and a word', () => {
    // Act
    render(<PlannerTable planner={PLANNER} phaseLabel={phaseLabel} />);
    // Assert
    const gapCell = screen
      .getByRole('link', { name: 'Lag frå mønster i Testfase etter for «Måle puls»' })
      .closest('td');
    expect(gapCell?.textContent).toContain('Hol');
    expect(gapCell?.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('!');
    const fullCell = screen.getByRole('link', { name: 'Beta' }).closest('td');
    expect(fullCell?.textContent).not.toContain('Hol');
  });
});

describe('[PED-031] the gaps and the untagged activities', () => {
  it('[UD-003] lists each gap with an icon and a text naming the phase from content and the outcome', () => {
    // Act
    render(<PlannerGaps gaps={PLANNER.gaps} phaseLabel={phaseLabel} />);
    // Assert
    const section = screen.getByRole('region', { name: 'Hol i planen' });
    const items = within(section).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '! Ingen aktivitet i Testfase etter for læringsutbyttet «Måle puls».',
      '! Ingen aktivitetar i Testfase mellom.',
    ]);
    expect(items[0]?.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('[PED-031] says so when there are no gaps', () => {
    render(<PlannerGaps gaps={[]} phaseLabel={phaseLabel} />);
    expect(screen.getByText('Planen har ingen hol.')).toBeTruthy();
  });

  it('[PED-031] lists the untagged activities with what each lacks, and nothing when there are none', () => {
    // Act
    const { rerender } = render(<PlannerUntagged courseCode="SYK110" untagged={PLANNER.untagged} />);
    const item = screen.getByRole('listitem');
    const text = item.textContent;
    const href = within(item).getByRole('link', { name: 'Delta' }).getAttribute('href');
    rerender(<PlannerUntagged courseCode="SYK110" untagged={[]} />);
    // Assert
    expect(text).toContain('Delta manglar fase');
    expect(text).toContain('Utkast');
    expect(href).toBe('/aktivitet/00000000-0000-4000-8000-000000000003');
    expect(screen.queryByRole('region')).toBeNull();
  });
});
