/**
 * Integration test for the test beds' library audit sink (test/support/testLibraryAuditSink.ts): it writes the rows
 * the real sink writes, and its cleanup removes only those, not an actor-less seed row another process wrote on the
 * shared database at the same time.
 *
 * Spec: NFR-004, H5P-011
 */
import type { ILibraryInstallResult } from '@lumieducation/h5p-server';
import { afterAll, expect, it } from 'vitest';
import { PrismaLibraryAuditSink } from '../../../src/h5p/libraries/LibraryAuditSink.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';
import { TestLibraryAuditSink } from '../../support/testLibraryAuditSink.js';

const installed = (machineName: string): ILibraryInstallResult[] => [
  { type: 'new', newVersion: { machineName, majorVersion: 1, minorVersion: 0, patchVersion: 2 } },
];

describeWithServices('[NFR-004] the test beds’ library audit sink', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const sha256 = uniqueName('sha');
  afterAll(async () => {
    await db.libraryAuditEvent.deleteMany({ where: { sha256 } });
    await db.$disconnect();
  });

  it('[NFR-004] removes the seed rows it wrote and keeps another process’s, written in the same moment', async () => {
    // Arrange: a test bed seeds, and another process seeds through the real sink meanwhile
    const sink = new TestLibraryAuditSink(db);
    const seed = { source: 'seed', actorUserId: null, sha256 } as const;
    await sink.record(installed(`${sha256}.Mine`), seed);
    await new PrismaLibraryAuditSink(db).record(installed(`${sha256}.Theirs`), seed);
    const written = await db.libraryAuditEvent.findMany({ where: { sha256 }, select: { machineName: true } });
    // Act
    const removed = await sink.remove();
    // Assert
    expect(written.map((row) => row.machineName).sort()).toEqual([`${sha256}.Mine`, `${sha256}.Theirs`]);
    expect(removed).toBe(1);
    const left = await db.libraryAuditEvent.findMany({ where: { sha256 } });
    expect(left).toEqual([
      expect.objectContaining({ machineName: `${sha256}.Theirs`, source: 'seed', actorUserId: null }),
    ]);
  });
});
