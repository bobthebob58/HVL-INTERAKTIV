/**
 * Tests for walking H5P parameters with their semantics, including list items and nested sub-content.
 *
 * Spec: SEC-008, H5P-002
 */
import { describe, it, expect } from 'vitest';
import type { ILibraryName } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { MAX_LIBRARY_DEPTH, walkParams, type ParamsVisit } from '../../../src/h5p/semantics/paramsWalker.js';

const SEMANTICS: Record<string, ISemanticsEntry[]> = {
  'H5P.Container': [
    { name: 'title', type: 'text' },
    { name: 'questions', type: 'list', field: { name: 'question', type: 'text' } },
    { name: 'wrapped', type: 'group', fields: [{ name: 'only', type: 'text' }] },
    { name: 'items', type: 'list', field: { name: 'item', type: 'library', options: ['H5P.Leaf 1.0'] } },
  ],
  'H5P.Leaf': [{ name: 'text', type: 'text' }],
  'H5P.Loop': [{ name: 'next', type: 'library', options: ['H5P.Loop 1.0'] }],
};
const lookup = async (lib: ILibraryName): Promise<ISemanticsEntry[]> => SEMANTICS[lib.machineName] ?? [];
const MAIN = { machineName: 'H5P.Container', majorVersion: 1, minorVersion: 0 };

const params = () => ({
  title: 'T',
  questions: ['q1', 'q2'],
  wrapped: 'single',
  items: [{ library: 'H5P.Leaf 1.0', params: { text: 'leaf' }, subContentId: 's1' }],
});

async function visits(p: Record<string, unknown>): Promise<ParamsVisit[]> {
  const seen: ParamsVisit[] = [];
  await walkParams(p, MAIN, lookup, (visit) => {
    seen.push(visit);
  });
  return seen;
}

describe('[SEC-008] walking parameters', () => {
  it('[SEC-008] visits list items with their array and index, so a policy can replace them', async () => {
    const p = params();
    await walkParams(p, MAIN, lookup, ({ semantics, container, key }) => {
      if (semantics.type === 'text') (container as Record<string | number, unknown>)[key] = 'clean';
    });
    expect(p).toMatchObject({ title: 'clean', questions: ['clean', 'clean'], wrapped: 'clean' });
    expect(p.items[0]?.params.text).toBe('clean');
  });

  it('[SEC-008] reports paths and treats a group with one field like H5P does', async () => {
    const paths = (await visits(params())).map((v) => `${v.path}:${v.semantics.type}`);
    expect(paths).toEqual([
      '$.title:text',
      '$.questions:list',
      '$.questions[0]:text',
      '$.questions[1]:text',
      '$.wrapped:text',
      '$.items:list',
      '$.items[0]:library',
      '$.items[0].params.text:text',
    ]);
  });

  it('[H5P-002] does not walk into a value when the visitor skips it', async () => {
    const seen: string[] = [];
    await walkParams(params(), MAIN, lookup, ({ semantics, path }) => {
      seen.push(path);
      return semantics.type === 'library' ? 'skip' : undefined;
    });
    expect(seen).not.toContain('$.items[0].params.text');
  });

  it('[H5P-002] refuses sub-content nested deeper than the limit', async () => {
    let nested: Record<string, unknown> = {};
    for (let i = 0; i <= MAX_LIBRARY_DEPTH + 1; i += 1)
      nested = { next: { library: 'H5P.Loop 1.0', params: nested } };
    const loop = { machineName: 'H5P.Loop', majorVersion: 1, minorVersion: 0 };
    await expect(walkParams(nested, loop, lookup, () => undefined)).rejects.toMatchObject({
      errorId: 'hvl:content-too-deep',
      httpStatusCode: 400,
    });
  });

  it('[SEC-008] ignores values whose shape does not match the semantics', async () => {
    const odd = {
      title: 5,
      questions: 'not a list',
      wrapped: { wrapped: 'x' },
      items: [{ library: 7 }, null],
    };
    await expect(visits(odd)).resolves.toBeInstanceOf(Array);
  });
});
