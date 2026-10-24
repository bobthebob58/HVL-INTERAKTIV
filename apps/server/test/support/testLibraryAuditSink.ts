/**
 * testLibraryAuditSink — the library audit sink of a test bed: it writes the rows the real sink writes and keeps
 * their IDs, so the test bed's close removes exactly the seed audit rows its own seeding wrote.
 *
 * Why: seeding records its installs without an actor (D-041), and every test process shares the development
 *      database. Removing actor-less seed rows written since the test bed opened also took other processes' rows:
 *      another test bed's seeding, the rows seedLibraries.int.test.ts and LibraryAuditSink.int.test.ts read back,
 *      or a developer's `npm run seed:libraries`, whose install record is the 2-year library audit (DATA-007).
 * Spec: NFR-004, H5P-011
 * Invariants:
 *   - The rows are ../../src/h5p/libraries/LibraryAuditSink.ts `libraryAuditRows`, as the real sink writes them.
 *   - `remove` deletes by row ID only, never by time, source or actor.
 * Collaborators: ./httpTestbed.ts, ./realWebApp.ts, ../../src/h5p/libraries/LibraryInstaller.ts.
 * Tests: apps/server/test/h5p/libraries/testLibraryAuditSink.int.test.ts
 */
import type { ILibraryInstallResult } from '@lumieducation/h5p-server';
import {
  libraryAuditRows,
  type LibraryAuditSink,
  type LibraryChange,
} from '../../src/h5p/libraries/LibraryAuditSink.js';
import type { Database } from '../../src/infra/prismaClient.js';

/** A library audit sink that remembers the rows it wrote. */
export class TestLibraryAuditSink implements LibraryAuditSink {
  private readonly ids: string[] = [];

  /**
   * @param db - The test bed's Prisma client.
   */
  constructor(private readonly db: Database) {}

  async record(results: readonly ILibraryInstallResult[], change: LibraryChange): Promise<void> {
    const rows = libraryAuditRows(results, change);
    if (rows.length === 0) return;
    const written = await this.db.libraryAuditEvent.createManyAndReturn({ data: rows, select: { id: true } });
    this.ids.push(...written.map((row) => row.id));
  }

  /**
   * Deletes the rows this sink wrote, and nothing else.
   * @returns How many rows were deleted.
   */
  async remove(): Promise<number> {
    const { count } = await this.db.libraryAuditEvent.deleteMany({ where: { id: { in: this.ids } } });
    this.ids.length = 0;
    return count;
  }
}
