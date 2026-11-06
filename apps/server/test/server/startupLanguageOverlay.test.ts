/**
 * Tests that the start-up hands the H5P engine the H5P texts it loaded with the rest of the studio content
 * (`content/h5p-tekstar/`, D-111), so the folder is read once and a content folder a caller names reaches the
 * engine too, instead of the repository's own.
 *
 * Spec: H5P-008
 */
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import type { H5pRuntimeInputs } from '../../src/h5p/createH5pRuntime.js';
import { EMPTY_LANGUAGE_OVERLAY } from '../../src/h5p/languageOverlay/languageOverlay.js';
import { REPOSITORY_ROOT } from '../../src/learningDesign/content/contentProblem.js';
import { loadStudioContent } from '../../src/learningDesign/content/loadStudioContent.js';
import { startServer } from '../../src/server/main.js';
import { VALID_ENV } from '../support/authEnv.js';

/** Thrown by the stand-in engine, so the start stops right after it was asked to build the engine. */
class EngineRequested extends Error {}

const engine = vi.hoisted(() => ({ inputs: [] as unknown[] }));

vi.mock('../../src/infra/redisClient.js', () => ({ connectRedis: () => Promise.resolve({}) }));
vi.mock('../../src/h5p/createH5pRuntime.js', () => ({
  createH5pRuntime: (inputs: unknown) => {
    engine.inputs.push(inputs);
    return Promise.reject(new EngineRequested('engine requested'));
  },
}));

/** The repository's content folder, copied without its H5P texts: a folder whose overlay differs from the real one. */
const contentRoot = mkdtempSync(join(tmpdir(), 'hvli-startup-overlay-'));
cpSync(join(REPOSITORY_ROOT, 'content'), contentRoot, { recursive: true });
rmSync(join(contentRoot, 'h5p-tekstar'), { recursive: true, force: true });

afterAll(() => rmSync(contentRoot, { recursive: true, force: true }));

describe('[H5P-008] the language overlay at start-up', () => {
  it('[H5P-008] the engine gets the overlay of the content folder the start loaded, not a second read of content/', async () => {
    // Arrange
    const env = loadEnv({ ...VALID_ENV, WEB_APP: 'off' });
    const real = loadStudioContent().h5pTexts.overlay;
    // Act
    const start = startServer(env, { studioContentRoot: contentRoot });
    // Assert
    await expect(start).rejects.toBeInstanceOf(EngineRequested);
    expect(engine.inputs).toHaveLength(1);
    const given = (engine.inputs[0] as H5pRuntimeInputs).languageOverlay;
    expect(given).toEqual(EMPTY_LANGUAGE_OVERLAY);
    expect(real).not.toEqual(EMPTY_LANGUAGE_OVERLAY);
  });
});
