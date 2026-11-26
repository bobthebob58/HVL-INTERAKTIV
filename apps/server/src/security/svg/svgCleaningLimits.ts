/**
 * svgCleaningLimits — the limits of cleaning one SVG file, and the watch that holds the memory limit.
 *
 * Why: D-119 gives one file five seconds and 512 MB. Node can hold a worker thread to a heap limit itself
 *      (`resourceLimits`), but not when the process was started with a heap flag (`--max-old-space-size`, also
 *      through `NODE_OPTIONS`): V8 then gives every thread the process's limit, and operations often set that flag.
 *      So while a file is being cleaned the main thread also asks the worker how much heap it uses, and stops it
 *      past the limit, whatever the flags are (D-119 amendment of 2026-11-20).
 * Spec: SEC-001
 * Invariants:
 *   - The watch asks every `everyMs` (50 ms), never twice at once, and calls `onPast` at most once.
 *   - A worker that cannot answer (it has stopped) is not an error here; its end is the cleaner's to handle.
 *   - Stopping the watch is final; nothing is called afterwards.
 * Collaborators: ./SvgCleaner.ts (uses both), ./svgCleaningThread.ts (the worker's `heapUsedBytes`),
 *   ../../http/staleUploadFolders.ts (the folder prefix).
 * Tests: apps/server/test/security/SvgCleaner.test.ts, apps/server/test/security/SvgCleaner.worker.test.ts
 */
import type { CleaningWorker } from './svgCleaningThread.js';

/** How the name of the folder for Lumi's temporary copy starts (../../http/staleUploadFolders.ts looks for it). */
export const SVG_COPY_FOLDER_PREFIX = 'hvl-svg-';

/** The limits of the cleaning. */
export interface SvgCleaningLimits {
  /** Longest cleaning of one file, in milliseconds. */
  readonly timeMs: number;
  /** Largest heap of the worker, in megabytes. */
  readonly memoryMb: number;
  /** Longest wait for a turn, in milliseconds. */
  readonly waitMs: number;
  /** Longest start of a worker, in milliseconds. */
  readonly startMs: number;
}

/** D-119: five seconds and 512 MB for one file, twenty seconds of waiting, thirty for a worker to start. */
export const SVG_CLEANING_LIMITS: SvgCleaningLimits = {
  timeMs: 5_000,
  memoryMb: 512,
  waitMs: 20_000,
  startMs: 30_000,
};

const MB = 1024 * 1024;

/**
 * Watches a worker's heap while it cleans one file.
 * @param worker - The worker; only its `heapUsedBytes` is used.
 * @param limitMb - The heap limit in megabytes.
 * @param onPast - Called once when the heap is past the limit.
 * @param everyMs - How often to ask; 50 ms outside tests.
 * @returns How to stop watching (when the file is done).
 */
export function watchWorkerHeap(
  worker: Pick<CleaningWorker, 'heapUsedBytes'>,
  limitMb: number,
  onPast: () => void,
  everyMs = 50,
): () => void {
  let asking = false;
  let stopped = false;
  const stop = (): void => {
    stopped = true;
    clearInterval(timer);
  };
  const timer = setInterval(() => {
    if (asking) return;
    asking = true;
    void worker.heapUsedBytes().then(
      (bytes) => {
        asking = false;
        if (stopped || bytes <= limitMb * MB) return;
        stop();
        onPast();
      },
      () => (asking = false),
    );
  }, everyMs);
  return stop;
}
