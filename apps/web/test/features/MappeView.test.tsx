/**
 * Tests for the `/mappe` page for a signed-in author: the activity picker with its filters (course, phase, dates) and
 * its limit of 50, the word count announced politely with an icon and a text prefix, the criteria set and language
 * in the preview request, the page's state while the mappe files are not in the content yet, and the note that
 * students' results come later.
 *
 * Spec: MAPPE-001, MAPPE-002, MAPPE-003, PED-001
 */
// @vitest-environment jsdom
import { MAPPE_MAX_ACTIVITIES, type MappeActivity } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MappeView } from '../../src/features/mappe/MappeView';
import { MAPPE_PICK_LIMIT } from '../../src/features/mappe/MappeWorkspace';
import { errorBody, fakeFetch } from '../support/fakeFetch';
import { activityId, MAPPE_ACTIVITIES, mappePreview, mappeRoutes } from '../support/mappeFixtures';

const checkboxNames = () =>
  screen.queryAllByRole('checkbox').map((box) => box.closest('li')?.textContent ?? '');

/** Renders the page and waits for the picker. */
async function openPage(routes = mappeRoutes()) {
  const requests = fakeFetch(routes);
  render(<MappeView />);
  const picker = await screen.findByRole('group', { name: 'Aktivitetar i mappa' });
  return { requests, picker };
}

describe('[MAPPE-001] choosing activities on /mappe', () => {
  it('[MAPPE-001] lists the author’s activities with each title in its own language, and filters by course and phase', async () => {
    // Arrange
    await openPage();
    // Act
    fireEvent.change(screen.getByRole('combobox', { name: 'Emne' }), { target: { value: 'SYK110' } });
    const afterCourse = checkboxNames();
    fireEvent.change(screen.getByRole('combobox', { name: 'Fase' }), { target: { value: 'etterarbeid' } });
    // Assert
    expect(afterCourse).toHaveLength(2);
    expect(checkboxNames()).toEqual([expect.stringContaining('Repetisjon etter samlinga')]);
    // WHY: the phase label comes from content (GET /api/studio), here the fixture's «Etter» (PED-001).
    expect(checkboxNames()[0]).toContain('Etter');
    expect(screen.getByText('Repetisjon etter samlinga').getAttribute('lang')).toBe('nb');
    expect(screen.getByText('1 av 3 aktivitetar passar med filtera.')).toBeTruthy();
  });

  it('[MAPPE-001] filters by a range of change dates, both days included, and by «utan emnekode»', async () => {
    // Arrange
    await openPage();
    // Act
    fireEvent.change(screen.getByLabelText('Endra frå og med'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('Endra til og med'), { target: { value: '2026-10-20' } });
    const inRange = checkboxNames();
    fireEvent.change(screen.getByLabelText('Endra frå og med'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Endra til og med'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Emne' }), { target: { value: '-' } });
    // Assert
    expect(inRange).toHaveLength(2);
    expect(checkboxNames()).toEqual([expect.stringContaining('Quiz without a course')]);
  });

  it('[MAPPE-001] chooses at most 50: «select all» stops there, and the reason is given in text', async () => {
    // Arrange
    const many: MappeActivity[] = Array.from({ length: 52 }, (_, index) => ({
      ...MAPPE_ACTIVITIES[2]!,
      contentId: activityId(index + 10),
      title: `Aktivitet ${index + 1}`,
    }));
    const { picker } = await openPage(
      mappeRoutes({ 'GET /api/mappe/activities': { status: 200, body: { items: many } } }),
    );
    // Act
    fireEvent.click(within(picker).getByRole('button', { name: 'Vel alle som passar' }));
    const last = within(picker).getAllByRole('checkbox').at(-1)!;
    fireEvent.click(last);
    // Assert
    expect(MAPPE_PICK_LIMIT).toBe(MAPPE_MAX_ACTIVITIES);
    const boxes = within(picker).getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.filter((box) => box.checked)).toHaveLength(50);
    expect(last.getAttribute('aria-disabled')).toBe('true');
    expect((last as HTMLInputElement).checked).toBe(false);
    const limit = within(picker).getByText(/kan ha inntil 50 aktivitetar/);
    expect(last.getAttribute('aria-describedby')).toBe(limit.id);
    expect(within(picker).getByText('50 av inntil 50 aktivitetar er valde.')).toBeTruthy();
    // Act and assert: «remove all» empties the choice again
    fireEvent.click(within(picker).getByRole('button', { name: 'Fjern alle' }));
    expect(boxes.filter((box) => box.checked)).toHaveLength(0);
  });

  it('[MAPPE-001] says the portfolio cannot be made yet while the mappe files are not in the content', async () => {
    // Arrange
    fakeFetch(
      mappeRoutes({
        'GET /api/mappe/criteria-sets': { status: 409, body: errorBody(409, 'hvl:mappe-not-ready') },
      }),
    );
    // Act
    render(<MappeView />);
    // Assert
    expect(await screen.findByText(/er ikkje lagde inn enno/)).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Last ned/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('[MAPPE-002] the word count on /mappe', () => {
  it('[MAPPE-002] announces the Del 1 count against the limit politely, with an icon and «Innanfor grensa:»', async () => {
    // Arrange
    const { requests, picker } = await openPage();
    // Act
    fireEvent.click(within(picker).getAllByRole('checkbox')[0]!);
    const text = await screen.findByText(/Innanfor grensa: Del 1 har 2\s345 ord av inntil 7\s500/u);
    // Assert
    const region = text.closest('[role="status"]');
    expect(region).not.toBeNull();
    expect(text.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('✓');
    const preview = requests.find((request) => request.path === '/api/mappe/preview');
    expect(preview?.headers['x-csrf-token']).toBe('csrf-1');
    expect(preview?.body).toEqual({
      contentIds: [activityId(1)],
      criteriaSet: 'hvl-merittering-2025',
      locale: 'nn',
    });
  });

  it('[MAPPE-002] over a limit warns in words, never by colour alone, and switching set and language changes the request', async () => {
    // Arrange
    const { requests, picker } = await openPage(
      mappeRoutes({
        'POST /api/mappe/preview': {
          status: 200,
          body: mappePreview({ criteriaSet: 'fixture-2027', words: 196, wordLimit: 100, overLimit: true }),
        },
      }),
    );
    // Act
    fireEvent.click(within(picker).getAllByRole('checkbox')[1]!);
    fireEvent.change(screen.getByRole('combobox', { name: 'Kriteriesett' }), {
      target: { value: 'fixture-2027' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Språk i mappa' }), { target: { value: 'en' } });
    const text = await screen.findByText(/Over grensa: Del 1 har 196 ord av inntil 100/);
    // Assert
    expect(text.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('!');
    expect(
      screen.getByRole('option', { name: 'Testsett 2027 (grensene er ikkje stadfesta enno)' }),
    ).toBeTruthy();
    expect(requests.filter((request) => request.path === '/api/mappe/preview').at(-1)?.body).toEqual({
      contentIds: [activityId(2)],
      criteriaSet: 'fixture-2027',
      locale: 'en',
    });
  });
});

describe('[MAPPE-003] students’ results on /mappe', () => {
  it('[MAPPE-003] says that students’ results come in a later version (no results yet in S5)', async () => {
    // Act
    await openPage();
    // Assert
    expect(screen.getByText(/Resultat frå studentane kjem i ein seinare versjon/)).toBeTruthy();
  });
});
