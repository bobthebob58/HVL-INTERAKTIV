/**
 * logger — the structured JSON logger every server module uses.
 *
 * Why: one configured pino instance guarantees that every log line passes the same personal-data
 *      redaction (DATA-009) and has the same shape for the log pipeline (NFR-006).
 * Spec: DATA-009, NFR-006
 * Invariants:
 *   - Every record, every base and child-logger binding, every message string and every printf-style
 *     argument goes through `redactPersonalData` / `redactText` before it is serialised.
 *   - An error logged without a message gets a redacted copy of its message as `msg`.
 *   - Error objects are logged under `err` with type, message and stack, all redacted; Prisma errors keep
 *     their codes only (./prismaErrorSummary.ts).
 *   - As a last line of defence, every finished line passes `redactText` once more.
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

/** The error pino would copy into `msg` when a call has no message: the argument itself, or its `err`. */
const errorOf = (value: unknown): Error | undefined => {
  if (value instanceof Error) return value;
  const err = value !== null && typeof value === 'object' ? asRecord(value).err : undefined;
  return err instanceof Error ? err : undefined;
};

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
        logMethod(args, method) {
          // PRIVACY: strings are free text; objects after the format string end up inside `msg`.
          const formatAt = typeof args[0] === 'string' ? 0 : 1;
          const masked: unknown[] = args.map((arg, i) =>
            typeof arg === 'string' ? redactText(arg) : i > formatAt ? redactPersonalData(arg) : arg,
          );
          // PRIVACY: with no message string, pino copies err.message into `msg` after this hook runs.
          const error = masked.length === 1 ? errorOf(masked[0]) : undefined;
          if (error) masked.push(redactText(error.message));
          method.apply(this, masked as Parameters<typeof method>);
        },
        streamWrite: (line) => redactText(line),
      },
    },
    options.destination,
  );
  // WHY: pino skips formatters.bindings for child loggers by design (https://getpino.io/#/docs/api?id=bindings).
  // Children are created with Object.create(parent), so this wrapper is inherited at every depth.
  const originalChild = logger.child;
  logger.child = function redactingChild(this: Logger, bindings, childOptions) {
    return originalChild.call(this, asRecord(redactPersonalData(bindings)), childOptions);
  } as Logger['child'];
  return logger;
}
