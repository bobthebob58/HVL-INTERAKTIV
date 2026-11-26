/**
 * debugOutput — the debug switches production refuses: `DEBUG` and `NODE_DEBUG`.
 *
 * Why: every line the server writes goes through its logger, which removes personal data and secrets (DATA-009).
 *      `DEBUG` makes libraries write to standard error on their own (Express its routes and addresses, which can
 *      hold an ltik; Lumi's H5P engine file paths), and `NODE_DEBUG` makes Node itself print requests with their
 *      headers. Neither passes the logger, so production does not start with either set (D-133).
 * Spec: DATA-009, NFR-006, DOC-008
 * Invariants:
 *   - A variable set to any non-empty value is a problem; the message names the variable, never its value.
 *   - The variables are read from the raw environment: they are not part of the parsed configuration.
 * Collaborators: ./productionChecks.ts (calls it in production), ../logging/logger.ts.
 * Tests: apps/server/test/config/debugOutput.test.ts
 */

/** The switches that make libraries (`DEBUG`) and Node itself (`NODE_DEBUG`) write debug text to standard error. */
export const DEBUG_OUTPUT_VARIABLES = ['DEBUG', 'NODE_DEBUG'] as const;

/**
 * Lists the debug switches that are set.
 * @param source - The raw environment.
 * @returns One `VARIABLE: reason` message per switch set, naming no value.
 */
export function debugOutputProblems(source: NodeJS.ProcessEnv): string[] {
  // PRIVACY: debug text is written around the logger, so nothing removes tokens or personal data from it.
  return DEBUG_OUTPUT_VARIABLES.filter((name) => (source[name] ?? '') !== '').map(
    (name) =>
      `${name}: must be unset in production; debug output goes around the logger, which removes personal ` +
      'data and secrets (DATA-009)',
  );
}
