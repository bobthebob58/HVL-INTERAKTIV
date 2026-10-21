/**
 * logger — the structured JSON logger every server module uses.
 *
 * Why: one configured pino instance guarantees that every log line passes the same personal-data
 *      redaction (DATA-009) and has the same shape for the log pipeline (NFR-006).
 * Spec: DATA-009, NFR-006
 * Invariants:
 *   - Every record, every base and child-logger binding and every message string goes through
 *     `redactPersonalData` / `redactText` before it is serialised.
 *   - Error objects are logged under `err` with type, message and stack, all redacted.
 * Collaborators: ./redactPersonalData.ts, ../config/env.ts (LOG_LEVEL).
 * Tests: apps/server/test/logging/logger.test.ts
 */
import { pino, type DestinationStream, type Logger, type LevelWithSilent } from 'pino';
import { redactPersonalData, redactText } from './redactPersonalData.js';

/** Options for `createLogger`. */
export interface LoggerOptions {
  /** Minimum level to write. */
  level: LevelWithSilent;
  /** Where to write; defaults to standard output. Tests pass an in-memory stream. */
  destination?: DestinationStream;
}

const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

/**
 * Creates the application logger.
 * @param options - Level and optional destination.
 * @returns A pino logger whose output contains no personal data.
 */
export function createLogger(options: LoggerOptions): Logger {
  const logger = pino(
    {
      level: options.level,
      base: { service: 'hvl-interaktiv-server' },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
        bindings: (bindings) => asRecord(redactPersonalData(bindings)),
        log: (record) => asRecord(redactPersonalData(record)),
      },
      serializers: { err: (error: unknown) => redactPersonalData(error) },
      hooks: {
        // PRIVACY: message strings are free text, so tokens in them (e.g. a URL with ?ltik=) are masked.
        logMethod(args, method) {
          const masked = args.map((arg) => (typeof arg === 'string' ? redactText(arg) : arg));
          method.apply(this, masked as Parameters<typeof method>);
        },
      },
    },
    options.destination,
  );
  // UPSTREAM: pino skips formatters.bindings for child loggers by design (https://getpino.io/#/docs/api?id=bindings).
  // Children are created with Object.create(parent), so this wrapper is inherited at every depth.
  const originalChild = logger.child;
  logger.child = function redactingChild(this: Logger, bindings, childOptions) {
    return originalChild.call(this, asRecord(redactPersonalData(bindings)), childOptions);
  } as Logger['child'];
  return logger;
}
