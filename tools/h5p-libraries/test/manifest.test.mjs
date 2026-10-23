/**
 * Tests for the committed library manifest and the example activities: every library is pinned to a commit, the
 * ten content types are covered at the versions S4 starts from, and no example uses H5P.DragQuestion.
 *
 * Spec: H5P-003, H5P-002
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_TYPE_ROOTS } from '../resolveManifest.mjs';

const manifest = JSON.parse(readFileSync(new URL('../libraries.manifest.json', import.meta.url), 'utf8'));
const examplesDir = new URL('../examples/', import.meta.url);
const examples = readdirSync(examplesDir)
  .filter((f) => f.endsWith('.json'))
  .map((file) => ({ file, text: readFileSync(new URL(file, examplesDir), 'utf8') }));
const key = (l) => `${l.machineName} ${l.version.split('.').slice(0, 2).join('.')}`;

describe('[H5P-003] the library manifest', () => {
  it('[H5P-003] pins every library and the registry to a full commit, from a release tag unless marked untagged', () => {
    expect(manifest.registry.commit).toMatch(/^[0-9a-f]{40}$/);
    for (const library of manifest.libraries) {
      expect(library.commit, key(library)).toMatch(/^[0-9a-f]{40}$/);
      expect(library.repository, key(library)).toMatch(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/);
      if (library.untagged) expect(library.ref, key(library)).toBe('HEAD');
      else expect(library.ref, key(library)).toBe(`refs/tags/${library.version}`);
    }
  });

  it('[H5P-003] holds each library major.minor once and every content type root', () => {
    const keys = manifest.libraries.map(key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const root of CONTENT_TYPE_ROOTS) {
      expect(keys, root.machineName).toContain(
        `${root.machineName} ${root.majorVersion}.${root.minorVersion}`,
      );
    }
  });
});

describe('[H5P-002] the example activities', () => {
  it('[H5P-002] there is one example per authorable type, each naming a pinned main library', () => {
    const folders = new Set(manifest.libraries.map((l) => key(l).replace(' ', '-')));
    const mains = examples.map(({ text }) => JSON.parse(text).mainLibrary).sort();
    expect(mains).toEqual(
      CONTENT_TYPE_ROOTS.map((r) => `${r.machineName}-${r.majorVersion}.${r.minorVersion}`).sort(),
    );
    for (const main of mains) expect(folders.has(main), main).toBe(true);
  });

  it('[H5P-002] no example uses H5P.DragQuestion, not even as sub-content (CLAUDE.md §1)', () => {
    for (const { file, text } of examples) expect(text, file).not.toContain('H5P.DragQuestion');
  });

  it('[H5P-002] examples are Nynorsk and use no remote media', () => {
    for (const { file, text } of examples) {
      expect(JSON.parse(text).language, file).toBe('nn');
      expect(text, file).not.toMatch(/https?:\/\/(?!purl\.imsglobal)/);
    }
  });
});
