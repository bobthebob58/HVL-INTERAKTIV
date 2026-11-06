/**
 * Tests for the CSV download on the Innsikt tab: it asks for the view on screen (its period, version and, in the
 * portal, its context) as `text/csv`, saves the file under the server's name, says so, says when it fails, and in
 * Canvas carries the Bearer ltik and no context.
 *
 * Spec: INS-009, INS-006, LTI-003
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiAuthProvider } from '../../../src/api/ApiAuthContext';
import { CSV_FALLBACK_NAME, InsightCsvDownload } from '../../../src/features/insight/InsightCsvDownload';
import { insightPath } from '../../../src/features/insight/insightApi';
import { errorBody, fakeFetch } from '../../support/fakeFetch';
import { ID, SYK_KEY } from './insightAnswers';

const PORTAL_EXPORT = `/api/content/${ID}/insight/export?period=14d&context=portal&version=3`;
const CANVAS_EXPORT = `/api/content/${ID}/insight/export?period=7d&version=2`;
const CSV = {
  status: 200,
  raw: 'del;mål;verdi\n',
  headers: {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': 'attachment; filename="innsikt-syk110.csv"',
  },
};

const saved: string[] = [];

beforeEach(() => {
  saved.length = 0;
  // WHY: jsdom has no object URLs and cannot navigate; the test records the name the page hands to the browser.
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:insight-1'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download);
  });
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('[INS-009] the CSV download', () => {
  it('[INS-009][INS-006] asks for the view on screen as text/csv, saves it under the server’s name and says so', async () => {
    // Arrange
    const requests = fakeFetch({ [`GET ${PORTAL_EXPORT}`]: CSV });
    render(<InsightCsvDownload contentId={ID} query={{ period: '14d', version: '3', context: 'portal' }} />);
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Last ned tala som CSV (rekneark)' }));
    // Assert
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Fila innsikt-syk110.csv er lasta ned.'),
    );
    expect(requests[0]?.path).toBe(PORTAL_EXPORT);
    expect(requests[0]?.headers.Accept).toBe('text/csv');
    expect(saved).toEqual(['innsikt-syk110.csv']);
    expect(screen.getByText(/med dei same skjulte verdiane/)).toBeTruthy();
  });

  it('[INS-009] a refused export says so in an alert, every time it is pressed', async () => {
    // Arrange
    fakeFetch({ [`GET ${PORTAL_EXPORT}`]: { status: 500, body: errorBody(500, 'error.internal') } });
    render(<InsightCsvDownload contentId={ID} query={{ period: '14d', version: '3', context: 'portal' }} />);
    // Act
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    const first = await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).not.toBe(first));
    expect(screen.getByRole('alert').textContent).toBe('Klarte ikkje å lage CSV-fila. Prøv igjen.');
  });

  it('[LTI-003][INS-009] in Canvas carries the Bearer ltik, sends no context, and names the file when the server does not', async () => {
    // Arrange
    const requests = fakeFetch({
      [`GET ${CANVAS_EXPORT}`]: { ...CSV, headers: { 'content-type': 'text/csv' } },
    });
    render(
      <ApiAuthProvider auth={{ kind: 'lti', ltik: 'ltik-1' }}>
        <InsightCsvDownload contentId={ID} query={{ period: '7d', version: '2' }} />
      </ApiAuthProvider>,
    );
    // Act
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    // Assert
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(`Fila ${CSV_FALLBACK_NAME} er lasta ned.`),
    );
    expect(requests[0]?.headers.Authorization).toBe('Bearer ltik-1');
    expect(requests[0]?.credentials).toBe('omit');
    expect(saved).toEqual([CSV_FALLBACK_NAME]);
  });

  it('[INS-007] encodes the activity and a course key into the address', () => {
    // Act and assert
    expect(insightPath('a/b', '', { context: SYK_KEY })).toBe(
      `/api/content/a%2Fb/insight?context=${encodeURIComponent(SYK_KEY)}`,
    );
    expect(insightPath(ID, '/contexts')).toBe(`/api/content/${ID}/insight/contexts`);
  });
});
