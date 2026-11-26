/**
 * Unit tests of the address of H5P's link field (D-140): no character that can end an HTML attribute stays in it,
 * on a save, on the player page and in the editor's form; an ordinary address is not changed; and the fitting
 * reads the address the save has cleaned.
 *
 * Spec: SEC-008, H5P-004, H5P-006
 */
import { LibraryManager, fsImplementations, type IPlayerModel } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import { EditorFormParams } from '../../../src/h5p/semantics/editorFormParams.js';
import { attributeSafeAddress, fitLinkAddress } from '../../../src/h5p/semantics/linkAddressConformance.js';
import { withFittedContents } from '../../../src/h5p/semantics/playedParams.js';
import { SubContentPolicy } from '../../../src/h5p/semantics/SubContentPolicy.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';

afterAll(removeSyntheticLibraryDirs);

const MAIN = { machineName: 'H5P.Linked', majorVersion: 1, minorVersion: 0 };
const linkField = (name: string) => ({
  name,
  type: 'group',
  widget: 'linkWidget',
  fields: [
    { name: 'protocol', type: 'select', options: [{ value: 'https://' }, { value: 'other' }] },
    { name: 'url', type: 'text' },
  ],
});
const LIBRARIES = [
  {
    machineName: 'H5P.Linked',
    runnable: true,
    semantics: [
      { name: 'title', type: 'text' },
      linkField('linkWidget'),
      {
        name: 'stops',
        type: 'list',
        field: { name: 'stop', type: 'group', fields: [{ name: 'label', type: 'text' }, linkField('goto')] },
      },
      {
        name: 'plain',
        type: 'group',
        fields: [
          { name: 'protocol', type: 'text' },
          { name: 'url', type: 'text' },
        ],
      },
    ],
  },
];
const manager = new LibraryManager(new fsImplementations.FileLibraryStorage(syntheticLibraryDir(LIBRARIES)));
const lookup = (library: Parameters<LibraryManager['getSemantics']>[0]) => manager.getSemantics(library);
const QUOTED = 'hvl.no/kurs" style="x" data-a=\'b\'';
const SAFE = 'hvl.no/kurs%22%20style=%22x%22%20data-a=%27b%27';
const content = (url: string) => ({
  title: 'Les "meir"',
  linkWidget: { protocol: 'https://', url },
  stops: [{ label: 'Vidare', goto: { protocol: 'other', url } }],
  plain: { protocol: 'x', url },
});
const played = (model: IPlayerModel): string =>
  (model.integration.contents as Record<string, { jsonContent: string }>)['cid-c1']?.jsonContent ?? '';
const modelOf = (params: unknown) =>
  ({
    contentId: 'c1',
    integration: {
      contents: { 'cid-c1': { library: 'H5P.Linked 1.0', jsonContent: JSON.stringify(params) } },
    },
  }) as unknown as IPlayerModel;

describe('[SEC-008] the address of a link field', () => {
  it('[SEC-008] is written with quotes, brackets, backticks and spaces percent-encoded, and without control characters', () => {
    expect(attributeSafeAddress(QUOTED)).toBe(SAFE);
    expect(attributeSafeAddress('  a.no/<b>`c`\t\n\u0000d  ')).toBe('a.no/%3Cb%3E%60c%60d');
    expect(attributeSafeAddress('a.no/&quot;x&quot;&#039;y&#039;')).toBe('a.no/%22x%22%27y%27');
  });

  it('[SEC-008] an ordinary address is not changed, with its query, fragment and encoded characters', () => {
    const address = 'www.hvl.no/studier/?a=1&amp;b=%20to#del-2';
    const link = { protocol: 'https://', url: address };
    expect(fitLinkAddress(link)).toBe(false);
    expect(link.url).toBe(address);
    expect(fitLinkAddress({ protocol: 'https://', url: 7 })).toBe(false);
    expect(fitLinkAddress({ protocol: 'https://' })).toBe(false);
  });

  it('[SEC-008] on save: every link field is fitted, also in a list, and no other text is', async () => {
    // Arrange
    const params = content(QUOTED);
    // Act
    const changed = await new SubContentPolicy(manager).enforce(params, {}, MAIN);
    // Assert: the address that was cleaned as text is the one fitted; a text field named `url` elsewhere is not
    expect(params.linkWidget.url).toBe(SAFE);
    expect(params.stops[0]?.goto.url).toBe(SAFE);
    expect(params.plain.url).toBe(QUOTED);
    expect(params.title).toBe('Les "meir"');
    expect(changed).toBe(2);
  });

  it('[SEC-008] on save: markup in an address is removed as from any plain text before the address is fitted', async () => {
    const params = content('hvl.no/<b onmouseover="x()">kurs</b> A');
    await new SubContentPolicy(manager).enforce(params, {}, MAIN);
    expect(params.linkWidget.url).toBe('hvl.no/kurs%20A');
  });

  it('[H5P-004] on the player page: a row stored with a quote in an address is handed over fitted', async () => {
    // Arrange
    const model = modelOf(content(QUOTED));
    // Act
    const fitted = JSON.parse(played(await withFittedContents(model, lookup))) as ReturnType<typeof content>;
    // Assert
    expect([fitted.linkWidget.url, fitted.stops[0]?.goto.url]).toEqual([SAFE, SAFE]);
    expect(played(model)).toContain('style=');
  });

  it('[H5P-006] in the editor form: the address is shown as a save stores it', async () => {
    const params = content(QUOTED);
    await new EditorFormParams(manager).clean(params, {}, MAIN);
    expect([params.linkWidget.url, params.stops[0]?.goto.url]).toEqual([SAFE, SAFE]);
    expect(params.title).toBe('Les &quot;meir&quot;');
  });
});
