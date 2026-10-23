/**
 * lumiTextSanitizer — applies Lumi's own text rules to values Lumi itself skips: list items and titles.
 *
 * Why: CVE-2025-47828 was fixed in Lumi by sanitising text fields on save, but its scanner never reaches text
 *      that is a list item (D-039), and content metadata is not sanitised at all. H5P Core's "Rights of use"
 *      dialog builds HTML from metadata without escaping (h5p.js `buildMetadataCopyrights`, `MediaCopyright`),
 *      with `source` inside `<a href="…">`. Reusing Lumi's rules keeps one definition of "safe text" (allowed
 *      tags from the semantics, sanitize-html defaults for plain text).
 * Spec: SEC-008
 * Invariants:
 *   - Values are sanitised exactly as Lumi sanitises a text field with the same semantics.
 *   - Every string in a metadata object (main or sub-content, also inside `authors` and `changes`) is plain
 *     text: tags are removed, `<`, `>` and `&` escaped.
 *   - A top-level field that was only markup is removed (Lumi's schema refuses empty strings).
 *   - `source` is kept only as an http(s) URL in its normalised form (quotes and angle brackets
 *     percent-encoded, so it cannot leave the `href` attribute); anything else is removed.
 * Collaborators: ./SubContentPolicy.ts, ../lumiInternals.ts (Lumi's SemanticsEnforcer).
 * Tests: apps/server/test/h5p/semantics/SubContentPolicy.test.ts
 */
import type { LibraryManager } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { SemanticsEnforcer } from '../lumiInternals.js';

/** The private Lumi method we call (SemanticsEnforcer.enforceTextSemantics). */
interface TextEnforcer {
  enforceTextSemantics(
    semantics: ISemanticsEntry,
    text: unknown,
    parent: Record<string, unknown>,
    path: string,
  ): void;
}

/** Nesting limit for metadata (h5p.json is flat apart from `authors` and `changes`). */
const MAX_METADATA_DEPTH = 8;

/**
 * The `source` URL in a form that cannot leave a double-quoted attribute, or undefined.
 * @param value - The author's value.
 * @returns The normalised http(s) URL, or undefined for anything else.
 */
export function safeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value.trim());
    // SECURITY: WHATWG serialisation percent-encodes `"`, `<`, `>` and spaces; only web links are kept.
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Sanitises text values with Lumi's text rules. */
export class LumiTextSanitizer {
  private readonly enforcer: TextEnforcer;

  /**
   * @param libraryManager - Lumi's library manager (needed by its SemanticsEnforcer's constructor).
   */
  constructor(libraryManager: LibraryManager) {
    // UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/SemanticsEnforcer.ts
    // keeps enforceTextSemantics private in the typings, but it is the CVE-2025-47828 fix we reuse. Remove the
    // cast when Lumi exports it; if a Lumi upgrade drops the method, SubContentPolicy.test.ts fails.
    this.enforcer = new SemanticsEnforcer(libraryManager) as unknown as TextEnforcer;
  }

  /**
   * Sanitises one text value as Lumi would sanitise a text field with these semantics.
   * @param semantics - The text field's semantics (its `tags` decide which HTML is allowed).
   * @param value - The value; anything but a string becomes an empty string.
   * @returns The sanitised text.
   */
  sanitizeText(semantics: ISemanticsEntry, value: unknown): string {
    const holder: Record<string, unknown> = {};
    this.enforcer.enforceTextSemantics(semantics, typeof value === 'string' ? value : '', holder, '$');
    const result = holder[semantics.name];
    return typeof result === 'string' ? result : '';
  }

  /**
   * Sanitises a metadata object (h5p.json or a sub-content's `metadata`) in place: every string becomes plain
   * text, and `source` is kept only as a safe web link.
   * @param metadata - The metadata object.
   */
  sanitizeMetadata(metadata: unknown): void {
    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return;
    const record = metadata as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (key !== 'source') {
        record[key] = this.plainText(value, key, 1);
        // WHY: Lumi's schema wants 1+ characters; a field that was only markup is left out instead.
        if (record[key] === '' && value !== '') delete record[key];
        continue;
      }
      const source = safeSourceUrl(value);
      if (source === undefined) delete record[key];
      else record[key] = source;
    }
  }

  private plainText(value: unknown, name: string, depth: number): unknown {
    if (typeof value === 'string') return this.sanitizeText({ name, type: 'text' }, value);
    if (typeof value !== 'object' || value === null || depth >= MAX_METADATA_DEPTH) return value;
    if (Array.isArray(value)) return value.map((item) => this.plainText(item, name, depth + 1));
    const record = value as Record<string, unknown>;
    for (const [key, item] of Object.entries(record)) record[key] = this.plainText(item, key, depth + 1);
    return record;
  }
}
