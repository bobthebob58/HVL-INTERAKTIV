/**
 * Tests for the headers every response carries and the framing rule of portal pages.
 *
 * Spec: LTI-003, SEC-004
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  baseSecurityHeaders,
  DEFAULT_CSP,
  HSTS_MAX_AGE,
  ownAnswerHeaders,
  setPortalFrameHeaders,
} from '../../src/http/securityHeaders.js';

const PAGE_CSP = "default-src 'none'; script-src 'self'; frame-ancestors 'self'";
const app = (https: boolean, includeSubDomains?: boolean) =>
  express()
    .use(baseSecurityHeaders(includeSubDomains === undefined ? { https } : { https, includeSubDomains }))
    .get('/page', (_req, res) => {
      setPortalFrameHeaders(res);
      res.send('ok');
    })
    .get('/own-policy', (_req, res) => {
      res.setHeader('Content-Security-Policy', PAGE_CSP);
      res.send('ok');
    })
    .get('/api', (_req, res) => res.json({}));

describe('[LTI-003] security headers', () => {
  it('[LTI-003] every response is no-referrer and nosniff; HSTS only over https', async () => {
    // Act
    const plain = await request(app(false)).get('/api');
    const secure = await request(app(true)).get('/api');
    // Assert
    expect(plain.headers).toMatchObject({
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-permitted-cross-domain-policies': 'none',
    });
    expect(plain.headers['strict-transport-security']).toBeUndefined();
    expect(secure.headers['strict-transport-security']).toBe(`max-age=${HSTS_MAX_AGE}`);
  });

  it('[LTI-003] HSTS covers the names under the host only when the switch says so', async () => {
    // Act
    const off = await request(app(true, false)).get('/api');
    const on = await request(app(true, true)).get('/api');
    const plain = await request(app(false, true)).get('/api');
    // Assert
    expect(off.headers['strict-transport-security']).toBe(`max-age=${HSTS_MAX_AGE}`);
    expect(on.headers['strict-transport-security']).toBe(`max-age=${HSTS_MAX_AGE}; includeSubDomains`);
    expect(plain.headers['strict-transport-security']).toBeUndefined();
  });

  it('[SEC-004] an answer that sets no policy loads nothing and is framed by nothing; a page keeps its own', async () => {
    // Act
    const answer = await request(app(false)).get('/api');
    const page = await request(app(false)).get('/own-policy');
    // Assert
    expect(DEFAULT_CSP).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(answer.headers['content-security-policy']).toBe(DEFAULT_CSP);
    expect(page.headers['content-security-policy']).toBe(PAGE_CSP);
  });

  it('[SEC-004] portal pages may be framed by our own origin only', async () => {
    const res = await request(app(false)).get('/page');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'self'");
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('[AUTH-003] a portal page gives a window of another site no handle on it', async () => {
    // Act
    const res = await request(app(false)).get('/page');
    // Assert
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
  });

  it('[AUTH-003] an answer about the signed-in person is not cached, embedded or framed by another site', async () => {
    // Arrange
    const own = express()
      .use(ownAnswerHeaders)
      .get('/answer', (_req, res) => void res.json({ ok: true }));
    // Act
    const res = await request(own).get('/answer');
    // Assert
    expect(res.headers).toMatchObject({
      'cache-control': 'no-store',
      'cross-origin-resource-policy': 'same-origin',
      'content-security-policy': "default-src 'none'; frame-ancestors 'self'",
      'x-frame-options': 'SAMEORIGIN',
    });
  });
});
