/**
 * Pins where Lumi opens an .h5p package itself: one place that unpacks and one that lists the entries, both of
 * which ../../../src/h5p/libraries/checkedPackageReading.ts replaces (D-118). A Lumi upgrade that opens a package
 * anywhere else fails here, before it can read an upload with a second zip reader.
 *
 * Spec: SEC-005
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractCheckedPackage,
  useCheckedPackageReading,
} from '../../../src/h5p/libraries/checkedPackageReading.js';
import { PackageImporter, PackageValidator } from '../../../src/h5p/lumiInternals.js';

const lumiDir = dirname(createRequire(import.meta.url).resolve('@lumieducation/h5p-server'));

/** Every built Lumi source file under `dir`, as `relative name -> text`. */
function sources(dir: string, prefix = ''): Record<string, string> {
  const found: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) Object.assign(found, sources(join(dir, entry.name), `${name}/`));
    else if (name.endsWith('.js')) found[name] = readFileSync(join(dir, entry.name), 'utf8');
  }
  return found;
}

const count = (text: string, part: string): number => text.split(part).length - 1;

describe('[SEC-005] upstream: where Lumi opens a package', () => {
  const lumi = sources(lumiDir);

  it('[SEC-005] only the package importer and the package validator load Lumi’s zip reader', () => {
    const users = Object.keys(lumi).filter((name) => /require\(["']yauzl/.test(lumi[name] ?? ''));
    expect(users.sort()).toEqual(['PackageImporter.js', 'PackageValidator.js']);
  });

  it('[SEC-005] the importer opens a package only in its static extractPackage, which it calls by that name', () => {
    // Arrange
    const importer = lumi['PackageImporter.js'] ?? '';
    // Act: where the method starts, where the reader is opened, and where the next method starts
    const [defined, opened, nextMethod] = [
      importer.indexOf('static async extractPackage('),
      importer.indexOf('yauzl_promise_1.default.open('),
      importer.indexOf('async addPackageLibrariesAndContent('),
    ];
    // Assert
    expect(count(importer, '.open(')).toBe(1);
    expect(defined).toBeGreaterThan(-1);
    expect(opened).toBeGreaterThan(defined);
    expect(opened).toBeLessThan(nextMethod);
    expect(count(importer, 'extractPackage(')).toBe(1 + count(importer, 'PackageImporter.extractPackage('));
    expect(count(importer, 'PackageImporter.extractPackage(')).toBeGreaterThan(0);
  });

  it('[SEC-005] the validator opens a package only for validateFileSizes, called on an instance', () => {
    const validator = lumi['PackageValidator.js'] ?? '';
    const importer = lumi['PackageImporter.js'] ?? '';
    expect(count(validator, 'yauzl.open(')).toBe(1);
    expect(validator).toMatch(/static async openZipArchive\(file\) \{[\s\S]*?yauzl\.open\(file\)/);
    expect(count(validator, 'openZipArchive(')).toBe(2);
    expect(validator).toMatch(
      /async validateFileSizes\(h5pFile\) \{[\s\S]{0,200}PackageValidator\.openZipArchive\(/,
    );
    expect(count(importer, '.validateFileSizes(')).toBe(1);
  });

  it('[SEC-005] after the replacement, both functions are HVL’s', async () => {
    // Arrange
    const lumiValidate = PackageValidator.prototype.validateFileSizes;
    // Act
    useCheckedPackageReading();
    useCheckedPackageReading();
    // Assert
    expect(PackageImporter.extractPackage.toString()).toContain(extractCheckedPackage.name);
    expect(PackageValidator.prototype.validateFileSizes).not.toBe(lumiValidate);
    await expect(PackageValidator.prototype.validateFileSizes('/no/such/package.h5p')).rejects.toMatchObject({
      messageKey: 'upload.archive.unreadable',
    });
  });
});
