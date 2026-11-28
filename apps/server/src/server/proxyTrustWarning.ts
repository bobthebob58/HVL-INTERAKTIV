/**
 * proxyTrustWarning — says at every start how many reverse proxies the server trusts, and warns when a production
 * start trusts none (`TRUST_PROXY=0`).
 *
 * Why: production runs behind a reverse proxy that ends TLS (docs/assurance/threat-model.md, assumption A1). With
 *      `TRUST_PROXY` left at 0 the app then takes the proxy's address for every visitor's: the request ceilings
 *      per address on the Feide login and the LTI login and launch (../http/addressRequestCeiling.ts) count
 *      everyone as one, so ordinary use, or one stranger, can use up the ceiling for all, and the audit's address
 *      hash is the same for everyone. The value is right only when no proxy is in front, which the app cannot
 *      see, so it warns and starts (D-153).
 * Spec: NFR-006, LTI-001, AUTH-001
 * Invariants:
 *   - One `info` line with the setting at every start, for the deployment checklist; one `warn` line more, only
 *     when `NODE_ENV` is `production` and `TRUST_PROXY` is 0.
 *   - PRIVACY: the lines hold the setting's value and nothing of a request or a person (DATA-009).
 *   - The start is never refused for it: a server without a proxy in front is a valid set-up.
 * Collaborators: ./main.ts (calls it at the start), ./createApp.ts (applies `TRUST_PROXY`), ../config/env.ts.
 * Tests: apps/server/test/server/proxyTrustWarning.test.ts, apps/server/test/server/main.smoke.test.ts
 */
import type { Logger } from 'pino';
import type { Env } from '../config/env.js';

/**
 * Writes how many reverse proxies are trusted, and warns when a production server trusts none.
 * @param logger - The server's logger.
 * @param env - The mode and the number of trusted proxies.
 */
export function logProxyTrust(
  logger: Pick<Logger, 'info' | 'warn'>,
  env: Pick<Env, 'NODE_ENV' | 'TRUST_PROXY'>,
): void {
  logger.info({ trustProxy: env.TRUST_PROXY }, 'reverse proxies trusted');
  if (env.NODE_ENV !== 'production' || env.TRUST_PROXY !== 0) return;
  logger.warn(
    { trustProxy: env.TRUST_PROXY },
    'TRUST_PROXY is 0: behind a reverse proxy every visitor then has the proxy’s address and shares one ' +
      'request ceiling; set it to the number of proxies in front (usually 1)',
  );
}
