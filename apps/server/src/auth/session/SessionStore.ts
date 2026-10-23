/**
 * SessionStore — portal sessions in Redis behind an opaque cookie ID, with idle and absolute expiry.
 *
 * Why: AUTH-003 asks for a Redis session behind `__Host-hvli_sid` that ends after 2 h idle or 12 h absolute, and
 *      D-021 for the Feide ID token kept server-side only, encrypted, for `id_token_hint` at logout. Generic session
 *      middleware does not give these exact semantics, so this is a small store of our own (D-057).
 * Spec: AUTH-003
 * Invariants:
 *   - `create` always makes a new random ID and writes it with `SET NX`; it never reuses or renews an ID. Login
 *     always calls it and the caller destroys the old session, so an ID known before login is worthless after
 *     it (session fixation).
 *   - The Redis key is `hvli:sess:<base64url SHA-256(sid)>`; the value is a `PortalSessionRecord` (the
 *     DATA-INVENTORY fields). The sid is never stored, and the ID token only encrypted (`session-id-token`).
 *   - `get` refuses and deletes a session idle for 2 h or older than 12 h by the injected clock; otherwise it
 *     slides `lastSeenAt` and the TTL, and the TTL never reaches past the absolute end.
 *   - Sliding uses `SET XX`, so a request in flight never brings back a session that logout has just deleted.
 *   - A malformed stored value counts as no session and is deleted.
 * Collaborators: ./portalSessionRecord.ts, ./opaqueIds.ts, ./portalSessionMiddleware.ts, ./csrfToken.ts,
 *   ../../security/keys/DataEncryption.ts.
 * Tests: apps/server/test/auth/session/SessionStore.int.test.ts,
 *   apps/server/test/auth/session/SessionStore.integrity.int.test.ts
 */
import type { Redis } from '../../infra/redisClient.js';
import { DecryptionError, type DataEncryption } from '../../security/keys/DataEncryption.js';
import { isOpaqueId, newOpaqueId, opaqueIdKey } from './opaqueIds.js';
import {
  checkedPortalSessionRecord,
  parsePortalSessionRecord,
  toPortalSession,
  type NewPortalSession,
  type PortalSession,
  type PortalSessionRecord,
} from './portalSessionRecord.js';

/** A session ends after this long without a request (AUTH-003). */
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
/** A session ends this long after login, however active (AUTH-003). */
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
/** Namespace of session keys in Redis. */
export const SESSION_KEY_PREFIX = 'hvli:sess:';

/**
 * The Redis key of a session.
 * @param sid - The session ID from the cookie.
 * @returns `hvli:sess:<base64url SHA-256(sid)>`.
 */
export const sessionRedisKey = (sid: string): string => opaqueIdKey(SESSION_KEY_PREFIX, sid);

/** A session `create` has just written. */
export interface CreatedPortalSession {
  /** The new session ID, for the cookie only. */
  readonly sid: string;
  /** The session's CSRF token. */
  readonly csrfToken: string;
  /** The session as `get` would return it. */
  readonly session: PortalSession;
}

/** What the store needs. */
export interface SessionStoreDeps {
  /** Shared Redis. */
  readonly redis: Redis;
  /** `DATA_ENCRYPTION_KEYS`, for the ID token. */
  readonly encryption: DataEncryption;
  /** The clock; tests pass a fake one. */
  readonly now?: () => Date;
}

/** Portal sessions in Redis. */
export class SessionStore {
  private readonly redis: Redis;
  private readonly encryption: DataEncryption;
  private readonly now: () => Date;

  /**
   * @param deps - Redis, encryption and an optional clock.
   */
  constructor(deps: SessionStoreDeps) {
    this.redis = deps.redis;
    this.encryption = deps.encryption;
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Starts a new session. Never reuses an ID: every call makes a new random one.
   * @param data - Facts computed at login and Feide's ID token.
   * @returns The new session ID, its CSRF token and the session.
   * @throws Error when the data is invalid or the ID collides (never expected).
   */
  async create(data: NewPortalSession): Promise<CreatedPortalSession> {
    if (typeof data.idToken !== 'string' || data.idToken === '')
      throw new TypeError('an ID token is required');
    const sid = newOpaqueId();
    const now = this.now().getTime();
    const record = checkedPortalSessionRecord({
      userId: data.userId,
      roles: [...new Set(data.roles)],
      hvlMember: data.hvlMember,
      studentAuthor: data.studentAuthor,
      locale: data.locale,
      learnerKey: data.learnerKey,
      csrfToken: newOpaqueId(),
      // PRIVACY: the ID token can carry name and e-mail; it is stored encrypted only (D-021, D-056, DATA-001).
      idTokenEncrypted: this.encryption.encrypt('session-id-token', data.idToken).toString('base64'),
      createdAt: now,
      lastSeenAt: now,
    });
    const options = { PX: SESSION_IDLE_MS, NX: true } as const;
    const written = await this.redis.set(sessionRedisKey(sid), JSON.stringify(record), options);
    if (written !== 'OK') throw new Error('session ID collision');
    return { sid, csrfToken: record.csrfToken, session: toPortalSession(record) };
  }

  /**
   * Loads a session and slides its idle expiry.
   * @param sid - The session ID from the cookie (untrusted).
   * @returns The session, or undefined when it is unknown, malformed, idle for 2 h or older than 12 h.
   */
  async get(sid: string): Promise<PortalSession | undefined> {
    if (!isOpaqueId(sid)) return undefined;
    const key = sessionRedisKey(sid);
    const raw = await this.redis.get(key);
    if (raw === null) return undefined;
    const record = parsePortalSessionRecord(raw);
    const now = this.now().getTime();
    const lifeLeft = record ? this.lifeLeftMs(record, now) : 0;
    if (!record || lifeLeft <= 0) {
      await this.redis.del(key);
      return undefined;
    }
    const slid: PortalSessionRecord = { ...record, lastSeenAt: now };
    // SECURITY: XX writes only while the key exists, so a logout that deleted it between our read and this write
    // stays a logout; the TTL is capped by the absolute end, so sliding never extends a session past 12 h.
    const options = { PX: Math.min(SESSION_IDLE_MS, lifeLeft), XX: true } as const;
    const written = await this.redis.set(key, JSON.stringify(slid), options);
    return written === 'OK' ? toPortalSession(slid) : undefined;
  }

  /**
   * Ends a session and hands back Feide's ID token for `id_token_hint` (D-021).
   * @param sid - The session ID from the cookie.
   * @returns The decrypted ID token, or undefined when the session was unknown, expired or unreadable. The key is
   *   deleted in every case.
   */
  async destroy(sid: string): Promise<string | undefined> {
    if (!isOpaqueId(sid)) return undefined;
    // WHY: GETDEL reads and deletes in one step, so two concurrent logouts cannot both use the token.
    const raw = await this.redis.getDel(sessionRedisKey(sid));
    const record = raw === null ? undefined : parsePortalSessionRecord(raw);
    if (!record || this.lifeLeftMs(record, this.now().getTime()) <= 0) return undefined;
    try {
      const sealed = Buffer.from(record.idTokenEncrypted, 'base64');
      return this.encryption.decrypt('session-id-token', sealed).toString('utf8');
    } catch (error) {
      // WHY: a token sealed with a key removed from the ring cannot help logout; the session is gone either way.
      if (error instanceof DecryptionError) return undefined;
      throw error;
    }
  }

  /** Milliseconds until the absolute end, or 0 once the session is idle for 2 h or older than 12 h. */
  private lifeLeftMs(record: PortalSessionRecord, now: number): number {
    if (now >= record.lastSeenAt + SESSION_IDLE_MS) return 0;
    return Math.max(0, record.createdAt + SESSION_ABSOLUTE_MS - now);
  }
}

export type { NewPortalSession, PortalSession } from './portalSessionRecord.js';
