/**
 * Tests for the offline content-type bundle: it holds exactly the ten types, every package must match its hash, and a
 * changed, missing, unlisted or extra file is refused. The secret guard has its own file (bundleSecretGuard.test.mjs).
 *
 * Spec: NFR-007, H5P-003
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { BUNDLE_PACKAGES, buildBundle, bundleProblems } from '../contentTypeBundle.mjs';
import { fetchedPackages, refusal, removeTempDirs, sha, temp, writePackage } from './bundleFixtures.mjs';

afterAll(removeTempDirs);

describe('[NFR-007] the offline content-type bundle', () => {
  it('[NFR-007] holds exactly the ten content types, never DragQuestion as a package of its own', () => {
    expect(BUNDLE_PACKAGES).toHaveLength(10);
    expect(BUNDLE_PACKAGES).toContain('H5P.BranchingScenario.h5p');
    expect(BUNDLE_PACKAGES.some((name) => name.includes('DragQuestion'))).toBe(false);
  });

  it('[NFR-007] copies the checked packages and writes their SHA256SUMS, which verify accepts', async () => {
    // Arrange
    const from = await fetchedPackages();
    const out = join(temp(), 'bundle');
    // Act
    const { packages } = await buildBundle({ from, out });
    // Assert
    expect(packages).toBe(10);
    expect(readFileSync(join(out, 'SHA256SUMS'), 'utf8')).toBe(
      readFileSync(join(from, 'SHA256SUMS'), 'utf8'),
    );
    expect((await bundleProblems(out)).problems).toEqual([]);
  });

  it('[NFR-007] refuses a package changed after its hash was listed, and writes nothing', async () => {
    // Arrange
    const from = await fetchedPackages();
    await writePackage(join(from, 'H5P.Blanks.h5p'), { 'h5p.json': '{"mainLibrary":"H5P.Blanks","x":1}' });
    const out = join(temp(), 'bundle');
    // Act
    const problems = await refusal(buildBundle({ from, out }));
    // Assert
    expect(problems).toEqual(['changed: H5P.Blanks.h5p']);
    expect(existsSync(out)).toBe(false);
  });

  it('[NFR-007] verify refuses a bundle whose package changed after the bundle was built', async () => {
    // Arrange
    const out = join(temp(), 'bundle');
    await buildBundle({ from: await fetchedPackages(), out });
    writeFileSync(join(out, 'H5P.MultiChoice.h5p'), 'not the package that was checked');
    // Act
    const { problems } = await bundleProblems(out);
    // Assert
    expect(problems).toEqual(['changed: H5P.MultiChoice.h5p']);
  });

  it('[NFR-007] refuses a missing package, an unlisted file and a listed name that is not one of the ten', async () => {
    // Arrange
    const from = await fetchedPackages();
    rmSync(join(from, 'H5P.Column.h5p'));
    writeFileSync(join(from, 'notes.txt'), 'left behind');
    await writePackage(join(from, 'H5P.DragQuestion.h5p'), { 'h5p.json': '{}' });
    const list = readFileSync(join(from, 'SHA256SUMS'), 'utf8');
    writeFileSync(
      join(from, 'SHA256SUMS'),
      `${list}${sha(join(from, 'H5P.DragQuestion.h5p'))}  H5P.DragQuestion.h5p\n`,
    );
    // Act
    const problems = await refusal(buildBundle({ from, out: join(temp(), 'bundle') }));
    // Assert
    expect(problems).toEqual([
      'missing: H5P.Column.h5p',
      'not one of the ten content types: H5P.DragQuestion.h5p',
      'unexpected: notes.txt',
    ]);
  });

  it('[NFR-007] refuses a hash list without one of the ten types, even when its package is gone too', async () => {
    // Arrange: H5P.Column neither listed nor present, so only the list of ten can notice.
    const from = await fetchedPackages();
    rmSync(join(from, 'H5P.Column.h5p'));
    const list = readFileSync(join(from, 'SHA256SUMS'), 'utf8');
    writeFileSync(
      join(from, 'SHA256SUMS'),
      list
        .split('\n')
        .filter((line) => !line.endsWith('H5P.Column.h5p'))
        .join('\n'),
    );
    // Act
    const problems = await refusal(buildBundle({ from, out: join(temp(), 'bundle') }));
    // Assert
    expect(problems).toEqual(['not listed: H5P.Column.h5p']);
  });

  it('[NFR-007] refuses to write into a bundle folder that is not empty', async () => {
    // Arrange
    const out = temp();
    mkdirSync(join(out, 'old'));
    // Act
    const problems = await refusal(buildBundle({ from: await fetchedPackages(), out }));
    // Assert
    expect(problems).toEqual([`the bundle folder is not empty: ${out}`]);
  });
});
