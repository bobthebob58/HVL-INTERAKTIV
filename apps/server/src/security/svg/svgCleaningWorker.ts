/**
 * svgCleaningWorker — the entry of the worker thread that cleans uploaded SVG files.
 *
 * Why: cleaning one SVG may take long and much memory, depending on the file. In a thread of its own it can be
 *      stopped after a time limit and held to a memory limit, while the main thread goes on serving (D-119).
 * Spec: SEC-001
 * Invariants:
 *   - Runs only as a worker thread started by ./SvgCleaner.ts; it says `{ ready: true }` once, when the steps are
 *     loaded, and then answers each request with exactly one message.
 *   - It holds no state between requests and writes only the copy in the folder each request names.
 * Collaborators: ./SvgCleaner.ts (starts, limits and stops it), ./svgPipeline.ts (the steps and the messages).
 * Tests: apps/server/test/security/SvgCleaner.worker.test.ts
 */
import { parentPort } from 'node:worker_threads';
import { answerSvgCleaning, type SvgCleaningRequest, type SvgWorkerReady } from './svgPipeline.js';

if (!parentPort) throw new Error('svgCleaningWorker must be started as a worker thread');
const port = parentPort;

port.on('message', (request: SvgCleaningRequest) => {
  void answerSvgCleaning(request).then((answer) => port.postMessage(answer));
});
port.postMessage({ ready: true } satisfies SvgWorkerReady);
