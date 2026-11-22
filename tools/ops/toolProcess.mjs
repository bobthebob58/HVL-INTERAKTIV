/**
 * toolProcess — runs one external program (`pg_dump`, `pg_restore`, `psql`) with an environment of its own and turns
 * a failure into a message that is safe to print.
 *
 * Why: the backup CLI drives PostgreSQL's own tools (NFR-002, D-110's backup amendment of 2026-11-05). Their error
 *      output can quote row values in `DETAIL:` lines (a duplicate key names the key), and their connection errors
 *      name the host and user; the CLI's output goes to operations logs, which hold no personal data (DATA-009).
 * Spec: NFR-002, DATA-009
 * Invariants:
 *   - The child gets exactly the environment it is given, no shell, and no standard input.
 *   - A failure message names the program, its exit code and its first `error:` line with quoted text replaced by
 *     `"…"`; `DETAIL`, `HINT`, `CONTEXT` and `LINE` lines are never shown.
 *   - Standard output is either collected (small answers) or written to a file or a line handler (dumps).
 *   - A line handler gets the output cut at the newline byte and nowhere else: PostgreSQL's COPY text format
 *     writes a newline inside a value as two characters, so a newline byte always ends a row, while a value may
 *     hold other characters that some line readers also break at (U+2028, U+2029; D-132).
 * Collaborators: ./postgresDump.mjs.
 * Tests: tools/ops/test/postgresConnection.test.mjs (the message), tools/ops/test/newlineSplitter.test.mjs (the
 *   lines), tools/ops/test/backupRoundTrip.test.mjs and tools/ops/test/backupUnusualText.test.mjs (the runs)
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { BackupConfigError, POSTGRES_MAJOR } from './postgresConnection.mjs';

/**
 * The one line of a tool's error output that may be shown.
 * @param {string} tool - The program's name.
 * @param {number | null} code - Its exit code.
 * @param {string} stderr - Its error output.
 * @returns {string} e.g. `pg_restore exited with code 1: pg_restore: error: could not execute query: …`.
 */
export function toolFailure(tool, code, stderr) {
  const first = stderr
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /error:|FATAL:|fatal:/i.test(line) && !/^(DETAIL|HINT|CONTEXT|LINE \d+):/.test(line));
  // PRIVACY: quoted text in PostgreSQL's messages is a value, a host or a user name; the rest names the problem.
  const shown = first ? `: ${first.replace(/"[^"]*"/g, '"…"').slice(0, 240)}` : '';
  return `${tool} exited with code ${code}${shown}`;
}

/**
 * Cuts a byte stream into lines at the newline byte (0x0A) only, and decodes each line as UTF-8.
 * @param {(line: string) => void} onLine - Called once per line, without its newline.
 * @returns {{write: (chunk: Buffer) => void, end: () => void}} `write` takes each chunk; `end` hands over a last
 *   line that has no newline.
 */
export function newlineSplitter(onLine) {
  /** The bytes of the line that has not ended yet; a character may be split between two chunks. */
  let pending = [];
  const emit = (last) => {
    onLine(Buffer.concat([...pending, last]).toString('utf8'));
    pending = [];
  };
  return {
    write(chunk) {
      let from = 0;
      for (let at = chunk.indexOf(0x0a); at !== -1; at = chunk.indexOf(0x0a, from)) {
        emit(chunk.subarray(from, at));
        from = at + 1;
      }
      if (from < chunk.length) pending.push(chunk.subarray(from));
    },
    end() {
      if (pending.length > 0) emit(Buffer.alloc(0));
    },
  };
}

/**
 * Runs a program and waits for it.
 * @param {string} tool - The program, found on the environment's `PATH`.
 * @param {string[]} args - Its arguments (never a password: that goes in `env`).
 * @param {Record<string, string>} env - Its whole environment.
 * @param {{toFile?: string, onLine?: (line: string) => void}} [output] - Where standard output goes: a file (mode
 *   0600), a line handler, or (by default) collected and returned.
 * @returns {Promise<string>} The collected standard output (empty when it went elsewhere).
 * @throws {BackupConfigError} When the program is missing; Error with `toolFailure`'s message when it fails.
 */
export function runTool(tool, args, env, output = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(tool, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const err = [];
    const out = [];
    let piped = Promise.resolve();
    child.stderr.on('data', (chunk) => err.push(chunk));
    if (output.toFile) {
      const file = createWriteStream(output.toFile, { mode: 0o600 });
      piped = new Promise((done, fail) => file.on('finish', done).on('error', fail));
      child.stdout.pipe(file);
    } else if (output.onLine) {
      // WHY: `node:readline` also ends a line at U+2028 and U+2029, which a database value may hold (D-132).
      const lines = newlineSplitter(output.onLine);
      child.stdout.on('data', (chunk) => lines.write(chunk));
      piped = new Promise((done) => child.stdout.on('end', () => done(lines.end())));
    } else child.stdout.on('data', (chunk) => out.push(chunk));
    child.on('error', (error) =>
      reject(
        error.code === 'ENOENT'
          ? new BackupConfigError(
              `${tool} was not found; install PostgreSQL ${POSTGRES_MAJOR}'s client tools`,
            )
          : error,
      ),
    );
    child.on('close', async (code) => {
      await piped.catch(() => undefined);
      if (code !== 0) return reject(new Error(toolFailure(tool, code, Buffer.concat(err).toString('utf8'))));
      resolve(Buffer.concat(out).toString('utf8'));
    });
  });
}
