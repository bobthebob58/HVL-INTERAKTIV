/**
 * Component tests for Tabs: the WAI-ARIA tabs pattern with one tab stop, arrow keys, Home and End, manual activation,
 * and panels that stay mounted once shown.
 *
 * Spec: UD-006, LTI-006
 */
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Tabs, type TabItem } from '../../src/components/Tabs';

const TABS: TabItem[] = [
  { id: 'play', label: 'Spel', panel: <p>Spelaren</p> },
  { id: 'edit', label: 'Rediger', panel: <input aria-label="Tittel" /> },
  { id: 'check', label: 'Sjekk og publiser', panel: <p>Funna</p> },
];

const Harness = ({ manual = false }: { readonly manual?: boolean }) => {
  const [selected, setSelected] = useState('play');
  return (
    <Tabs
      label="Aktiviteten"
      tabs={TABS}
      selectedId={selected}
      onSelect={setSelected}
      manualActivation={manual}
    />
  );
};

describe('[UD-006] tabs follow the WAI-ARIA tabs pattern', () => {
  it('[UD-006] names the tab list, marks the selected tab and links each tab to its panel', () => {
    // Act
    render(<Harness />);
    // Assert
    expect(screen.getByRole('tablist', { name: 'Aktiviteten' })).toBeTruthy();
    const play = screen.getByRole('tab', { name: 'Spel' });
    expect(play.getAttribute('aria-selected')).toBe('true');
    expect(play.tabIndex).toBe(0);
    expect(screen.getByRole('tab', { name: 'Rediger' }).tabIndex).toBe(-1);
    const panel = screen.getByRole('tabpanel', { name: 'Spel' });
    expect(play.getAttribute('aria-controls')).toBe(panel.id);
  });

  it('[UD-006] arrow keys, Home and End move between tabs and select them', () => {
    // Arrange
    render(<Harness />);
    const play = screen.getByRole('tab', { name: 'Spel' });
    play.focus();
    // Act and assert
    fireEvent.keyDown(play, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Rediger' }));
    expect(screen.getByRole('tab', { name: 'Rediger' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Sjekk og publiser' }));
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(play);
    fireEvent.keyDown(play, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Sjekk og publiser' }));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Home' });
    expect(document.activeElement).toBe(play);
  });

  it('[UD-006] with manual activation the arrows move focus and Enter (a click) selects', () => {
    // Arrange
    render(<Harness manual />);
    const play = screen.getByRole('tab', { name: 'Spel' });
    play.focus();
    // Act
    fireEvent.keyDown(play, { key: 'ArrowRight' });
    // Assert
    const edit = screen.getByRole('tab', { name: 'Rediger' });
    expect(document.activeElement).toBe(edit);
    expect(edit.getAttribute('aria-selected')).toBe('false');
    expect(edit.tabIndex).toBe(0);
    fireEvent.click(edit);
    expect(edit.getAttribute('aria-selected')).toBe('true');
  });

  it('[LTI-006] a panel mounts when first shown and stays mounted, so an editor keeps unsaved work', () => {
    // Arrange
    render(<Harness />);
    expect(screen.queryByLabelText('Tittel')).toBeNull();
    // Act
    fireEvent.click(screen.getByRole('tab', { name: 'Rediger' }));
    fireEvent.change(screen.getByLabelText('Tittel'), { target: { value: 'Ulagra' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Spel' }));
    // Assert
    const input = screen.getByLabelText<HTMLInputElement>('Tittel');
    expect(input.value).toBe('Ulagra');
    expect(input.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(true);
  });
});
