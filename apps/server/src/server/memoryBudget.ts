/**
 * memoryBudget — what memory the server may use against what its container gives it, said once at start.
 *
 * Why: every single thing the server does has a ceiling (one upload, one SVG, one insight view, one export),
 *      but nobody was told whether their sum fits the container. Without any limit a runaway process can take
 *      the machine; with one below the sum the kernel stops the server without a line in its log, where Node's
 *      own heap limit at least says "heap out of memory". One start line gives the three numbers, and a warning
 *      follows when they do not fit (D-134).
 * Spec: NFR-002, NFR-006, NFR-007
 * Invariants:
 *   - Needed = Node's heap limit + the SVG worker's limit (D-119) + the server outside its heap + Chromium for
 *     `PDF_MAX_CONCURRENCY` exports + the temporary folder when it is kept in memory (a tmpfs counts against the
 *     container). The last three are measured figures, rounded up (D-134).
 *   - Warns, never refuses: an estimate must not keep a working installation from starting. Production without
 *     any limit warns; a limit below the need warns in every mode.
 *   - The line holds numbers only.
 * Collaborators: ./main.ts (logs it at start), ../security/svg/svgCleaningLimits.ts, docs/ops/docker.md (the
 *   budget for operators), deploy/compose.app.yml (the example limit).
 * Tests: apps/server/test/server/memoryBudget.test.ts
 */
import { statfsSync } from 'node:fs';
import { tmpdir, totalmem } from 'node:os';
import { getHeapStatistics } from 'node:v8';
import type { Logger } from 'pino';
import type { Env } from '../config/env.js';
import { SVG_CLEANING_LIMITS } from '../security/svg/svgCleaningLimits.js';

const MB = 1024 * 1024;
/** Linux's file system type of a folder kept in memory. */
const TMPFS = 0x01021994;

/** The server process outside its heap (code, buffers, the idle SVG worker): about 250 MB measured, in MiB. */
export const OUTSIDE_HEAP_MB = 256;
/** Chromium while it prints one PDF: 246 MB measured, in MiB. */
export const CHROMIUM_BASE_MB = 256;
/** Each further export at once, in MiB. */
export const CHROMIUM_PER_EXPORT_MB = 128;

/** The facts the budget is worked out from. */
export interface MemoryFacts {
  /** The heap limit of the server's main thread, in bytes. */
  readonly heapLimitBytes: number;
  /** The container's memory limit in bytes; undefined when there is none. */
  readonly containerLimitBytes: number | undefined;
  /** The size of the temporary folder in bytes when it is kept in memory, else 0. */
  readonly temporaryFolderBytes: number;
  /** `PDF_MAX_CONCURRENCY`. */
  readonly pdfExportsAtOnce: number;
  /** Whether the mode is `production`. */
  readonly production: boolean;
}

/** The budget in MiB, and what is wrong with it, if anything. */
export interface MemoryBudget {
  /** The container's limit; null when there is none. */
  readonly containerLimitMb: number | null;
  readonly heapLimitMb: number;
  /** What the server may use beside its heap. */
  readonly besideHeapMb: number;
  /** The heap limit and what is beside it. */
  readonly neededMb: number;
  /** `no-limit` (production only) or `limit-too-small`; undefined when the budget fits. */
  readonly problem?: 'no-limit' | 'limit-too-small';
}

/**
 * Works the budget out.
 * @param facts - The limits and settings of this process.
 * @returns The numbers in MiB and the problem, if any.
 */
export function memoryBudgetOf(facts: MemoryFacts): MemoryBudget {
  const heapLimitMb = Math.ceil(facts.heapLimitBytes / MB);
  const chromiumMb = CHROMIUM_BASE_MB + Math.max(0, facts.pdfExportsAtOnce - 1) * CHROMIUM_PER_EXPORT_MB;
  const besideHeapMb =
    SVG_CLEANING_LIMITS.memoryMb + OUTSIDE_HEAP_MB + chromiumMb + Math.ceil(facts.temporaryFolderBytes / MB);
  const neededMb = heapLimitMb + besideHeapMb;
  const sizes = { heapLimitMb, besideHeapMb, neededMb };
  if (facts.containerLimitBytes === undefined)
    return { containerLimitMb: null, ...sizes, ...(facts.production ? { problem: 'no-limit' } : {}) };
  const containerLimitMb = Math.floor(facts.containerLimitBytes / MB);
  return {
    containerLimitMb,
    ...sizes,
    ...(neededMb > containerLimitMb ? { problem: 'limit-too-small' } : {}),
  };
}

/**
 * Reads this process's limits.
 * @param env - The parsed configuration.
 * @returns The facts for `memoryBudgetOf`.
 */
export function readMemoryFacts(env: Pick<Env, 'NODE_ENV' | 'PDF_MAX_CONCURRENCY'>): MemoryFacts {
  // UPSTREAM: https://nodejs.org/api/process.html#processconstrainedmemory — without a limit Node 24 answers 0
  // or a number far above the machine's memory, so only a limit below the machine's memory counts as one.
  const constrained = process.constrainedMemory();
  let temporaryFolderBytes = 0;
  try {
    const folder = statfsSync(tmpdir());
    if (folder.type === TMPFS) temporaryFolderBytes = folder.blocks * folder.bsize;
  } catch {
    // WHY: where the folder cannot be asked (another platform), it is not counted.
  }
  return {
    heapLimitBytes: getHeapStatistics().heap_size_limit,
    containerLimitBytes: constrained > 0 && constrained < totalmem() ? constrained : undefined,
    temporaryFolderBytes,
    pdfExportsAtOnce: env.PDF_MAX_CONCURRENCY,
    production: env.NODE_ENV === 'production',
  };
}

/**
 * Writes the budget to the log: one `info` line, and a `warn` line when it does not fit.
 * @param logger - The server's logger.
 * @param budget - The worked-out budget.
 */
export function logMemoryBudget(logger: Pick<Logger, 'info' | 'warn'>, budget: MemoryBudget): void {
  const { problem, ...numbers } = budget;
  logger.info(numbers, 'memory limits');
  if (problem === 'no-limit')
    logger.warn(numbers, 'the container has no memory limit: one fault could take the whole machine');
  if (problem === 'limit-too-small')
    logger.warn(
      numbers,
      'the memory limit is below what the server may use: the system would stop it without a log line; ' +
        'raise the limit or start Node with a smaller heap',
    );
}
