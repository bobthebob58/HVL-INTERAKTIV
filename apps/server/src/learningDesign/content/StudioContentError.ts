/**
 * StudioContentError — thrown at start-up (and by `npm run content:check`) when a file under `content/` has
 * problems; it lists every problem, each with its file, line and key.
 *
 * Why: a bad content file stops the start (D-082, as D-073 does for the thresholds), and the person fixing it should
 *      see every mistake at once, not one per restart.
 * Spec: PED-001
 * Invariants:
 *   - `problems` is frozen and ordered by file, then line.
 *   - The message holds file paths, line numbers, keys and plain-English descriptions only; content files hold no
 *     personal data, so the message is safe to log (DATA-009).
 * Collaborators: ./loadStudioContent.ts (throws it), ./runContentCheck.ts (prints it), ./contentProblem.ts.
 * Tests: apps/server/test/learningDesign/content/loadStudioContent.test.ts
 */
import { formatContentProblem, sortContentProblems, type ContentProblem } from './contentProblem.js';

/** The studio content in `content/` cannot be loaded; start-up stops. */
export class StudioContentError extends Error {
  /** Every problem, ordered by file and line. */
  readonly problems: readonly ContentProblem[];

  /**
   * @param problems - Every problem found across the content files.
   */
  constructor(problems: readonly ContentProblem[]) {
    const sorted = Object.freeze(sortContentProblems(problems));
    const count = sorted.length === 1 ? '1 problem' : `${sorted.length} problems`;
    super(
      `The studio content has ${count}; the server does not start until it is fixed:\n` +
        `${sorted.map((problem) => `  - ${formatContentProblem(problem)}`).join('\n')}\n` +
        'See content/README.md for how to edit these files; `npm run content:check` checks them without a server.',
    );
    this.name = 'StudioContentError';
    this.problems = sorted;
  }
}
