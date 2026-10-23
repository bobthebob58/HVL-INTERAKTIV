/**
 * Pins upstream behaviour of Lumi's SemanticsEnforcer: list items are skipped (the reason for D-039).
 *
 * Spec: SEC-008, H5P-002
 */
import { describe, it, expect, afterAll } from 'vitest';
import { LibraryManager, fsImplementations } from '@lumieducation/h5p-server';
import { SemanticsEnforcer } from '../../../src/h5p/lumiInternals.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';

afterAll(removeSyntheticLibraryDirs);

const XSS = '<img src=x onerror=alert(1)>text';

/** A container whose text field, text list and library list mirror H5P.Blanks and H5P.QuestionSet. */
const LIST_PROBE = {
  machineName: 'H5P.ListProbe',
  runnable: true,
  semantics: [
    { name: 'title', type: 'text' },
    { name: 'questions', type: 'list', field: { name: 'question', type: 'text' } },
    { name: 'items', type: 'list', field: { name: 'item', type: 'library', options: ['H5P.Allowed 1.0'] } },
  ],
};

async function enforce(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const manager = new LibraryManager(
    new fsImplementations.FileLibraryStorage(
      syntheticLibraryDir([LIST_PROBE, { machineName: 'H5P.Allowed' }]),
    ),
  );
  await new SemanticsEnforcer(manager).enforceSemanticStructure(params, {
    machineName: 'H5P.ListProbe',
    majorVersion: 1,
    minorVersion: 0,
  });
  return params;
}

describe('[SEC-008] upstream: Lumi skips list items when enforcing semantics', () => {
  it('upstream pin: sanitises a plain text field but leaves text that is a list item untouched', async () => {
    const params = await enforce({ title: XSS, questions: [XSS], items: [] });
    expect(params.title).not.toContain('onerror');
    // UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/ContentScanner.ts passes the array as parentParams for list
    // items, so the sanitised text is written to a property of the array, not to the item. D-039 closes this.
    // When this fails after a Lumi upgrade, the gap is fixed upstream; SubContentPolicy keeps its own walk.
    const questions = params.questions as string[] & { question?: string };
    expect(questions[0]).toBe(XSS);
    expect(questions.question).not.toContain('onerror');
  });

  it('upstream pin: keeps a library that is a list item even when the field does not offer it', async () => {
    const drag = { library: 'H5P.DragQuestion 1.0', params: {}, subContentId: 'a' };
    const params = await enforce({ title: 'ok', questions: [], items: [drag] });
    expect(params.items).toEqual([drag]);
  });
});
