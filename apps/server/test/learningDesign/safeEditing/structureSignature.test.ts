/**
 * Unit tests for the structure signature: the pre-order walk, library names, the three kinds of library (with a
 * rule, stateless, stateful without a rule) and what is never compared.
 *
 * Spec: PROD-013
 */
import { describe, expect, it } from 'vitest';
import { structuralDifference } from '../../../src/learningDesign/safeEditing/structuralChange.js';
import { structureSignature } from '../../../src/learningDesign/safeEditing/structureSignature.js';

const text = (body: string, id = 't1') => ({
  library: 'H5P.AdvancedText 1.1',
  params: { text: body },
  subContentId: id,
  metadata: { title: 'Tekst' },
});
const trueFalse = (question: string, id = 'tf1') => ({
  library: 'H5P.TrueFalse 1.8',
  params: { question, correct: 'true' },
  subContentId: id,
});
const column = (...items: object[]) => ({
  content: items.map((content) => ({ content, useSeparator: 'auto' })),
});
const differs = (before: unknown, after: unknown, main = 'H5P.Column 1.22') =>
  structuralDifference(structureSignature(before, main), structureSignature(after, main));

describe('[PROD-013] structureSignature', () => {
  it('[PROD-013] lists the activity, then every node in pre-order with its path, library and subContentId', () => {
    // Arrange
    const params = column(text('<p>A</p>'), {
      ...trueFalse('Q'),
      params: { question: 'Q', media: text('B', 't2') },
    });
    // Act
    const nodes = structureSignature(params, 'H5P.Column-1.22.3').nodes.map(
      ({ path, library, subContentId }) => ({
        path,
        library,
        subContentId,
      }),
    );
    // Assert
    expect(nodes).toEqual([
      { path: '', library: 'H5P.Column 1.22', subContentId: null },
      { path: 'content[0].content', library: 'H5P.AdvancedText 1.1', subContentId: 't1' },
      { path: 'content[1].content', library: 'H5P.TrueFalse 1.8', subContentId: 'tf1' },
      { path: 'content[1].content.params.media', library: 'H5P.AdvancedText 1.1', subContentId: 't2' },
    ]);
  });

  it('[PROD-013] gives the same signature whatever the key order (PostgreSQL jsonb reorders keys)', () => {
    const stored = { b: [text('x')], a: { library: 'H5P.Image 1.1', params: {}, subContentId: 'i' } };
    const edited = { a: { subContentId: 'i', params: {}, library: 'H5P.Image 1.1' }, b: [text('x')] };
    expect(structureSignature(stored, 'H5P.Column 1.22')).toEqual(
      structureSignature(edited, 'H5P.Column 1.22'),
    );
  });

  it('[PROD-013] a stateless leaf counts by position only: rewording it is not structural, moving it is', () => {
    const before = column(text('<p>A</p>', 'a'), text('<p>B</p>', 'b'));
    expect(differs(before, column(text('<p>Heilt ny tekst</p>', 'a'), text('<p>B</p>', 'b')))).toBeNull();
    expect(differs(before, column(text('<p>B</p>', 'b'), text('<p>A</p>', 'a')))).toEqual({
      kind: 'node',
      path: 'content[0].content',
    });
  });

  it('[PROD-013] a stateful leaf without a rule counts any change of its parameters, but not of its markup', () => {
    const before = column(trueFalse('<p>Er jorda rund?</p>'));
    expect(differs(before, column(trueFalse('<div>Er  jorda rund?</div>')))).toBeNull();
    expect(differs(before, column(trueFalse('<p>Er jorda flat?</p>')))).toEqual({
      kind: 'facts',
      path: 'content[0].content',
    });
  });

  it('[PROD-013] another library version, subContentId or main library is structural; a title is not', () => {
    const before = column(text('A'));
    expect(differs(before, column({ ...text('A'), library: 'H5P.AdvancedText 1.2' }))?.kind).toBe('node');
    expect(differs(before, column(text('A', 'another-id')))?.kind).toBe('node');
    expect(differs(before, column({ ...text('A'), metadata: { title: 'Ny tittel' } }))).toBeNull();
    const main = structuralDifference(
      structureSignature(before, 'H5P.Column 1.22'),
      structureSignature(before, 'H5P.Column 1.18'),
    );
    expect(main).toEqual({ kind: 'main-library', path: '' });
  });

  it('[PROD-013] a nested node of a stateful library without a rule is compared on its own entry only', () => {
    const outer = (inner: object) => ({ ...trueFalse('Q'), params: { question: 'Q', media: inner } });
    expect(differs(column(outer(text('A', 'n'))), column(outer(text('Ny tekst', 'n'))))).toBeNull();
  });

  it('[PROD-013] reads values of any JSON type without throwing, and refuses nesting past 300 levels', () => {
    const odd = {
      content: [{ content: { library: 'H5P.MultiChoice 1.16', params: { answers: 'x' } } }, 7, null],
    };
    expect(() => structureSignature(odd, 'H5P.Column 1.22')).not.toThrow();
    let deep: unknown = {};
    for (let level = 0; level < 320; level++) deep = { inner: deep };
    expect(() => structureSignature(deep, 'H5P.Column 1.22')).toThrow(RangeError);
  });
});
