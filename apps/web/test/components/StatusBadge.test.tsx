/**
 * Component tests for StatusBadge: draft and published are told apart by a word and an icon, not colour alone.
 *
 * Spec: PROD-003, UD-003
 */
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STATUS_ICON, StatusBadge } from '../../src/components/StatusBadge';

describe('[UD-003] the status badge', () => {
  it.each([
    ['draft', 'nn', 'Utkast'],
    ['published', 'nn', 'Publisert'],
    ['draft', 'en', 'Draft'],
    ['published', 'en', 'Published'],
  ] as const)('[UD-003] shows %s in %s as the word "%s" with an icon', (status, locale, word) => {
    render(<StatusBadge status={status} locale={locale} />);
    const badge = screen.getByText(word, { exact: false });
    expect(badge.textContent).toBe(`${STATUS_ICON[status]} ${word}`);
    expect(screen.getByText(STATUS_ICON[status], { exact: false }).getAttribute('aria-hidden')).toBe('true');
  });
});
