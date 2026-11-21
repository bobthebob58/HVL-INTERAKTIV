/**
 * svgCleaningThread — starts the worker thread that cleans SVG files, and names the part of it the cleaner uses.
 *
 * Why: the worker must load the same TypeScript sources as the server, in every way the server is started
 *      (`npm start`, the Docker image, the tests), and must be held to a memory limit by the runtime itself
 *      (D-119). Keeping the start in one small module lets ./SvgCleaner.ts be tested with a scripted worker.
 * Spec: SEC-001
 * Invariants:
 *   - The worker's heap is limited by Node's `resourceLimits`; past it the runtime stops the worker with
 *     `ERR_WORKER_OUT_OF_MEMORY` and the main thread goes on. Under a process-wide heap flag that limit is not in
 *     force, so the worker also tells its heap use when asked (./svgCleaningLimits.ts watches it).
 *   - The TypeScript loader (tsx, a runtime dependency) is named by its file, so neither the working directory nor
 *     the flags of the process that starts the worker matter.
 *   - The worker is `unref`ed as soon as it runs: an idle worker never keeps a stopping server alive.
 * Collaborators: ./SvgCleaner.ts (the only caller), ./svgCleaningWorker.ts (the entry it starts).
 * Tests: apps/server/test/security/SvgCleaner.worker.test.ts (the real thread),
 *   apps/server/test/security/SvgCleaner.test.ts (a scripted one)
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { SvgCleaningRequest } from './svgPipeline.js';

/** The part of a worker thread the cleaner uses; a test passes a scripted one. */
export interface CleaningWorker {
  /** Sends one file to clean. */
  postMessage(request: SvgCleaningRequest): void;
  /** Listens for the worker's messages. */
  on(event: 'message', listener: (message: unknown) => void): unknown;
  /** Listens for the worker's failure. */
  on(event: 'error', listener: (error: Error) => void): unknown;
  /** Listens for the worker's end. */
  on(event: 'exit', listener: (code: number) => void): unknown;
  /** Stops the worker at once, whatever it is doing. */
  terminate(): Promise<unknown>;
  /** The bytes of heap the worker uses now; answered also while it is busy. */
  heapUsedBytes(): Promise<number>;
}

/** Starts a worker whose heap may grow to `memoryMb` megabytes. */
export type StartCleaningWorker = (memoryMb: number) => CleaningWorker;

const WORKER_ENTRY = new URL('./svgCleaningWorker.ts', import.meta.url);

/**
 * Starts the real worker thread.
 * @param memoryMb - The worker's heap limit in megabytes.
 * @returns The started worker; it says `{ ready: true }` when it can take a file.
 */
export const startCleaningWorker: StartCleaningWorker = (memoryMb) => {
  // WHY: a worker does not inherit the loader everywhere (not under the test runner), so it is named here.
  const loader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;
  const worker = new Worker(WORKER_ENTRY, {
    execArgv: ['--import', loader],
    resourceLimits: { maxOldGenerationSizeMb: memoryMb },
  });
  // WHY: `unref` only holds once the worker is running; called earlier, Node undoes it when the worker comes up.
  worker.once('online', () => worker.unref());
  // WHY: `resourceLimits` is not in force under a process-wide heap flag; the cleaner watches this too.
  const heapUsedBytes = (): Promise<number> => worker.getHeapStatistics().then((heap) => heap.used_heap_size);
  return Object.assign(worker, { heapUsedBytes });
};
