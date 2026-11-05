/**
 * sandboxProof — run inside the app container by the smoke test (`node --import tsx --input-type=module -`, from
 * apps/server): starts Chromium with the PDF export's own launch options, renders one offline page, and reads from
 * /proc whether its renderers really are sandboxed.
 *
 * Why: a launch that succeeds with `chromiumSandbox: true` is not yet proof that the renderers are confined. The
 *      kernel shows it: a renderer in Chromium's namespace sandbox has a PID namespace of its own (two or more `NSpid`
 *      entries), and its seccomp-bpf sandbox adds a filter to the container's (`Seccomp_filters` above the browser
 *      process's). With `--no-sandbox` both are absent (measured here, 2026-11-05: `NSpid` 1 entry and 1 filter
 *      without the sandbox, 3 entries and 2 filters with it). MAPPE-004, D-096, D-110 amendment of 2026-11-05.
 * Spec: MAPPE-004
 * Invariants:
 *   - Uses `pdfBrowserLaunchOptions` with the sandbox on, JavaScript off and the context offline; loads nothing.
 *   - Prints one JSON line (counts and kernel fields only, no paths or command lines); exit code 0 only when there is
 *     at least one renderer and every renderer is in its own PID namespace with an extra seccomp filter.
 * Collaborators: apps/server/src/learningDesign/mappe/pdf/SharedChromium.ts, ./smokeChecks.sh
 *   (`check_sandbox_processes`), playwright-core 1.56.1.
 * Tests: it is a check of the smoke test (./dockerSmoke.sh); its two outcomes were measured by hand with the sandbox on
 *   and off (D-110 amendment of 2026-11-05).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { pdfBrowserLaunchOptions } from './src/learningDesign/mappe/pdf/SharedChromium.ts';

const field = (status, name) => new RegExp(`^${name}:\\s*(.*)$`, 'm').exec(status)?.[1].trim() ?? '';

/** Chromium's processes by type, with the two kernel fields that show its sandbox. */
function chromiumProcesses() {
  const found = [];
  for (const pid of readdirSync('/proc').filter((name) => /^\d+$/.test(name))) {
    let commandLine;
    let status;
    try {
      commandLine = readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      status = readFileSync(`/proc/${pid}/status`, 'utf8');
    } catch {
      continue; // WHY: a process may end while the list is read.
    }
    if (!commandLine.includes('chrome-linux/chrome')) continue;
    const type = /--type=([a-z-]+)/.exec(commandLine)?.[1] ?? 'browser';
    const namespaces = field(status, 'NSpid').split(/\s+/).length;
    found.push({ type, namespaces, filters: Number(field(status, 'Seccomp_filters')) });
  }
  return found;
}

const browser = await chromium.launch(pdfBrowserLaunchOptions({ PDF_ALLOW_NO_SANDBOX: false }));
let processes;
try {
  const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
  const page = await context.newPage();
  await page.setContent('<p lang="nn">æ ø å</p>');
  processes = chromiumProcesses();
} finally {
  await browser.close();
}
const browserFilters = Math.min(...processes.filter((p) => p.type === 'browser').map((p) => p.filters));
const renderers = processes.filter((p) => p.type === 'renderer');
const sandboxed = renderers.filter((p) => p.namespaces >= 2 && p.filters > browserFilters);
process.stdout.write(
  `${JSON.stringify({ renderers: renderers.length, sandboxed: sandboxed.length, browserFilters, rendererFilters: renderers.map((p) => p.filters), rendererPidNamespaces: renderers.map((p) => p.namespaces) })}\n`,
);
process.exitCode = renderers.length > 0 && sandboxed.length === renderers.length ? 0 : 1;
