/**
 * statementDeletes — the test database with `xapiStatement.deleteMany` replaced and everything else passed through,
 * for the yearly purge's tests of a delete that fails or whose rows another writer takes first.
 *
 * Why: D-107's amendment of 2026-11-04 audits a run that fails part-way and has the next check finish it, and its step 5
 *      review keeps a table going when a batch deletes fewer rows than it found. A real database cannot be made to
 *      lose its connection or race on cue; this wrapper can, at exactly the statement delete.
 * Spec: DATA-003
 * Invariants:
 *   - Only `xapiStatement.deleteMany` changes; every other model and method is the real one, bound to its own object,
 *     so transactions, reads and other deletes behave as in production.
 * Collaborators: ../../../../src/infra/prismaClient.ts.
 * Tests: used by apps/server/test/privacy/purge/retentionPurgeFailure.int.test.ts,
 *   apps/server/test/privacy/purge/retentionPurgeJobRetry.int.test.ts,
 *   apps/server/test/privacy/purge/purgeBatches.int.test.ts
 */
import type { Database } from '../../../../src/infra/prismaClient.js';

/** The arguments the purge passes to a statement delete: the batch's IDs and the year filter its page was read with. */
export interface StatementDeleteArgs {
  readonly where: { readonly id: { readonly in: readonly string[] }; readonly academicYear?: unknown };
}

/** The real statement delete, for a replacement that calls it. */
export type RealStatementDelete = (args: StatementDeleteArgs) => Promise<{ count: number }>;

/** Reads a property, binding a method to its own object, as a proxy that passes calls through must. */
const passThrough = (target: object, prop: string | symbol): unknown => {
  const value: unknown = Reflect.get(target, prop);
  return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
};

/**
 * Wraps the database so that statement deletes go through `replace`.
 * @param db - The test database.
 * @param replace - Called for each `xapiStatement.deleteMany` with its arguments and the real delete.
 * @returns The wrapped database.
 */
export function withStatementDeletes(
  db: Database,
  replace: (args: StatementDeleteArgs, real: RealStatementDelete) => Promise<{ count: number }>,
): Database {
  const real: RealStatementDelete = (args) => db.xapiStatement.deleteMany(args as never);
  return new Proxy(db, {
    get(target, prop) {
      if (prop !== 'xapiStatement') return passThrough(target, prop);
      return new Proxy(target.xapiStatement, {
        get: (statements, method) =>
          method === 'deleteMany'
            ? (args: StatementDeleteArgs) => replace(args, real)
            : passThrough(statements, method),
      });
    },
  });
}
