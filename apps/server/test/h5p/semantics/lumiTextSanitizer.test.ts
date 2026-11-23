/**
 * Unit tests of the one definition of safe text (D-140): a text field with a `tags` list is sanitised as Lumi
 * sanitises it, a field without one is plain text, what the editor sends for a plain field is kept, a text past
 * its field's length is cut whole, and Lumi's `regexp` check still has the last word.
 *
 * Spec: SEC-008
 */
import { LibraryManager, fsImplementations } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { afterAll, describe, expect, it } from 'vitest';
import { SemanticsEnforcer } from '../../../src/h5p/lumiInternals.js';
import { LumiTextSanitizer, isPlainTextField } from '../../../src/h5p/semantics/lumiTextSanitizer.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';

afterAll(removeSyntheticLibraryDirs);

const manager = new LibraryManager(
  new fsImplementations.FileLibraryStorage(syntheticLibraryDir([{ machineName: 'H5P.Any', runnable: true }])),
);
const text = new LumiTextSanitizer(manager);
const field = (more: Record<string, unknown> = {}) =>
  ({ name: 'label', type: 'text', ...more }) as unknown as ISemanticsEntry;
/** What Lumi's enforcer alone makes of a text field's value. */
const lumiAlone = (semantics: ISemanticsEntry, value: string): unknown => {
  const holder: Record<string, unknown> = {};
  (
    new SemanticsEnforcer(manager) as unknown as {
      enforceTextSemantics(s: ISemanticsEntry, v: string, p: Record<string, unknown>, path: string): void;
    }
  ).enforceTextSemantics(semantics, value, holder, '$');
  return holder[semantics.name];
};
const MARKED_UP =
  'Les <a href="https://example.org/" target="_blank">her</a><table><tr><td>celle</td></tr></table><h2>No</h2>';

describe('[SEC-008] the rule for one text value', () => {
  it('[SEC-008] a text field without a tag list is plain text: links, tables and headings go, the words stay', () => {
    // Arrange: UPSTREAM — Lumi's rule alone keeps the link, the table and the heading in such a field
    expect(lumiAlone(field(), MARKED_UP)).toMatch(/<a href=.*<table>.*<h2>/);
    // Act
    const clean = text.sanitizeText(field(), MARKED_UP);
    // Assert
    expect(clean).toBe('Les hercelleNo');
    expect(isPlainTextField(field())).toBe(true);
    expect(isPlainTextField(field({ tags: [] }))).toBe(false);
    expect(isPlainTextField({ ...field(), type: 'number' } as ISemanticsEntry)).toBe(false);
  });

  it('[SEC-008] a text field with a tag list keeps exactly those tags, as Lumi sanitises it', () => {
    const rich = field({ tags: ['strong', 'a'] });
    const value =
      '<strong>Les</strong> <a href="https://hvl.no/" onclick="x()">her</a><em>no</em><script>x()</script>';
    expect(text.sanitizeText(rich, value)).toBe('<strong>Les</strong> <a href="https://hvl.no/">her</a>no');
    expect(text.sanitizeText(rich, value)).toBe(lumiAlone(rich, value));
    // WHY: an empty list still means markup: H5P always allows div, span, p and br in such a field.
    expect(text.sanitizeText(field({ tags: [] }), '<p>Hei</p><a href="/x">x</a>')).toBe('<p>Hei</p>x');
  });

  it('[H5P-006] what the editor sends for a plain field is kept: a typed "<", "&" and quotes', () => {
    // Arrange: H5P's editor writes a plain field with `&lt;`, `&amp;`, `&quot;` and `&#039;`
    const sent = '2 &lt; 3 &amp; &quot;ja&quot; Ola&#039;s &lt;b&gt;';
    // Act + Assert: a quote is stored plain, as before; the typed tag stays text
    expect(text.sanitizeText(field(), sent)).toBe('2 &lt; 3 &amp; "ja" Ola\'s &lt;b&gt;');
    expect(text.sanitizeText(field(), 'Kva er 2 + 2?')).toBe('Kva er 2 + 2?');
    expect(text.sanitizeText(field(), 42)).toBe('');
  });

  it('[SEC-008] a text past its field length is cut to it and ends whole, with and without a tag list', () => {
    // Arrange: UPSTREAM — Lumi's fixed cut ends inside the reference and inside the tag
    const [plain, rich] = [field({ maxLength: 7 }), field({ tags: ['a'], maxLength: 20 })];
    const link = '<a href="https://hvl.no/">Les meir</a>';
    expect(lumiAlone(plain, 'Ola & Kari')).toBe('Ola &am');
    expect(lumiAlone(rich, link)).toBe('<a href="https://hvl');
    // Act + Assert
    expect(text.sanitizeText(plain, 'Ola & Kari')).toBe('Ola ');
    expect(text.sanitizeText(rich, link)).toBe('Les meir');
    expect(text.sanitizeText(field({ tags: ['a'], maxLength: 50 }), link)).toBe(link);
  });

  it('[SEC-008] at every length the stored text is within it and is not changed by a second save', () => {
    // Arrange: text with a reference, markup, a character outside the basic plane and quotes
    const value = 'Ola & Kari <b>feit</b> 😀 "sitat" <a href="https://hvl.no/?a=1&b=2">lenke</a> slutt';
    for (const tags of [undefined, ['a', 'strong']]) {
      for (let max = 1; max <= 90; max += 1) {
        const semantics = field({ maxLength: max, ...(tags ? { tags } : {}) });
        // Act
        const stored = text.sanitizeText(semantics, value);
        // Assert
        expect(stored.length).toBeLessThanOrEqual(max);
        expect(text.sanitizeText(semantics, stored)).toBe(stored);
        expect(lumiAlone(semantics, stored)).toBe(stored);
        expect(stored.isWellFormed()).toBe(true);
      }
    }
  });

  it('[H5P-002] the regexp of an optional field still empties a text that does not match it', () => {
    const digits = field({ optional: true, regexp: { pattern: '^[0-9]+$' } });
    expect(text.sanitizeText(digits, '2026')).toBe('2026');
    expect(text.sanitizeText(digits, 'tjue')).toBe('');
  });
});
