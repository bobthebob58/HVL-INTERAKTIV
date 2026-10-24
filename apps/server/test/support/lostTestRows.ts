/**
 * lostTestRows — tells a failed end-to-end flow whether the rows it set up are still in the shared database.
 *
 * Why: every test process uses the one development database. `openAppTestbed`'s `close` removes every user created
 *      since that testbed opened, with their content, whichever process created them (./appTestbed.ts), and
 *      ./realWebApp.ts signs every process in as the same mock Feide author. A testbed that closes in another
 *      process while a flow runs can therefore delete the flow's teacher, author or activity; the flow then sees
 *      401s and 404s and times out. A failure should say so, not look like a bug in the code under test.
 * Spec: NFR-004
 * Invariants:
 *   - It only reads; it never repairs or recreates a row.
 *   - The answer names each lost row by the label the flow gave it, never by personal data.
 * Collaborators: ./appTestbed.ts, ./realWebApp.ts, ./flowRecorder.ts (the facts of a failed step).
 * Tests: apps/server/e2e/flowRecord.e2e.test.ts; used by apps/server/e2e/appPlayEditor.e2e.test.ts and
 *   apps/server/e2e/publishWithReason.e2e.test.ts
 */
import type { Database } from '../../src/infra/prismaClient.js';

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
  "another process's testbed removed them on the shared database (appTestbed.close deletes every user created " +
  'since it opened, with their content); run this flow without other test processes';

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
