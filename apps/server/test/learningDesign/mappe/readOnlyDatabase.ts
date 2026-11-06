/**
 * readOnlyDatabase — the test database wrapped so that every write through it is recorded, for the tests that prove
 * the pedagogisk mappe export stores nothing (MAPPE-003).
 *
 * Why: "not stored on the server" is shown by watching the client the export uses: a model write (`create`,
 *      `update`, `delete` and the like) or a raw `$execute…` or `$transaction` is recorded by name, so a test can
 *      assert that none happened. The call itself still runs, so a recorder that misses a write shows up in a test
 *      that writes on purpose.
 * Spec: MAPPE-003
 * Tests: apps/server/test/learningDesign/mappe/mappePrivacy.int.test.ts,
 *   apps/server/test/learningDesign/mappe/storedActivityResults.int.test.ts
 */
import type { Database } from '../../../src/infra/prismaClient.js';

const WRITES = /^(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)$/;

/**
 * The database, with every write recorded.
 * @param db - The test database.
 * @param writes - Receives `model.method` or `$method` for each write.
 * @returns A client that behaves as `db` and records its writes.
 */
export function readOnlyDatabase(db: Database, writes: string[]): Database {
  return new Proxy(db, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof property === 'string' && /^\$(execute|transaction)/.test(property)) {
        return (...args: unknown[]) => {
          writes.push(property);
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      if (typeof value !== 'object' || value === null) return value;
      return new Proxy(value, {
        get(model, method, modelReceiver) {
          const fn: unknown = Reflect.get(model, method, modelReceiver);
          if (typeof method === 'string' && WRITES.test(method)) writes.push(`${String(property)}.${method}`);
          return typeof fn === 'function' ? fn.bind(model) : fn;
        },
      });
    },
  });
}
