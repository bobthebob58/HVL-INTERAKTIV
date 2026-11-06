/**
 * dsrFailure — what the data-subject CLI prints when a run fails: a configuration or input problem by its own message,
 * a Prisma or driver error by its value-free line, anything else by its name and code; never a database message.
 *
 * Why: DATA-009 keeps personal data out of what may be kept (a terminal's scrollback, an operations ticket). Prisma
 *      renders a call's arguments into `message` and `stack`, here the person's learnerKeys and identity hashes, so
 *      D-108's amendment of 2026-11-04 prints a failure by name and code only, and its amendment of 2026-11-05 uses the
 *      logger's own value-free line for Prisma errors (`prismaErrorLine`, which also reads a driver error's code).
 * Spec: DATA-008, DATA-009
 * Invariants:
 *   - `InvalidEnvironmentError` and `DataSubjectInputError` print their message, which names variables or fields only.
 *   - A Prisma or driver-adapter error prints its name and database code; any other error its `name` and, when it is
 *     a string, its `code`. Never a message, stack or cause; a thrown non-Error prints `Error`.
 * Collaborators: ./dsrCli.ts (the caller), ../../logging/prismaErrorSummary.ts, ../../config/env.ts, ./dataSubject.ts.
 * Tests: apps/server/test/privacy/dsr/dsrFailure.test.ts
 */
import { InvalidEnvironmentError } from '../../config/env.js';
import { isPrismaError, prismaErrorLine } from '../../logging/prismaErrorSummary.js';
import { DataSubjectInputError } from './dataSubject.js';

/**
 * Describes a failed run for standard error.
 * @param error - What the run threw.
 * @returns One value-free line.
 * @spec DATA-009
 */
export function describeFailure(error: unknown): string {
  if (error instanceof InvalidEnvironmentError || error instanceof DataSubjectInputError)
    return error.message;
  // PRIVACY: Prisma quotes the query's values (learnerKeys, identity hashes) in its message (DATA-009).
  if (isPrismaError(error)) return prismaErrorLine(error);
  const name = error instanceof Error ? error.name : 'Error';
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? `${name} ${code}` : name;
}
