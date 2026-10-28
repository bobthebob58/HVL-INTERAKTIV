/**
 * Tests for giving every sub-content node of a pattern skeleton a fresh `subContentId`.
 *
 * Spec: PED-010
 */
import { describe, expect, it } from 'vitest';
import { withFreshSubContentIds } from '../../../src/learningDesign/patterns/subContentIds.js';

const counter = () => {
  let n = 0;
  return () => `id-${++n}`;
};

/** Freezes a value and everything in it, so a change to the input throws. */
const deepFreeze = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

describe('[PED-010] fresh subContentIds for pattern skeletons', () => {
  it('[PED-010] every sub-content node gets a fresh ID in pre-order, replacing any it had, in lists and groups', () => {
    // Arrange
    const params = {
      chapters: [
        {
          library: 'H5P.Column 1.22',
          subContentId: 'from-an-export',
          params: { content: [{ content: { library: 'H5P.MultiChoice 1.16', params: {} } }] },
        },
      ],
      cover: { medium: { library: 'H5P.Image 1.1', params: {} } },
    };
    // Act
    const renewed = withFreshSubContentIds(params, counter());
    // Assert
    expect(renewed.chapters[0]?.subContentId).toBe('id-1');
    expect(renewed.chapters[0]?.params.content[0]?.content).toEqual({
      library: 'H5P.MultiChoice 1.16',
      params: {},
      subContentId: 'id-2',
    });
    expect(renewed.cover.medium).toEqual({ library: 'H5P.Image 1.1', params: {}, subContentId: 'id-3' });
  });

  it('[PED-010] an object with a subContentId key (a sub-content group) is renewed; other objects stay as they are', () => {
    // Arrange
    const params = { summaries: [{ summary: ['<p>A</p>'], subContentId: 'old' }, { summary: ['<p>B</p>'] }] };
    // Act
    const renewed = withFreshSubContentIds(params, counter());
    // Assert
    expect(renewed).toEqual({
      summaries: [{ summary: ['<p>A</p>'], subContentId: 'id-1' }, { summary: ['<p>B</p>'] }],
    });
  });

  it('[PED-010] a library value that is not a sub-content name does not make a node', () => {
    const params = { a: { library: 'H5P.Image-1.1' }, b: { library: 'image' }, c: { library: 3 } };
    expect(withFreshSubContentIds(params, counter())).toEqual(params);
  });

  it('[PED-010] the input is not changed and shares no object with the result', () => {
    // Arrange
    const params = deepFreeze({
      list: [{ library: 'H5P.Text 1.1', params: { text: 'x' }, subContentId: 'a' }],
    });
    // Act
    const renewed = withFreshSubContentIds(params, counter());
    // Assert
    expect(params.list[0]?.subContentId).toBe('a');
    expect(renewed.list).not.toBe(params.list);
    expect(renewed.list[0]?.params).not.toBe(params.list[0]?.params);
  });

  it('[PED-010] IDs are random UUIDs by default', () => {
    // Arrange
    const text = () => ({ library: 'H5P.Text 1.1', params: {} });
    // Act
    const ids = withFreshSubContentIds([text(), text()]).map(
      (node) => (node as { subContentId?: string }).subContentId,
    );
    // Assert
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(ids.every((id) => uuid.test(id ?? ''))).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });

  it('[PED-010] refuses parameters nested deeper than 100 levels', () => {
    let deep: unknown = {};
    for (let i = 0; i < 101; i += 1) deep = { next: deep };
    expect(() => withFreshSubContentIds(deep)).toThrow(RangeError);
  });
});
