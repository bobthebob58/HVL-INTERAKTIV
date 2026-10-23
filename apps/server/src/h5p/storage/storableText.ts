/**
 * storableText — refuses text that PostgreSQL cannot store, before a content or learner-state write.
 *
 * Why: PostgreSQL's `text` and `jsonb` refuse U+0000 and unpaired UTF-16 surrogates. Without a check, an author's
 *      or a learner's request with such a character fails inside the database driver and is answered with 500,
 *      although the request is at fault (PROD-012).
 * Spec: PROD-012, H5P-004
 * Invariants:
 *   - Every string and every object key in the values is checked, at any depth, iteratively.
 *   - A refusal is a 400 `hvl:unstorable-text`; nothing is written.
 * Collaborators: ./PrismaContentStorage.ts (addContent), ./PrismaContentUserDataStorage.ts.
 * Tests: apps/server/test/http/contentInput.int.test.ts
 */
import { H5pError } from '@lumieducation/h5p-server';

const storable = (text: string): boolean => text.isWellFormed() && !text.includes('\u0000');

/**
 * Throws when any string or key in the values holds U+0000 or an unpaired surrogate.
 * @param values - Parameters, metadata or learner state about to be stored.
 * @throws H5pError `hvl:unstorable-text` (400).
 */
export function assertStorableText(...values: unknown[]): void {
  const pending: unknown[] = [...values];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string') {
      if (!storable(value)) throw new H5pError('hvl:unstorable-text', {}, 400);
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        if (!storable(key)) throw new H5pError('hvl:unstorable-text', {}, 400);
        pending.push(child);
      }
    }
  }
}
