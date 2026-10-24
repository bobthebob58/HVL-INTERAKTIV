/**
 * capturedLogger — the application logger with an in-memory destination, for tests that read what was logged.
 *
 * Why: tests prove what a module logs (and that no token or personal value is logged) by reading the lines pino
 *      wrote; each built the same in-memory Writable by hand, and one helper keeps them alike.
 * Spec: DATA-009, NFR-006
 * Invariants:
 *   - The logger is `createLogger` unchanged, so every line passes the same redaction as in production.
 *   - `lines` keeps every written line in order, as pino wrote it (JSON and a newline); `silent` writes nothing.
 * Collaborators: ../../src/logging/logger.ts.
 * Tests: used by apps/server/test/h5p/cleanupJob.test.ts, apps/server/test/h5p/h5pServerInit.test.ts,
 *   apps/server/test/logging/loggerMessages.test.ts, apps/server/test/auth/audit/AuthAuditRecorder.int.test.ts,
 *   apps/server/test/lti/ltijsLogger.test.ts, ./feideTestbed.ts and ./appTestbed.ts.
 */
import { Writable } from 'node:stream';
import type { LevelWithSilent, Logger } from 'pino';
import { createLogger } from '../../src/logging/logger.js';

/** A logger and the lines it wrote. */
export interface CapturedLogger {
  readonly logger: Logger;
  /** Each line as pino wrote it (JSON and a newline). */
  readonly lines: string[];
}

/**
 * Creates the application logger with an in-memory destination.
 * @param level - Minimum level; `silent` writes nothing.
 * @returns The logger and its lines.
 */
export function capturedLogger(level: LevelWithSilent = 'info'): CapturedLogger {
  const lines: string[] = [];
  const destination = new Writable({
    write: (chunk, _encoding, done) => (lines.push(String(chunk)), done()),
  });
  return { logger: createLogger({ level, destination }), lines };
}
