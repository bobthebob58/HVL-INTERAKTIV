/**
 * taggedPdfLaunchChild — a Node script that starts Chromium as the D-096 PDF renderer would and prints, as one JSON
 * line, what the browser's processes look like: sandboxed or not, and which environment variables they can see.
 *
 * Why: D-096 keeps Chromium's sandbox and starts the browser with a scrubbed environment. Both are properties of the
 *      operating-system processes, so the probe inspects /proc (Linux) for the processes this script spawned. It runs
 *      in its own process so the test can start it as another user (the sandbox refuses root) and with an
 *      environment that holds no secrets of the test run.
 * Spec: MAPPE-004
 * Invariants:
 *   - Never throws: a failed launch is reported as `{ launched: false, error }`.
 *   - Only this script's own descendants are inspected; the browser is closed before the report is printed.
 *   - Runs with Node's type stripping (no relative imports, no TypeScript-only syntax).
 * Collaborators: started by ./taggedPdfLaunchRunner.ts; playwright-core 1.56.1 finds the browser through
 *   PLAYWRIGHT_BROWSERS_PATH.
 * Tests: apps/server/test/learningDesign/mappe/taggedPdf.browser.test.ts
 *
 * Usage: node taggedPdfLaunchChild.ts <sandbox|no-sandbox> <scrubbed|inherited>
 */
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { chromium } from 'playwright-core';

// WHY: a variable this script plants in its own environment before it starts Chromium, standing in for a secret.
const CANARY_NAME = 'HVLI_PDF_PROBE_CANARY';

/** What the script prints. */
export type LaunchReport =
  | { readonly launched: false; readonly uid: number; readonly error: string }
  | {
      readonly launched: true;
      readonly uid: number;
      /** The first bytes of the PDF the browser printed. */
      readonly pdfHeader: string;
      /** Any browser process was started with `--no-sandbox`. */
      readonly noSandboxFlag: boolean;
      /** Browser processes under a seccomp-BPF filter (`Seccomp: 2`), as Chromium's sandbox puts its renderers. */
      readonly seccompFiltered: number;
      /** Browser processes in a user namespace of their own (the namespace sandbox). */
      readonly ownUserNamespace: number;
      /** Variable names the main browser process sees. */
      readonly browserEnvironment: readonly string[];
      /** Whether any browser process whose environment could be read holds the canary. */
      readonly canaryVisible: boolean;
    };

/** The parent process ID of a process, from /proc/<pid>/stat. */
function parentOf(pid: number): number {
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
  return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
}

/** Every process that descends from this one. */
function descendants(): number[] {
  return readdirSync('/proc')
    .filter((entry) => /^\d+$/.test(entry))
    .map(Number)
    .filter((pid) => {
      try {
        for (let ancestor = parentOf(pid); ancestor > 1; ancestor = parentOf(ancestor)) {
          if (ancestor === process.pid) return true;
        }
      } catch {
        // WHY: a process may exit while the tree is walked.
      }
      return false;
    });
}

/** Reads a /proc file, or undefined when the process is gone or the kernel refuses (a sandboxed process). */
function readProc(pid: number, file: string): string | undefined {
  try {
    return file === 'ns/user'
      ? readlinkSync(`/proc/${pid}/${file}`)
      : readFileSync(`/proc/${pid}/${file}`, 'utf8');
  } catch {
    return undefined;
  }
}

/** Starts Chromium, prints a tiny tagged PDF, and describes the browser's processes. */
async function inspectLaunch(sandbox: boolean, scrubbed: boolean): Promise<LaunchReport> {
  const uid = process.getuid?.() ?? -1;
  process.env[CANARY_NAME] = 'not-for-the-browser';
  // SECURITY: the scrubbed environment is what D-096 passes: PATH and HOME only, so no secret of the server reaches
  // the browser. Without `env`, playwright-core hands Chromium the whole process environment.
  const env = scrubbed ? { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' } : undefined;
  let browser;
  try {
    browser = await chromium.launch({ chromiumSandbox: sandbox, ...(env ? { env } : {}) });
  } catch (error) {
    return { launched: false, uid, error: error instanceof Error ? error.message : String(error) };
  }
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.setContent(
      '<html lang="nn"><head><title>Sandkasse</title></head><body><h1>Æ Ø Å</h1></body></html>',
    );
    const pdf = await page.pdf({ tagged: true });
    const self = readProc(process.pid, 'ns/user');
    const processes = descendants().map((pid) => ({
      pid,
      parent: parentOf(pid),
      cmdline: (readProc(pid, 'cmdline') ?? '').split('\0'),
      seccomp: /Seccomp:\s*(\d)/.exec(readProc(pid, 'status') ?? '')?.[1],
      userNamespace: readProc(pid, 'ns/user'),
      environ: readProc(pid, 'environ')?.split('\0').filter(Boolean),
    }));
    const main = processes.find((entry) => entry.parent === process.pid);
    return {
      launched: true,
      uid,
      pdfHeader: pdf.subarray(0, 5).toString('latin1'),
      noSandboxFlag: processes.some((entry) => entry.cmdline.includes('--no-sandbox')),
      seccompFiltered: processes.filter((entry) => entry.seccomp === '2').length,
      ownUserNamespace: processes.filter((entry) => entry.userNamespace && entry.userNamespace !== self)
        .length,
      browserEnvironment: (main?.environ ?? []).map((pair) => pair.split('=')[0] ?? '').sort(),
      canaryVisible: processes.some((entry) =>
        entry.environ?.some((pair) => pair.startsWith(`${CANARY_NAME}=`)),
      ),
    };
  } finally {
    await browser.close();
  }
}

// WHY: the script runs only when Node starts it; the test imports nothing but its types.
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const report = await inspectLaunch(process.argv[2] === 'sandbox', process.argv[3] === 'scrubbed');
  process.stdout.write(`${JSON.stringify(report)}\n`);
}
