/**
 * Integration test for the yearly purge's deletes under a concurrent login (D-107's amendment of 2026-11-04, second
 * step 5 review), in the academic years 2001 (ended) and 2002: a learner whom a login makes staff after the purge has
 * read a page of identities and before it deletes them keeps their identity and their account, as the delete repeats
 * the page's filter; the other learner identities of the page still go.
 *
 * Spec: DATA-003, DATA-002
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Database } from '../../../src/infra/prismaClient.js';
import { purgeScopeAt } from '../../../src/privacy/purge/purgeCalendar.js';
import { deletePurgeRows, emptyTableCounts } from '../../../src/privacy/purge/purgeTables.js';
import { describeWithServices } from '../../support/services.js';
import { openPurgeFixture, type PurgeFixture } from './support/purgeFixture.js';

/**
 * The database, except that reading a page of identities is followed by a login that makes `userId` staff, as
 * `AccountResolver` does for a learner who now has a staff role.
 */
const loginMakesStaffAfterRead = (db: Database, userId: string): Database =>
  new Proxy(db, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop);
      if (prop !== 'identity') {
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
      }
      const identities = target.identity;
      return new Proxy(identities, {
        get: (model, method) => {
          if (method !== 'findMany') {
            const member: unknown = Reflect.get(model, method);
            return typeof member === 'function'
              ? (member as (...args: unknown[]) => unknown).bind(model)
              : member;
          }
          return async (args: Parameters<Database['identity']['findMany']>[0]) => {
            const rows = await model.findMany(args);
            await target.user.update({ where: { id: userId }, data: { kind: 'staff' } });
            return rows;
          };
        },
      });
    },
  });

describeWithServices('[DATA-003] the yearly purge’s deletes under a concurrent login', () => {
  let fx: PurgeFixture;
  beforeAll(async () => {
    fx = await openPurgeFixture(2001);
  });
  afterAll(() => fx.close());

  it('[DATA-003] keeps the identity of a learner a login made staff between the page read and its delete', async () => {
    // Arrange
    const { old, linked } = fx.accounts;
    const db = loginMakesStaffAfterRead(fx.db, old);
    const tally = emptyTableCounts();
    // Act
    await deletePurgeRows(db, purgeScopeAt(fx.runsAt), tally);
    // Assert: only `linked`'s identity from 2001 went; `old` is staff now and keeps both its identity and its account.
    const accounts = await fx.db.user.findMany({
      where: { id: { in: [old, linked] } },
      select: { id: true, kind: true, _count: { select: { identities: true } } },
    });
    const of = (id: string) => accounts.find((account) => account.id === id);
    expect(of(old)).toMatchObject({ kind: 'staff', _count: { identities: 1 } });
    expect(of(linked)).toMatchObject({ kind: 'learner', _count: { identities: 1 } });
    expect([tally.learnerIdentities, tally.learnerUsers]).toEqual([1, 1]);
  });
});
