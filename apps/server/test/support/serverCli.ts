/**
 * serverCli — runs one of the server's operations CLIs as HVL operations do: `npm run --silent <script> -- <args>` from
 * apps/server, in a child process with its own environment and standard input.
 *
 * Why: the runbooks in docs/ops name the npm scripts, and the CLIs' `main` (environment, exit code, standard input and
 *      output, the database client) runs only in a process of its own; the in-process tests of `runPurgeCli` and
 *      `runDsrCli` stop short of it. A test that spawns the script proves the whole path the runbook gives.
 * Spec: DATA-003, DATA-008, DATA-010
 * Invariants:
 *   - The child gets exactly the environment given (plus `PATH`), so a variable the test does not set comes from
 *     apps/server/.env only where the script itself loads it (`--env-file-if-exists`), as on a server.
 *   - Standard input is written whole and closed; standard output and error are kept apart, as UTF-8 text.
 *   - Node's own notice that apps/server/.env is missing is left out of standard error, so a run reads the same with
 *     or without a developer's .env (CI and a server have none).
 *   - A run that outlasts `timeoutMs` is killed and reported with the code `null`.
 * Collaborators: apps/server/package.json (`db:roles`, `privacy:purge`, `privacy:dsr`), ./freshDeployment.ts.
 * Tests: apps/server/test/privacy/operationsClis.int.test.ts
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** The server's directory, where the runbooks run the scripts. */
export const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));

/** The scripts the runbooks name. */
export type ServerCliScript = 'db:roles' | 'privacy:purge' | 'privacy:dsr';

// WHY: `--env-file-if-exists` makes Node print this line when the file is missing (twice under tsx). It is Node's,
// not the CLI's, and a test that requires the CLI's standard error to be one line failed in CI on it alone.
const NODE_ENV_FILE_NOTICE = '.env not found. Continuing without it.';

/** What one run printed and how it ended. */
export interface ServerCliRun {
  /** The exit code; `null` when the run was killed. */
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Runs one npm script of apps/server and waits for it.
 * @param script - The script.
 * @param args - Its arguments, after `--`.
 * @param env - The child's whole environment, without `PATH`.
 * @param stdin - What to write to its standard input before closing it.
 * @param timeoutMs - How long it may run.
 * @returns Its exit code and output.
 */
export function runServerCli(
  script: ServerCliScript,
  args: readonly string[],
  env: Readonly<Record<string, string>>,
  stdin = '',
  timeoutMs = 60_000,
): Promise<ServerCliRun> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', '--silent', script, '--', ...args], {
      cwd: SERVER_DIR,
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err)
          .toString('utf8')
          .split('\n')
          .filter((line) => line.trimEnd() !== NODE_ENV_FILE_NOTICE)
          .join('\n'),
      });
    });
    child.stdin.end(stdin);
  });
}

/**
 * Reads a CLI's output as one JSON value per non-empty line.
 * @param text - Standard output.
 * @returns The values.
 */
export const jsonLines = (text: string): unknown[] =>
  text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as unknown);
