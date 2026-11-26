/**
 * serverProcess — runs the server as a process: reads the configuration, starts the server, stops it on SIGTERM
 * and SIGINT, and ends with an exit code whatever goes wrong.
 *
 * Why: the entry point (./main.ts) must never leave a fault to Node's own printing, which writes a message and a
 *      stack as they are, past the logger that removes personal data and secrets (DATA-009). A start that fails
 *      must also end the process, with clients that may already be connected (D-133).
 * Spec: NFR-002, NFR-006, DATA-009, DOC-008
 * Invariants:
 *   - The fault handlers (./processFaults.ts) are installed before anything is read or started.
 *   - Invalid configuration, a bad thresholds file or bad studio content stops the start with the list of problems
 *     on standard error and exit code 1: names, files, lines and keys only, never a value (content files hold no
 *     personal data). Nothing has been connected at that point.
 *   - Any other failed start (a service that cannot be reached, a port that cannot be opened) is one `fatal` line
 *     through the logger and exit code 1; nothing else is printed.
 *   - SIGTERM and SIGINT stop the server once; exit code 0, or 1 with an `error` line when a part did not stop.
 * Collaborators: ./main.ts (`startServer`), ./processFaults.ts, ../config/env.ts, ../logging/logger.ts.
 * Tests: apps/server/test/server/serverProcess.test.ts, apps/server/test/server/main.smoke.test.ts
 */
import type { Logger } from 'pino';
import { InvalidEnvironmentError, loadEnv, loadEnvPart, type Env } from '../config/env.js';
import { InvalidValidationContextError } from '../config/validationContext.js';
import { StudioContentError } from '../learningDesign/content/StudioContentError.js';
import { createLogger } from '../logging/logger.js';
import type { RunningServer } from './main.js';
import { installProcessFaultHandlers, type FaultingProcess } from './processFaults.js';

/** Where the configuration problems are listed: standard error. */
export interface ProblemOutput {
  /** Writes text, as `process.stderr.write` does. */
  write(text: string): unknown;
}

/** The part of `process` a server process uses; tests pass a stand-in. */
export interface HostProcess extends FaultingProcess {
  /** The raw environment. */
  readonly env: NodeJS.ProcessEnv;
  /** The code the process ends with when nothing calls `exit`. */
  exitCode?: typeof process.exitCode;
  /** Where the configuration problems are listed. */
  readonly stderr: ProblemOutput;
  /** Registers a one-time signal listener, as `process.once` does. */
  once(event: 'SIGTERM' | 'SIGINT', listener: () => void): unknown;
}

/** How `runServerProcess` reaches its surroundings; every field has the production default. */
export interface ServerProcessOptions {
  /** The process; defaults to this one. */
  readonly proc?: HostProcess;
  /** The logger for faults of the process itself; defaults to one at the configured `LOG_LEVEL`. */
  readonly logger?: Logger;
}

/** Problems of the configuration or of the content files: reported as a list, without a stack trace. */
const isConfigurationProblem = (error: unknown): error is Error =>
  error instanceof InvalidEnvironmentError ||
  error instanceof InvalidValidationContextError ||
  error instanceof StudioContentError;

// WHY: the process logger is needed before the configuration is known to be valid; a bad level falls back.
const processLogger = (source: NodeJS.ProcessEnv): Logger => {
  try {
    return createLogger({ level: loadEnvPart(['LOG_LEVEL'], source).LOG_LEVEL });
  } catch {
    return createLogger({ level: 'info' });
  }
};

/**
 * Runs the server until a signal stops it.
 * @param start - Starts the server from the parsed configuration (`startServer` of ./main.ts).
 * @param options - The process and the logger, for tests.
 */
export async function runServerProcess(
  start: (env: Env) => Promise<RunningServer>,
  options: ServerProcessOptions = {},
): Promise<void> {
  const proc = options.proc ?? process;
  const logger = options.logger ?? processLogger(proc.env);
  installProcessFaultHandlers(logger, proc);
  let running: RunningServer;
  try {
    running = await start(loadEnv(proc.env));
  } catch (error) {
    if (isConfigurationProblem(error)) {
      // SECURITY: the problem list names variables and rules only, never their values.
      proc.stderr.write(`${error.message}\n`);
      proc.exitCode = 1;
      return;
    }
    // PRIVACY: a service's error can hold its address; the logger redacts it, and nothing is printed raw.
    logger.fatal({ err: error }, 'the server could not start');
    // WHY: clients that connected before the failure would keep the process alive.
    proc.exit(1);
    return;
  }
  let stopping = false;
  const shutdown = (): void => {
    if (stopping) return;
    stopping = true;
    // WHY: idle keep-alive connections would hold `server.close` open until they time out.
    running.server.closeIdleConnections();
    void running.stop().then(
      () => (proc.exitCode = 0),
      (error: unknown) => {
        logger.error({ err: error }, 'the server did not stop cleanly');
        proc.exitCode = 1;
      },
    );
  };
  proc.once('SIGTERM', shutdown);
  proc.once('SIGINT', shutdown);
}
