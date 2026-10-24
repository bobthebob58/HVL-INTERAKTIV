/**
 * Tests for the status-region text that is announced every time: the same message twice in a row changes the
 * region's text (by an invisible no-break space), and a new message is shown as it is.
 *
 * Spec: UD-006, PROD-003
 */
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NO_BREAK_SPACE, useAnnouncement } from '../../src/components/useAnnouncement';

describe('[UD-006] a status message that is heard every time', () => {
  it('[UD-006] the same message twice changes the region, with the same visible words', () => {
    // Arrange
    const { result } = renderHook(() => useAnnouncement());
    const texts: string[] = [];
    // Act
    for (const message of ['Lagra.', 'Lagra.', 'Lagra.', 'Publisert.']) {
      act(() => result.current[1](message));
      texts.push(result.current[0]);
    }
    // Assert
    expect(texts).toEqual(['Lagra.', `Lagra.${NO_BREAK_SPACE}`, 'Lagra.', `Publisert.${NO_BREAK_SPACE}`]);
    expect(new Set(texts.slice(0, 3)).size).toBe(2);
    expect(texts.map((text) => text.trim())).toEqual(['Lagra.', 'Lagra.', 'Lagra.', 'Publisert.']);
  });
});
