/**
 * lumiTextSanitizer — applies Lumi's own text rules to values Lumi itself skips: list items and titles.
 *
 * Why: CVE-2025-47828 was fixed in Lumi by sanitising text fields on save, but its scanner never reaches text
 *      that is a list item (D-039), and content titles are not sanitised at all. Reusing Lumi's rules keeps one
 *      definition of "safe text" (allowed tags from the semantics, sanitize-html defaults for plain text).
 * Spec: SEC-008
 * Invariants:
 *   - Values are sanitised exactly as Lumi sanitises a text field with the same semantics.
 *   - Titles (main and sub-content metadata) are treated as plain text; URLs and dates are not touched.
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

/** Metadata fields that hold free text shown to users (H5P metadata semantics). */
const METADATA_TEXT_FIELDS = ['title', 'extraTitle', 'a11yTitle', 'authorComments'] as const;

/** Sanitises text values with Lumi's text rules. */
export class LumiTextSanitizer {
  private readonly enforcer: TextEnforcer;

  /**
   * @param libraryManager - Lumi's library manager (needed by its SemanticsEnforcer's constructor).
   */
  constructor(libraryManager: LibraryManager) {
    // UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/SemanticsEnforcer.ts
    // keeps enforceTextSemantics private in the typings, but it is the CVE-2025-47828 fix we reuse.
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
   * Sanitises the free-text fields of a metadata object (h5p.json or a sub-content's `metadata`) in place.
   * @param metadata - The metadata object; other fields are left alone.
   */
  sanitizeMetadata(metadata: unknown): void {
    if (typeof metadata !== 'object' || metadata === null) return;
    const record = metadata as Record<string, unknown>;
    for (const field of METADATA_TEXT_FIELDS) {
      if (typeof record[field] === 'string')
        record[field] = this.sanitizeText({ name: field, type: 'text' }, record[field]);
    }
    for (const list of ['authors', 'changes'] as const) {
      const entries = record[list];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (typeof entry !== 'object' || entry === null) continue;
        const item = entry as Record<string, unknown>;
        for (const key of ['name', 'author', 'log']) {
          if (typeof item[key] === 'string')
            item[key] = this.sanitizeText({ name: key, type: 'text' }, item[key]);
        }
      }
    }
  }
}
