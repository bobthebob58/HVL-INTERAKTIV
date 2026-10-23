/**
 * loginTransactions — single-use Feide login transactions in Redis: the state, nonce and PKCE verifier of one
 * login, bound to one browser by the `__Host-hvli_login` cookie that carries the transaction ID.
 *
 * Why: AUTH-001 requires Authorization Code with PKCE (S256), state and nonce. D-057 binds those values to the
 *      browser that started the login, so a callback URL forced on another browser (login CSRF), replayed, or
 *      opened after 10 minutes finds no transaction and completes no login.
 * Spec: AUTH-001, AUTH-003
 * Invariants:
 *   - txId, state, nonce and codeVerifier are 32 independent random bytes each (base64url, 43 characters), so the
 *     URL Feide sees (state, nonce, PKCE challenge) reveals nothing about the cookie.
 *   - The Redis key is `hvli:login:<base64url SHA-256(txId)>` with a 10-minute TTL; the value holds only state,
 *     nonce, codeVerifier, returnTo and createdAt (DATA-INVENTORY, Redis section).
 *   - `consume` is single-use: GETDEL reads and deletes in one step, so two callbacks racing for one transaction
 *     cannot both get it. It returns undefined for an unknown, used, expired or malformed transaction.
 *   - `returnTo` passes through `safeReturnTo` (../returnTo.ts) before it is stored, so a transaction only ever
 *     holds and hands back a local path, whatever the caller passed (open redirect, `javascript:`).
 * Collaborators: ./FeideClient.ts (LoginChecks), ./feideLoginRoutes.ts, ../returnTo.ts,
 *   ../session/sessionCookies.ts (LOGIN_COOKIE), ../session/opaqueIds.ts.
 * Tests: apps/server/test/auth/feide/loginTransactions.int.test.ts
 */
import { z } from 'zod';
import type { Redis } from '../../infra/redisClient.js';
import { safeReturnTo } from '../returnTo.js';
import { isOpaqueId, newOpaqueId, opaqueIdKey } from '../session/opaqueIds.js';
import type { LoginChecks } from './FeideClient.js';

/** How long a login may take from redirect to callback (the login cookie lives as long). */
export const LOGIN_TRANSACTION_TTL_MS = 10 * 60 * 1000;
/** Namespace of login-transaction keys in Redis. */
export const LOGIN_KEY_PREFIX = 'hvli:login:';

/**
 * The Redis key of a login transaction.
 * @param txId - The transaction ID from the login cookie.
 * @returns `hvli:login:<base64url SHA-256(txId)>`.
 */
export const loginTransactionRedisKey = (txId: string): string => opaqueIdKey(LOGIN_KEY_PREFIX, txId);

// PRIVACY: login secrets and a local path only; nothing about the person (DATA-001).
const StoredLoginTransaction = z.object({
  state: z.string().min(1),
  nonce: z.string().min(1),
  codeVerifier: z.string().min(1),
  returnTo: z.string(),
  createdAt: z.number().int(),
});

/** One login's checks and where to go afterwards. */
export interface LoginTransaction extends LoginChecks {
  /** The checked local path to open after login. */
  readonly returnTo: string;
}

/** A transaction `begin` has just stored. */
export interface BegunLoginTransaction extends LoginTransaction {
  /** The transaction ID, for the `__Host-hvli_login` cookie only. */
  readonly txId: string;
}

/** Single-use login transactions in Redis. */
export class LoginTransactions {
  /**
   * @param redis - Shared Redis.
   * @param now - The clock; tests pass a fake one.
   */
  constructor(
    private readonly redis: Redis,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Starts a login: makes fresh state, nonce and PKCE verifier and stores them for 10 minutes.
   * @param input - `returnTo`: where to go after login (untrusted; reduced to a local path or `/`).
   * @returns The transaction ID (for the login cookie), the values for the authorisation request, and the checked
   *   `returnTo` that was stored.
   * @throws Error when the ID collides (never expected).
   */
  async begin(input: { readonly returnTo: string }): Promise<BegunLoginTransaction> {
    const txId = newOpaqueId();
    const checks: LoginChecks = { state: newOpaqueId(), nonce: newOpaqueId(), codeVerifier: newOpaqueId() };
    // SECURITY: checked here as well as by the route, so no caller can turn the callback into an open redirect.
    const returnTo = safeReturnTo(input.returnTo);
    const record = { ...checks, returnTo, createdAt: this.now().getTime() };
    const options = { PX: LOGIN_TRANSACTION_TTL_MS, NX: true } as const;
    const written = await this.redis.set(loginTransactionRedisKey(txId), JSON.stringify(record), options);
    if (written !== 'OK') throw new Error('login transaction ID collision');
    return { txId, ...checks, returnTo };
  }

  /**
   * Takes a login transaction out of Redis; a second call for the same ID finds nothing.
   * @param txId - The transaction ID from the login cookie (untrusted).
   * @returns The transaction, or undefined when it is unknown, already used, older than 10 minutes or malformed.
   */
  async consume(txId: string): Promise<LoginTransaction | undefined> {
    if (!isOpaqueId(txId)) return undefined;
    // SECURITY: GETDEL makes the transaction single-use even when two callbacks arrive at the same moment.
    const raw = await this.redis.getDel(loginTransactionRedisKey(txId));
    if (raw === null) return undefined;
    const record = parse(raw);
    // WHY: the injected clock decides expiry as well as the Redis TTL, so nodes and tests agree on the 10 minutes.
    if (!record || this.now().getTime() - record.createdAt >= LOGIN_TRANSACTION_TTL_MS) return undefined;
    const { state, nonce, codeVerifier, returnTo } = record;
    return { state, nonce, codeVerifier, returnTo };
  }
}

function parse(raw: string): z.infer<typeof StoredLoginTransaction> | undefined {
  try {
    const result = StoredLoginTransaction.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}
