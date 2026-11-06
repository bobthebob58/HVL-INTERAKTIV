/**
 * loadBench.test — the load bench as the runner starts it: ready with one launch address per learner and no token
 * in its file, one visit of the load model accepted by the real routes, and on stop the rows that visit stored, with
 * the bench's own database dropped.
 * Spec: NFR-001, DATA-009
 */
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminSql, servicesConfigured } from '../../ops/test/backupBench.mjs';
import { startBench } from '../benchProcess.mjs';
import { playerContext } from '../k6/playerPages.js';
import { launchInNode, useActivityInNode } from './nodeVisit.mjs';

const PACKAGES =
  process.env.REAL_H5P_PACKAGES_DIR ??
  new URL('../../../apps/server/var/h5p-real/packages', import.meta.url).pathname;
const ready = servicesConfigured && existsSync(join(PACKAGES, 'SHA256SUMS'));
if (!ready && process.env.CI === 'true')
  throw new Error('CI must run the load bench test (services and real packages)');
const describeWithBench = ready ? describe : describe.skip;
const loadDatabases = async () =>
  (await adminSql("SELECT datname FROM pg_database WHERE datname LIKE 'hvli_load_%'")).map(([name]) => name);

describeWithBench('the load bench (NFR-001)', () => {
  let out;
  let bench;
  let before;
  let visits = 0;

  beforeAll(async () => {
    out = await mkdtemp(join(tmpdir(), 'hvli-load-test-'));
    before = await loadDatabases();
    bench = await startBench({ learners: 2, addresses: join(out, 'learners.json') });
  }, 300_000);

  afterAll(async () => {
    if (out) await rm(out, { recursive: true, force: true });
  });

  it('[DATA-009] writes one launch address per learner, for its owner only, with no token or sub', async () => {
    // Act
    const file = join(out, 'learners.json');
    const text = await readFile(file, 'utf8');
    const addresses = JSON.parse(text);

    // Assert
    expect(bench.ready).toMatchObject({ ready: true, learners: 2 });
    expect(addresses.learners).toHaveLength(2);
    expect(new Set(addresses.learners).size).toBe(2);
    expect(addresses.learners.every((url) => url.startsWith(`${addresses.canvasOrigin}/courses/`))).toBe(
      true,
    );
    expect(text).not.toMatch(/eyJ|ltik|id_token|"sub"/);
    expect((await stat(file)).mode & 0o077).toBe(0);
  });

  it('[NFR-001] serves one visit as the k6 script makes it: launch, page, assets, batches and state saves', async () => {
    // Arrange
    const { toolUrl, learners } = JSON.parse(await readFile(join(out, 'learners.json'), 'utf8'));

    // Act
    const opened = await launchInNode(learners[0], toolUrl);
    const used = await useActivityInNode(toolUrl, opened, 2);
    visits += 1;

    // Assert
    expect(opened.ltik).toBeDefined();
    expect(opened.pageStatus).toBe(200);
    expect(opened.assetStatuses.length).toBeGreaterThan(50);
    expect(opened.assetStatuses.every((status) => status === 200)).toBe(true);
    expect(playerContext(opened.html)?.questions).toHaveLength(4);
    expect(used.batchStatuses).toEqual([202, 202, 202, 202]);
    expect(used.stateAnswers).toEqual([{ success: true }, { success: true }]);
    expect(JSON.parse(used.stateReadBack.data).progress).toBe(2);
  }, 120_000);

  it('[NFR-001] stops with the rows the load stored and drops its own database', async () => {
    // Act
    const rows = await bench.stop();
    const after = await loadDatabases();

    // Assert
    expect(rows).toEqual({
      xapiStatement: 4 * visits,
      h5PUserData: visits,
      ltiPlacement: visits,
      identity: visits,
      user: 1 + visits,
    });
    expect(after.filter((name) => !before.includes(name))).toEqual([]);
  }, 180_000);
});
