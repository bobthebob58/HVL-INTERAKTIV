/**
 * Tests for the `/mappe` page's downloads: the Markdown export is a POST with the CSRF token whose file the browser
 * saves under the server's name, and the page says so; a PDF the server cannot make (no browser, or every slot busy)
 * is explained in words with a pointer to the Markdown file; nothing is sent while no activity is chosen, and pressing
 * again then is a new alert.
 *
 * Spec: MAPPE-001, MAPPE-003, MAPPE-004
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MappeView } from '../../src/features/mappe/MappeView';
import { errorBody, fakeFetch, type FakeRoutes } from '../support/fakeFetch';
import { activityId, mappeRoutes } from '../support/mappeFixtures';

const saved: { download: string; href: string }[] = [];

beforeEach(() => {
  saved.length = 0;
  // WHY: jsdom has no object URLs and cannot navigate; the test records what the page hands to the browser.
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mappe-1'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push({ download: this.download, href: this.href });
  });
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

/** Renders the page, chooses the first activity and returns the downloads section. */
async function chooseFirst(routes: FakeRoutes) {
  const requests = fakeFetch(mappeRoutes(routes));
  render(<MappeView />);
  const picker = await screen.findByRole('group', { name: 'Aktivitetar i mappa' });
  fireEvent.click(within(picker).getAllByRole('checkbox')[0]!);
  return { requests, downloads: screen.getByRole('region', { name: 'Last ned mappa' }) };
}

describe('[MAPPE-001] downloading the portfolio', () => {
  it('[MAPPE-001] posts the export with the CSRF token and saves the file under the server’s name', async () => {
    // Arrange
    const { requests, downloads } = await chooseFirst({
      'POST /api/mappe/export?format=md': {
        status: 200,
        raw: '# Pedagogisk mappe\n',
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': 'attachment; filename="pedagogisk-mappe-2026-10-29.md"',
        },
      },
    });
    // Act
    fireEvent.click(within(downloads).getByRole('button', { name: 'Last ned Markdown (til å redigere)' }));
    // Assert
    expect(
      await within(downloads).findByText('Fila pedagogisk-mappe-2026-10-29.md er lasta ned.'),
    ).toBeTruthy();
    const exported = requests.find((request) => request.path === '/api/mappe/export?format=md');
    expect(exported).toMatchObject({ method: 'POST', cache: 'no-store' });
    expect(exported?.headers['x-csrf-token']).toBe('csrf-1');
    expect(exported?.body).toEqual({
      contentIds: [activityId(1)],
      criteriaSet: 'hvl-merittering-2025',
      locale: 'nn',
    });
    expect(saved).toEqual([{ download: 'pedagogisk-mappe-2026-10-29.md', href: 'blob:mappe-1' }]);
  });

  it('[MAPPE-001] asks for an activity first and sends nothing while none is chosen', async () => {
    // Arrange
    const requests = fakeFetch(mappeRoutes());
    render(<MappeView />);
    const downloads = await screen.findByRole('region', { name: 'Last ned mappa' });
    // Act
    fireEvent.click(within(downloads).getByRole('button', { name: 'Last ned PDF' }));
    // Assert
    expect((await within(downloads).findByRole('alert')).textContent).toBe(
      'Vel minst éin aktivitet før du lastar ned.',
    );
    expect(requests.some((request) => request.path.startsWith('/api/mappe/export'))).toBe(false);
  });

  it('[MAPPE-001] a second press with nothing chosen shows the refusal as a new alert, so it is announced again', async () => {
    // Arrange
    fakeFetch(mappeRoutes());
    render(<MappeView />);
    const downloads = await screen.findByRole('region', { name: 'Last ned mappa' });
    const markdown = within(downloads).getByRole('button', { name: 'Last ned Markdown (til å redigere)' });
    fireEvent.click(markdown);
    const first = within(downloads).getByRole('alert');
    // Act
    fireEvent.click(markdown);
    // Assert
    const second = within(downloads).getByRole('alert');
    expect(second).not.toBe(first);
    expect(second.textContent).toBe('Vel minst éin aktivitet før du lastar ned.');
  });
});

describe('[MAPPE-004] when the PDF cannot be made', () => {
  it.each([
    ['hvl:pdf-unavailable', /Last ned Markdown-fila i staden: ho har det same innhaldet/],
    ['hvl:pdf-busy', /Vent litt og prøv igjen, eller last ned Markdown-fila/],
  ])('[MAPPE-004] explains a 503 %s in words and points to the Markdown file', async (code, message) => {
    // Arrange
    const { downloads } = await chooseFirst({
      'POST /api/mappe/export?format=pdf': { status: 503, body: errorBody(503, code, 'server text') },
    });
    // Act
    fireEvent.click(within(downloads).getByRole('button', { name: 'Last ned PDF' }));
    // Assert
    expect((await within(downloads).findByRole('alert')).textContent).toMatch(message);
    expect(saved).toEqual([]);
  });
});
