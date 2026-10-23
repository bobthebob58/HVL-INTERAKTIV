/**
 * Tests for filling example parameters with a library's Nynorsk semantic defaults, as the H5P editor does.
 *
 * Spec: H5P-003, H5P-008
 */
import { describe, expect, it } from 'vitest';
import { defaultsOf, mergeOver, translateSemantics, withDefaults } from '../semanticDefaults.mjs';

const SEMANTICS = [
  { name: 'question', type: 'text' },
  {
    name: 'feedback',
    type: 'group',
    fields: [{ name: 'list', type: 'list', field: { name: 'f', type: 'text' } }],
  },
  {
    name: 'UI',
    type: 'group',
    fields: [
      { name: 'check', type: 'text', default: 'Check' },
      { name: 'retry', type: 'text', default: 'Retry' },
    ],
  },
  { name: 'behaviour', type: 'group', fields: [{ name: 'enableRetry', type: 'boolean', default: true }] },
];

describe('[H5P-003] semantic defaults for example content', () => {
  it('[H5P-008] the Nynorsk translation replaces defaults; untranslated defaults stay', () => {
    const translated = translateSemantics(SEMANTICS, [{}, {}, { fields: [{ default: 'Sjekk' }] }]);
    expect(defaultsOf(translated)).toEqual({ UI: { check: 'Sjekk', retry: 'Retry' }, behaviour: true });
  });

  it('[H5P-003] only fields with a default get a value, and a one-field group stores that value directly', () => {
    expect(defaultsOf(SEMANTICS)).toEqual({ UI: { check: 'Check', retry: 'Retry' }, behaviour: true });
  });

  it('[H5P-003] given values win: objects merge, arrays and scalars replace', () => {
    expect(mergeOver({ a: { b: 1, c: 2 }, l: [1, 2], s: 'x' }, { a: { b: 3 }, l: [9], s: 'y' })).toEqual({
      a: { b: 3, c: 2 },
      l: [9],
      s: 'y',
    });
    expect(mergeOver({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it('[H5P-003] sub-content gets its own library defaults, at any depth', () => {
    // Arrange
    const defaults = {
      'H5P.Column 1.18': { label: 'Kolonne' },
      'H5P.Text 1.1': { size: 'm' },
    };
    const params = { content: [{ content: { library: 'H5P.Text 1.1', params: { text: 'Hei' } } }] };
    // Act
    const filled = withDefaults(params, (lib) => defaults[lib] ?? {}, 'H5P.Column 1.18');
    // Assert
    expect(filled).toEqual({
      label: 'Kolonne',
      content: [{ content: { library: 'H5P.Text 1.1', params: { size: 'm', text: 'Hei' } } }],
    });
  });
});
