/**
 * Tests for the files origin's setting: `files.<host>` of `PUBLIC_BASE_URL` by default, `FILES_BASE_URL` as an origin
 * when set, another host than the app's in every environment, an IP-address app host needing the setting, and https
 * in production; messages name the variable, never its value (D-110 amendment of 2026-11-05).
 *
 * Spec: SEC-004, DOC-008
 */
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { filesOriginOf, filesOriginProblems } from '../../src/config/filesOrigin.js';
import { envProblems, productionEnv, VALID_ENV } from '../support/authEnv.js';

const AUTUMN_2026 = new Date('2026-10-22T12:00:00Z');

describe('[SEC-004] the files origin setting', () => {
  it('[SEC-004] defaults to files.<host> with the app’s scheme and port', () => {
    expect(filesOriginOf({ PUBLIC_BASE_URL: 'http://localhost:3000' })).toBe('http://files.localhost:3000');
    expect(filesOriginOf({ PUBLIC_BASE_URL: 'https://interaktiv.hvl.no' })).toBe(
      'https://files.interaktiv.hvl.no',
    );
    expect(
      loadEnv({ ...VALID_ENV, PUBLIC_BASE_URL: 'http://localhost:4321' }).FILES_BASE_URL,
    ).toBeUndefined();
  });

  it('[SEC-004] takes FILES_BASE_URL as an origin, and an empty value means the default', () => {
    // Act
    const set = loadEnv({ ...VALID_ENV, FILES_BASE_URL: 'http://files.example.test:8080/' });
    const empty = loadEnv({ ...VALID_ENV, FILES_BASE_URL: '' });
    // Assert
    expect(set.FILES_BASE_URL).toBe('http://files.example.test:8080');
    expect(filesOriginOf(set)).toBe('http://files.example.test:8080');
    expect(filesOriginOf(empty)).toBe(`http://files.${new URL(empty.PUBLIC_BASE_URL).host}`);
    expect(envProblems({ ...VALID_ENV, FILES_BASE_URL: 'https://files.hvl.no/filer' })[0]).toMatch(
      /^FILES_BASE_URL: must be an origin/,
    );
    expect(envProblems({ ...VALID_ENV, FILES_BASE_URL: 'javascript:alert(1)' })[0]).toMatch(
      /^FILES_BASE_URL:/,
    );
  });

  it('[SEC-004] refuses the app’s own host on another port, in development too, without printing the value', () => {
    // Arrange: cookies are scoped by host, not port (RFC 6265 §8.5)
    const env = {
      ...VALID_ENV,
      PUBLIC_BASE_URL: 'http://localhost:3000',
      FILES_BASE_URL: 'http://LOCALHOST:3001',
    };
    // Act
    const problems = envProblems(env);
    // Assert
    expect(problems).toEqual([
      'FILES_BASE_URL: must name another host than PUBLIC_BASE_URL (cookies reach every port of a host)',
    ]);
    expect(problems.join(' ')).not.toMatch(/localhost|3001/i);
  });

  it('[SEC-004] needs FILES_BASE_URL when the app’s host is an IP address', () => {
    const ipApp = { ...VALID_ENV, PUBLIC_BASE_URL: 'http://127.0.0.1:3000' };
    expect(envProblems(ipApp)).toEqual([
      "FILES_BASE_URL: must be set when PUBLIC_BASE_URL's host is an IP address (no files.<host> exists)",
    ]);
    expect(envProblems({ ...ipApp, PUBLIC_BASE_URL: 'http://[::1]:3000' })).toHaveLength(1);
    expect(envProblems({ ...ipApp, FILES_BASE_URL: 'http://localhost:3000' })).toEqual([]);
    expect(() => filesOriginOf({ PUBLIC_BASE_URL: 'http://127.0.0.1:3000' })).toThrow(/FILES_BASE_URL/);
  });

  it('[SEC-004] production needs https for a set FILES_BASE_URL; the default follows PUBLIC_BASE_URL', () => {
    // Arrange: only this module's messages count here; other production rules have their own tests
    const filesProblems = (overrides: Record<string, string>) =>
      envProblems(productionEnv(overrides), AUTUMN_2026).filter((p) => p.startsWith('FILES_BASE_URL'));
    // Act
    const plain = filesProblems({ FILES_BASE_URL: 'http://files.interaktiv.hvl.no' });
    const fine = filesProblems({ FILES_BASE_URL: 'https://filer.hvl-interaktiv.no' });
    // Assert
    expect(plain).toEqual(['FILES_BASE_URL: must use https in production']);
    expect(fine).toEqual([]);
    expect(filesProblems({})).toEqual([]);
    expect(filesOriginProblems({ PUBLIC_BASE_URL: 'http://interaktiv.hvl.no' }, true)).toEqual([]);
  });
});
