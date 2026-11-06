/**
 * holdSignals — holds Ctrl-C, SIGTERM and SIGHUP while a data-subject request runs, so the run always ends with its
 * audit event.
 *
 * Why: DATA-008 audits every use, and D-108's amendment of 2026-11-04 audits a run that fails part-way with what it had
 *      deleted. A signal's default action ends the process at once instead: an erasure stopped by Ctrl-C, a closed SSH
 *      session or a container stop would have deleted rows with no audit event. Held, the run finishes (seconds) and is
 *      audited (D-108's amendment of 2026-11-05).
 * Spec: DATA-008, DATA-007
 * Invariants:
 *   - While `work` runs, SIGINT, SIGTERM and SIGHUP do not end the process; the first of them prints one note.
 *   - The listeners are removed when `work` settles, resolved or rejected; its result or error passes through.
 *   - SIGKILL, Ctrl-\ (SIGQUIT) and a crash cannot be held: such a run stays unaudited (the runbook says so).
 * Collaborators: ./dsrCli.ts (the caller), docs/ops/data-subject-requests.md.
 * Tests: apps/server/test/privacy/dsr/holdSignals.test.ts
 */

/** The signals held while a request runs. */
export const HELD_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

/** One of the held signals. */
export type HeldSignal = (typeof HELD_SIGNALS)[number];

/** Where signals arrive: `process` in production. */
export interface SignalSource {
  /** Adds a listener for a signal (`process.on`). */
  on(signal: HeldSignal, listener: () => void): unknown;
  /** Removes the listener again (`process.off`). */
  off(signal: HeldSignal, listener: () => void): unknown;
}

/** The note printed at the first held signal. */
export const HOLD_NOTE =
  'the request is finishing so that it is audited; wait for it (Ctrl-\\ stops it at once, unaudited)';

/**
 * Runs `work` with the signals held.
 * @param work - The request (export, dry run or erasure, and its audit).
 * @param source - Where signals arrive (`process`).
 * @param warn - Prints one line to standard error.
 * @returns What `work` returns.
 * @throws Whatever `work` throws.
 * @spec DATA-008
 */
export async function holdSignals<T>(
  work: () => Promise<T>,
  source: SignalSource,
  warn: (line: string) => void,
): Promise<T> {
  let noted = false;
  // WHY: a listener replaces the default action, which ends the process before the audit event is written.
  const hold = () => {
    if (!noted) warn(HOLD_NOTE);
    noted = true;
  };
  for (const signal of HELD_SIGNALS) source.on(signal, hold);
  try {
    return await work();
  } finally {
    for (const signal of HELD_SIGNALS) source.off(signal, hold);
  }
}
