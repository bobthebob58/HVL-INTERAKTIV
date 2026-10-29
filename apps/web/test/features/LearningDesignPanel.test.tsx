/**
 * Tests for the **Læringsdesign** tab's form: its fieldsets with the phase labels from content, the stored values,
 * a save with the `updatedAt` it read, a clear conflict message that keeps what was typed, the error summary on
 * invalid input, the outcomes already used in the course, and the purpose's language.
 *
 * Spec: PED-030, PED-032, UD-013
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LearningDesignPanel } from '../../src/features/learningDesign/LearningDesignPanel';
import { errorBody, fakeFetch, type FakeRoutes } from '../support/fakeFetch';
import { DETAIL, ID, METADATA_PATH, OVERVIEW, STORED } from './learningDesignFixtures';

const routes = (extra: FakeRoutes = {}): FakeRoutes => ({
  [`GET ${METADATA_PATH}`]: { status: 200, body: STORED },
  'GET /api/studio': { status: 200, body: OVERVIEW },
  'GET /api/learning-design/course-codes': {
    status: 200,
    body: { inUse: ['SYK110'], fromCanvas: ['MAT101'] },
  },
  'GET /api/learning-design/outcomes?courseCode=SYK110': {
    status: 200,
    body: { courseCode: 'SYK110', outcomes: [] },
  },
  ...extra,
});
const show = (detail = DETAIL, reloadDetail = vi.fn(async () => undefined)) => {
  render(<LearningDesignPanel detail={detail} announce={() => undefined} reloadDetail={reloadDetail} />);
  return reloadDetail;
};
// WHY: by label, since the course code has suggestions (`list`), which makes it a combobox, not a textbox.
const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

describe('[PED-030] the Læringsdesign tab', () => {
  it('[PED-030] groups phase and outcomes in fieldsets, with the phase labels from content and the stored values', async () => {
    // Arrange
    fakeFetch(routes());
    // Act
    show();
    // Assert
    const phases = await screen.findByRole('group', { name: 'Fase' });
    expect(
      within(phases)
        .getAllByRole('radio')
        .map((radio) => radio.parentElement?.textContent),
    ).toEqual(['Ingen fase', 'Testfase før', 'Testfase mellom', 'Testfase etter']);
    expect((within(phases).getByRole('radio', { name: 'Testfase mellom' }) as HTMLInputElement).checked).toBe(
      true,
    );
    const outcomes = screen.getByRole('group', { name: 'Læringsutbytte' });
    expect(within(outcomes).getByRole('textbox', { name: 'Læringsutbytte 2' })).toHaveProperty(
      'value',
      'Måle puls',
    );
    expect(within(outcomes).getByRole('combobox', { name: 'Kategori for læringsutbytte 2' })).toHaveProperty(
      'value',
      'ferdigheiter',
    );
    expect(field('Emnekode').value).toBe('SYK110');
    expect(field('Tid for studentane, i minutt').value).toBe('15');
    expect(screen.getByText('Aktiviteten er laga frå mønsteret «Testmønster».')).toBeTruthy();
  });

  it('[PED-030] saves everything with the updatedAt it read, says so and loads the activity again', async () => {
    // Arrange
    const saved = { ...STORED, learnerPurpose: 'Ny linje.', updatedAt: '2026-10-29T09:00:00.000Z' };
    const requests = fakeFetch(routes({ [`PUT ${METADATA_PATH}`]: { status: 200, body: saved } }));
    const reloadDetail = show();
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'Kvifor aktiviteten er viktig, for studentane' }),
      {
        target: { value: 'Ny linje.' },
      },
    );
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Lagre læringsdesignet' }));
    // Assert
    expect(await screen.findByText('Læringsdesignet er lagra.')).toBeTruthy();
    const put = requests.find((request) => request.method === 'PUT');
    expect(put?.body).toEqual({
      phase: 'underveis',
      courseCode: 'SYK110',
      outcomes: STORED.outcomes,
      rationale: STORED.rationale,
      estimatedStudentMinutes: 15,
      learnerPurpose: 'Ny linje.',
      updatedAt: STORED.updatedAt,
    });
    expect(reloadDetail).toHaveBeenCalledOnce();
  });

  it('[PED-030] a conflict keeps what was typed, says so, and loads what is stored on request', async () => {
    // Arrange
    let stored = STORED;
    fakeFetch(
      routes({
        [`GET ${METADATA_PATH}`]: () => ({ status: 200, body: stored }),
        [`PUT ${METADATA_PATH}`]: { status: 409, body: errorBody(409, 'hvl:learning-design-conflict') },
      }),
    );
    show();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Grunngjeving' }), {
      target: { value: 'Mitt.' },
    });
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Lagre læringsdesignet' }));
    const alert = await screen.findByRole('alert');
    const typed = field('Grunngjeving').value;
    stored = { ...STORED, rationale: 'Kollegaen sitt.', updatedAt: '2026-10-29T09:00:00.000Z' };
    fireEvent.click(within(alert).getByRole('button', { name: 'Hent det som er lagra' }));
    // Assert
    expect(alert.textContent).toContain('endringane dine er ikkje lagra');
    expect(typed).toBe('Mitt.');
    await waitFor(() => expect(field('Grunngjeving').value).toBe('Kollegaen sitt.'));
    await waitFor(() => expect(document.activeElement?.id).toBe('laeringsdesign-skjema'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('[UD-013] invalid input is listed in an error summary linked to its fields, and nothing is sent', async () => {
    // Arrange
    const requests = fakeFetch(routes());
    show();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Emnekode' }), {
      target: { value: 'SYK_110' },
    });
    fireEvent.change(field('Tid for studentane, i minutt'), { target: { value: '601' } });
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Lagre læringsdesignet' }));
    // Assert
    const summary = await screen.findByRole('alert');
    expect(within(summary).getByRole('heading').textContent).toBe('Det er 2 problem du må rette');
    const links = within(summary).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `#${field('Emnekode').id}`,
      `#${field('Tid for studentane, i minutt').id}`,
    ]);
    expect(document.activeElement).toBe(summary);
    expect(field('Emnekode').getAttribute('aria-invalid')).toBe('true');
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('[PED-030] offers the outcomes already used in the course as checkboxes that add and remove them', async () => {
    // Arrange
    const used = [{ text: 'Reflektere over eiga rolle', category: 'generell-kompetanse' }];
    fakeFetch(
      routes({
        'GET /api/learning-design/outcomes?courseCode=SYK110': {
          status: 200,
          body: { courseCode: 'SYK110', outcomes: used },
        },
      }),
    );
    show();
    const choices = await screen.findByRole('group', { name: 'Læringsutbytte du alt brukar i SYK110' });
    const box = within(choices).getByRole('checkbox', {
      name: 'Reflektere over eiga rolle (Generell kompetanse)',
    });
    // Act
    fireEvent.click(box);
    const added = screen
      .getAllByRole('textbox', { name: /^Læringsutbytte \d+$/ })
      .map((input) => (input as HTMLTextAreaElement).value);
    fireEvent.click(box);
    // Assert
    expect(added).toEqual(['Forklare blodtrykk', 'Måle puls', 'Reflektere over eiga rolle']);
    expect(screen.getAllByRole('textbox', { name: /^Læringsutbytte \d+$/ })).toHaveLength(2);
  });

  it('[PED-032] the learner purpose is marked with the activity’s language when it differs from the page’s', async () => {
    // Arrange
    fakeFetch(routes());
    // Act
    show({ ...DETAIL, language: 'en' });
    // Assert
    const purpose = await screen.findByRole('textbox', {
      name: 'Kvifor aktiviteten er viktig, for studentane',
    });
    expect(purpose.getAttribute('lang')).toBe('en');
    expect(screen.getByText('21 av 200 teikn')).toBeTruthy();
    expect(ID).toBe(DETAIL.id);
  });
});
