/**
 * Tests for the report's table cells: text from a result file or the upstream register stays inside its cell.
 *
 * Spec: UD-040
 */
import { describe, expect, it } from 'vitest';
import { resultsList } from '../renderSections.mjs';

describe('[UD-040] table cells of the accessibility report', () => {
  it('[UD-040] keeps a cell whole when its text holds `|` or a backslash, also a backslash before a `|`', () => {
    // Arrange: a set-up text that ends its cell early unless both characters are escaped
    const files = [{ file: 'a.md', date: '2026-11-27', release: 'v1 | v2', setUp: 'C:\\at\\|nvda' }];
    // Act
    const [, , row] = resultsList(files).split('\n');
    // Assert
    expect(row).toBe('| 2026-11-27 | v1 \\| v2 | C:\\\\at\\\\\\|nvda | [a.md](results/a.md) |');
  });

  it('[UD-040] writes a line break in a cell as a space, so the row stays one line', () => {
    expect(resultsList([{ file: 'a.md', setUp: 'NVDA\nFirefox' }]).split('\n')[2]).toBe(
      '| — | — | NVDA Firefox | [a.md](results/a.md) |',
    );
  });
});
