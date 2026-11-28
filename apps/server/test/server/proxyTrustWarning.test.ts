/**
 * Tests for what a start says about reverse proxies (D-153): one line with the setting at every start, and one
 * warning more, with the setting and nothing else, when `TRUST_PROXY` is 0 in production; no warning when a proxy
 * is trusted, and none outside production.
 *
 * Spec: NFR-006, LTI-001, AUTH-001
 */
import { describe, expect, it } from 'vitest';
import type { Env } from '../../src/config/env.js';
import { logProxyTrust } from '../../src/server/proxyTrustWarning.js';
import { capturedLogger } from '../support/capturedLogger.js';

type Setting = Pick<Env, 'NODE_ENV' | 'TRUST_PROXY'>;
const logged = (env: Setting): Record<string, unknown>[] => {
  const log = capturedLogger();
  logProxyTrust(log.logger, env);
  return log.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
};

describe('[NFR-006] a production start that trusts no reverse proxy', () => {
  it('[NFR-006] writes the setting, and one warning that says what it means behind a proxy', () => {
    // Act
    const [setting, warning, ...others] = logged({ NODE_ENV: 'production', TRUST_PROXY: 0 });
    // Assert
    expect(others).toEqual([]);
    expect(setting).toMatchObject({ level: 'info', trustProxy: 0, msg: 'reverse proxies trusted' });
    expect(warning).toMatchObject({ level: 'warn', trustProxy: 0 });
    expect(String(warning?.msg)).toMatch(/^TRUST_PROXY is 0: behind a reverse proxy every visitor /);
    // PRIVACY: beside the logger's own fields each line holds the setting and nothing else (DATA-009).
    for (const line of [setting, warning]) {
      expect(Object.keys(line ?? {}).sort()).toEqual(['level', 'msg', 'service', 'time', 'trustProxy']);
    }
  });

  it.each<[string, Setting]>([
    ['one proxy is trusted in production', { NODE_ENV: 'production', TRUST_PROXY: 1 }],
    ['two proxies are trusted in production', { NODE_ENV: 'production', TRUST_PROXY: 2 }],
    ['the server runs in development', { NODE_ENV: 'development', TRUST_PROXY: 0 }],
    ['the server runs in a test', { NODE_ENV: 'test', TRUST_PROXY: 0 }],
  ])('[NFR-006] writes the setting and no warning when %s', (_what, env) => {
    // Act and assert
    expect(logged(env)).toEqual([
      expect.objectContaining({ level: 'info', trustProxy: env.TRUST_PROXY, msg: 'reverse proxies trusted' }),
    ]);
  });
});
