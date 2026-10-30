/**
 * lostTestRows — tells a failed end-to-end flow whether the rows it set up are still in the shared database, and a
 * closed test bed that it left none of its own.
 *
 * Why: every test process uses the one development database. A test bed with a run author (`runAuthor`, as
 *      ./realWebApp.ts opens it for the flows that use this) owns an author whose Feide ID and subject exist only in
 *      this run and a mock Canvas on its own port, and another process's test bed removes only the accounts of its
 *      own mock Feide and Canvas (./appTestbed.ts, ./runFeideAuthor.ts), so it cannot take this flow's rows. Rows
 *      that are gone, or a platform that is inactive, therefore mean that something else changed the shared
 *      database: another server's start-up platform sync, a reset or a manual cleanup. The flow then sees 401s and
 *      404s and times out, and the failure should say so, not look like a bug in the code under test. The reverse
 *      also happened: a test bed whose author's account had outlived an earlier run left every activity it imported
 *      (3 000+ on the start page), so `assertRowsRemoved` checks after `close`.
 * Spec: NFR-004
 * Invariants:
 *   - It only reads; it never repairs, recreates or deletes a row.
 *   - The answer names each lost row by the label the flow gave it, never by personal data.
 * Collaborators: ./appTestbed.ts, ./realWebApp.ts, ./flowRecorder.ts (the facts of a failed step).
 * Tests: apps/server/e2e/flowRecord.e2e.test.ts, apps/server/e2e/testbedCleanup.e2e.test.ts; used by
 *   apps/server/e2e/appPlayEditor.e2e.test.ts, apps/server/e2e/publishWithReason.e2e.test.ts,
 *   apps/server/e2e/bankDuplicate.e2e.test.ts and apps/server/e2e/safeEditReset.e2e.test.ts
 */
import { createPrismaClient, type Database } from '../../src/infra/prismaClient.js';

/** The rows a flow set up, by the label a failure names them with. */
export interface FlowRows {
  /** Label → `User.id`, e.g. `{ teacher: '…' }`. */
  readonly users?: Readonly<Record<string, string>>;
  /** Label → `H5PContent.id`. */
  readonly contents?: Readonly<Record<string, string>>;
  /** The mock Canvas's `LtiPlatform.id`, which must still be there and active. */
  readonly platformId?: string;
}

/** How a failure explains lost rows: the cause and what to do about it. */
export const LOST_ROWS_HINT =
  'something else changed the shared database: a test bed with a run author owns accounts and a mock Canvas that ' +
  "no other process's test bed removes, so look for another server's start-up platform sync, a database reset or " +
  'a manual cleanup; run this flow without other test processes or servers on the same database';

/**
 * Lists the rows of `rows` that are gone (or, for the platform, inactive).
 * @param db - The shared database.
 * @param rows - The flow's rows.
 * @returns The labels of the lost rows, empty when all are there.
 */
export async function lostTestRows(db: Database, rows: FlowRows): Promise<string[]> {
  const lost: string[] = [];
  for (const [label, id] of Object.entries(rows.users ?? {})) {
    if (!(await db.user.findUnique({ where: { id }, select: { id: true } }))) lost.push(`${label} (User)`);
  }
  for (const [label, id] of Object.entries(rows.contents ?? {})) {
    if (!(await db.h5PContent.findUnique({ where: { id }, select: { id: true } })))
      lost.push(`${label} (H5PContent)`);
  }
  if (rows.platformId) {
    const platform = await db.ltiPlatform.findUnique({ where: { id: rows.platformId } });
    if (!platform?.active) lost.push('the mock Canvas (LtiPlatform deleted or inactive)');
  }
  return lost;
}

/**
 * The fact a failed step reports about its rows: `{ lostRows, hint }` when some are lost, else `{ lostRows: [] }`.
 * @param db - The shared database.
 * @param rows - The flow's rows.
 * @returns Facts for `FlowRecord.explain`; a database error is reported as such instead of thrown.
 */
export async function lostRowsFact(db: Database, rows: FlowRows): Promise<Record<string, unknown>> {
  try {
    const lost = await lostTestRows(db, rows);
    return lost.length > 0 ? { lostRows: lost, hint: LOST_ROWS_HINT } : { lostRows: [] };
  } catch (error) {
    return { lostRows: `unknown (${error instanceof Error ? error.message : String(error)})` };
  }
}

/**
 * Fails when any of a closed test bed's accounts or activities is still in the database. It reads on a connection
 * of its own, because the test bed's is closed.
 * @param databaseUrl - The shared database.
 * @param rows - The accounts the run created and the activities it imported (and any activity those accounts own).
 * @throws Error naming how many activities and accounts were left.
 */
export async function assertRowsRemoved(
  databaseUrl: string,
  rows: { readonly users: readonly string[]; readonly contents: readonly string[] },
): Promise<void> {
  const db = createPrismaClient(databaseUrl);
  try {
    const where = { OR: [{ id: { in: [...rows.contents] } }, { ownerUserId: { in: [...rows.users] } }] };
    const activities = await db.h5PContent.count({ where });
    const accounts = await db.user.count({ where: { id: { in: [...rows.users] } } });
    if (activities + accounts > 0) {
      throw new Error(`the closed test bed left ${activities} activities and ${accounts} accounts`);
    }
  } finally {
    await db.$disconnect();
  }
}
