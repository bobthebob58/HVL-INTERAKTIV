/**
 * Tests of the forms a library source's parts must have before they reach git or a folder name (D-143): what is
 * accepted, what is refused, and that every line of the committed pin list passes.
 *
 * Spec: H5P-003
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkedCommit,
  checkedMachineName,
  checkedManifestEntry,
  checkedRef,
  checkedRepository,
  checkedVersionPart,
  libraryFolder,
  registryRepository,
} from '../sourceRules.mjs';

const manifest = JSON.parse(readFileSync(new URL('../libraries.manifest.json', import.meta.url), 'utf8'));
const COMMIT = '49f57629864f80d0bc339ccf3b99f172106d20b4';
const refusedBy = (check, values) => values.filter((value) => !thrown(() => check(value)));
const thrown = (act) => {
  try {
    act();
    return false;
  } catch (error) {
    return /does not have the form a library source may have/.test(error.message) && !error.transient;
  }
};

describe('[H5P-003] the forms of a library source', () => {
  it('[H5P-003] a repository is an https address of one GitHub repository', () => {
    // Arrange
    const accepted = [
      'https://github.com/h5p/h5p-multi-choice',
      'https://github.com/otacke/h5p-editor.x_1.git',
    ];
    const refused = [
      '--upload-pack=x',
      '-o',
      'ext::x',
      'file:///tmp/x',
      '/tmp/x',
      '../x',
      'git@github.com:h5p/x.git',
      'ssh://git@github.com/h5p/x',
      'http://github.com/h5p/x',
      'https://github.com.example.org/h5p/x',
      'https://example.org/h5p/x',
      'https://user@github.com/h5p/x',
      'https://github.com/h5p',
      'https://github.com/h5p/x/y',
      'https://github.com/h5p/x/',
      'https://github.com/../x',
      'https://github.com/h5p/-x',
      'https://github.com/h5p/x?y',
      'https://github.com/h5p/x#y',
      'https://github.com/h5p/x y',
      'https://github.com/h5p/x\n',
      ' https://github.com/h5p/x',
      '',
      undefined,
      null,
      { toString: () => 'https://github.com/h5p/x' },
    ];
    // Act and assert
    expect(accepted.map(checkedRepository)).toEqual(accepted);
    expect(refusedBy(checkedRepository, refused)).toEqual([]);
  });

  it('[H5P-003] a machine name and a version make one folder name, with no way out of the folder', () => {
    // Arrange
    const names = [
      'H5P.MultiChoice',
      'FontAwesome',
      'jQuery.ui',
      'H5PEditor.Wizard',
      'H5P.Tether-2',
      'a_b.c',
    ];
    const oddNames = [
      '..',
      '.',
      '.hidden',
      'H5P..X',
      'H5P.',
      'H5P/X',
      'H5P\\X',
      '-x',
      'H5P.X ',
      '',
      'x'.repeat(101),
      7,
    ];
    const oddParts = ['1', '../x', 1.5, -1, Number.NaN, 100_000, undefined, null, [1]];
    // Act and assert
    expect(names.map(checkedMachineName)).toEqual(names);
    expect(manifest.libraries.map((l) => checkedMachineName(l.machineName))).toHaveLength(
      manifest.libraries.length,
    );
    expect(refusedBy(checkedMachineName, oddNames)).toEqual([]);
    expect([0, 1, 28, 99_999].map(checkedVersionPart)).toEqual([0, 1, 28, 99_999]);
    expect(refusedBy(checkedVersionPart, oddParts)).toEqual([]);
    expect(libraryFolder('H5P.Column', 1, 18)).toBe('H5P.Column-1.18');
    expect(thrown(() => libraryFolder('../x', 1, 0)) && thrown(() => libraryFolder('H5P.X', '..', 0))).toBe(
      true,
    );
  });

  it('[H5P-003] a ref is HEAD, a version tag or a full commit; a commit is 40 hex characters', () => {
    // Arrange
    const refs = ['HEAD', 'refs/tags/1.2.3', 'refs/tags/v1.28.10', COMMIT];
    const oddRefs = [
      '--upload-pack=x',
      'refs/heads/master',
      'master',
      'refs/tags/1.2',
      'refs/tags/1.2.3 x',
      '',
      1,
    ];
    // Act and assert
    expect(refs.map(checkedRef)).toEqual(refs);
    expect(refusedBy(checkedRef, oddRefs)).toEqual([]);
    expect(checkedCommit(COMMIT)).toBe(COMMIT);
    expect(
      refusedBy(checkedCommit, [COMMIT.slice(1), COMMIT.toUpperCase(), `${COMMIT}0`, 'HEAD', '']),
    ).toEqual([]);
  });

  it('[H5P-003] the registry is asked by its own keys only, and its address is held to the form', () => {
    // Arrange
    const registry = {
      'H5P.A': { repo: { url: 'https://github.com/h5p/a' } },
      'H5P.B': { repo: { url: '--upload-pack=x' } },
      'H5P.C': {},
    };
    // Act and assert
    expect(registryRepository(registry, 'H5P.A')).toBe('https://github.com/h5p/a');
    expect(
      ['H5P.C', 'H5P.D', 'constructor', '__proto__'].map((n) => registryRepository(registry, n)),
    ).toEqual([undefined, undefined, undefined, undefined]);
    expect(thrown(() => registryRepository(registry, 'H5P.B'))).toBe(true);
  });

  it('[H5P-003] every line of the committed pin list passes; a line edited out of form names its library', () => {
    // Arrange
    const [first] = manifest.libraries;
    const edits = [
      { repository: 'file:///tmp/x' },
      { commit: 'HEAD' },
      { ref: 'refs/heads/master' },
      { version: '1.0' },
      { machineName: '../x' },
      { build: 'yes' },
    ];
    // Act and assert
    expect(manifest.libraries.map(checkedManifestEntry)).toEqual(manifest.libraries);
    for (const edit of edits) {
      expect(() => checkedManifestEntry({ ...first, ...edit }), JSON.stringify(edit)).toThrow(
        /^pin list line "/,
      );
    }
    expect(() => checkedManifestEntry(undefined)).toThrow(/^pin list line/);
  });
});
