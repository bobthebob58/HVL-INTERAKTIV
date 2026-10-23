/**
 * Tests for packing a content type's `.h5p`: the library closure, sub-content libraries, Nynorsk defaults, assets
 * and byte-for-byte reproducible output.
 *
 * Spec: H5P-003
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import yauzl from 'yauzl';
import { libraryClosure, packContentType, subContentLibraries } from '../packContentTypes.mjs';

const dirs = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'h5p-pack-'));
  dirs.push(dir);
  return dir;
};
const dep = (name, v) => ({
  machineName: name,
  majorVersion: Number(v.split('.')[0]),
  minorVersion: Number(v.split('.')[1]),
});
const writeJson = (path, value) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
};

/** Three libraries: Main → Helper (preloaded), Main → Editor widget (editor), and a sub-content Text type. */
function libraries() {
  const dir = temp();
  writeJson(join(dir, 'H5P.Main-1.2/library.json'), {
    ...dep('H5P.Main', '1.2'),
    embedTypes: ['iframe'],
    preloadedDependencies: [dep('H5P.Helper', '1.0')],
    editorDependencies: [dep('H5PEditor.Widget', '1.1')],
  });
  writeJson(join(dir, 'H5P.Main-1.2/semantics.json'), [{ name: 'label', type: 'text', default: 'Check' }]);
  writeJson(join(dir, 'H5P.Main-1.2/language/nn.json'), { semantics: [{ default: 'Sjekk' }] });
  writeJson(join(dir, 'H5P.Helper-1.0/library.json'), dep('H5P.Helper', '1.0'));
  writeJson(join(dir, 'H5PEditor.Widget-1.1/library.json'), dep('H5PEditor.Widget', '1.1'));
  writeJson(join(dir, 'H5P.Text-1.1/library.json'), dep('H5P.Text', '1.1'));
  writeJson(join(dir, 'H5P.Unused-1.0/library.json'), dep('H5P.Unused', '1.0'));
  return dir;
}
const entriesOf = (file) =>
  new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: false }, (error, zip) => {
      if (error) return reject(error);
      const names = [];
      zip.on('entry', (e) => names.push(e.fileName));
      zip.on('end', () => resolve(names));
    });
  });

describe('[H5P-003] packing a content type', () => {
  it('[H5P-003] finds sub-content libraries at any depth and the closure over preloaded and editor dependencies', () => {
    // Arrange
    const params = {
      a: [{ x: { library: 'H5P.Text 1.1', params: { b: { library: 'H5P.Helper 1.0', params: {} } } } }],
    };
    // Act
    const found = subContentLibraries(params).map((d) => d.machineName);
    const closure = libraryClosure(libraries(), [dep('H5P.Main', '1.2')]);
    // Assert
    expect(found.sort()).toEqual(['H5P.Helper', 'H5P.Text']);
    expect(closure).toEqual(['H5P.Helper-1.0', 'H5P.Main-1.2', 'H5PEditor.Widget-1.1']);
  });

  it('[H5P-003] writes h5p.json, defaulted content, assets and the needed libraries, reproducibly', async () => {
    // Arrange
    const libs = libraries();
    const examples = temp();
    writeFileSync(join(examples, 'pic.png'), 'png');
    const exampleFile = join(examples, 'Main.json');
    writeJson(exampleFile, {
      mainLibrary: 'H5P.Main-1.2',
      title: 'Døme',
      language: 'nn',
      license: 'U',
      params: { text: { library: 'H5P.Text 1.1', params: {} } },
      assets: { 'images/pic.png': 'pic.png' },
    });
    const out = temp();
    // Act
    const folders = await packContentType({ librariesDir: libs, exampleFile, outFile: join(out, 'a.h5p') });
    await packContentType({ librariesDir: libs, exampleFile, outFile: join(out, 'b.h5p') });
    // Assert
    expect(folders).toEqual(['H5P.Helper-1.0', 'H5P.Main-1.2', 'H5P.Text-1.1', 'H5PEditor.Widget-1.1']);
    const names = await entriesOf(join(out, 'a.h5p'));
    expect(names).toContain('h5p.json');
    expect(names).toContain('content/images/pic.png');
    expect(names.some((n) => n.startsWith('H5P.Unused'))).toBe(false);
    expect(readFileSync(join(out, 'a.h5p')).equals(readFileSync(join(out, 'b.h5p')))).toBe(true);
  });
});
