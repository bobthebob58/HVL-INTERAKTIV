/**
 * Component tests for Dialog: a labelled modal dialog that takes focus, keeps Tab and Shift+Tab inside, makes the
 * page behind it inert, closes on Escape and returns focus to the element that opened it.
 *
 * Spec: UD-006, UD-004
 */
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Dialog } from '../../src/components/Dialog';

const Harness = () => {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="page">
      <button type="button" onClick={() => setOpen(true)}>
        Opne
      </button>
      <Dialog open={open} title="Publiser aktiviteten" onClose={() => setOpen(false)}>
        <label htmlFor="r">Grunngjeving</label>
        <textarea id="r" />
        <button type="button">Publiser no</button>
      </Dialog>
    </div>
  );
};

const open = () => {
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Opne' });
  opener.focus();
  fireEvent.click(opener);
  return { opener, dialog: screen.getByRole('dialog', { name: 'Publiser aktiviteten' }) };
};

describe('[UD-006] the modal dialog', () => {
  it('[UD-006] is a labelled modal that takes focus and makes the page behind it inert', () => {
    // Act
    const { dialog } = open();
    // Assert
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);
    expect(screen.getByTestId('page').closest('[inert]')).not.toBeNull();
    expect(dialog.closest('[inert]')).toBeNull();
  });

  it('[UD-006] Tab from the last control wraps to the first, Shift+Tab from the first wraps to the last', () => {
    // Arrange
    const { dialog } = open();
    const close = screen.getByRole('button', { name: 'Lukk' });
    const last = screen.getByRole('button', { name: 'Publiser no' });
    last.focus();
    // Act and assert
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('[UD-006] Escape closes it, the page is reachable again and focus returns to the opener', () => {
    // Arrange
    const { dialog, opener } = open();
    // Act
    fireEvent.keyDown(dialog, { key: 'Escape' });
    // Assert
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[inert]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('[UD-006] the close button closes it too', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Lukk' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
