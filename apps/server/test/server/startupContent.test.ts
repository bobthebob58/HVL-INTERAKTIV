/**
 * Tests for the start-up's content check: `startServer` loads the studio content before it connects to anything, and
 * a broken content folder stops the start with the loader's error, which names every problem by file and key.
 *
 * Spec: PED-001
 */
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { StudioContentError } from '../../src/learningDesign/content/StudioContentError.js';
import { startServer } from '../../src/server/main.js';
import { VALID_ENV } from '../support/authEnv.js';

const BROKEN = fileURLToPath(new URL('../fixtures/studio-content/missing-language/', import.meta.url));

describe('[PED-001] the studio content at start-up', () => {
  it('[PED-001] a broken content folder stops the start before any connection, naming the file and key', async () => {
    // Arrange: nothing listens on these ports, so a start that got as far as connecting would fail differently
    const env = loadEnv({
      ...VALID_ENV,
      DATABASE_URL: 'postgresql://nobody:none@127.0.0.1:1/none',
      REDIS_URL: 'redis://127.0.0.1:1',
    });
    // Act
    const start = startServer(env, { studioContentRoot: BROKEN });
    // Assert
    await expect(start).rejects.toBeInstanceOf(StudioContentError);
    const error = (await start.catch((caught: unknown) => caught)) as StudioContentError;
    expect(error.problems.length).toBeGreaterThan(0);
    expect(error.message).toContain('studio-content/missing-language/laeringsdesign/phases.yaml');
    expect(error.message).toContain('the server does not start until it is fixed');
  });
});
