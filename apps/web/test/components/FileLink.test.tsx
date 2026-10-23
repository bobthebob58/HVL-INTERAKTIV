/**
 * Component tests for FileLink: the file's type and size are visible next to the link text, in the page language's
 * number format.
 *
 * Spec: UD-007
 */
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FileLink, formatFileSize } from '../../src/components/FileLink';

describe('[UD-007] file links show type and size', () => {
  it('[UD-007] shows "PDF, 1,2 MB" with the link text in Nynorsk', () => {
    render(
      <FileLink href="/filer/rettleiing.pdf" locale="nn" type="PDF" bytes={1_200_000}>
        Rettleiing
      </FileLink>,
    );
    expect(screen.getByRole('link').textContent).toBe('Rettleiing (PDF, 1,2 MB)');
  });

  it.each([
    [512, 'en', '512 B'],
    [1_500, 'en', '1.5 kB'],
    [1_200_000, 'en', '1.2 MB'],
    [3_000_000_000, 'nb', '3 GB'],
    [1_250_000, 'nn', '1,3 MB'],
  ] as const)('[UD-007] writes %i bytes in %s as %s', (bytes, locale, text) => {
    expect(formatFileSize(bytes, locale)).toBe(text);
  });
});
