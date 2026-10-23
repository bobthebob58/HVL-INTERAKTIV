/**
 * Tests for the Hub check: the F1 local ID, the F2 registration evidence, version comparison against the spec
 * table, and a report instead of an exception when the Hub cannot be reached.
 *
 * Spec: H5P-001, H5P-003
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createH5pConfig } from '../../src/h5p/H5pConfigFactory.js';
import { SERVER_ROOT } from '../../src/h5p/h5pServerInit.js';
import { HUB_MIN_VERSIONS, runHubCheck } from '../../src/h5p/hubCheck.js';

const UUID = '7f9a1c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b';
const allTen = (bump = 0) =>
  [...HUB_MIN_VERSIONS].map(([id, [major, minor]]) => ({
    id,
    version: { major, minor: minor + bump, patch: 3 },
  }));

/** A fetch that answers registration and content types as given, and records the calls. */
function fakeHub(answers: { sites?: [number, unknown]; types?: [number, unknown] }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const [status, body] = (url.endsWith('/sites') ? answers.sites : answers.types) ?? [500, {}];
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('runHubCheck', () => {
  it('[H5P-003] the minimum versions match the spec 01 §3 table', () => {
    const spec = readFileSync(join(SERVER_ROOT, '../../docs/specs/01-h5p-core128.md'), 'utf8');
    const rows = [...spec.matchAll(/^\| \d+ \| [^|]+ \| `(H5P\.\w+)` \| (\d+)\.(\d+) \|/gm)];
    expect(rows.map(([, id, major, minor]) => [id, [Number(major), Number(minor)]])).toEqual([
      ...HUB_MIN_VERSIONS,
    ]);
  });

  it('[H5P-001] with a site UUID it skips registration, sends a 15-character local_id, and passes', async () => {
    const config = await createH5pConfig(undefined, { siteUuid: UUID, platformVersion: 'test' });
    const hub = fakeHub({ types: [200, { contentTypes: allTen() }] });
    const report = await runHubCheck(config, hub.impl);
    expect(report).toMatchObject({ ok: true, localIdLength: 15, registration: { attempted: false } });
    expect(hub.calls.map((c) => c.url)).toEqual(['https://hub-api.h5p.org/v1/content-types/']);
    const sent = new URLSearchParams(String(hub.calls[0]?.init.body));
    expect(sent.get('uuid')).toBe(UUID);
    expect(sent.get('local_id')).toHaveLength(15);
  });

  it('[H5P-001] without a UUID it registers and reports a non-200 2xx status as F2 evidence', async () => {
    const config = await createH5pConfig(undefined, { platformVersion: 'test' });
    const hub = fakeHub({ sites: [201, { uuid: UUID }], types: [200, { contentTypes: allTen(1) }] });
    const report = await runHubCheck(config, hub.impl);
    expect(report.registration).toEqual({ attempted: true, status: 201, uuid: UUID });
    expect(report.ok).toBe(true);
    expect(config.uuid).toBe('');
  });

  it('[H5P-003] names the types that are missing or older than required', async () => {
    const config = await createH5pConfig(undefined, { siteUuid: UUID, platformVersion: 'test' });
    const list = allTen().filter((t) => t.id !== 'H5P.Blanks');
    list[0] = { id: 'H5P.CoursePresentation', version: { major: 1, minor: 26, patch: 9 } };
    const report = await runHubCheck(config, fakeHub({ types: [200, { contentTypes: list }] }).impl);
    expect(report.contentTypes).toMatchObject({
      missing: ['H5P.Blanks'],
      tooOld: ['H5P.CoursePresentation'],
    });
    expect(report.ok).toBe(false);
  });

  it('[H5P-001] an unreachable Hub or a refused registration is reported, not thrown', async () => {
    const config = await createH5pConfig(undefined, { platformVersion: 'test' });
    const down = (async () => {
      throw new Error('CONNECT tunnel failed, response 403');
    }) as unknown as typeof fetch;
    const report = await runHubCheck(config, down);
    expect(report.registration).toEqual({ attempted: true, error: 'CONNECT tunnel failed, response 403' });
    expect(report.ok).toBe(false);
    const refused = await runHubCheck(config, fakeHub({ sites: [405, {}] }).impl);
    expect(refused.registration).toMatchObject({ status: 405 });
    expect(refused.contentTypes.status).toBeUndefined();
  });
});
