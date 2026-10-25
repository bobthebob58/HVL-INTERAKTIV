/**
 * Tests for the mock platform entry point: both mocks start, the environment they give is one the server's own
 * configuration schema accepts, and a malformed request cannot crash them (./httpRouter.mjs).
 *
 * Spec: LTI-001, AUTH-001
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { request } from 'node:http';
import { loadEnvPart } from '../../../apps/server/src/config/env.ts';
import { startMockPlatform } from '../mockPlatform.mjs';

const TOOL = 'http://localhost:3999';
let platform;

beforeAll(async () => {
  platform = await startMockPlatform({ toolUrl: TOOL });
});
afterAll(() => platform.close());

describe('[LTI-001] mock platform entry point', () => {
  it('[LTI-001] gives exactly the six tool variables, and the server configuration accepts them', () => {
    // Arrange
    const six = [
      'FEIDE_ISSUER',
      'FEIDE_GROUPS_API_URL',
      'FEIDE_CLIENT_ID',
      'FEIDE_CLIENT_SECRET',
      'CANVAS_ORIGINS',
      'LTI_PLATFORMS',
    ];
    // Act
    const env = loadEnvPart(six, platform.env);
    // Assert
    expect(Object.keys(platform.env).sort()).toEqual([...six].sort());
    expect(env.CANVAS_ORIGINS).toEqual([platform.canvas.origin]);
    expect(env.LTI_PLATFORMS).toEqual([platform.canvas.platformConfig]);
    expect(env.FEIDE_ISSUER).toBe(platform.feide.issuer);
  });

  it('[LTI-001] puts Canvas on 127.0.0.1 and Feide on localhost, so Canvas frames a localhost tool cross-site', async () => {
    // Act
    const [jwks, discovery] = await Promise.all([
      fetch(platform.canvas.jwksUrl).then((response) => response.json()),
      fetch(`${platform.feide.issuer}/.well-known/openid-configuration`).then((response) => response.json()),
    ]);
    // Assert
    expect(new URL(platform.canvas.origin).hostname).toBe('127.0.0.1');
    expect(new URL(platform.feide.issuer).hostname).toBe(new URL(TOOL).hostname);
    expect(jwks.keys).toEqual([platform.canvas.publicJwk]);
    expect(discovery.issuer).toBe(platform.feide.issuer);
  });

  it('[LTI-001] answers request targets it cannot parse with 400 or 404, and keeps serving', async () => {
    // Arrange: raw targets, which fetch would normalise
    const raw = (origin, path) =>
      new Promise((resolve, reject) => {
        const answer = (res) => resolve(res.resume().statusCode);
        request({ host: '127.0.0.1', port: new URL(origin).port, path }, answer)
          .on('error', reject)
          .end();
      });
    const statuses = [];
    // Act
    for (const origin of [platform.canvas.origin, platform.feide.issuer]) {
      for (const path of ['//', '/courses/%E0%A4%A/launches/x']) statuses.push(await raw(origin, path));
    }
    const alive = await fetch(platform.canvas.jwksUrl);
    // Assert
    expect(statuses).toEqual([400, 404, 400, 404]);
    expect(alive.status).toBe(200);
  });

  it('[AUTH-001] refuses a tool URL that is not http(s) before starting anything', async () => {
    for (const toolUrl of [undefined, 'ftp://tool', 'http://localhost:3000/?x=1', 'not a url']) {
      await expect(startMockPlatform({ toolUrl })).rejects.toThrow(TypeError);
    }
  });

  it('[AUTH-001] closes both mocks, and closing twice is harmless', async () => {
    // Arrange
    const other = await startMockPlatform({ toolUrl: TOOL });
    // Act
    await other.close();
    await other.close();
    // Assert
    await expect(fetch(other.canvas.jwksUrl)).rejects.toThrow();
    await expect(fetch(`${other.feide.issuer}/openid/jwks`)).rejects.toThrow();
  });
});
