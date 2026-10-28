/**
 * safeCopyName — a file name for a duplicate's own copy of a file whose stored name Lumi would not copy.
 *
 * Why: an imported package may store names with spaces or æøå (`videos/klipp av hav æ.webm`). Lumi copies a paste
 *      source only when the name fits `^[\w\-./_]+$`, and leaves anything else pointing into the source, so the
 *      duplicator copies such a file itself (D-092 amendment). The new name must fit Lumi's pattern, so that a copy of
 *      the copy is again an ordinary paste, and must be a name the storage accepts.
 * Spec: PROD-007
 * Invariants:
 *   - The result uses only ASCII letters, digits, `_`, `-`, `.` and `/`; no segment is empty, `.` or `..`; it does not
 *     start with `/`. So it fits Lumi's pattern and `assertSafeObjectName`.
 *   - The folders are kept (cleaned); the base name gets `-<suffix>` before a cleaned extension, as Lumi names its
 *     own copies, and æ, ø and å become ae, o and a so the name stays readable.
 *   - The suffix uses Lumi's ID alphabet, so a later paste of the copy replaces it instead of stacking another.
 * Collaborators: ./ownFileCopies.ts (the caller).
 * Tests: apps/server/test/learningDesign/collaboration/safeCopyName.test.ts
 */
import { randomInt } from 'node:crypto';

// UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/helpers/FilenameGenerator.ts
// holds this alphabet; its "remove an earlier suffix" rule only recognises suffixes drawn from it. Keep it in step.
const LUMI_ID_ALPHABET = '1234567890abcdefghjiklmnoprstuvwxyABCDEFGHJIKLMNOPRSTUVWYXZ';
const NORWEGIAN: Readonly<Record<string, string>> = { æ: 'ae', ø: 'o', å: 'a', Æ: 'Ae', Ø: 'O', Å: 'A' };
const COMBINING_MARKS = /\p{M}/gu;

const safeSegment = (segment: string): string => {
  const latin = [...segment.normalize('NFC')].map((c) => NORWEGIAN[c] ?? c).join('');
  const ascii = latin.normalize('NFD').replace(COMBINING_MARKS, '');
  const cleaned = ascii
    .replace(/[^\w.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned === '' ? 'file' : cleaned;
};

/**
 * A random suffix as Lumi gives its copies.
 * @returns Eight characters from Lumi's ID alphabet.
 */
export const copySuffix = (): string =>
  Array.from({ length: 8 }, () => LUMI_ID_ALPHABET[randomInt(LUMI_ID_ALPHABET.length)]).join('');

/**
 * Builds a safe name for a copy of a stored file.
 * @param name - The source's stored name, e.g. `videos/klipp av hav æ.webm`.
 * @param suffix - The distinguishing suffix, e.g. from {@link copySuffix}.
 * @returns e.g. `videos/klipp-av-hav-ae-1a2B3c4D.webm`.
 */
export function safeCopyName(name: string, suffix: string): string {
  const segments = name.split('/');
  const base = segments.pop() ?? '';
  const folders = segments.filter((s) => s !== '').map(safeSegment);
  const dot = base.lastIndexOf('.');
  const extension = dot > 0 ? base.slice(dot + 1).replace(/[^A-Za-z0-9]/g, '') : '';
  const stem = safeSegment(dot > 0 ? base.slice(0, dot) : base);
  return [...folders, `${stem}-${safeSegment(suffix)}${extension ? `.${extension}` : ''}`].join('/');
}
