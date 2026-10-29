/**
 * Tests for the co-author search on the **Deling** tab: nothing is sent before three characters, one search after a
 * pause in typing, the number of results announced politely, the results as «Legg til» buttons, and the 429 and a
 * student author's refusal explained.
 *
 * Spec: PROD-007, UD-013
 */
// @vitest-environment jsdom
import { PEOPLE_QUERY_MIN_LENGTH, type Person } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PeopleSearch, SEARCH_MIN_LENGTH, SEARCH_PAUSE_MS } from '../../src/features/sharing/PeopleSearch';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const KARI: Person = { userId: '0192f0c4-0000-7000-8000-00000000a001', displayName: 'Kari Nordmann' };
const KARL: Person = { userId: '0192f0c4-0000-7000-8000-00000000a002', displayName: 'Karl Kollega' };
const NAMELESS: Person = { userId: '0192f0c4-0000-7000-8000-00000000a003', displayName: null };

const show = (exclude: ReadonlySet<string> = new Set(), onAdd = vi.fn()) => {
  render(<PeopleSearch exclude={exclude} onAdd={onAdd} />);
  return onAdd;
};
const type = (value: string) =>
  fireEvent.change(screen.getByRole('searchbox', { name: 'Søk etter tilsette ved HVL' }), {
    target: { value },
  });
const pause = () => new Promise((resolve) => setTimeout(resolve, SEARCH_PAUSE_MS + 100));

describe('[PROD-007] searching for co-authors', () => {
  it('[PROD-007] sends nothing before three characters, then one search after a pause in typing', async () => {
    // Arrange
    const requests = fakeFetch({ 'GET /api/people?q=Kari': { status: 200, body: { people: [KARI] } } });
    show();
    // Act
    type('Ka');
    await pause();
    type('Kar');
    type('Kari');
    await pause();
    // Assert
    expect(requests.map((request) => request.path)).toEqual(['/api/people?q=Kari']);
    expect(SEARCH_MIN_LENGTH).toBe(PEOPLE_QUERY_MIN_LENGTH);
  });

  it('[PROD-007] announces the number of results politely and offers each as «Legg til <namn>»', async () => {
    // Arrange
    fakeFetch({ 'GET /api/people?q=Kar': { status: 200, body: { people: [KARI, KARL, NAMELESS] } } });
    const onAdd = show(new Set([KARL.userId]));
    // Act
    type('Kar');
    // Assert: the person already on the list is left out; a missing name is said in words
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Treff: 2'));
    const results = screen.getByRole('list', { name: 'Treff i søket' });
    const buttons = within(results)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(buttons).toEqual(['Legg til Kari Nordmann', 'Legg til Namnet er ikkje kjent']);
    fireEvent.click(within(results).getByRole('button', { name: 'Legg til Kari Nordmann' }));
    expect(onAdd).toHaveBeenCalledWith(KARI);
  });

  it('[PROD-007] says when nothing was found', async () => {
    fakeFetch({ 'GET /api/people?q=Zzz': { status: 200, body: { people: [] } } });
    show();
    type('Zzz');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Ingen treff.'));
    expect(screen.queryByRole('list')).toBeNull();
  });

  it.each([
    [
      'too many searches (429)',
      { status: 429, body: errorBody(429, 'hvl:rate-limited', 'Server-tekst') },
      'Du har søkt mange gonger på kort tid. Vent eit minutt og prøv igjen.',
    ],
    [
      'a student author’s refusal',
      { status: 403, body: errorBody(403, 'hvl:sharing-not-allowed', 'Som student kan du førebels …') },
      'Som student kan du førebels …',
    ],
  ])('[PROD-007] explains %s in words', async (_name, answer, text) => {
    // Arrange
    fakeFetch({ 'GET /api/people?q=Kari': answer });
    show();
    // Act
    type('Kari');
    // Assert
    expect((await screen.findByRole('alert')).textContent).toContain(text);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
