/**
 * Tests for what Express removes from and adds to a request before the web app sees it.
 *
 * Spec: LTI-003, AUTH-003, DATA-009, PROD-012
 */
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { describe, expect, it } from 'vitest';
import {
  LOCALE_HEADER,
  prepareWebRequest,
  stripForWebApp,
  withoutLtik,
} from '../../src/web/webRequestContract.js';

/** A request as Node parses it from raw header pairs. */
function requestWith(url: string, raw: string[]): IncomingMessage {
  const req = new IncomingMessage(new Socket());
  req.url = url;
  req.rawHeaders = raw;
  for (let i = 0; i < raw.length; i += 2) req.headers[(raw[i] ?? '').toLowerCase()] = raw[i + 1] ?? '';
  return req;
}

describe('[LTI-003] web request contract', () => {
  it('[LTI-003] removes credentials, forged decisions and Next.js internals in every spelling', () => {
    // Arrange
    const req = requestWith('/hjelp', [
      'Cookie', '__Host-hvli=secret',
      'AUTHORIZATION', 'Bearer ltik-token',
      'Proxy-Authorization', 'Basic x',
      'Content-Security-Policy', "script-src 'nonce-forged'",
      'content-security-policy-report-only', "script-src 'nonce-forged'",
      'X-HVLI-Locale', 'en',
      'x-hvli-anything', 'x',
      'X-Middleware-Subrequest', 'middleware',
      'Next-Action', 'abc',
      'Accept', 'text/html',
    ]); // prettier-ignore
    // Act
    prepareWebRequest(req, { csp: "script-src 'self' 'nonce-real'", locale: 'nn' });
    // Assert
    expect(req.headers).toEqual({
      accept: 'text/html',
      'content-security-policy': "script-src 'self' 'nonce-real'",
      [LOCALE_HEADER]: 'nn',
    });
    expect(req.rawHeaders).toEqual([
      'Accept', 'text/html',
      'content-security-policy', "script-src 'self' 'nonce-real'",
      LOCALE_HEADER, 'nn',
    ]); // prettier-ignore
    expect(JSON.stringify(req.rawHeaders)).not.toMatch(/secret|ltik-token|forged/);
  });

  it('[DATA-009] removes the ltik query in any case and keeps every other parameter', () => {
    expect(withoutLtik('/app/play?ltik=abc&tab=play')).toBe('/app/play?tab=play');
    expect(withoutLtik('/app/play?LTIK=abc&Ltik=def')).toBe('/app/play');
    expect(withoutLtik('/hjelp?q=ltik')).toBe('/hjelp?q=ltik');
    expect(withoutLtik('/hjelp')).toBe('/hjelp');
  });

  it('[LTI-003] stripping alone (a WebSocket upgrade) removes the same headers and the ltik, and adds nothing', () => {
    // Arrange
    const req = requestWith('/_next/webpack-hmr?ltik=abc&id=1', [
      'Cookie', '__Host-hvli_sid=secret',
      'Authorization', 'Bearer ltik-token',
      'X-HVLI-Locale', 'en',
      'Upgrade', 'websocket',
    ]); // prettier-ignore
    // Act
    stripForWebApp(req);
    // Assert
    expect(req.headers).toEqual({ upgrade: 'websocket' });
    expect(req.rawHeaders).toEqual(['Upgrade', 'websocket']);
    expect(req.url).toBe('/_next/webpack-hmr?id=1');
  });

  it('[PROD-012] the locale header is always Express’s decision', () => {
    const req = requestWith('/?ltik=abc', ['x-hvli-locale', 'en']);
    prepareWebRequest(req, { csp: "default-src 'none'", locale: 'nb' });
    expect(req.headers[LOCALE_HEADER]).toBe('nb');
    expect(req.url).toBe('/');
  });
});
