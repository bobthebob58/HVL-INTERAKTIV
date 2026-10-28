/**
 * Tests for filling a pattern skeleton with each library's localised semantics defaults, as H5P's editor does, with
 * semantics and language files read through a stand-in for Lumi's library manager.
 *
 * Spec: PED-010
 */
import { describe, expect, it } from 'vitest';
import {
  extendDeep,
  translateSemantics,
  withSemanticDefaults,
} from '../../../src/learningDesign/patterns/semanticDefaults.js';
import { librarySource, SUB } from './semanticDefaultsLibraries.js';

const counter = () => {
  let n = 0;
  return () => `id-${++n}`;
};
const SUB_UI_NN = { submit: 'Send inn', more: 'More' };

describe('[PED-010] semantics defaults for pattern skeletons', () => {
  it('[PED-010] a field gets its Nynorsk default only where it has no value: in groups, list items and sub-content', async () => {
    // Arrange
    const params = {
      items: [{ label: 'Mitt' }, {}],
      task: { library: 'H5P.Sub 1.0', params: { question: 'Q' } },
    };
    // Act
    const filled = await withSemanticDefaults(params, 'H5P.Main 1.0', librarySource(), 'nn');
    // Assert
    expect(filled).toEqual({
      title: 'Tittel',
      items: [
        { label: 'Mitt', done: false },
        { label: 'Item', done: false },
      ],
      task: { library: 'H5P.Sub 1.0', params: { question: 'Q', UI: SUB_UI_NN } },
      // WHY: sub-content that a semantics default adds gets its own library's defaults too.
      summary: { library: 'H5P.Sub 1.0', params: { UI: SUB_UI_NN } },
      l10n: { check: 'Sjekk', retry: 'Retry' },
    });
  });

  it('[PED-010] a group of one field holds that value; a sub-content group stays an object and gets an ID', async () => {
    // Arrange
    const params = { feedback: [{}], statements: [{ text: 'A' }, { text: 'B', subContentId: 'kept' }] };
    // Act
    const filled = await withSemanticDefaults(params, 'H5P.Main 1.0', librarySource(), 'nn', counter());
    // Assert
    expect(filled.feedback).toEqual([{ from: 0, to: 100 }]);
    expect(filled.statements).toEqual([
      { text: 'A', subContentId: 'id-1' },
      { text: 'B', subContentId: 'kept' },
    ]);
  });

  it('[PED-010] given values win, unknown keys stay, lists are never lengthened, and empty entries are left alone', async () => {
    // Arrange
    const task = { library: 'H5P.Sub 1.0', params: {}, metadata: { title: 'T' }, subContentId: 's' };
    const params = {
      title: '',
      items: [],
      extra: { x: 1 },
      task,
      summary: {},
      l10n: { check: 'Kontroller' },
    };
    // Act
    const filled = await withSemanticDefaults(params, 'H5P.Main 1.0', librarySource(), 'nn');
    // Assert
    expect(filled).toEqual({
      ...params,
      task: { ...task, params: { UI: SUB_UI_NN } },
      l10n: { check: 'Kontroller', retry: 'Retry' },
    });
  });

  it('[PED-010] the result shares no object with the input or the semantics', async () => {
    // Arrange
    const source = librarySource();
    const params = Object.freeze({ items: Object.freeze([Object.freeze({ label: 'Mitt' })]) });
    // Act
    const first = await withSemanticDefaults(params, 'H5P.Main 1.0', source, 'nn');
    (first.summary as { params: { UI: { submit: string } } }).params.UI.submit = 'changed';
    (first.items as { label: string }[])[0]!.label = 'changed';
    const second = await withSemanticDefaults(params, 'H5P.Main 1.0', source, 'nn');
    // Assert
    expect(second.summary).toEqual({ library: 'H5P.Sub 1.0', params: { UI: SUB_UI_NN } });
    expect(params.items[0]?.label).toBe('Mitt');
  });

  it("[PED-010] each library is read once, in the activity's language; without a language file the English defaults stay", async () => {
    // Arrange
    const source = librarySource();
    const two = {
      task: { library: 'H5P.Sub 1.0', params: {} },
      summary: { library: 'H5P.Sub 1.0', params: {} },
    };
    // Act
    await withSemanticDefaults(two, 'H5P.Main 1.0', source, 'nn');
    const bokmaal = await withSemanticDefaults({}, 'H5P.Main 1.0', librarySource(), 'nb');
    // Assert
    expect(source.calls).toEqual([
      'semantics H5P.Main 1.0',
      'language H5P.Main 1.0 nn',
      'semantics H5P.Sub 1.0',
      'language H5P.Sub 1.0 nn',
    ]);
    expect([bokmaal.title, bokmaal.l10n]).toEqual(['Title', { check: 'Check', retry: 'Retry' }]);
  });

  it('[PED-010] a library that is not installed, or a malformed library name, rejects', async () => {
    const missingSub = { task: { library: 'H5P.Missing 1.0', params: {} } };
    await expect(withSemanticDefaults({}, 'H5P.Missing 1.0', librarySource(), 'nn')).rejects.toThrow(
      'not installed',
    );
    await expect(withSemanticDefaults(missingSub, 'H5P.Main 1.0', librarySource(), 'nn')).rejects.toThrow(
      'not installed',
    );
    await expect(withSemanticDefaults({}, 'H5P.Main', librarySource(), 'nn')).rejects.toThrow();
  });

  it("[PED-010] a translation merges by index and key, as jQuery's deep extend, and leaves its inputs unchanged", () => {
    // Arrange
    const target = [{ a: 1, b: [1, 2] }];
    const source = [{ b: [9] }, { c: 3, d: undefined }];
    // Act
    const merged = extendDeep(target, source);
    // Assert
    expect(merged).toEqual([{ a: 1, b: [9, 2] }, { c: 3 }]);
    expect(target).toEqual([{ a: 1, b: [1, 2] }]);
    expect(translateSemantics(SUB, undefined)).toEqual(SUB);
  });

  it("[PED-010] a language file cannot write to an object's prototype", () => {
    // Arrange
    const hostile = JSON.parse(
      '[{"__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}}]',
    );
    // Act
    const translated = translateSemantics(SUB, hostile);
    // Assert
    expect(translated).toEqual(SUB);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});
