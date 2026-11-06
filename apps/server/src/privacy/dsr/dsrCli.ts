/**
 * dsrCli — the data-subject request tool for HVL operations: `export` prints everything stored about a learner as
 * JSON; `erase` counts what it would delete, and deletes it with `--confirm`. The person is read from standard input.
 * Run from apps/server: `npm run --silent --logs-max=0 privacy:dsr -- export --operator <id> > <file>`.
 *
 * Why: DATA-008 needs an admin-only export and erasure tool. D-108 makes it a CLI run where the server runs, never a
 *      web page or HTTP route, and its amendment of 2026-11-04 reads the person's identifiers from standard input,
 *      never from the arguments (shell history, process list), with the exit codes below.
 * Spec: DATA-008, DATA-007, DATA-009
 * Invariants:
 *   - Exactly `export|erase --operator <feide-id>`, and `--confirm` only after `erase`; anything else prints the usage
 *     and exits 2 before the configuration or the database is read.
 *   - Exit codes: 0 done, 1 refused or failed, 2 usage or an unreadable data subject, 3 an erasure that found rows
 *     written while it ran.
 *   - Standard output carries only the export document (`export`) or the summary line (`erase`); standard error the
 *     export's summary, refusals and failures. PRIVACY: `export` refuses (exit 2, nothing read) when standard output
 *     is a terminal, so the person's record goes to a file or a pipe, never to scrollback (D-108, 2026-11-05).
 *   - SECURITY: once the data subject is read, the run is held against Ctrl-C, SIGTERM and SIGHUP until it is audited
 *     (./holdSignals.ts), so no erasure ends unaudited because of a signal (DATA-008).
 *   - PRIVACY: nothing printed holds an identifier the request gave; a failure prints a value-free line
 *     (./dsrFailure.ts), never a database message, which can quote query values (DATA-009).
 * Collaborators: ./dataSubjectRequest.ts, ./dataSubject.ts, ./subjectInput.ts, ./holdSignals.ts, ./dsrFailure.ts,
 *   ../../config/env.ts, ../../infra/prismaClient.ts, ../../security/keys/IdentityHasher.ts,
 *   docs/ops/data-subject-requests.md.
 * Tests: apps/server/test/privacy/dsr/dsrCli.int.test.ts, apps/server/test/privacy/dsr/dsrArgs.test.ts,
 *   apps/server/test/privacy/dsr/dsrCliGuards.test.ts
 */
import { pathToFileURL } from 'node:url';
import { loadEnv } from '../../config/env.js';
import { createPrismaClient } from '../../infra/prismaClient.js';
import { IdentityHasher } from '../../security/keys/IdentityHasher.js';
import { DataSubjectInputError, parseDataSubject } from './dataSubject.js';
import { hasRemainingRows, runDataSubjectRequest, type DsrDeps } from './dataSubjectRequest.js';
import type { DsrAction } from './dsrAudit.js';
import { describeFailure } from './dsrFailure.js';
import { holdSignals } from './holdSignals.js';
import { readSubjectInput } from './subjectInput.js';
import { NoPseudonymSecretsError } from './subjectKeys.js';

/** How the CLI is called. */
export const DSR_USAGE = [
  'usage: dsrCli.ts export --operator <your-feide-id>             print the data subject’s data as JSON',
  '       dsrCli.ts erase --operator <your-feide-id> [--confirm]  count it (dry run), or delete it',
  'The data subject is read from standard input as one JSON object, for example',
  '  {"feideId":"<feide-id>","lti":[{"issuer":"<iss>","sub":"<sub>"}]}',
].join('\n');

/** The CLI's exit codes. */
export const DSR_EXIT = { done: 0, refusedOrFailed: 1, usage: 2, rowsRemain: 3 } as const;

/** What the arguments ask for. */
export interface DsrCliArgs {
  readonly action: DsrAction;
  readonly operatorFeideId: string;
  readonly confirm: boolean;
}

/**
 * Reads the CLI's arguments.
 * @param argv - The arguments after the script's path.
 * @returns The action, the operator and `confirm`; undefined for anything else.
 * @spec DATA-008
 */
export function parseDsrArgs(argv: readonly string[]): DsrCliArgs | undefined {
  const [action, ...rest] = argv;
  if (action !== 'export' && action !== 'erase') return undefined;
  let operatorFeideId: string | undefined;
  let confirm = false;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i] ?? '';
    if (arg === '--confirm' && action === 'erase' && !confirm) confirm = true;
    else if (
      arg === '--operator' &&
      operatorFeideId === undefined &&
      !(rest[i + 1] ?? '--').startsWith('--')
    ) {
      operatorFeideId = rest[(i += 1)];
    } else if (arg.startsWith('--operator=') && operatorFeideId === undefined) {
      operatorFeideId = arg.slice('--operator='.length);
    } else return undefined;
  }
  return operatorFeideId ? { action, operatorFeideId, confirm } : undefined;
}

/** What a CLI run uses: the request's dependencies, standard input and the two outputs. */
export interface DsrCliDeps extends DsrDeps {
  /** Reads the data subject (standard input in production). */
  readonly readSubject: () => Promise<string>;
  /** Prints to standard output. */
  readonly write: (text: string) => void;
  /** Prints one line to standard error. */
  readonly warn: (line: string) => void;
  /** True when standard output is a terminal (`export` then refuses). */
  readonly stdoutIsTerminal?: boolean;
  /** Runs the request once the subject is read (./holdSignals.ts in production). */
  readonly finishFirst?: <T>(work: () => Promise<T>) => Promise<T>;
}

/** What `export` prints when standard output is a terminal. */
export const EXPORT_TO_TERMINAL =
  'export prints personal data: redirect standard output to a file, e.g. `… > <DPO case number>.json`';

/**
 * Runs the CLI.
 * @param argv - The arguments after the script's path.
 * @param deps - The request's dependencies, the input and the outputs.
 * @returns The exit code (`DSR_EXIT`).
 * @throws Whatever the database throws; the run is then audited as failed.
 * @spec DATA-008
 */
export async function runDsrCli(argv: readonly string[], deps: DsrCliDeps): Promise<number> {
  const args = parseDsrArgs(argv);
  if (!args) {
    deps.warn(DSR_USAGE);
    return DSR_EXIT.usage;
  }
  if (args.action === 'export' && deps.stdoutIsTerminal) {
    deps.warn(EXPORT_TO_TERMINAL);
    return DSR_EXIT.usage;
  }
  let subject;
  try {
    subject = parseDataSubject(await deps.readSubject());
  } catch (error) {
    if (!(error instanceof DataSubjectInputError)) throw error;
    deps.warn(`the data subject is not readable: ${error.message}`);
    return DSR_EXIT.usage;
  }
  let result;
  const finishFirst = deps.finishFirst ?? (<T>(work: () => Promise<T>) => work());
  try {
    result = await finishFirst(() => runDataSubjectRequest(deps, { ...args, subject }));
  } catch (error) {
    if (!(error instanceof NoPseudonymSecretsError)) throw error;
    deps.warn(`refused: ${error.message}`);
    return DSR_EXIT.refusedOrFailed;
  }
  if (result.outcome === 'refused') {
    deps.warn(
      `refused (${result.reason}): --operator must name your own HVL admin account (ADMIN_FEIDE_IDS, with a staff ` +
        `account); audited as request ${result.requestId}`,
    );
    return DSR_EXIT.refusedOrFailed;
  }
  const summary = JSON.stringify(result.summary);
  if (result.document) {
    deps.write(`${JSON.stringify(result.document, null, 2)}\n`);
    deps.warn(summary);
  } else deps.write(`${summary}\n`);
  if (!hasRemainingRows(result.summary)) return DSR_EXIT.done;
  deps.warn('rows were written under the keys while the erasure ran; run the erasure again');
  return DSR_EXIT.rowsRemain;
}

async function main(argv: readonly string[]): Promise<void> {
  if (!parseDsrArgs(argv)) {
    process.stderr.write(`${DSR_USAGE}\n`);
    process.exitCode = DSR_EXIT.usage;
    return;
  }
  try {
    const env = loadEnv(process.env);
    const db = createPrismaClient(env.DATABASE_URL);
    const warn = (line: string) => void process.stderr.write(`${line}\n`);
    try {
      process.exitCode = await runDsrCli(argv, {
        db,
        secrets: env.PSEUDONYM_SECRETS,
        hasher: new IdentityHasher(env.IDENTITY_HASH_KEYS),
        adminFeideIds: env.ADMIN_FEIDE_IDS,
        now: new Date(),
        readSubject: () => readSubjectInput(process.stdin, warn),
        write: (text) => void process.stdout.write(text),
        warn,
        stdoutIsTerminal: process.stdout.isTTY === true,
        finishFirst: (work) => holdSignals(work, process, warn),
      });
    } finally {
      await db.$disconnect();
    }
  } catch (error) {
    // PRIVACY: a value-free line; Prisma's own message quotes the query's learnerKeys and hashes (DATA-009).
    process.stderr.write(`data-subject request failed: ${describeFailure(error)}\n`);
    process.exitCode = DSR_EXIT.refusedOrFailed;
  }
}

// WHY: tests import `runDsrCli` without running the CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main(process.argv.slice(2));
