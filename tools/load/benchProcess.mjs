/**
 * benchProcess — starts the load bench (apps/server/test/load/loadBench.ts) in a process of its own, waits for its
 * ready line, and stops it with SIGTERM to read the rows the load stored.
 *
 * Why: k6 must load the server from outside its process, as browsers do (D-114's load amendment of 2026-11-05); the
 *      bench speaks one JSON line when ready and one with the row counts when stopped, and nothing else on standard
 *      output, so the runner can rely on it.
 * Spec: NFR-001
 * Invariants:
 *   - The bench runs from apps/server with its `.env` (if any) and `tsx`, as the server's own CLIs run.
 *   - Its error output is kept in memory and shown only when it fails, through `redactTokens`.
 *   - A bench that does not get ready within `readyTimeoutMs`, or does not stop within two minutes, is killed.
 * Collaborators: ./runLoad.mjs, ./k6Container.mjs (`redactTokens`), apps/server/test/load/loadBench.ts.
 * Tests: tools/load/test/loadBench.test.mjs
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { redactTokens } from './k6Container.mjs';

const SERVER_DIR = fileURLToPath(new URL('../../apps/server/', import.meta.url));
const STOP_TIMEOUT_MS = 120_000;

/**
 * A running bench.
 * @typedef {{ready: {toolUrl: string, learners: number}, stop: () => Promise<Record<string, number>>,
 *   errorOutput: () => string}} RunningBench
 */

/**
 * Starts the bench and waits until it is ready.
 * @param {{learners: number, addresses: string, readyTimeoutMs?: number}} options - How many learners, the address
 *   file to write, and how long to wait (default 10 minutes: it installs ten content types first).
 * @returns {Promise<RunningBench>} The bench; call `stop` when the load is done.
 * @throws {Error} When the bench fails or does not get ready in time (with its redacted error output).
 */
export function startBench({ learners, addresses, readyTimeoutMs = 600_000 }) {
  const child = spawn(
    process.execPath,
    [
      '--env-file-if-exists=.env',
      '--import',
      'tsx',
      'test/load/loadBench.ts',
      '--learners',
      String(learners),
      '--addresses',
      addresses,
    ],
    { cwd: SERVER_DIR, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const stderr = [];
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  const errorOutput = () =>
    redactTokens(Buffer.concat(stderr).toString('utf8')).split('\n').slice(-20).join('\n');
  const lines = [];
  const waiters = [];
  createInterface({ input: child.stdout }).on('line', (line) => {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }
    lines.push(parsed);
    waiters.splice(0).forEach((wake) => wake());
  });
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  exited.then(() => waiters.splice(0).forEach((wake) => wake()));
  const next = (test, timeoutMs) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('the bench did not answer in time')), timeoutMs);
      const look = () => {
        const found = lines.find(test) ?? lines.find((line) => line.error);
        if (found || child.exitCode !== null) {
          clearTimeout(timer);
          return found && !found.error
            ? resolve(found)
            : reject(new Error(found?.error ?? 'the bench exited'));
        }
        waiters.push(look);
      };
      look();
    });
  return next((line) => line.ready === true, readyTimeoutMs).then(
    (ready) => ({
      ready,
      errorOutput,
      stop: async () => {
        child.kill('SIGTERM');
        const killer = setTimeout(() => child.kill('SIGKILL'), STOP_TIMEOUT_MS);
        try {
          return (await next((line) => line.rows !== undefined, STOP_TIMEOUT_MS)).rows;
        } finally {
          await exited;
          clearTimeout(killer);
        }
      },
    }),
    (error) => {
      child.kill('SIGKILL');
      throw new Error(`${error.message}\n${errorOutput()}`);
    },
  );
}
