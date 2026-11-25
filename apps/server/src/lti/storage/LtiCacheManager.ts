/**
 * LtiCacheManager — ltijs 7's `CacheManager` on the server's node-redis client.
 *
 * Why: ltijs caches two things through a pluggable `CacheManager`: the tool's own keyset (`keyset:default`,
 *      the public keys it serves at `/lti/keys`, 60 seconds) and each platform's public JWKS
 *      (`oidc:jwks:<jwks URL>`, 5 minutes), so it does not fetch Canvas's keys on every launch. Its default is a
 *      no-op and its `RedisCacheManager` needs ioredis; we already run node-redis, shared by every node.
 * Spec: LTI-001, LTI-002
 * Invariants:
 *   - Keys are prefixed `hvli:lti:cache:` so they never collide with H5P or session keys.
 *   - Every value expires after the TTL ltijs passes (`PX`); a TTL that is not a positive number is not cached,
 *     so nothing is ever stored without expiry.
 *   - Only what ltijs hands it is stored, as JSON: public keys, never a secret or personal data.
 *   - A missing or unreadable value is a miss (ltijs then fetches fresh keys).
 *   - A platform's key set that was fetched less than `JWKS_KEEP_MS` ago is not removed: ltijs removes it, and
 *     fetches again, whenever an ID token names a key ID the set does not hold, and anyone can send such a
 *     token. So the platform is asked at most once in that time, whatever is sent (D-141). A real change of keys
 *     is seen at the next fetch, a minute later at most.
 *   - `listen` and `close` do nothing: the server owns the Redis client's lifecycle.
 * Collaborators: ltijs `Provider` (ProviderOptions.cacheManager), ltijs `KeysetService`, `OidcService` and
 *   `PlatformManager` (which deletes the keyset entry when keys change), ../../infra/redisClient.ts.
 * Tests: apps/server/test/lti/storage/LtiCacheManager.int.test.ts,
 *   apps/server/test/lti/storage/ltijsOnPrismaStorage.int.test.ts
 */
import type { CacheManager } from 'ltijs';
import type { Redis } from '../../infra/redisClient.js';

/** Prefix of every key this cache writes. */
export const LTI_CACHE_PREFIX = 'hvli:lti:cache:';

/** ltijs's key prefix for a platform's public key set (`OidcService.JWKS_CACHE_KEY_PREFIX`). */
export const JWKS_KEY_PREFIX = 'oidc:jwks:';
/** How long a fetched key set is kept before ltijs may drop it and fetch again. */
export const JWKS_KEEP_MS = 60_000;

const FRESH_MARK_PREFIX = `${LTI_CACHE_PREFIX}fresh:`;

/**
 * ltijs's cache of public keysets in Redis.
 *
 * SPEC-DEVIATION: D-050 replaces ltijs's ioredis `RedisCacheManager` (named by LTI-001) with this node-redis one.
 */
export class LtiCacheManager implements CacheManager {
  /**
   * @param redis - The server's shared Redis client.
   */
  constructor(private readonly redis: Pick<Redis, 'get' | 'set' | 'del'>) {}

  /** Nothing to open: ltijs would connect its own Redis here, but the shared client is connected by main. */
  async listen(): Promise<void> {}

  /** Nothing to close: the shared Redis client is closed by main. */
  async close(): Promise<void> {}

  /** The cached value of `key`, or undefined for a miss or an unreadable value. */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(LTI_CACHE_PREFIX + key);
    if (typeof raw !== 'string') return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // WHY: a foreign or damaged value is a miss, as ltijs's own cache treats it; ltijs fetches fresh keys.
      return undefined;
    }
  }

  /** Caches `value` under `key` for `ttlMs` milliseconds; a non-positive lifetime caches nothing. */
  async set<T = unknown>(key: string, value: T, ttlMs: number): Promise<void> {
    if (!Number.isFinite(ttlMs) || ttlMs < 1) return;
    const text = JSON.stringify(value);
    if (text === undefined) return;
    await this.redis.set(LTI_CACHE_PREFIX + key, text, { PX: Math.ceil(ttlMs) });
    // WHY: the mark outlives no key set by more than its own time, and says "fetched just now" to `delete`.
    if (key.startsWith(JWKS_KEY_PREFIX)) {
      await this.redis.set(FRESH_MARK_PREFIX + key, '1', { PX: Math.min(JWKS_KEEP_MS, Math.ceil(ttlMs)) });
    }
  }

  /** Removes `key` from the cache; a platform's key set fetched within `JWKS_KEEP_MS` stays. */
  async delete(key: string): Promise<void> {
    // SECURITY: an unknown key ID in a token must not make the server ask the platform on every request (D-141).
    if (key.startsWith(JWKS_KEY_PREFIX) && (await this.redis.get(FRESH_MARK_PREFIX + key)) !== null) return;
    await this.redis.del(LTI_CACHE_PREFIX + key);
  }
}
