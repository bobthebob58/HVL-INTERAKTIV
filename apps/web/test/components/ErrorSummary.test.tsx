/**
 * Component tests for ErrorSummary: a summary at the top that takes focus, names the number of problems, and links
 * each problem to its field, which names its message through `aria-describedby`.
 *
 * Spec: UD-013, UD-006
 */
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorSummary, fieldErrorId } from '../../src/components/ErrorSummary';
import { LocaleProvider } from '../../src/i18n/LocaleContext';

const Form = () => (
  <form>
    <ErrorSummary
      errors={[
        { fieldId: 'reason-0', message: 'Skriv ei grunngjeving for feilen «Bilete utan alt-tekst».' },
        { fieldId: 'reason-1', message: 'Grunngjevinga er for lang.' },
      ]}
    />
    <label htmlFor="reason-0">Grunngjeving 1</label>
    <textarea id="reason-0" aria-describedby={fieldErrorId('reason-0')} />
    <p id={fieldErrorId('reason-0')}>Skriv ei grunngjeving.</p>
    <label htmlFor="reason-1">Grunngjeving 2</label>
    <textarea id="reason-1" />
  </form>
);

describe('[UD-013] the error summary', () => {
  it('[UD-013] takes focus and announces how many problems there are', () => {
    // Act
    render(<Form />);
    // Assert
    const summary = screen.getByRole('alert');
    expect(document.activeElement).toBe(summary);
    expect(screen.getByRole('heading', { name: 'Det er 2 problem du må rette' })).toBeTruthy();
    expect(summary.getAttribute('aria-labelledby')).toBe(screen.getByRole('heading').id);
  });

  it('[UD-013] each link moves focus to its field, which names its message', () => {
    // Arrange
    render(<Form />);
    const link = screen.getByRole('link', { name: /Bilete utan alt-tekst/ });
    // Act
    fireEvent.click(link);
    // Assert
    const field = screen.getByLabelText('Grunngjeving 1');
    expect(document.activeElement).toBe(field);
    expect(link.getAttribute('href')).toBe('#reason-0');
    expect(field.getAttribute('aria-describedby')).toBe('reason-0-error');
  });

  it('[UD-013] uses the singular and the page language for one problem', () => {
    render(
      <LocaleProvider locale="en">
        <ErrorSummary errors={[{ fieldId: 'x', message: 'Write a reason.' }]} />
      </LocaleProvider>,
    );
    expect(screen.getByRole('heading', { name: 'There is 1 problem to fix' })).toBeTruthy();
  });
});
