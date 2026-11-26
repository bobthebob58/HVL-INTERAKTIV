/**
 * BoundedGate — lets a few pieces of work run at the same time in one server process, keeps a short line behind
 * them, and refuses the rest.
 *
 * Why: every single piece of memory-heavy work has its own ceiling (one insight view, one saved state), but the
 *      number done at the same moment had none, so their sum could pass what the server has. Work that takes a
 *      moment can wait its turn; only a full line is refused (D-134).
 * Spec: NFR-002, INS-001, H5P-005
 * Invariants:
 *   - Never more than `atOnce` pieces of work run; never more than `waiting` wait. Work past both is refused with
 *     `GateBusyError` at once, before it starts.
 *   - Those who wait are served in the order they came; work that ends, also by failing, hands its place to the
 *     next in line.
 *   - Per process: several server processes each have their own gates.
 *   - PRIVACY: a gate holds no request, person or activity, only counts and the waiting work's resumptions.
 * Collaborators: ../insight/InsightViewGate.ts (insight views), ../http/routes/stateSaveGate.ts (saved states),
 *   ../server/memoryBudget.ts and docs/ops/docker.md (the memory budget).
 * Tests: apps/server/test/infra/boundedGate.test.ts
 */

/** How much work runs at once and how much may wait. */
export interface GateLimits {
  /** The most pieces of work at the same time. */
  readonly atOnce: number;
  /** The most pieces of work waiting for a place. */
  readonly waiting: number;
}

/** Thrown when the line is full: the work was not started. */
export class GateBusyError extends Error {
  constructor() {
    super('every place and the whole line are taken');
    this.name = 'GateBusyError';
  }
}

/** A gate of a process. */
export class BoundedGate {
  private working = 0;
  private readonly line: (() => void)[] = [];

  /**
   * @param limits - Places and line length.
   */
  constructor(private readonly limits: GateLimits) {}

  /**
   * Runs one piece of work when a place is free, after waiting in line if need be.
   * @param work - What to do in the place.
   * @returns What the work returns.
   * @throws GateBusyError when every place and the whole line are taken; whatever the work throws.
   */
  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.working < this.limits.atOnce) this.working += 1;
    else if (this.line.length >= this.limits.waiting) throw new GateBusyError();
    // WHY: the place is handed over by the work that ends (below), so the count stays as it is.
    else await new Promise<void>((resume) => this.line.push(resume));
    try {
      return await work();
    } finally {
      const next = this.line.shift();
      if (next) next();
      else this.working -= 1;
    }
  }

  /** How much work runs and how much waits, for tests. */
  get load(): { readonly working: number; readonly waiting: number } {
    return { working: this.working, waiting: this.line.length };
  }
}
