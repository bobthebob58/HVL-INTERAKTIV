/**
 * LibraryAuditRecorder — writes one audit event per installed or updated H5P library.
 *
 * Why: libraries are code that runs for every learner, so every change must be traceable to a person (or to
 *      the seed command), a version change and the hash of the package it came from (`H5P-011`, D-041).
 * Spec: H5P-011
 * Invariants:
 *   - One row per library that was newly installed (`new`) or patched (`patch`); `none` results write nothing.
 *   - Versions are written as `major.minor.patch`.
 * Collaborators: ./LibraryInstaller.ts (seed), ../HvlH5PEditor.ts (admin package import), prisma LibraryAuditEvent.
 * Tests: apps/server/test/h5p/libraries/LibraryAuditRecorder.int.test.ts
 */
import type { ILibraryInstallResult } from '@lumieducation/h5p-server';
import type { IFullLibraryName } from '@lumieducation/h5p-server/build/src/types.js';
import type { Database } from '../../infra/prismaClient.js';

/** Who and what caused a library change. */
export interface LibraryChange {
  /** `seed` for the seed command, `upload` for an admin's package import. */
  readonly source: 'seed' | 'upload';
  /** The admin's `User.id`; null for the seed command. */
  readonly actorUserId: string | null;
  /** SHA-256 (hex) of the package the libraries came from. */
  readonly sha256: string | null;
}

/** Records library changes. */
export interface LibraryAuditSink {
  /**
   * Records the results of one install.
   * @param results - What Lumi installed or updated.
   * @param change - Who and from which package.
   */
  record(results: readonly ILibraryInstallResult[], change: LibraryChange): Promise<void>;
}

const version = (lib: IFullLibraryName | undefined): string | null =>
  lib ? `${lib.majorVersion}.${lib.minorVersion}.${lib.patchVersion}` : null;

/** Writes library changes to the LibraryAuditEvent table. */
export class PrismaLibraryAuditSink implements LibraryAuditSink {
  /**
   * @param db - Prisma client.
   */
  constructor(private readonly db: Database) {}

  async record(results: readonly ILibraryInstallResult[], change: LibraryChange): Promise<void> {
    const rows = results
      .filter((result) => (result.type === 'new' || result.type === 'patch') && result.newVersion)
      .map((result) => ({
        actorUserId: change.actorUserId,
        source: change.source,
        sha256: change.sha256,
        machineName: result.newVersion?.machineName ?? '',
        fromVersion: version(result.oldVersion),
        toVersion: version(result.newVersion),
      }));
    if (rows.length > 0) await this.db.libraryAuditEvent.createMany({ data: rows });
  }
}
