/**
 * Smoke tests for the entry point: `src/server/main.ts` started as its own process against the mock platform
 * answers `/healthz` and `/lti/keys` and stops cleanly on SIGTERM; a broken configuration stops it with exit code 1
 * and names the variable without printing any secret.
 *
 * Spec: NFR-002, LTI-001
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { CreateBucketCommand } from '@aws-sdk/client-s3';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { startMockPlatform, type MockPlatform } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { createPrismaClient } from '../../src/infra/prismaClient.js';
import { createS3Client } from '../../src/infra/s3Client.js';
import { describeWithServices, serviceEnv, uniqueName } from '../support/services.js';
import { removeTestBucket } from '../support/storageFixtures.js';
import { syntheticLibraryDir } from '../support/syntheticLibraries.js';
import { HTTP_TEST_LIBRARIES } from '../support/tenTypeLibraries.js';

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
const PORT = 3900 + Math.floor(Math.random() * 90);
const TOOL_URL = `http://localhost:${PORT}`;

/** Starts main.ts with the given environment; resolves with the process and everything it printed. */
function startMain(env: NodeJS.ProcessEnv): {
  child: ChildProcess;
  output: () => string;
  exit: Promise<number | null>;
} {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server/main.ts'], { cwd: SERVER_DIR, env });
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => (output += String(chunk)));
  child.stderr?.on('data', (chunk: Buffer) => (output += String(chunk)));
  const exit = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)));
  return { child, output: () => output, exit };
}

const until = async (check: () => boolean, ms: number): Promise<void> => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

describeWithServices('[NFR-002] the server entry point', () => {
  let mock: MockPlatform;
  const buckets = { content: uniqueName('content'), temporary: uniqueName('temporary') };
  const s3 = createS3Client(serviceEnv());
  beforeAll(async () => {
    mock = await startMockPlatform({ toolUrl: TOOL_URL });
    for (const Bucket of Object.values(buckets)) await s3.send(new CreateBucketCommand({ Bucket }));
  });
  afterAll(async () => {
    await mock.close();
    const db = createPrismaClient(serviceEnv().DATABASE_URL);
    await db.ltiPlatform.deleteMany({ where: { url: mock.canvas.issuer } });
    await db.$disconnect();
    for (const bucket of Object.values(buckets)) await removeTestBucket(s3, bucket);
  });

  const serverEnv = (): NodeJS.ProcessEnv => ({
    ...process.env,
    ...mock.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    PORT: String(PORT),
    PUBLIC_BASE_URL: TOOL_URL,
    H5P_LIBRARY_DIR: syntheticLibraryDir(HTTP_TEST_LIBRARIES),
    S3_CONTENT_BUCKET: buckets.content,
    S3_TEMPORARY_BUCKET: buckets.temporary,
  });

  it('[NFR-002] starts, answers /healthz and /lti/keys, and stops with exit code 0 on SIGTERM', async () => {
    // Arrange
    const main = startMain(serverEnv());
    await until(() => main.output().includes('HVL Interaktiv server listening'), 30_000);
    // Act
    const health = await fetch(`${TOOL_URL}/healthz`);
    const keys = (await (await fetch(`${TOOL_URL}/lti/keys`)).json()) as { keys: unknown[] };
    main.child.kill('SIGTERM');
    const code = await main.exit;
    // Assert
    expect(health.status).toBe(200);
    expect(keys.keys.length).toBeGreaterThan(0);
    expect(main.output()).toContain('LTI platforms synchronised');
    expect(main.output()).toContain('HVL Interaktiv server stopped');
    expect(code).toBe(0);
  }, 60_000);

  it('[NFR-002] a broken configuration stops the start with exit code 1 and prints no secret', async () => {
    // Arrange
    const env: NodeJS.ProcessEnv = { ...serverEnv(), FEIDE_CLIENT_ID: '', CANVAS_ORIGINS: 'not a url' };
    // Act
    const main = startMain(env);
    const code = await main.exit;
    // Assert
    expect(code).toBe(1);
    expect(main.output()).toContain('FEIDE_CLIENT_ID');
    expect(main.output()).toContain('CANVAS_ORIGINS');
    expect(main.output()).not.toContain(String(env.FEIDE_CLIENT_SECRET));
    expect(main.output()).not.toContain(String(env.DATA_ENCRYPTION_KEYS));
  }, 30_000);
});
