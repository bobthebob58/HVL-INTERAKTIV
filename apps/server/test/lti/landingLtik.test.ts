/**
 * Unit tests of the ltik in a landing page's address (D-130): accepted from our own pages, refused from anywhere
 * else before it is looked at, and without fetch metadata accepted only just after the launch.
 *
 * Spec: LTI-003
 */
import { describe, expect, it, vi } from 'vitest';
import { LANDING_WINDOW_MS, landingLtik } from '../../src/lti/landingLtik.js';
import type { ResolvedLtik } from '../../src/lti/ltikPrincipal.js';

const ISSUED = Date.UTC(2026, 10, 21, 12, 0, 0);
/** A token shaped like an ltik: a JWT whose payload holds `tid` and, unless left out, `iat`. */
const tokenWith = (payload: object): string =>
  ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');
const LTIK = tokenWith({ tid: 'record-1', iat: ISSUED / 1000 });
const RESOLVED = { principal: { userId: 'u' } } as unknown as ResolvedLtik;
const REFUSED = { errorCode: 'hvl:ltik-invalid', status: 401 };

/** Stands for an address without any `ltik`. */
const ABSENT = Symbol('no ltik');

/** A landing request with the given `Sec-Fetch-Site` (none when undefined) and ltik query value. */
const landing = (site: string | undefined, ltik: unknown = LTIK, at = ISSUED + 1000) => {
  const resolve = vi.fn(async () => RESOLVED);
  const query = ltik === ABSENT ? {} : { ltik };
  const req = { query, headers: site === undefined ? {} : { 'sec-fetch-site': site } };
  return { resolve, result: landingLtik(req as never, resolve, () => new Date(at)) };
};

describe('[LTI-003] the ltik in a landing page’s address', () => {
  it('[LTI-003] from our own page it is resolved and handed back, however old the launch is', async () => {
    // Act
    const fresh = await landing('same-origin').result;
    const hoursLater = await landing('same-origin', LTIK, ISSUED + 20 * 3_600_000).result;
    // Assert
    expect(fresh).toEqual({ ...RESOLVED, ltik: LTIK });
    expect(hoursLater.ltik).toBe(LTIK);
  });

  it.each(['cross-site', 'same-site', 'none', 'SAME-ORIGIN', ''])(
    '[LTI-003] with Sec-Fetch-Site «%s» it is refused before the ltik is looked at',
    async (site) => {
      // Act
      const { resolve, result } = landing(site);
      // Assert
      await expect(result).rejects.toMatchObject(REFUSED);
      expect(resolve).not.toHaveBeenCalled();
    },
  );

  it('[LTI-003] without fetch metadata it is accepted up to ten minutes after the launch, and not after', async () => {
    // Act
    const atTheLimit = await landing(undefined, LTIK, ISSUED + LANDING_WINDOW_MS).result;
    const pastIt = landing(undefined, LTIK, ISSUED + LANDING_WINDOW_MS + 1).result;
    // Assert
    expect(LANDING_WINDOW_MS).toBe(600_000);
    expect(atTheLimit.ltik).toBe(LTIK);
    await expect(pastIt).rejects.toMatchObject(REFUSED);
  });

  it.each([
    ['no issue time', tokenWith({ tid: 'record-1' })],
    ['an issue time that is no number', tokenWith({ tid: 'record-1', iat: 'now' })],
    ['a payload that is no JSON', 'e30.bm90LWpzb24.sig'],
  ])('[LTI-003] without fetch metadata an ltik with %s is refused', async (_case, ltik) => {
    // Act
    const { result } = landing(undefined, ltik);
    // Assert
    await expect(result).rejects.toMatchObject(REFUSED);
  });

  it.each([
    ['missing', ABSENT],
    ['empty', ''],
    ['repeated', [LTIK, LTIK]],
  ])('[LTI-003] a %s ltik is refused without a lookup', async (_case, ltik) => {
    // Act
    const { resolve, result } = landing('same-origin', ltik);
    // Assert
    await expect(result).rejects.toMatchObject(REFUSED);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('[LTI-003] what the resolver refuses stays refused, whatever the browser says', async () => {
    // Arrange
    const resolve = vi.fn(async () => Promise.reject(new Error('resolver refused')));
    const req = { query: { ltik: LTIK }, headers: { 'sec-fetch-site': 'same-origin' } };
    // Act
    const result = landingLtik(req as never, resolve);
    // Assert
    await expect(result).rejects.toThrow('resolver refused');
  });
});
