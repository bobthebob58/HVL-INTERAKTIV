/**
 * purgeCli — runs the yearly purge by hand, for HVL operations: `--dry-run` counts what a run would delete and
 * write; `--execute` runs it, from the configured run date on. Run from apps/server:
 * `npm run --silent privacy:purge -- --dry-run`.
 *
 * Why: DATA-003 asks for a dry run that reports counts without deleting; D-107 has a CLI run the same code as the
 *      leased job, so operations can check a purge before the day, rerun one that failed, and see which pseudonym
 *      secret to destroy afterwards (docs/ops/yearly-purge.md).
 * Spec: DATA-003, DATA-007
 * Invariants:
 *   - Exactly one of `--dry-run` and `--execute`; anything else prints the usage and exits 2, deleting nothing.
 *   - SPEC-DEVIATION: D-107 — `--execute` before the run date (default 31 August, Oslo) is refused with exit 1 and
 *     deletes nothing; a dry run may run on any day.
 *   - Every run is audited by ./retentionPurge.ts with `trigger: "cli"` and no actor.
 *   - Prints counts, years and dates only, one JSON line per result; never a secret, key or learner value. A failure
 *     exits 1 with one line (`purgeFailureLine`): a Prisma or driver error by its name and database code only, as the
 *     data-subject CLI does, because Prisma renders a call's arguments into its message (DATA-009); any other error by
 *     its message with credential shapes masked.
 * Collaborators: ./retentionPurge.ts, ./purgeCalendar.ts, ./purgeAudit.ts, ./RetentionPurgeJob.ts (`PurgeEnv`),
 *   ../../config/env.ts, ../../infra/prismaClient.ts, ../../logging/prismaErrorSummary.ts,
 *   ../../logging/redactText.ts, docs/ops/yearly-purge.md.
 * Tests: apps/server/test/privacy/purge/retentionPurge.int.test.ts,
 *   apps/server/test/privacy/purge/purgeCliFailure.test.ts
 */
import { pathToFileURL } from 'node:url';
import { loadEnv } from '../../config/env.js';
import { createPrismaClient, type Database } from '../../infra/prismaClient.js';
import { isPrismaError, prismaErrorLine } from '../../logging/prismaErrorSummary.js';
import { redactText } from '../../logging/redactText.js';
import { minimumGroupSize } from '../minimumGroupSize.js';
import { DEFAULT_PURGE_RUN_DATE, isPurgeDue, purgeRunsFrom, purgeScopeAt } from './purgeCalendar.js';
import { latestPurgedYear, staleSecretYears } from './purgeAudit.js';
import type { PurgeEnv } from './RetentionPurgeJob.js';
import { runRetentionPurge } from './retentionPurge.js';

/** How the CLI is called. */
export const PURGE_USAGE =
  'usage: purgeCli.ts --dry-run   count what the yearly purge would delete (any day)\n' +
  '       purgeCli.ts --execute   run the yearly purge (from PURGE_RUN_DATE, default 31 August)';

/** What the CLI was asked to do, or why it was not understood. */
export type PurgeCliMode = 'dry-run' | 'execute' | 'usage';

/**
 * Reads the CLI's arguments.
 * @param argv - The arguments after the script's path.
 * @returns `dry-run` or `execute` for exactly that one flag; `usage` for anything else.
 * @spec DATA-003
 */
export function parsePurgeArgs(argv: readonly string[]): PurgeCliMode {
  if (argv.length !== 1) return 'usage';
  return argv[0] === '--dry-run' ? 'dry-run' : argv[0] === '--execute' ? 'execute' : 'usage';
}

/** What a CLI run uses. */
export interface PurgeCliDeps {
  readonly env: PurgeEnv;
  readonly db: Database;
  /** The run's moment. */
  readonly now: Date;
  /** Prints one line (standard output in production). */
  readonly write: (line: string) => void;
}

/** An Oslo date as `YYYY-MM-DD`. */
const osloDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', dateStyle: 'short' });

/**
 * Runs the CLI.
 * @param argv - The arguments after the script's path.
 * @param deps - Configuration, database, moment and output.
 * @returns The exit code: 0 done, 1 refused before the run date, 2 usage.
 * @throws Whatever the purge throws; the run is then audited as failed.
 * @spec DATA-003
 */
export async function runPurgeCli(argv: readonly string[], deps: PurgeCliDeps): Promise<number> {
  const mode = parsePurgeArgs(argv);
  if (mode === 'usage') {
    deps.write(PURGE_USAGE);
    return 2;
  }
  const runDate = deps.env.PURGE_RUN_DATE ?? DEFAULT_PURGE_RUN_DATE;
  if (mode === 'execute' && !isPurgeDue(runDate, deps.now)) {
    const { endedYear } = purgeScopeAt(deps.now);
    const from = osloDay.format(purgeRunsFrom(runDate, deps.now));
    // SPEC-DEVIATION: D-107 — never before the run date, so the 30 days after the year's end always pass first.
    deps.write(
      `refused: the purge of academic year ${endedYear} may run from ${from} (PURGE_RUN_DATE, D-107)`,
    );
    return 1;
  }
  const groupSize = minimumGroupSize(deps.env.MIN_GROUP_SIZE);
  const dryRun = mode === 'dry-run';
  const result = await runRetentionPurge(
    { db: deps.db, groupSize },
    { now: deps.now, dryRun, trigger: 'cli' },
  );
  deps.write(JSON.stringify(result));
  if (!dryRun) {
    const years = staleSecretYears(deps.env.PSEUDONYM_SECRETS.keys(), await latestPurgedYear(deps.db));
    // PRIVACY: years only; the secrets themselves are removed by operations (D-107, docs/ops/yearly-purge.md).
    if (years.length > 0) deps.write(JSON.stringify({ removePseudonymSecretsOfYears: years }));
  }
  return 0;
}

/**
 * Describes a failed run for standard error.
 * @param error - What the run threw.
 * @returns One line: a Prisma or driver error's name and database code (`PrismaClientKnownRequestError P2002`), or
 *   another error's message (a configuration problem names variables, never values) with credential shapes masked.
 * @spec DATA-003
 */
export function purgeFailureLine(error: unknown): string {
  // PRIVACY: Prisma renders the call's arguments into `message`; its name and code are enough (DATA-009).
  if (isPrismaError(error)) return prismaErrorLine(error);
  return error instanceof Error ? redactText(error.message) : 'Error';
}

async function main(): Promise<void> {
  try {
    const env = loadEnv(process.env);
    const db = createPrismaClient(env.DATABASE_URL);
    try {
      const write = (line: string) => void process.stdout.write(`${line}\n`);
      process.exitCode = await runPurgeCli(process.argv.slice(2), { env, db, now: new Date(), write });
    } finally {
      await db.$disconnect();
    }
  } catch (error) {
    // SECURITY: the environment's problem list names variables, never their values; a database error is its code.
    process.stderr.write(`retention purge failed: ${purgeFailureLine(error)}\n`);
    process.exitCode = 1;
  }
}

// WHY: tests import `runPurgeCli` without running the CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
