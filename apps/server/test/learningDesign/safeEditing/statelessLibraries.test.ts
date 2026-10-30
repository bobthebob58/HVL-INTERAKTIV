/**
 * Unit tests for the list of stateless libraries: each listed library and version is in the pinned packages, and
 * none of its scripts defines `getCurrentState`, so it really keeps no learner state (D-093).
 *
 * Spec: PROD-013
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { fromBuffer, type Entry, type ZipFile } from 'yauzl';
import { STATELESS_LIBRARIES } from '../../../src/learningDesign/safeEditing/statelessLibraries.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../../support/realPackages.js';

// WHY: a library without scripts (H5P.Nil) is still in the package, by its library.json.
const LIBRARY_FILE = /^(H5P\.[\w.]+)-(\d+)\.(\d+)\/(?:library\.json|.*\.js)$/;

/** `Name major.minor` → the text of its scripts (and library.json), for every library folder in one package. */
const scriptsOf = (buffer: Buffer): Promise<Map<string, string>> =>
  new Promise((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true }, (error, zip?: ZipFile) => {
      if (error || !zip) return reject(error ?? new Error('not a zip'));
      const scripts = new Map<string, string>();
      zip.on('entry', (entry: Entry) => {
        const match = LIBRARY_FILE.exec(entry.fileName);
        if (!match) return zip.readEntry();
        zip.openReadStream(entry, (err, stream) => {
          if (err || !stream) return reject(err ?? new Error('unreadable entry'));
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            const key = `${match[1]} ${match[2]}.${match[3]}`;
            scripts.set(key, `${scripts.get(key) ?? ''}\n${Buffer.concat(chunks).toString('utf8')}`);
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => resolve(scripts));
      zip.readEntry();
    });
  });

describeWithRealPackages('[PROD-013] the stateless libraries', () => {
  const scripts = new Map<string, string>();
  beforeAll(async () => {
    const packages = readdirSync(REAL_PACKAGES_DIR).filter((file) => file.endsWith('.h5p'));
    for (const file of packages) {
      for (const [key, text] of await scriptsOf(readFileSync(join(REAL_PACKAGES_DIR, file))))
        scripts.set(key, text);
    }
  }, 60_000);

  it.each([...STATELESS_LIBRARIES])(
    '[PROD-013] %s is in the pinned packages and defines no getCurrentState',
    (key) => {
      const text = scripts.get(key);
      expect(text, `${key} is not in ${REAL_PACKAGES_DIR}`).toBeDefined();
      expect(text).not.toContain('getCurrentState');
    },
  );

  it('[PROD-013] the question types with a rule do define getCurrentState (the check can see it)', () => {
    expect(scripts.get('H5P.MultiChoice 1.16')).toContain('getCurrentState');
  });
});
