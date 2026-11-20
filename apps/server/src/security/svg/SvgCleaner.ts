/**
 * SvgCleaner — cleans uploaded SVG files in a worker thread, one at a time, within a time, a memory and a waiting
 * limit.
 *
 * Why: making an SVG safe means parsing a text an author sent, and how long that takes and how much memory it
 *      needs depend on the text, not only on its size. On the main thread a slow file would stop every other
 *      request. In a worker thread the cleaning can be stopped, and the main thread goes on serving (D-119).
 * Spec: SEC-001
 * Invariants:
 *   - The main thread never parses an uploaded SVG; every file goes to the worker (./svgCleaningWorker.ts).
 *   - One file at a time, in the order asked. A file that waits longer than `waitMs` for its turn is refused with
 *     `upload.file.svgCheckBusy` and is never cleaned.
 *   - A file whose cleaning takes longer than `timeMs`, or more memory than `memoryMb`, is refused with
 *     `upload.file.svgTooComplex`. The worker is stopped first, and the next file gets a new one. The memory limit
 *     is held twice: by the runtime, and by a watch from the main thread that needs no runtime setting
 *     (./svgCleaningLimits.ts).
 *   - The time limit counts the cleaning only. A worker that is not ready within `startMs` is stopped, and the file
 *     is refused with `upload.file.svgCheckBusy`.
 *   - The folder for Lumi's temporary copy is made here and removed here, after the worker has answered or has
 *     stopped, so a stopped worker leaves nothing behind. Its name starts with `SVG_COPY_FOLDER_PREFIX`.
 *   - A refusal the steps raise (`upload.file.svgRejected`) reaches the caller unchanged; any other failure is an
 *     Error (a server error), never a silent success.
 *   - The worker loads the sources with the server's TypeScript loader and never keeps the process alive.
 * Collaborators: ./svgCleaningWorker.ts, ./svgPipeline.ts (the messages), ./svgCleaningLimits.ts (the numbers and
 *   the memory watch), ../SvgSanitizer.ts (the one cleaner of the server).
 * Tests: apps/server/test/security/SvgCleaner.test.ts, apps/server/test/security/SvgCleaner.worker.test.ts
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RejectedUploadError, type RejectedUploadKey } from '../RejectedUploadError.js';
import {
  SVG_CLEANING_LIMITS,
  SVG_COPY_FOLDER_PREFIX,
  watchWorkerHeap,
  type SvgCleaningLimits,
} from './svgCleaningLimits.js';
import { startCleaningWorker, type CleaningWorker, type StartCleaningWorker } from './svgCleaningThread.js';
import type { SvgCleaningAnswer, SvgCleaningRequest, SvgWorkerReady } from './svgPipeline.js';

export { SVG_CLEANING_LIMITS, SVG_COPY_FOLDER_PREFIX, type SvgCleaningLimits } from './svgCleaningLimits.js';

interface Waiting {
  readonly raw: string;
  readonly resolve: (safe: string) => void;
  readonly reject: (reason: unknown) => void;
  readonly timer: NodeJS.Timeout;
}

interface Expected {
  readonly worker: CleaningWorker;
  readonly resolve: (message: unknown) => void;
  readonly reject: (reason: unknown) => void;
  readonly timer: NodeJS.Timeout;
}

const refusal = (key: RejectedUploadKey): RejectedUploadError => new RejectedUploadError(key);
const isOutOfMemory = (error: Error): boolean =>
  (error as NodeJS.ErrnoException).code === 'ERR_WORKER_OUT_OF_MEMORY';

/** Cleans SVG files in a worker thread, with limits. */
export class SvgCleaner {
  private readonly waiting: Waiting[] = [];
  private busy = false;
  private worker: CleaningWorker | undefined;
  private expected: Expected | undefined;

  /**
   * @param limits - Time, memory, waiting and start limits; D-119's outside tests.
   * @param startWorker - Starts a worker thread; the real one outside tests.
   */
  constructor(
    private readonly limits: SvgCleaningLimits = SVG_CLEANING_LIMITS,
    private readonly startWorker: StartCleaningWorker = startCleaningWorker,
  ) {}

  /**
   * Makes SVG text safe.
   * @param raw - The uploaded SVG, decoded as UTF-8.
   * @returns Safe SVG text, starting with `<svg`.
   * @throws RejectedUploadError `upload.file.svgRejected` when the file cannot be made safe,
   *   `upload.file.svgTooComplex` past the time or memory limit, `upload.file.svgCheckBusy` past the waiting limit.
   */
  clean(raw: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const entry: Waiting = {
        raw,
        resolve,
        reject,
        timer: setTimeout(() => this.giveUp(entry), this.limits.waitMs),
      };
      this.waiting.push(entry);
      this.next();
    });
  }

  /** Stops the worker and refuses every file that still waits (`upload.file.svgCheckBusy`). */
  async close(): Promise<void> {
    for (const entry of this.waiting.splice(0)) this.giveUp(entry, true);
    const worker = this.worker;
    if (worker) await this.retire(worker, refusal('upload.file.svgCheckBusy'));
  }

  private giveUp(entry: Waiting, removed = false): void {
    const at = this.waiting.indexOf(entry);
    if (at < 0 && !removed) return;
    if (at >= 0) this.waiting.splice(at, 1);
    clearTimeout(entry.timer);
    entry.reject(refusal('upload.file.svgCheckBusy'));
  }

  private next(): void {
    const entry = this.busy ? undefined : this.waiting.shift();
    if (!entry) return;
    clearTimeout(entry.timer);
    this.busy = true;
    void this.cleanOne(entry.raw)
      .then(entry.resolve, entry.reject)
      .finally(() => {
        this.busy = false;
        this.next();
      });
  }

  private async cleanOne(raw: string): Promise<string> {
    const copyDir = await mkdtemp(join(tmpdir(), SVG_COPY_FOLDER_PREFIX));
    let unwatch = (): void => undefined;
    try {
      const worker = this.worker ?? (await this.start());
      const pastMemory = (): void => void this.retire(worker, refusal('upload.file.svgTooComplex'));
      unwatch = watchWorkerHeap(worker, this.limits.memoryMb, pastMemory);
      const answering = this.expect<SvgCleaningAnswer>(
        worker,
        this.limits.timeMs,
        'upload.file.svgTooComplex',
      );
      worker.postMessage({ raw, copyDir } satisfies SvgCleaningRequest);
      const answer = await answering;
      if ('safe' in answer) return answer.safe;
      if ('refused' in answer) throw new RejectedUploadError(answer.refused.key, answer.refused.params);
      throw new Error(`the SVG cleaning failed: ${answer.failed}`);
    } finally {
      unwatch();
      await rm(copyDir, { recursive: true, force: true });
    }
  }

  private async start(): Promise<CleaningWorker> {
    const worker = this.startWorker(this.limits.memoryMb);
    worker.on('message', (message) => this.heard(worker, message));
    // WHY: listeners for the worker's whole life, so a worker that fails while idle cannot end the process.
    worker.on('error', (error) => {
      void this.retire(worker, isOutOfMemory(error) ? refusal('upload.file.svgTooComplex') : error);
    });
    worker.on('exit', () => void this.retire(worker, new Error('the SVG cleaning worker stopped')));
    await this.expect<SvgWorkerReady>(worker, this.limits.startMs, 'upload.file.svgCheckBusy');
    this.worker = worker;
    return worker;
  }

  /** Waits for the worker's next message; past `withinMs` the worker is stopped and the wait fails with `late`. */
  private expect<T>(worker: CleaningWorker, withinMs: number, late: RejectedUploadKey): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => void this.retire(worker, refusal(late)), withinMs);
      this.expected = { worker, resolve: resolve as (message: unknown) => void, reject, timer };
    });
  }

  private heard(worker: CleaningWorker, message: unknown): void {
    const expected = this.expected;
    if (expected?.worker !== worker) return;
    this.expected = undefined;
    clearTimeout(expected.timer);
    expected.resolve(message);
  }

  /** Stops a worker for good, then fails whatever waited for its answer. */
  private async retire(worker: CleaningWorker, reason: unknown): Promise<void> {
    if (this.worker === worker) this.worker = undefined;
    const expected = this.expected?.worker === worker ? this.expected : undefined;
    if (expected) {
      this.expected = undefined;
      clearTimeout(expected.timer);
    }
    // WHY: the worker is gone before the caller removes its copy folder and before the next file starts.
    await worker.terminate().catch(() => undefined);
    expected?.reject(reason);
  }
}
