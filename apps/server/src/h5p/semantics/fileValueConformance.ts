/**
 * fileValueConformance — what a file, image, video or audio value in H5P content parameters may hold: the keys
 * H5P's editor writes for it, each with the type it has there.
 *
 * Why: a file value is an object the player and the editor read key by key (`path`, `mime`, the size, a video's
 *      quality). H5P's own server software keeps only those keys and makes each a number or plain text; Lumi keeps
 *      whatever a save carries (D-123). This module lists the keys and fits their values, for ./semanticsConformance.ts.
 * Spec: SEC-008
 * Invariants:
 *   - Kept keys: `path`, `mime`, `copyright`; for an image also `width`, `height`, `originalImage`; for a video
 *     also `width`, `height`, `codecs`, `quality`, `bitrate`, `aspectRatio`; and the field's `extraAttributes`
 *     (InteractiveVideo's `metadata`). Every other key is listed for removal.
 *   - `mime` is a plain `type/subtype` token, `width`, `height` and `bitrate` finite numbers (a numeric string
 *     becomes a number), `codecs` and `aspectRatio` short plain tokens, `quality` an object with a numeric `level`
 *     and a plain-text `label`, `copyright` and an extra attribute plain objects, `originalImage` an image value without
 *     an `originalImage` of its own. A value that does not fit is listed for removal.
 *   - `path` is not judged here: ./paramsWalker.ts refuses a path that is no string, ./rightsOfUse.ts an unsafe one.
 *   - Nothing is changed here; the caller applies the fixes (./semanticsConformance.ts).
 * Collaborators: ./semanticsConformance.ts (the only caller), ./rightsOfUse.ts (cleans the text inside `copyright`
 *   and `metadata`).
 * Tests: apps/server/test/h5p/semantics/fileValueConformance.test.ts
 */
import { plainText } from './lumiTextSanitizer.js';

/** One change to make to a value: remove a key, or give it another value. */
export type ConformanceFix =
  | { readonly remove: string; readonly from: Record<string, unknown> }
  | { readonly set: string; readonly on: Record<string, unknown>; readonly to: unknown };

/** The kind of field a file value belongs to. */
export type FileKind = 'file' | 'image' | 'video' | 'audio';

const BASE_KEYS = ['path', 'mime', 'copyright'];
const KIND_KEYS: Record<FileKind, readonly string[]> = {
  file: [],
  audio: [],
  image: ['width', 'height', 'originalImage'],
  video: ['width', 'height', 'codecs', 'quality', 'bitrate', 'aspectRatio'],
};
const NUMBER_KEYS = new Set(['width', 'height', 'bitrate']);
/** A media type as RFC 6838 writes it, without parameters: `video/mp4`, `video/YouTube`, `image/svg+xml`. */
const MIME_TOKEN = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;
const CODECS_TOKEN = /^[a-z0-9][a-z0-9., +-]{0,99}$/i;
const ASPECT_RATIO = /^\d{1,4}:\d{1,4}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A finite number from a stored value.
 * @param value - A number, or a string that holds one.
 * @returns The number, or undefined when the value is neither.
 */
export function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** The fix that makes a key a finite number, or removes it. */
function numberFix(object: Record<string, unknown>, key: string): ConformanceFix[] {
  const fitted = finiteNumber(object[key]);
  if (fitted === undefined) return [{ remove: key, from: object }];
  return fitted === object[key] ? [] : [{ set: key, on: object, to: fitted }];
}

/** The fixes for a video's `quality`: `{ level: number, label: text }` and nothing else. */
function qualityFixes(file: Record<string, unknown>): ConformanceFix[] {
  const quality = file.quality;
  if (!isObject(quality) || finiteNumber(quality.level) === undefined || typeof quality.label !== 'string') {
    return [{ remove: 'quality', from: file }];
  }
  const extra = Object.keys(quality).filter((key) => key !== 'level' && key !== 'label');
  const label = plainText(quality.label);
  return [
    ...extra.map((key) => ({ remove: key, from: quality })),
    ...numberFix(quality, 'level'),
    ...(label === quality.label ? [] : [{ set: 'label', on: quality, to: label }]),
  ];
}

/** Whether a kept key's value has the type the key has in H5P; numbers and `quality` are fitted apart. */
function fitsKey(key: string, value: unknown, kind: FileKind, nested: boolean): boolean {
  if (key === 'mime') return typeof value === 'string' && MIME_TOKEN.test(value);
  if (key === 'codecs') return typeof value === 'string' && CODECS_TOKEN.test(value);
  if (key === 'aspectRatio') return typeof value === 'string' && ASPECT_RATIO.test(value);
  if (key === 'originalImage') return kind === 'image' && !nested && isObject(value);
  // WHY: `copyright` and the extra attributes are objects of text, which ./rightsOfUse.ts cleans afterwards.
  return key === 'path' || isObject(value);
}

/**
 * The fixes that leave a file value with H5P's keys only, each of its type.
 * @param file - The file object (one source of a video or audio field, an image, a file).
 * @param kind - The field's type.
 * @param extraAttributes - Further keys the field's semantics allow.
 * @param nested - True for an image's `originalImage`, which holds none of its own.
 * @returns The fixes, in the order to apply them.
 */
export function fileValueFixes(
  file: Record<string, unknown>,
  kind: FileKind,
  extraAttributes: readonly string[] = [],
  nested = false,
): ConformanceFix[] {
  const kept = new Set([...BASE_KEYS, ...KIND_KEYS[kind], ...extraAttributes]);
  const fixes: ConformanceFix[] = [];
  for (const [key, value] of Object.entries(file)) {
    if (!kept.has(key)) fixes.push({ remove: key, from: file });
    else if (NUMBER_KEYS.has(key)) fixes.push(...numberFix(file, key));
    else if (key === 'quality') fixes.push(...qualityFixes(file));
    else if (!fitsKey(key, value, kind, nested)) fixes.push({ remove: key, from: file });
    else if (key === 'originalImage') {
      fixes.push(...fileValueFixes(value as Record<string, unknown>, 'image', [], true));
    }
  }
  return fixes;
}
