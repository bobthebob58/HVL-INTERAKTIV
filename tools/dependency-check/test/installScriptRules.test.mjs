/**
 * Tests for the install-script rules (D-145): the real lock file, package.json and .npmrc agree; a package with an
 * install script that the reviewed list does not name, a stale or loosely written entry of the list, and npm
 * settings that do not refuse an unreviewed script are each a problem.
 *
 * Spec: SEC-007
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  installScriptProblems,
  npmrcProblems,
  npmrcSettings,
  scriptedPackages,
} from '../installScriptRules.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LOCK = JSON.parse(readFileSync(`${ROOT}package-lock.json`, 'utf8'));
const MANIFEST = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8'));
const NPMRC = readFileSync(`${ROOT}.npmrc`, 'utf8');
const STRICT =
  '.npmrc: must set strict-allow-scripts=true, so a script outside allowScripts stops the install';

/** The real package.json with another reviewed list. */
const reviewed = (change) => ({ ...MANIFEST, allowScripts: change({ ...MANIFEST.allowScripts }) });

describe('[SEC-007] install scripts run only from the reviewed list', () => {
  it('[SEC-007] the real files agree: each package with an install script is named, at its version', () => {
    expect(installScriptProblems(LOCK, MANIFEST)).toEqual([]);
    expect(npmrcProblems(NPMRC)).toEqual([]);
    expect(Object.keys(MANIFEST.allowScripts).sort()).toEqual(scriptedPackages(LOCK));
  });

  it('[SEC-007] a package with an install script that the list does not name is refused', () => {
    // Arrange: a dependency gains a script, and a listed package moves to a new version
    const gained = structuredClone(LOCK);
    gained.packages['node_modules/express'].hasInstallScript = true;
    const version = LOCK.packages['node_modules/express'].version;
    const bumped = structuredClone(LOCK);
    bumped.packages['node_modules/esbuild'].version = '0.99.0';
    // Act
    const problems = installScriptProblems(gained, MANIFEST);
    const afterBump = installScriptProblems(bumped, MANIFEST);
    // Assert
    expect(problems).toEqual([
      `express@${version}: has an install script that allowScripts does not name; review it, then allow or deny it`,
    ]);
    expect(afterBump).toEqual([
      'esbuild@0.99.0: has an install script that allowScripts does not name; review it, then allow or deny it',
      'package.json: allowScripts names esbuild@0.28.2, which has no install script in the lock file; remove it',
    ]);
  });

  it('[SEC-007] a list without the real entries, or with none, is refused', () => {
    // Act
    const none = installScriptProblems(LOCK, { ...MANIFEST, allowScripts: undefined });
    const stale = installScriptProblems(
      LOCK,
      reviewed((list) => ({ ...list, 'sharp@0.34.0': true })),
    );
    // Assert
    expect(none).toHaveLength(scriptedPackages(LOCK).length);
    expect(stale).toEqual([
      'package.json: allowScripts names sharp@0.34.0, which has no install script in the lock file; remove it',
    ]);
  });

  it('[SEC-007] an entry must be name@version with true or false', () => {
    // Arrange: a name for every version, a range and a text value
    const loose = reviewed((list) => {
      delete list['esbuild@0.28.2'];
      return { ...list, esbuild: true, 'prisma@7': true, 'fsevents@2.3.3': 'no' };
    });
    // Act
    const problems = installScriptProblems(LOCK, loose);
    // Assert
    expect(problems).toEqual([
      'package.json: allowScripts: "fsevents@2.3.3" must be name@version with true or false',
      'package.json: allowScripts: "esbuild" must be name@version with true or false',
      'package.json: allowScripts: "prisma@7" must be name@version with true or false',
      'esbuild@0.28.2: has an install script that allowScripts does not name; review it, then allow or deny it',
      'package.json: allowScripts names esbuild, which has no install script in the lock file; remove it',
      'package.json: allowScripts names prisma@7, which has no install script in the lock file; remove it',
    ]);
  });

  it('[SEC-007] npm settings that do not refuse an unreviewed script are a problem', () => {
    expect(npmrcProblems(undefined)).toEqual([STRICT]);
    expect(npmrcProblems('# strict-allow-scripts=true\n')).toEqual([STRICT]);
    expect(npmrcProblems('strict-allow-scripts=false\n')).toEqual([STRICT]);
    expect(npmrcProblems('strict-allow-scripts=true\nstrict-allow-scripts=false\n')).toEqual([STRICT]);
    expect(npmrcProblems('strict-allow-scripts = "true"\r\n; a comment\n')).toEqual([]);
    expect(npmrcProblems('strict-allow-scripts\n')).toEqual([]);
    expect(npmrcProblems('strict-allow-scripts=true\ndangerously-allow-all-scripts=true\n')).toEqual([
      '.npmrc: must not set dangerously-allow-all-scripts',
    ]);
    expect(npmrcProblems('strict-allow-scripts=true\ndangerously-allow-all-scripts\n')).toHaveLength(1);
  });

  it('[SEC-007] settings are read as npm reads them', () => {
    expect([...npmrcSettings('a=1\n b = two \n#c=3\n;d=4\n\ne\nf="x y"\n')]).toEqual([
      ['a', '1'],
      ['b', 'two'],
      ['e', 'true'],
      ['f', 'x y'],
    ]);
  });
});
