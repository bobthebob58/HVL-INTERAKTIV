/**
 * FileLink — a link to a file that tells its type and size before anyone opens it, e.g. "Rettleiing (PDF, 1,2 MB)".
 *
 * Why: UD-007 asks file links to show type and size, so nobody downloads a large file or an unexpected format
 *      by surprise. The details are visible text, so everyone gets them, not only screen-reader users.
 * Spec: UD-007
 * Invariants:
 *   - Sizes use 1000-based units with one decimal, in the page language's number format.
 *   - The type is shown in capitals as given (`PDF`, `DOCX`); it is an abbreviation, not styled text.
 * Collaborators: ../i18n/translate.ts, ../i18n/formatDate.ts (`INTL_LOCALE`).
 * Tests: apps/web/test/components/FileLink.test.tsx
 */
import type { ReactNode } from 'react';
import { INTL_LOCALE } from '../i18n/formatDate';
import { t, type Locale, type MessageKey } from '../i18n/translate';

/** What the link needs. */
export interface FileLinkProps {
  readonly href: string;
  readonly locale: Locale;
  readonly children: ReactNode;
  /** The file type as people know it, e.g. `PDF`. */
  readonly type: string;
  /** The file size in bytes. */
  readonly bytes: number;
}

const UNITS: readonly (readonly [number, MessageKey])[] = [
  [1e9, 'fileSize.gigabytes'],
  [1e6, 'fileSize.megabytes'],
  [1e3, 'fileSize.kilobytes'],
];

/**
 * Writes a file size for people.
 * @param bytes - The size in bytes.
 * @param locale - The page locale.
 * @returns For example `1,2 MB` in Nynorsk or `1.2 MB` in English.
 */
export function formatFileSize(bytes: number, locale: Locale): string {
  const number = (value: number) =>
    new Intl.NumberFormat([...INTL_LOCALE[locale]], { maximumFractionDigits: 1 }).format(value);
  const unit = UNITS.find(([size]) => bytes >= size);
  if (unit) return t(unit[1], locale, { value: number(bytes / unit[0]) });
  return t('fileSize.bytes', locale, { value: number(Math.max(0, Math.round(bytes))) });
}

/**
 * A link to a file with its type and size.
 * @param props - Address, locale, text, type and size.
 * @returns The link.
 */
export function FileLink({ href, locale, children, type, bytes }: FileLinkProps) {
  const details = t('link.fileDetails', locale, { type, size: formatFileSize(bytes, locale) });
  return (
    <a href={href}>
      {children} <span>({details})</span>
    </a>
  );
}
