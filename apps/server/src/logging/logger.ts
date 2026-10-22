/**
 * logger — the structured JSON logger every server module uses.
 *
 * Why: one configured pino instance guarantees that every log line passes the same personal-data
 *      redaction (DATA-009) and has the same shape for the log pipeline (NFR-006).
 * Spec: DATA-009, NFR-006
 * Invariants:
 *   - Every record, every base and child-logger binding and every argument after the record (message
 *     strings, printf-style arguments, object messages) goes through `redactPersonalData` / `redactText`.
 *   - An Error used as a printf argument becomes redacted text (`Error: …`); a Prisma error becomes its
 *     code line only (./prismaErrorSummary.ts).
 *   - An error logged without a message gets a redacted `msg` (Prisma errors: code only), unless the
 *     record already has its own `msg`, mirroring pino's own rule.
 *   - What redaction can and cannot do: keys and credential/e-mail shapes are removed; names typed into
 *     free text cannot be recognised, so messages must never contain them (DATA-009).
 * Collaborators: ./redactPersonalData.ts, ./redactText.ts, ./prismaErrorSummary.ts, ../config/env.ts (LOG_LEVEL).
 * Tests: apps/server/test/logging/logger.test.ts, apps/server/test/logging/loggerMessages.test.ts
 */
import { pino, type DestinationStream, type Logger, type LevelWithSilent } from 'pino';
import { isPrismaError, prismaErrorLine } from './prismaErrorSummary.js';
import { redactPersonalData } from './redactPersonalData.js';
import { redactText } from './redactText.js';

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

/** A log-safe one-line message for an error, or undefined when it has no usable message. */
const messageOf = (error: Error): string | undefined => {
  if (isPrismaError(error)) return prismaErrorLine(error);
  return typeof error.message === 'string' ? redactText(error.message) : undefined;
};

/** Redacts one argument that pino will place inside `msg`. */
const maskArgument = (arg: unknown): unknown => {
  if (typeof arg === 'string') return redactText(arg);
  if (arg instanceof Error) return isPrismaError(arg) ? prismaErrorLine(arg) : redactText(String(arg));
  return arg !== null && typeof arg === 'object' ? redactPersonalData(arg) : arg;
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
          const all = args as unknown[];
          // PRIVACY: a leading record object is redacted by formatters.log; everything after it ends up in `msg`.
          const recordFirst = all.length > 0 && typeof all[0] !== 'string';
          const masked = all.map((arg, i) => (i === 0 && recordFirst ? arg : maskArgument(arg)));
          // PRIVACY: with no message, pino copies err.message into `msg` after this hook runs.
          if (recordFirst && masked.slice(1).every((arg) => arg === undefined)) {
            const error = errorOf(all[0]);
            const ownMsg = all[0] !== null && typeof all[0] === 'object' && Object.hasOwn(all[0], 'msg');
            const message = error && !ownMsg ? messageOf(error) : undefined;
            if (message !== undefined) masked.splice(1, masked.length - 1, message);
          }
          method.apply(this, masked as Parameters<typeof method>);
        },
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
