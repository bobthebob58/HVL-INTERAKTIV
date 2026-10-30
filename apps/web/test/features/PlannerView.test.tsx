/**
 * Tests for the planner page for a signed-in author: the course chooser offers their course codes and opens the plan
 * through the address, the course in the address loads its plan with the phase labels from content, and an author
 * without course codes is told how to add one.
 *
 * Spec: PED-031, PED-001
 */
// @vitest-environment jsdom
import type { Planner } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlannerView } from '../../src/features/planner/PlannerView';
import { fakeFetch, type FakeRoutes } from '../support/fakeFetch';
import { OVERVIEW } from './learningDesignFixtures';

const SESSION = { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'c' } };
const PLANNER: Planner = {
  courseCode: 'SYK110',
  phases: ['forarbeid', 'underveis', 'etterarbeid'],
  rows: [
    {
      outcome: { text: 'Forklare blodtrykk', category: 'kunnskap' },
      cells: [
        { phase: 'forarbeid', activities: [] },
        { phase: 'underveis', activities: [] },
        { phase: 'etterarbeid', activities: [] },
      ],
    },
  ],
  gaps: [],
  untagged: [],
};
const routes = (inUse: string[]): FakeRoutes => ({
  'GET /auth/session': SESSION,
  'GET /api/learning-design/course-codes': { status: 200, body: { inUse, fromCanvas: ['MAT101'] } },
  'GET /api/studio': { status: 200, body: OVERVIEW },
  'GET /api/learning-design/planner?courseCode=SYK110': { status: 200, body: PLANNER },
});

afterEach(() => window.history.replaceState(null, '', '/'));

describe('[PED-031] the planner page', () => {
  it('[PED-031] offers the author’s course codes in use and opens the chosen one’s plan through the address', async () => {
    // Arrange
    window.history.replaceState(null, '', '/laeringsdesign/planlegg');
    fakeFetch(routes(['PED3001', 'SYK110']));
    const navigate = vi.fn();
    render(<PlannerView navigate={navigate} />);
    const select = await screen.findByRole('combobox', { name: 'Emne' });
    // Act
    fireEvent.change(select, { target: { value: 'SYK110' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vis planen' }));
    // Assert
    expect([...select.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'PED3001',
      'SYK110',
    ]);
    expect(navigate).toHaveBeenCalledWith('/laeringsdesign/planlegg?emne=SYK110');
    expect(screen.getByText('Vel eit emne for å sjå planen.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('[PED-031] the course in the address loads its plan, with the phase labels from content', async () => {
    // Arrange
    window.history.replaceState(null, '', '/laeringsdesign/planlegg?emne=syk110');
    const requests = fakeFetch(routes(['SYK110']));
    // Act
    render(<PlannerView navigate={() => undefined} />);
    // Assert
    const table = await screen.findByRole('table', { name: 'Læringsutbytte og fasar i SYK110' });
    expect(table.querySelectorAll('th[scope="col"]')[3]?.textContent).toBe('Testfase etter');
    expect((screen.getByRole('combobox', { name: 'Emne' }) as HTMLSelectElement).value).toBe('SYK110');
    expect(requests.map((request) => request.path)).toContain(
      '/api/learning-design/planner?courseCode=SYK110',
    );
    expect(screen.getByText('Planen har ingen hol.')).toBeTruthy();
  });

  it('[PED-031] an author without course codes is told where to add one', async () => {
    // Arrange
    fakeFetch(routes([]));
    // Act
    render(<PlannerView navigate={() => undefined} />);
    // Assert
    expect(await screen.findByText(/Skriv emnekoden på fana Læringsdesign/)).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('[PED-031] a plan that cannot be loaded says so', async () => {
    // Arrange
    window.history.replaceState(null, '', '/laeringsdesign/planlegg?emne=SYK110');
    fakeFetch({
      ...routes(['SYK110']),
      'GET /api/learning-design/planner?courseCode=SYK110': { status: 500, body: {} },
    });
    // Act
    render(<PlannerView navigate={() => undefined} />);
    // Assert
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Klarte ikkje å hente innhaldet. Last sida på nytt.',
    );
  });
});
