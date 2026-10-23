/**
 * Tests for the portal cookies: exact attributes of the session and login cookies and their clearing variants,
 * the strict Cookie-header parser (duplicates, malformed pairs, no decoding), and replacing a Set-Cookie value.
 *
 * Spec: AUTH-003, AUTH-001
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { newOpaqueId } from '../../../src/auth/session/opaqueIds.js';
import {
  LOGIN_COOKIE,
  SESSION_COOKIE,
  expiredLoginCookie,
  expiredSessionCookie,
  loginCookie,
  parseCookieHeader,
  readCookie,
  sessionCookie,
  setCookie,
} from '../../../src/auth/session/sessionCookies.js';

const ID = newOpaqueId();

describe('[AUTH-003] cookie attributes', () => {
  it('[AUTH-003] the session cookie is __Host-hvli_sid, HttpOnly, Secure, SameSite=Lax, Path=/, without Max-Age', () => {
    expect(SESSION_COOKIE).toBe('__Host-hvli_sid');
    expect(sessionCookie(ID)).toBe(`__Host-hvli_sid=${ID}; Path=/; Secure; HttpOnly; SameSite=Lax`);
    expect(sessionCookie(ID)).not.toMatch(/Domain|Max-Age|Expires/i);
  });

  it('[AUTH-003] clearing the session cookie keeps its attributes and sets Max-Age=0', () => {
    expect(expiredSessionCookie()).toBe(
      '__Host-hvli_sid=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax',
    );
  });

  it('[AUTH-001] the login cookie is __Host-hvli_login for 10 minutes, and its clearing variant has Max-Age=0', () => {
    expect(LOGIN_COOKIE).toBe('__Host-hvli_login');
    expect(loginCookie(ID)).toBe(
      `__Host-hvli_login=${ID}; Max-Age=600; Path=/; Secure; HttpOnly; SameSite=Lax`,
    );
    expect(expiredLoginCookie()).toBe(
      '__Host-hvli_login=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax',
    );
  });

  it('[AUTH-003] refuses to write anything but an opaque ID, so no value can add attributes', () => {
    expect(() => sessionCookie(`${ID}; Domain=hvl.no`)).toThrow(TypeError);
    expect(() => sessionCookie('')).toThrow(TypeError);
    expect(() => loginCookie(`${ID}\r\nSet-Cookie: x=1`)).toThrow(TypeError);
  });
});

describe('[AUTH-003] Cookie header parser', () => {
  it('[AUTH-003] reads well-formed pairs with optional spaces and keeps values undecoded', () => {
    const cookies = parseCookieHeader(`a=1;b=x%41y ;  ${SESSION_COOKIE}=${ID}; c=d=e`);
    expect([...cookies]).toEqual([
      ['a', '1'],
      ['b', 'x%41y'],
      [SESSION_COOKIE, ID],
      ['c', 'd=e'],
    ]);
  });

  it('[AUTH-003] drops a name that occurs twice, so a tossed cookie can force at most a logout', () => {
    // Arrange
    const tossed = `${SESSION_COOKIE}=attacker; ${SESSION_COOKIE}=${ID}; other=1`;
    const reversed = `${SESSION_COOKIE}=${ID}; ${SESSION_COOKIE}=attacker`;
    // Act and assert
    expect(parseCookieHeader(tossed).has(SESSION_COOKIE)).toBe(false);
    expect(parseCookieHeader(reversed).has(SESSION_COOKIE)).toBe(false);
    expect(parseCookieHeader(tossed).get('other')).toBe('1');
  });

  it('[AUTH-003] ignores pairs without a name, without "=", or with an invalid name or value', () => {
    // Arrange
    const header = `novalue; =nameless; bad name=1; q="quoted"; sp=a b; ok=1; ${SESSION_COOKIE}=${ID}`;
    // Act
    const cookies = parseCookieHeader(header);
    // Assert
    expect([...cookies.keys()]).toEqual(['ok', SESSION_COOKIE]);
  });

  it('[AUTH-003] drops a name whose duplicate is malformed, rather than trusting the other copy', () => {
    expect(parseCookieHeader(`${SESSION_COOKIE}=${ID}; ${SESSION_COOKIE}=a"b`).has(SESSION_COOKIE)).toBe(
      false,
    );
  });

  it('[AUTH-003] never decodes names, so an encoded prefix is a different cookie', () => {
    expect(parseCookieHeader(`__%48ost-hvli_sid=${ID}`).has(SESSION_COOKIE)).toBe(false);
  });

  it("[AUTH-003] matches names case-sensitively, so a sibling domain's __host- cookie is not the session", () => {
    const cookies = parseCookieHeader(`__host-hvli_sid=${ID}; __HOST-hvli_sid=${ID}`);
    expect(cookies.has(SESSION_COOKIE)).toBe(false);
    expect(readCookie({ headers: { cookie: `__host-hvli_sid=${ID}` } }, SESSION_COOKIE)).toBeUndefined();
  });

  it('[AUTH-003] handles a missing, empty or split header', () => {
    expect(parseCookieHeader(undefined).size).toBe(0);
    expect(parseCookieHeader('').size).toBe(0);
    expect(parseCookieHeader(';;  ;').size).toBe(0);
    expect(parseCookieHeader(['a=1', `${SESSION_COOKIE}=${ID}`]).get(SESSION_COOKIE)).toBe(ID);
    expect(readCookie({ headers: { cookie: `x=1; ${LOGIN_COOKIE}=${ID}` } }, LOGIN_COOKIE)).toBe(ID);
  });
});

describe('[AUTH-003] Set-Cookie writer', () => {
  it('[AUTH-003] keeps one value per cookie: a later value replaces an earlier one, other cookies stay', async () => {
    // Arrange
    const app = express();
    app.get('/', (_req, res) => {
      res.append('Set-Cookie', 'other=1; Path=/');
      setCookie(res, expiredSessionCookie());
      setCookie(res, expiredLoginCookie());
      setCookie(res, sessionCookie(ID));
      res.end();
    });
    // Act
    const res = await request(app).get('/');
    // Assert
    expect(res.headers['set-cookie']).toEqual([
      'other=1; Path=/',
      expiredLoginCookie(),
      `__Host-hvli_sid=${ID}; Path=/; Secure; HttpOnly; SameSite=Lax`,
    ]);
  });

  it('[AUTH-003] refuses a value without a cookie name, which would otherwise remove every other cookie', async () => {
    // Arrange
    const app = express();
    app.get('/', (_req, res) => {
      res.append('Set-Cookie', 'other=1; Path=/');
      const refusals = ['', 'novalue', '=x', 'bad name=1'].filter((value) => {
        try {
          setCookie(res, value);
          return false;
        } catch (error) {
          return error instanceof TypeError;
        }
      });
      res.json({ refusals: refusals.length });
    });
    // Act
    const res = await request(app).get('/');
    // Assert
    expect(res.body).toEqual({ refusals: 4 });
    expect(res.headers['set-cookie']).toEqual(['other=1; Path=/']);
  });
});
