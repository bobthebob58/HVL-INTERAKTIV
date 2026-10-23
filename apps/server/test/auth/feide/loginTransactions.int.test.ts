/**
 * Integration tests for Feide login transactions over real Redis with a fake clock: fresh random state, nonce
 * and PKCE verifier, a hashed key with a 10-minute TTL, single use (also under a race), expiry, and a stored
 * return path that is always local.
 *
 * Spec: AUTH-001, AUTH-003
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LOGIN_KEY_PREFIX,
  LOGIN_TRANSACTION_TTL_MS,
  LoginTransactions,
  loginTransactionRedisKey,
} from '../../../src/auth/feide/loginTransactions.js';
import { newOpaqueId } from '../../../src/auth/session/opaqueIds.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

const OPAQUE = /^[A-Za-z0-9_-]{43}$/;

describeWithServices('[AUTH-001] Feide login transactions', () => {
  let redis: Redis;
  const txIds: string[] = [];

  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
  });
  afterAll(async () => {
    if (txIds.length > 0) await redis.del(txIds.map(loginTransactionRedisKey));
    await redis.quit();
  });

  /** Transactions on a fake clock. */
  const testbed = () => {
    let clock = new Date('2026-10-23T08:00:00Z').getTime();
    const transactions = new LoginTransactions(redis, () => new Date(clock));
    const begin = async (returnTo = '/mappe') => {
      const begun = await transactions.begin({ returnTo });
      txIds.push(begun.txId);
      return begun;
    };
    return { transactions, begin, advance: (ms: number) => (clock += ms) };
  };

  it('[AUTH-001] makes a fresh, independent random state, nonce, PKCE verifier and ID for every login', async () => {
    // Arrange
    const { begin } = testbed();
    // Act
    const first = await begin();
    const second = await begin();
    // Assert
    const values = [first, second].flatMap((tx) => [tx.txId, tx.state, tx.nonce, tx.codeVerifier]);
    for (const value of values) expect(value).toMatch(OPAQUE);
    expect(new Set(values).size).toBe(8);
    expect(first.returnTo).toBe('/mappe');
  });

  it('[AUTH-001] stores only the login values under a hash of the ID, for 10 minutes', async () => {
    // Arrange
    const { begin } = testbed();
    const tx = await begin('/innsikt');
    // Act
    const keys = await redis.keys(`${LOGIN_KEY_PREFIX}*`);
    const raw = (await redis.get(loginTransactionRedisKey(tx.txId))) ?? '{}';
    const ttl = await redis.pTTL(loginTransactionRedisKey(tx.txId));
    // Assert
    expect(keys.some((key) => key.includes(tx.txId))).toBe(false);
    expect(raw).not.toContain(tx.txId);
    expect(Object.keys(JSON.parse(raw) as object).sort()).toEqual([
      'codeVerifier',
      'createdAt',
      'nonce',
      'returnTo',
      'state',
    ]);
    expect(ttl).toBeGreaterThan(LOGIN_TRANSACTION_TTL_MS - 60_000);
    expect(ttl).toBeLessThanOrEqual(LOGIN_TRANSACTION_TTL_MS);
  });

  it('[AUTH-001] gives a transaction back once; a second consume of the same ID fails', async () => {
    // Arrange
    const { transactions, begin } = testbed();
    const { txId, ...expected } = await begin('/h5p/play/1');
    // Act
    const first = await transactions.consume(txId);
    const second = await transactions.consume(txId);
    // Assert
    expect(first).toEqual(expected);
    expect(second).toBeUndefined();
    expect(await redis.exists(loginTransactionRedisKey(txId))).toBe(0);
  });

  it('[AUTH-001] lets exactly one of ten racing callbacks consume a transaction', async () => {
    const { transactions, begin } = testbed();
    const { txId } = await begin();
    const results = await Promise.all(Array.from({ length: 10 }, () => transactions.consume(txId)));
    expect(results.filter((result) => result !== undefined)).toHaveLength(1);
  });

  it.each(['//evil.example/x', 'https://evil.example', 'javascript:alert(1)', '/%2F%2Fevil.example'])(
    '[AUTH-003] stores and returns only a local path, so %s cannot make the callback an open redirect',
    async (unsafe) => {
      // Arrange
      const { transactions, begin } = testbed();
      // Act
      const begun = await begin(unsafe);
      const consumed = await transactions.consume(begun.txId);
      // Assert
      expect(begun.returnTo).toBe('/');
      expect(consumed?.returnTo).toBe('/');
    },
  );

  it('[AUTH-001] refuses a transaction 10 minutes after it began, and accepts it just before', async () => {
    // Arrange
    const late = testbed();
    const early = testbed();
    const lateTx = await late.begin();
    const earlyTx = await early.begin();
    // Act
    late.advance(LOGIN_TRANSACTION_TTL_MS);
    early.advance(LOGIN_TRANSACTION_TTL_MS - 1);
    // Assert
    expect(await late.transactions.consume(lateTx.txId)).toBeUndefined();
    expect(await early.transactions.consume(earlyTx.txId)).toMatchObject({ state: earlyTx.state });
    expect(await redis.exists(loginTransactionRedisKey(lateTx.txId))).toBe(0);
  });

  it('[AUTH-001] finds nothing for an unknown ID, and treats a malformed stored value as no transaction', async () => {
    // Arrange
    const { transactions } = testbed();
    const broken = newOpaqueId();
    txIds.push(broken);
    await redis.set(loginTransactionRedisKey(broken), '{"state":1}', { PX: 60_000 });
    // Act and assert
    expect(await transactions.consume(newOpaqueId())).toBeUndefined();
    expect(await transactions.consume(broken)).toBeUndefined();
    expect(await redis.exists(loginTransactionRedisKey(broken))).toBe(0);
  });
});

describe('[AUTH-001] login transaction input checks', () => {
  it('[AUTH-001] refuses a cookie value that is not a transaction ID without asking Redis', async () => {
    // Arrange
    const unusedRedis = new Proxy({} as Redis, {
      get: () => {
        throw new Error('Redis must not be called');
      },
    });
    const transactions = new LoginTransactions(unusedRedis);
    // Act and assert
    for (const txId of ['', 'tx-1', 'a'.repeat(44), `${'a'.repeat(42)}.`]) {
      expect(await transactions.consume(txId)).toBeUndefined();
    }
  });
});
