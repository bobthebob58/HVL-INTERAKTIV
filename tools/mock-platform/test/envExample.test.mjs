/**
 * Tests that apps/server/.env.example holds exactly the values `npm run mock:platform` gives, so a copied `.env`
 * works against the mock without pasting anything (the drift that S3 fixed twice by hand).
 *
 * Spec: LTI-001, AUTH-001
 */
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMockPlatform } from '../mockPlatform.mjs';

const root = new URL('../../../', import.meta.url);
const example = parseEnv(readFileSync(new URL('apps/server/.env.example', root), 'utf8'));
const script = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).scripts['mock:platform'];
const option = (name) => new RegExp(`--${name} (\\S+)`).exec(script)?.[1];
const fixed = { tool: option('tool-url'), canvas: option('canvas-port'), feide: option('feide-port') };

let mock;
beforeAll(async () => {
  mock = await startMockPlatform({ toolUrl: fixed.tool });
});
afterAll(() => mock.close());

/** The mock's environment as `npm run mock:platform` prints it: the same mocks, on the script's fixed ports. */
const atFixedPorts = (value) =>
  value
    .replaceAll(`:${new URL(mock.canvas.origin).port}`, `:${fixed.canvas}`)
    .replaceAll(`:${new URL(mock.feide.issuer).port}`, `:${fixed.feide}`);

describe('[LTI-001] .env.example and the mock platform', () => {
  it('[LTI-001] the script names a tool URL and both fixed ports, and PUBLIC_BASE_URL is that tool URL', () => {
    expect(fixed).toEqual({
      tool: expect.any(String),
      canvas: expect.any(String),
      feide: expect.any(String),
    });
    expect(example.PUBLIC_BASE_URL).toBe(fixed.tool);
  });

  it('[AUTH-001] the Feide values are the mock Feide’s, so login works without pasting', () => {
    for (const name of ['FEIDE_ISSUER', 'FEIDE_GROUPS_API_URL', 'FEIDE_CLIENT_ID']) {
      expect(example[name], name).toBe(atFixedPorts(mock.env[name]));
    }
  });

  it('[LTI-001] the Canvas origin and the LTI platform are the mock Canvas’s, including feideLinking', () => {
    expect(example.CANVAS_ORIGINS).toBe(atFixedPorts(mock.env.CANVAS_ORIGINS));
    expect(JSON.parse(example.LTI_PLATFORMS)).toEqual(JSON.parse(atFixedPorts(mock.env.LTI_PLATFORMS)));
  });
});
