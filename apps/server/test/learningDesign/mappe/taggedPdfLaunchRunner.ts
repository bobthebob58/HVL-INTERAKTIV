/**
 * taggedPdfLaunchRunner — runs ./taggedPdfLaunchChild.ts in a fresh Node process, optionally as an unprivileged
 * user, and returns its report.
 *
 * Why: Chromium refuses to start its sandbox as root (crbug.com/638180), and this container runs tests as root. To
 *      learn whether the sandbox D-096 keeps can work here for a normal service user, the child is started as
 *      `nobody` (uid 65534) through util-linux `setpriv`. When the test already runs as a normal user (CI), the
 *      child runs as that user.
 * Spec: MAPPE-004
 * Invariants:
 *   - The child's environment holds only PATH, HOME and PLAYWRIGHT_BROWSERS_PATH: no secret of the test run.
 *   - HOME is a fresh temporary directory, removed after the run, so Chromium's profile files (.pki, .config) never
 *     stay behind in the shared temporary directory.
 *   - A child that prints no report fails the test with its stderr, never with a silent default.
 * Collaborators: ./taggedPdfLaunchChild.ts (the script), Node's type stripping (runs the .ts file as it is).
 * Tests: apps/server/test/learningDesign/mappe/taggedPdf.browser.test.ts
 */
import { spawnSync } from 'node:child_process';
import { chownSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LaunchReport } from './taggedPdfLaunchChild.js';

const CHILD = fileURLToPath(new URL('./taggedPdfLaunchChild.ts', import.meta.url));

/** The user ID unprivileged runs use when the test runs as root: `nobody` on Debian and Ubuntu. */
export const NOBODY_UID = 65534;

/** True when the test process runs as root. */
export const runsAsRoot = process.getuid?.() === 0;

/** How to start the child. */
export interface LaunchMode {
  /** `chromiumSandbox: true` (D-096) or false (`--no-sandbox`). */
  readonly sandbox: boolean;
  /** Pass Chromium only PATH and HOME (D-096), or let it inherit the child's environment. */
  readonly scrubbed: boolean;
  /** Run the child as {@link NOBODY_UID}; only possible when the test runs as root. */
  readonly asNobody: boolean;
}

/**
 * Starts the child and parses its report.
 * @param mode - Sandbox, environment and user.
 * @returns The child's report.
 * @throws Error with the child's stderr when it printed no report.
 */
export function runLaunchChild(mode: LaunchMode): LaunchReport {
  const script = [CHILD, mode.sandbox ? 'sandbox' : 'no-sandbox', mode.scrubbed ? 'scrubbed' : 'inherited'];
  const command = mode.asNobody
    ? [
        'setpriv',
        `--reuid=${NOBODY_UID}`,
        `--regid=${NOBODY_UID}`,
        '--clear-groups',
        process.execPath,
        ...script,
      ]
    : [process.execPath, ...script];
  // WHY: Chromium writes .pki and .config into HOME; `nobody` cannot write to root's home, and a shared HOME such as
  // /tmp would keep those files (owned by `nobody`) after the run.
  const home = mkdtempSync(join(tmpdir(), 'taggedPdf-home-'));
  if (mode.asNobody) chownSync(home, NOBODY_UID, NOBODY_UID);
  // WHY: without PLAYWRIGHT_BROWSERS_PATH, playwright-core looks for its browsers under the cache directory of HOME
  // (XDG_CACHE_HOME, else ~/.cache), which the fresh HOME would hide, so the child gets the path this process uses.
  const cache = process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache');
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    HOME: home,
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(cache, 'ms-playwright'),
  };
  const [file = '', ...args] = command;
  let result;
  try {
    result = spawnSync(file, args, { env, encoding: 'utf8', timeout: 60_000 });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
  const line = result.stdout?.trim().split('\n').pop();
  if (!line?.startsWith('{')) {
    throw new Error(`taggedPdfLaunchChild printed no report (status ${result.status}): ${result.stderr}`);
  }
  return JSON.parse(line) as LaunchReport;
}
