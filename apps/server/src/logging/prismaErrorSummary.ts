/**
 * prismaErrorSummary — recognises Prisma errors and reduces them to fields that cannot hold query values.
 *
 * Why: in every `errorFormat`, Prisma renders the call's arguments (e-mail, names, learner answers) into
 *      `message` and `stack` (verified with Prisma 7.10.1). Key-based redaction cannot remove those, so a
 *      Prisma error is logged by its codes only (DATA-009).
 * Spec: DATA-009
 * Invariants: a Prisma error (class name `PrismaClient*`, or a `clientVersion` property) keeps only type,
 *   code, model name and constraint target; no message, stack or other free text.
 * Collaborators: ./redactPersonalData.ts (calls it for every Error it meets).
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
  error instanceof Error && (error.name.startsWith('PrismaClient') || 'clientVersion' in error);

/**
 * Reduces a Prisma error to log-safe fields.
 * @param error - A Prisma client error.
 * @returns Type, code, model name and constraint target.
 */
export function summarisePrismaError(error: Error & PrismaErrorShape): Record<string, unknown> {
  return {
    type: error.name,
    code: error.code,
    meta: { modelName: error.meta?.modelName, target: error.meta?.target },
  };
}
