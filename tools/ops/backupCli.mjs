/**
 * backupCli — `npm run ops:backup -- --out <folder>`, `npm run ops:backup-verify -- --from <backup>` and
 * `npm run ops:restore -- --from <backup>`: the backup, its check and the restore drill for HVL operations.
 *
 * Why: NFR-002 asks for daily database backups kept 30 days and a documented restore tested once per semester;
 *      docs/ops/runbook.md gives these commands, and D-110's backup amendment of 2026-11-05 what they do.
 * Spec: NFR-002, DATA-009
 * Invariants:
 *   - Reads only the server's own variables (`DATABASE_URL` and the `S3_*` settings) and its arguments.
 *   - Prints one JSON line with counts on standard output; a failure prints `{"error": …}` on standard error with
 *     a message that names a variable, a file or a rule, never a value (DATA-009).
 *   - Exit codes: 0 done (and, for a restore or a check, nothing differs), 1 failed or something differs, 2 bad
 *     arguments.
 *   - Files it writes are readable by their owner only (umask 077).
 * Collaborators: ./backupRun.mjs, the root package.json scripts, docs/ops/runbook.md.
 * Tests: tools/ops/test/backupRoundTrip.test.mjs (through this CLI, as operations run it)
 */
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { BackupConfigError } from './postgresConnection.mjs';
import { DEFAULT_KEEP_DAYS, runBackup, runRestore, runVerify } from './backupRun.mjs';

/** How to call the CLI. */
export const USAGE =
  'usage: node tools/ops/backupCli.mjs backup --out <folder> [--keep-days 30]\n' +
  '       node tools/ops/backupCli.mjs verify --from <backup folder>\n' +
  '       node tools/ops/backupCli.mjs restore --from <backup folder>';

/**
 * Parses the command line.
 * @param {string[]} argv - Arguments after the script name.
 * @returns {{command: 'backup' | 'verify' | 'restore', out?: string, from?: string, keepDays: number}} Options.
 * @throws {Error} For an unknown command or option, a missing folder or a bad `--keep-days`.
 */
export function parseCliArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { out: { type: 'string' }, from: { type: 'string' }, 'keep-days': { type: 'string' } },
    allowPositionals: true,
    strict: true,
  });
  const [command, ...rest] = positionals;
  if (!['backup', 'verify', 'restore'].includes(command) || rest.length > 0)
    throw new Error('unknown command');
  if (command === 'backup' && !values.out) throw new Error('backup needs --out <folder>');
  if (command !== 'backup' && !values.from) throw new Error(`${command} needs --from <backup folder>`);
  const keepDays = Number(values['keep-days'] ?? DEFAULT_KEEP_DAYS);
  if (!Number.isInteger(keepDays) || keepDays < 1 || keepDays > 3650) {
    throw new Error('--keep-days must be a whole number of days from 1 to 3650');
  }
  return { command, out: values.out, from: values.from, keepDays };
}

/**
 * Runs one command.
 * @param {ReturnType<typeof parseCliArgs>} options - Parsed arguments.
 * @param {Record<string, string | undefined>} env - The process environment.
 * @returns {Promise<{result: object, ok: boolean}>} The summary to print and whether the run succeeded.
 */
export async function runCommand(options, env) {
  if (options.command === 'backup') {
    return { result: await runBackup({ env, outDir: options.out, keepDays: options.keepDays }), ok: true };
  }
  if (options.command === 'verify') {
    const result = await runVerify({ from: options.from });
    return { result, ok: result.problems.length === 0 };
  }
  const result = await runRestore({ env, from: options.from });
  return { result, ok: result.ok };
}

async function main() {
  let options;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    process.exit(2);
  }
  // PRIVACY: a backup holds learner rows (pseudonymised); its files are for their owner only.
  process.umask(0o077);
  try {
    const { result, ok } = await runCommand(options, process.env);
    console.log(JSON.stringify(result));
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    // SECURITY: our own errors name variables and files; any other error is shown by its kind only, since a
    // library's message may quote a URL or a key.
    const message =
      error instanceof BackupConfigError || /exited with code/.test(error?.message ?? '')
        ? error.message
        : `${error?.name ?? 'Error'} during ${options.command}`;
    console.error(JSON.stringify({ error: message }));
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
