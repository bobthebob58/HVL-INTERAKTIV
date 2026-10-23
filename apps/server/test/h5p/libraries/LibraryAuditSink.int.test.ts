/**
 * Integration test for the library audit: one row per installed or patched library.
 *
 * Spec: H5P-011
 */
import { afterAll, expect, it } from 'vitest';
import type { ILibraryInstallResult } from '@lumieducation/h5p-server';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { PrismaLibraryAuditSink } from '../../../src/h5p/libraries/LibraryAuditSink.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

const lib = (machineName: string, patchVersion: number) => ({
  machineName,
  majorVersion: 1,
  minorVersion: 2,
  patchVersion,
});

describeWithServices('[H5P-011] library audit events', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const sha256 = uniqueName('sha');
  afterAll(async () => {
    await db.libraryAuditEvent.deleteMany({ where: { sha256 } });
    await db.$disconnect();
  });

  it('[H5P-011] records new and patched libraries with versions, actor, source and package hash', async () => {
    const admin = await db.user.create({ data: { kind: 'staff' } });
    const results: ILibraryInstallResult[] = [
      { type: 'new', newVersion: lib(`${sha256}.New`, 0) },
      { type: 'patch', oldVersion: lib(`${sha256}.Patched`, 3), newVersion: lib(`${sha256}.Patched`, 4) },
      { type: 'none' },
    ];
    await new PrismaLibraryAuditSink(db).record(results, { source: 'upload', actorUserId: admin.id, sha256 });
    const rows = await db.libraryAuditEvent.findMany({ where: { sha256 }, orderBy: { machineName: 'asc' } });
    expect(
      rows.map(({ machineName, fromVersion, toVersion, source, actorUserId }) => ({
        machineName,
        fromVersion,
        toVersion,
        source,
        actorUserId,
      })),
    ).toEqual([
      {
        machineName: `${sha256}.New`,
        fromVersion: null,
        toVersion: '1.2.0',
        source: 'upload',
        actorUserId: admin.id,
      },
      {
        machineName: `${sha256}.Patched`,
        fromVersion: '1.2.3',
        toVersion: '1.2.4',
        source: 'upload',
        actorUserId: admin.id,
      },
    ]);
    await db.libraryAuditEvent.deleteMany({ where: { sha256 } });
    await db.user.delete({ where: { id: admin.id } });
  });

  it('[H5P-011] records the seed command without an actor and writes nothing for unchanged libraries', async () => {
    await new PrismaLibraryAuditSink(db).record([{ type: 'none' }], {
      source: 'seed',
      actorUserId: null,
      sha256,
    });
    expect(await db.libraryAuditEvent.count({ where: { sha256 } })).toBe(0);
    await new PrismaLibraryAuditSink(db).record([{ type: 'new', newVersion: lib(`${sha256}.Seeded`, 1) }], {
      source: 'seed',
      actorUserId: null,
      sha256,
    });
    expect(await db.libraryAuditEvent.findFirst({ where: { sha256 } })).toMatchObject({
      source: 'seed',
      actorUserId: null,
    });
  });
});
