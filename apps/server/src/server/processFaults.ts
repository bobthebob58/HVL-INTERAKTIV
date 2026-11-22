/**
 * processFaults — what the server process does with a fault nothing handled: one `fatal` line through the logger,
 * then exit code 1.
 *
 * Why: without a handler Node prints such a fault to standard error itself, with its message and stack as they
 *      are. A database or Redis error can hold a connection address, and a request error a token; only the logger
 *      removes them (DATA-009). After such a fault the process's state is unknown, so it stops and the deployment
 *      starts a fresh one (D-133).
 * Spec: NFR-006, DATA-009, NFR-002
 * Invariants:
 *   - Both an uncaught exception and an unhandled promise rejection are logged once, at `fatal`, and end the
 *     process with exit code 1, also when the logging itself fails.
 *   - Nothing is written around the logger.
 * Collaborators: ./serverProcess.ts (installs the handlers before anything starts), ../logging/logger.ts.
 * Tests: apps/server/test/server/processFaults.test.ts
 */
import type { Logger } from 'pino';

/** The part of `process` the fault handlers use; tests pass a stand-in. */
export interface FaultingProcess {
  /** Registers a listener, as `process.on` does. */
  on(event: 'uncaughtException' | 'unhandledRejection', listener: (fault: unknown) => void): unknown;
  /** Ends the process, as `process.exit` does. */
  exit(code: number): void;
}

/**
 * Makes unhandled faults end the process through the logger.
 * @param logger - The server's logger (it redacts what it writes).
 * @param proc - The process; defaults to this one.
 */
export function installProcessFaultHandlers(
  logger: Pick<Logger, 'fatal'>,
  proc: FaultingProcess = process,
): void {
  const stopWith = (message: string) => (fault: unknown) => {
    try {
      // PRIVACY: the logger's `err` serializer redacts the fault's message and stack (DATA-009).
      logger.fatal({ err: fault }, message);
    } finally {
      // WHY: the logger writes to standard output synchronously, so the line is out before the process ends.
      proc.exit(1);
    }
  };
  proc.on('uncaughtException', stopWith('an uncaught fault stopped the server'));
  proc.on('unhandledRejection', stopWith('an unhandled promise rejection stopped the server'));
}
