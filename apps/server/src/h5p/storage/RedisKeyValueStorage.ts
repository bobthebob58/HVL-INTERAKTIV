/**
 * RedisKeyValueStorage — H5P's settings and content-type cache store, shared by every server instance.
 *
 * Why: the content-type cache and settings such as the Hub site UUID must be the same on every node
 *      (H5P-004 acceptance: "two server instances share the content-type cache").
 * Spec: H5P-004
 * Invariants:
 *   - Values are stored as JSON under `<prefix><key>`; a missing key loads as `undefined`, as H5P expects,
 *     and saving `undefined` deletes the key.
 *   - No personal data is stored here (H5P keeps only settings and the public content-type list).
 * Collaborators: `redis` client (shared with RedisLockProvider), ../H5pConfigFactory.ts, H5PEditor (S2).
 * Tests: apps/server/test/h5p/sharedState.int.test.ts
 */
import type { IKeyValueStorage } from '@lumieducation/h5p-server';
import type { RedisClientType } from 'redis';

/** Default key prefix, so H5P keys never collide with other Redis users. */
export const DEFAULT_PREFIX = 'hvli:h5p:kv:';

/** Redis-backed `IKeyValueStorage`. */
export class RedisKeyValueStorage implements IKeyValueStorage {
  /**
   * @param redis - Connected client.
   * @param prefix - Key prefix.
   */
  constructor(
    private readonly redis: Pick<RedisClientType, 'get' | 'set' | 'del'>,
    private readonly prefix: string = DEFAULT_PREFIX,
  ) {}

  /**
   * Loads a value.
   * @param key - Setting or cache key.
   * @returns The stored value, or undefined.
   */
  async load(key: string): Promise<unknown> {
    const raw = await this.redis.get(this.prefix + key);
    return raw === null ? undefined : JSON.parse(raw);
  }

  /**
   * Saves a value.
   * @param key - Setting or cache key.
   * @param value - Any JSON-serialisable value, or undefined to remove the setting.
   */
  async save(key: string, value: unknown): Promise<void> {
    // WHY: H5PConfig.save() writes unset optional settings (e.g. `proxy`) as undefined, which JSON cannot hold.
    if (value === undefined) await this.redis.del(this.prefix + key);
    else await this.redis.set(this.prefix + key, JSON.stringify(value));
  }
}
