/**
 * Tests for focus that waits for the commit that renders the request: it runs once the state updated in the same step
 * is on screen, also when a newer state replaced that update before it rendered or the state did not change, a newer
 * request replaces an older one, and each request runs once, also when React runs the effect again.
 *
 * Spec: UD-006, PROD-007
 */
// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { Activity, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useFocusAfterChange, type FocusAfterChange } from '../../src/components/useFocusAfterChange';

type Shown = 'list' | 'left' | 'listed';

/** What a test drives: the section's state setter and the hook's request, as a section uses them. */
interface Driver {
  show: (next: Shown) => void;
  focusAfter: FocusAfterChange;
  /** Focuses the message shown for 'left', if it is on screen. */
  focusMessage: () => void;
  /** Hides the section in an `<Activity>` and shows it again, so React destroys its effects and runs them again. */
  hideAndShow: () => void;
}

/**
 * A section in miniature: a button for 'list', a message for 'left' (the target that exists only after the change).
 * @returns The driver, filled in on each render.
 */
function renderSection(): Driver {
  const driver = {} as Driver;
  function Section() {
    const [shown, setShown] = useState<Shown>('list');
    const message = useRef<HTMLParagraphElement>(null);
    Object.assign(driver, {
      show: setShown,
      focusAfter: useFocusAfterChange(),
      focusMessage: () => message.current?.focus(),
    });
    if (shown === 'list') return <button type="button">Fjern meg</button>;
    return (
      <p ref={message} tabIndex={-1}>
        {shown}
      </p>
    );
  }
  const ui = (mode: 'visible' | 'hidden') => (
    <Activity mode={mode}>
      <Section />
    </Activity>
  );
  const { rerender } = render(ui('visible'));
  driver.hideAndShow = () => {
    rerender(ui('hidden'));
    rerender(ui('visible'));
  };
  return driver;
}

describe('[UD-006] focus once the change has rendered', () => {
  it('[UD-006] runs the focus after the commit that renders the request with the change, not before', () => {
    // Arrange
    const section = renderSection();
    const focus = vi.fn(() => section.focusMessage());
    // Act
    act(() => {
      section.focusAfter(focus);
      section.show('left');
      expect(focus).not.toHaveBeenCalled();
    });
    // Assert
    // WHY: focusing works only if the message existed when the focus ran.
    expect(focus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByText('left'));
  });

  it('[UD-006] a newer state that replaces the change before it renders does not drop the request', () => {
    // Arrange
    const section = renderSection();
    const focus = vi.fn(() => section.focusMessage());
    // Act
    // WHY: the change's answer and a newer answer (a re-read) are handled before React renders either.
    act(() => {
      section.focusAfter(focus);
      section.show('left');
      section.show('listed');
    });
    // Assert
    expect(focus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByText('listed'));
  });

  it('[UD-006] runs also when the answer equals what is shown already', () => {
    // Arrange
    const section = renderSection();
    const focus = vi.fn();
    // Act
    act(() => {
      section.focusAfter(focus);
      section.show('list');
    });
    // Assert
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('[UD-006] a newer request asked for before the older one rendered replaces it', () => {
    // Arrange
    const section = renderSection();
    const older = vi.fn();
    const newer = vi.fn();
    // Act
    act(() => {
      section.focusAfter(older);
      section.focusAfter(newer);
      section.show('left');
    });
    // Assert
    expect(older).not.toHaveBeenCalled();
    expect(newer).toHaveBeenCalledTimes(1);
  });

  it('[UD-006] each request runs once, whatever renders after it; the request function stays the same', () => {
    // Arrange
    const section = renderSection();
    const first = section.focusAfter;
    const focus = vi.fn();
    act(() => {
      section.focusAfter(focus);
      section.show('left');
    });
    // Act
    act(() => section.show('listed'));
    act(() => section.show('list'));
    act(() => section.show('left'));
    // Assert
    expect(focus).toHaveBeenCalledTimes(1);
    expect(section.focusAfter).toBe(first);
  });

  it('[UD-006] a request runs once, also when React runs the effect again for hidden content shown again', () => {
    // Arrange
    const section = renderSection();
    const focus = vi.fn(() => section.focusMessage());
    act(() => {
      section.focusAfter(focus);
      section.show('left');
    });
    // Act
    // WHY: the effect runs again with the same request, as after Fast Refresh in development.
    section.hideAndShow();
    // Assert
    expect(focus).toHaveBeenCalledTimes(1);
    expect(screen.getByText('left')).toBeTruthy();
  });
});
