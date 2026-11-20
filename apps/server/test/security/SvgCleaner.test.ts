/**
 * Tests for the cleaner's own rules, with a scripted worker: one file at a time and in order, the waiting limit,
 * the time limit, the memory limit, a worker that does not start, and that the copy folder is always removed.
 *
 * Spec: SEC-001
 */
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { RejectedUploadError } from '../../src/security/RejectedUploadError.js';
import { SvgCleaner, SVG_COPY_FOLDER_PREFIX } from '../../src/security/svg/SvgCleaner.js';
import type { CleaningWorker } from '../../src/security/svg/svgCleaningThread.js';
import type { SvgCleaningRequest } from '../../src/security/svg/svgPipeline.js';

const LIMITS = { timeMs: 150, memoryMb: 64, waitMs: 80, startMs: 150 };
const SAFE = '<svg xmlns="http://www.w3.org/2000/svg"/>';

/** A worker the test answers for: it records what it is sent and whether it was stopped. */
class ScriptedWorker extends EventEmitter implements CleaningWorker {
  readonly requests: SvgCleaningRequest[] = [];
  stopped = false;
  constructor(ready = true) {
    super();
    if (ready) setImmediate(() => this.emit('message', { ready: true }));
  }
  postMessage(request: SvgCleaningRequest): void {
    this.requests.push(request);
  }
  terminate(): Promise<number> {
    this.stopped = true;
    setImmediate(() => this.emit('exit', 1));
    return Promise.resolve(1);
  }
  /** Answers the newest request. */
  answer(message: unknown): void {
    this.emit('message', message);
  }
}

/** A cleaner whose workers are scripted; `workers` lists every worker it started. */
function scripted(ready = true) {
  const workers: ScriptedWorker[] = [];
  const cleaner = new SvgCleaner(LIMITS, () => {
    const worker = new ScriptedWorker(ready);
    workers.push(worker);
    return worker;
  });
  return { cleaner, workers };
}

const keyOf = async (cleaning: Promise<string>): Promise<string> => {
  const error = await cleaning.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  return error instanceof RejectedUploadError ? error.messageKey : `not a refusal: ${String(error)}`;
};
const sent = async (worker: () => ScriptedWorker | undefined, count: number): Promise<void> => {
  for (let tries = 0; tries < 100 && (worker()?.requests.length ?? 0) < count; tries += 1) await delay(2);
};

describe('[SEC-001] the SVG cleaner’s limits', () => {
  it('[SEC-001] cleans one file at a time, in the order asked, and removes each copy folder', async () => {
    // Arrange
    const { cleaner, workers } = scripted();
    // Act
    const first = cleaner.clean('<svg>1</svg>');
    const second = cleaner.clean('<svg>2</svg>');
    await sent(() => workers[0], 1);
    const whileFirstRuns = workers[0]?.requests.map((request) => request.raw);
    const firstFolder = workers[0]?.requests[0]?.copyDir ?? '';
    const folderExisted = existsSync(firstFolder);
    workers[0]?.answer({ safe: SAFE });
    await sent(() => workers[0], 2);
    workers[0]?.answer({ safe: '<svg xmlns="http://www.w3.org/2000/svg">2</svg>' });
    // Assert
    expect(whileFirstRuns).toEqual(['<svg>1</svg>']);
    expect(await first).toBe(SAFE);
    expect(await second).toContain('>2<');
    expect(workers).toHaveLength(1);
    expect(firstFolder).toContain(SVG_COPY_FOLDER_PREFIX);
    expect([folderExisted, existsSync(firstFolder)]).toEqual([true, false]);
  });

  it('[SEC-001] a file that waits too long for its turn is refused as busy and is never cleaned', async () => {
    // Arrange
    const { cleaner, workers } = scripted();
    const first = cleaner.clean('<svg>slow</svg>');
    await sent(() => workers[0], 1);
    // Act: the second file's waiting limit (80 ms) passes while the first is still being cleaned
    const waited = await keyOf(cleaner.clean('<svg>waiting</svg>'));
    workers[0]?.answer({ safe: SAFE });
    await first;
    // Assert
    expect(waited).toBe('upload.file.svgCheckBusy');
    expect(workers[0]?.requests.map((request) => request.raw)).toEqual(['<svg>slow</svg>']);
  });

  it('[SEC-001] past the time limit the worker is stopped, the file refused, and the next file gets a new worker', async () => {
    // Arrange
    const { cleaner, workers } = scripted();
    // Act: the first worker never answers
    const late = await keyOf(cleaner.clean('<svg>never answered</svg>'));
    const folder = workers[0]?.requests[0]?.copyDir ?? 'none';
    const next = cleaner.clean('<svg>next</svg>');
    await sent(() => workers[1], 1);
    workers[1]?.answer({ safe: SAFE });
    // Assert
    expect(late).toBe('upload.file.svgTooComplex');
    expect([workers[0]?.stopped, existsSync(folder)]).toEqual([true, false]);
    expect(await next).toBe(SAFE);
    expect(workers).toHaveLength(2);
  });

  it('[SEC-001] past the memory limit the file is refused the same way; a worker that fails while idle is replaced', async () => {
    // Arrange
    const { cleaner, workers } = scripted();
    const outOfMemory = Object.assign(new Error('heap limit'), { code: 'ERR_WORKER_OUT_OF_MEMORY' });
    // Act
    const cleaning = cleaner.clean('<svg>large</svg>');
    await sent(() => workers[0], 1);
    workers[0]?.emit('error', outOfMemory);
    const refused = await keyOf(cleaning);
    const second = cleaner.clean('<svg>2</svg>');
    await sent(() => workers[1], 1);
    workers[1]?.answer({ safe: SAFE });
    await second;
    workers[1]?.emit('error', new Error('failed while idle'));
    const third = cleaner.clean('<svg>3</svg>');
    await sent(() => workers[2], 1);
    workers[2]?.answer({ safe: SAFE });
    // Assert
    expect(refused).toBe('upload.file.svgTooComplex');
    expect(await third).toBe(SAFE);
    expect(workers.map((worker) => worker.stopped)).toEqual([true, true, false]);
  });

  it('[SEC-001] a worker that does not start in time is stopped and the file refused as busy', async () => {
    const { cleaner, workers } = scripted(false);
    expect(await keyOf(cleaner.clean(SAFE))).toBe('upload.file.svgCheckBusy');
    expect(workers.map((worker) => [worker.stopped, worker.requests.length])).toEqual([[true, 0]]);
  });

  it('[SEC-001] a refusal of the steps reaches the caller unchanged, and another failure is a server error', async () => {
    // Arrange
    const { cleaner, workers } = scripted();
    // Act
    const refused = cleaner.clean('<svg>unsafe</svg>');
    await sent(() => workers[0], 1);
    workers[0]?.answer({ refused: { key: 'upload.file.svgRejected', params: {} } });
    const key = await keyOf(refused);
    const failed = cleaner.clean('<svg>broken</svg>');
    await sent(() => workers[0], 2);
    workers[0]?.answer({ failed: 'disk full' });
    // Assert
    expect(key).toBe('upload.file.svgRejected');
    await expect(failed).rejects.toThrow('the SVG cleaning failed');
    expect(await keyOf(failed)).toContain('not a refusal');
    await cleaner.close();
    expect(workers[0]?.stopped).toBe(true);
  });
});
