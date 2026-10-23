/**
 * LibraryInstaller — installs the libraries of one verified package and records what changed.
 *
 * Why: the seed command is the only way content types arrive without an admin's upload (D-041). Every package
 *      goes through the same steps: the archive check, a hash check against the pinned list, Lumi's library
 *      install, and an audit row per new or patched library (`H5P-003`, `H5P-011`).
 * Spec: H5P-003, H5P-011, SEC-005
 * Invariants:
 *   - The archive is checked (`inspectZip`) and its hash compared before Lumi opens it.
 *   - Only libraries are installed; content in a seed package is never stored.
 *   - Audit rows have `source: 'seed'`, no actor, and the package hash; they are written before the install
 *     (./auditBeforeInstall.ts); an unchanged library writes none.
 * Collaborators: ./seedLibraries.ts, ./LibraryAuditRecorder.ts, ./sha256Sums.ts, ../../security/zipEntryGuard.ts,
 *   Lumi's PackageImporter (installLibrariesFromPackage).
 * Tests: apps/server/test/h5p/libraries/seedLibraries.int.test.ts
 */
import type { ILibraryInstallResult } from '@lumieducation/h5p-server';
import { inspectZip } from '../../security/zipEntryGuard.js';
import { auditBeforeInstall, type InstalledLibraries } from './auditBeforeInstall.js';
import type { LibraryAuditSink } from './LibraryAuditRecorder.js';
import { readPackageManifest } from './packageManifest.js';
import { sha256File } from './sha256Sums.js';

/** The part of Lumi's PackageImporter the installer uses. */
export interface LibraryPackageImporter {
  /**
   * Installs or updates the libraries in a package; content in it is ignored.
   * @param packagePath - Absolute path of the `.h5p` file.
   * @returns One result per new or patched library (unchanged ones are left out).
   */
  installLibrariesFromPackage(packagePath: string): Promise<ILibraryInstallResult[]>;
}

/** Thrown when a package's bytes do not match the pinned hash. */
export class PackageHashMismatchError extends Error {
  /**
   * @param fileName - The package file.
   */
  constructor(readonly fileName: string) {
    super(`${fileName} does not match its SHA256SUMS entry; nothing was installed from it`);
    this.name = 'PackageHashMismatchError';
  }
}

/** Installs libraries from verified packages. */
export class LibraryInstaller {
  /**
   * @param importer - Lumi's package importer of the server's editor.
   * @param audit - Where changes are recorded.
   * @param installed - Lumi's library manager, to predict the changes before they happen.
   */
  constructor(
    private readonly importer: LibraryPackageImporter,
    private readonly audit: LibraryAuditSink,
    private readonly installed: InstalledLibraries,
  ) {}

  /**
   * Installs the libraries of one package.
   * @param packagePath - Absolute path of the `.h5p` file.
   * @param fileName - Its name in SHA256SUMS (for messages).
   * @param expectedSha256 - The pinned hash.
   * @returns One result per new or patched library.
   * @throws ZipRejectedError for an unsafe archive; PackageHashMismatchError when the hash differs.
   */
  async install(
    packagePath: string,
    fileName: string,
    expectedSha256: string,
  ): Promise<ILibraryInstallResult[]> {
    await inspectZip(packagePath);
    const sha256 = await sha256File(packagePath);
    if (sha256 !== expectedSha256) throw new PackageHashMismatchError(fileName);
    const { libraries } = await readPackageManifest(packagePath);
    return [
      ...(await auditBeforeInstall(
        { libraries, installed: this.installed },
        { sink: this.audit, change: { source: 'seed', actorUserId: null, sha256 } },
        () => this.importer.installLibrariesFromPackage(packagePath),
      )),
    ];
  }
}
