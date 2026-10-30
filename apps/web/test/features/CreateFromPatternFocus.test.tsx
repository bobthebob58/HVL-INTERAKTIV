/**
 * Tests for focus in «Lag frå dette mønsteret» after a course code that is not one: the error summary takes focus
 * once per failed submit, and never while the author corrects the field.
 *
 * Spec: UD-013, UD-006, PROD-001
 */
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateFromPatternForm } from '../../src/features/studio/pattern/CreateFromPatternForm';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import { fakeFetch } from '../support/fakeFetch';
import { DETAIL } from '../support/studioFixtures';

/** Renders the form for an author, with no request answered. */
const openForm = () => {
  const requests = fakeFetch({});
  render(
    <LocaleProvider locale="nn">
      <CreateFromPatternForm
        pattern={DETAIL}
        session={{ roles: ['author'], locale: 'nn', csrfToken: 'csrf-1' }}
        locale="nn"
        carried={{}}
        phaseLabel={undefined}
        navigate={vi.fn()}
      />
    </LocaleProvider>,
  );
  return { requests, field: screen.getByRole('textbox', { name: 'Emnekode (valfri)' }) as HTMLInputElement };
};

describe('[UD-013] focus while correcting a course code', () => {
  it('[UD-013] keeps focus in the course code field while the author corrects it', () => {
    // Arrange
    const { requests, field } = openForm();
    fireEvent.change(field, { target: { value: 'x!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lag aktiviteten' }));
    const summary = screen.getByRole('alert');
    expect(document.activeElement).toBe(summary);
    // Act
    fireEvent.click(screen.getByRole('link', { name: /Skriv emnekoden med bokstavar og tal/ }));
    const typed = ['x!S', 'x!SY', 'x!SYK'].map((value) => {
      fireEvent.change(field, { target: { value } });
      return { value: field.value, focused: document.activeElement === field };
    });
    // Assert
    expect(typed).toEqual([
      { value: 'x!S', focused: true },
      { value: 'x!SY', focused: true },
      { value: 'x!SYK', focused: true },
    ]);
    expect(screen.getByRole('alert')).toBe(summary);
    expect(requests).toHaveLength(0);
  });

  it('[UD-013] focuses the summary again, as a new alert, after a second failed submit', () => {
    // Arrange
    const { field } = openForm();
    fireEvent.change(field, { target: { value: 'x!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lag aktiviteten' }));
    const first = screen.getByRole('alert');
    field.focus();
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Lag aktiviteten' }));
    // Assert
    const second = screen.getByRole('alert');
    expect(second).not.toBe(first);
    expect(document.activeElement).toBe(second);
  });
});
