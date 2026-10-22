/**
 * prismaErrorSummary — recognises Prisma errors and reduces them to fields that cannot hold query values.
 *
 * Why: in every `errorFormat`, Prisma renders the call's arguments (e-mail, names, learner answers) into
 *      `message` and `stack` (verified with Prisma 7.10.1). Key-based redaction cannot remove those, so a
 *      Prisma error is logged by its codes only (DATA-009).
 * Spec: DATA-009
 * Invariants: a Prisma error (class name `PrismaClient*` or `DriverAdapterError`, or a `clientVersion`
 *   property) keeps only type, code, model name and constraint target, in the record and in `msg`; no
 *   message, stack, cause or other free text.
 * Collaborators: ./redactPersonalData.ts (calls it for every Error it meets), ./logger.ts (message lines).
 * Tests: apps/server/test/logging/logger.test.ts
 */

/** Fields of a Prisma error that never contain query values. */
interface PrismaErrorShape {
  name: string;
  code?: unknown;
  clientVersion?: unknown;
  meta?: { modelName?: unknown; target?: unknown };
}

/**
 * Tells whether an error comes from the Prisma client.
 * @param error - Any value.
 * @returns True for Prisma client errors.
 */
export const isPrismaError = (error: unknown): error is Error & PrismaErrorShape =>
  error instanceof Error &&
  (error.name.startsWith('PrismaClient') || error.name === 'DriverAdapterError' || 'clientVersion' in error);

/** The database error code of a Prisma or driver-adapter error, if any. */
const codeOf = (error: Error & PrismaErrorShape): unknown =>
  error.code ?? (error as { cause?: { originalCode?: unknown } }).cause?.originalCode;

/**
 * Reduces a Prisma error to log-safe fields.
 * @param error - A Prisma client error.
 * @returns Type, code, model name and constraint target.
 */
export function summarisePrismaError(error: Error & PrismaErrorShape): Record<string, unknown> {
  // WHY: a driver-adapter error (found in `meta.driverAdapterError`) carries the failing row in `cause.detail`.
  if (error.name === 'DriverAdapterError') {
    return {
      type: error.name,
      kind: (error as { cause?: { kind?: unknown } }).cause?.kind,
      code: codeOf(error),
    };
  }
  return {
    type: error.name,
    code: error.code,
    meta: { modelName: error.meta?.modelName, target: error.meta?.target },
  };
}

/**
 * A one-line, value-free message for a Prisma error, used where a message string is needed.
 * @param error - A Prisma client or driver-adapter error.
 * @returns e.g. `PrismaClientKnownRequestError P2002`.
 */
export function prismaErrorLine(error: Error & PrismaErrorShape): string {
  const code = codeOf(error);
  return code === undefined ? error.name : `${error.name} ${String(code)}`;
}
