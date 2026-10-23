/**
 * auditBeforeInstall — writes the library audit before a library changes, so no change can go unrecorded.
 *
 * Why: H5P-011 requires an audit event for every library change. Recording after Lumi's install would leave a
 *      change unaudited whenever the audit write fails (the libraries are already on disk by then). Lumi's
 *      decision is predictable from the package alone (LibraryManager.installFromDirectory): a library whose
 *      major.minor is not installed is `new`, a higher patch of an installed one is a `patch`, anything else is
 *      left alone. So the expected changes are recorded first, and the install runs only if that succeeded.
 * Spec: H5P-011
 * Invariants:
 *   - A failed audit write means nothing is installed (fail closed).
 *   - Changes Lumi makes beyond the plan (none are expected) are recorded right after the install.
 *   - A failed install leaves the planned rows: the log may then show an attempted change, never miss a real one.
 * Collaborators: ./LibraryInstaller.ts (seed), ../HvlH5PEditor.ts (admin package import),
 *   ./LibraryAuditRecorder.ts, ./packageManifest.ts.
 * Tests: apps/server/test/h5p/HvlH5PEditor.upload.test.ts, apps/server/test/h5p/libraries/seedLibraries.int.test.ts
 */
import type { ILibraryInstallResult, LibraryManager } from '@lumieducation/h5p-server';
import type { LibraryAuditSink, LibraryChange } from './LibraryAuditRecorder.js';
import type { PackageLibrary } from './packageManifest.js';

/** What Lumi's library manager is asked to predict an install. */
export type InstalledLibraries = Pick<LibraryManager, 'libraryExists' | 'isPatchedLibrary'>;

const fullName = (lib: PackageLibrary) => ({
  machineName: lib.machineName,
  majorVersion: lib.majorVersion,
  minorVersion: lib.minorVersion,
  patchVersion: lib.patchVersion,
});

/**
 * The changes Lumi will make when it installs these library folders.
 * @param libraries - Library folders of the package, with patch versions.
 * @param installed - Lumi's library manager.
 * @returns One `new` or `patch` result per library that will change.
 */
export async function plannedLibraryChanges(
  libraries: readonly PackageLibrary[],
  installed: InstalledLibraries,
): Promise<ILibraryInstallResult[]> {
  const planned: ILibraryInstallResult[] = [];
  for (const lib of libraries) {
    const newVersion = fullName(lib);
    if (!(await installed.libraryExists(newVersion))) {
      planned.push({ type: 'new', newVersion });
      continue;
    }
    const oldVersion = await installed.isPatchedLibrary(newVersion);
    if (oldVersion) planned.push({ type: 'patch', newVersion, oldVersion });
  }
  return planned;
}

const sameChange = (a: ILibraryInstallResult, b: ILibraryInstallResult): boolean =>
  a.type === b.type &&
  a.newVersion?.machineName === b.newVersion?.machineName &&
  a.newVersion?.majorVersion === b.newVersion?.majorVersion &&
  a.newVersion?.minorVersion === b.newVersion?.minorVersion &&
  a.newVersion?.patchVersion === b.newVersion?.patchVersion;

/**
 * Records the planned changes, runs the install, then records anything Lumi did beyond the plan.
 * @param plan - The library folders of the package and Lumi's library manager.
 * @param audit - The audit sink and who caused the change.
 * @param install - Runs the install and returns what Lumi reports.
 * @returns Lumi's install results.
 * @throws Whatever the audit write throws (nothing is installed then), or the install's own error.
 */
export async function auditBeforeInstall(
  plan: { libraries: readonly PackageLibrary[]; installed: InstalledLibraries },
  audit: { sink: LibraryAuditSink; change: LibraryChange },
  install: () => Promise<readonly ILibraryInstallResult[]>,
): Promise<readonly ILibraryInstallResult[]> {
  const planned = await plannedLibraryChanges(plan.libraries, plan.installed);
  if (planned.length > 0) await audit.sink.record(planned, audit.change);
  const results = await install();
  const unplanned = results.filter(
    (r) => (r.type === 'new' || r.type === 'patch') && !planned.some((p) => sameChange(p, r)),
  );
  if (unplanned.length > 0) await audit.sink.record(unplanned, audit.change);
  return results;
}
