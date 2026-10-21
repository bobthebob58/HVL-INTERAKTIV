/**
 * coreVersionCheck — reads the core API version from the fetched H5P core files and compares it with the config.
 *
 * Why: the engine, the content types and the client files must agree on the core API. If someone fetches
 *      another core release, the server must refuse to start instead of serving mismatched JavaScript (H5P-001).
 * Spec: H5P-001
 * Invariants:
 *   - The version is read from `H5PCore::$coreApi` in `h5p.classes.php`, the same source H5P itself uses.
 *   - The editor folder must contain the editor entry script; its version is pinned by commit (D-022).
 * Collaborators: ./h5pServerInit.ts, tools/h5p-core/fetchCoreClients.sh (puts the files there).
 * Tests: apps/server/test/h5p/h5pServerInit.test.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A core API version such as 1.28. */
export interface CoreApiVersion {
  major: number;
  minor: number;
}

/** Thrown when the client files are missing or report another core API version. */
export class CoreVersionMismatchError extends Error {
  /**
   * @param message - What is wrong and how to fix it.
   */
  constructor(message: string) {
    super(message);
    this.name = 'CoreVersionMismatchError';
  }
}

/**
 * Reads the core API version from a fetched core folder.
 * @param coreDir - Folder with the H5P core files (contains `h5p.classes.php`).
 * @returns The version found.
 * @throws CoreVersionMismatchError when the file is missing or has no `$coreApi`.
 */
export function readCoreApiVersion(coreDir: string): CoreApiVersion {
  const file = join(coreDir, 'h5p.classes.php');
  if (!existsSync(file)) {
    throw new CoreVersionMismatchError(
      `H5P core files not found in ${coreDir}; run \`npm run h5p:fetch-core\`.`,
    );
  }
  const match = /\$coreApi\s*=\s*array\(\s*'majorVersion'\s*=>\s*(\d+),\s*'minorVersion'\s*=>\s*(\d+)/.exec(
    readFileSync(file, 'utf8'),
  );
  if (!match) throw new CoreVersionMismatchError(`${file} has no $coreApi declaration.`);
  return { major: Number(match[1]), minor: Number(match[2]) };
}

/**
 * Checks the core and editor folders against the expected core API version.
 * @param coreDir - Folder with the core files.
 * @param editorDir - Folder with the editor files.
 * @param expected - Version from the H5P config.
 * @returns The core version found (equal to `expected`).
 * @throws CoreVersionMismatchError on any mismatch or missing file.
 */
export function assertClientFiles(
  coreDir: string,
  editorDir: string,
  expected: CoreApiVersion,
): CoreApiVersion {
  const found = readCoreApiVersion(coreDir);
  if (found.major !== expected.major || found.minor !== expected.minor) {
    throw new CoreVersionMismatchError(
      `H5P core files in ${coreDir} are API ${found.major}.${found.minor}, but the config expects ` +
        `${expected.major}.${expected.minor}. Run \`npm run h5p:fetch-core\`.`,
    );
  }
  if (!existsSync(join(editorDir, 'scripts', 'h5peditor.js'))) {
    throw new CoreVersionMismatchError(
      `H5P editor files not found in ${editorDir}; run \`npm run h5p:fetch-core\`.`,
    );
  }
  return found;
}
