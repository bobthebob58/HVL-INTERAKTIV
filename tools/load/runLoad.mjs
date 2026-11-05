/**
 * runLoad — `npm run load:smoke` and `npm run load:full`: starts the load bench, runs k6 in its pinned image against
 * it, stops the bench, and leaves `summary.json`, `summary.txt` and `rows.json` in one output folder.
 *
 * Why: NFR-001's Verify asks for a k6 load test script in `tools/load/`; D-114's load amendment of 2026-11-05 runs it
 *      against one application node with the mock Canvas, and the full scale (200 learners) is HVL's on hardware
 *      like a production node (docs/ops/runbook.md), with the same command.
 * Spec: NFR-001, LTI-003
 * Invariants:
 *   - Usage: `node tools/load/runLoad.mjs --profile smoke|full [--out <folder>]`; the folder (default under the
 *     system's temporary folder) is created for its owner only (0700).
 *   - Exit codes: k6's own (0 every threshold passed, 99 a threshold failed), 1 any other failure, 2 bad arguments.
 *   - The bench is always stopped, also when k6 fails; `rows.json` holds counts only.
 *   - SECURITY: k6's output passes `redactTokens` line by line before it is printed (LTI-003).
 * Collaborators: ./benchProcess.mjs, ./k6Container.mjs, ./k6/visit.js, ./k6/loadProfiles.js, the root package.json.
 * Tests: tools/load/test/k6Container.test.mjs, tools/load/test/loadBench.test.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { startBench } from './benchProcess.mjs';
import { k6DockerArgs, pipeRedactedLines, redactTokens } from './k6Container.mjs';
import { profileOf } from './k6/loadProfiles.js';

const K6_DIR = fileURLToPath(new URL('./k6/', import.meta.url));

/**
 * Reads the command line.
 * @param {string[]} argv - Arguments after the script.
 * @param {Date} [now] - For the default folder's name.
 * @returns {{profile: 'smoke' | 'full', outDir: string}} The profile and the output folder.
 * @throws {Error} For a missing or unknown profile, or an unknown option.
 */
export function loadArgs(argv, now = new Date()) {
  const { values } = parseArgs({
    args: argv,
    options: { profile: { type: 'string' }, out: { type: 'string' } },
  });
  profileOf(values.profile);
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  return {
    profile: values.profile,
    outDir: resolve(values.out ?? join(tmpdir(), `hvli-load-${values.profile}-${stamp}`)),
  };
}

/**
 * Runs k6 in its container and waits for it.
 * @param {string[]} args - From `k6DockerArgs`.
 * @returns {Promise<number>} k6's exit code.
 */
function runK6(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const piped = Promise.all([
      pipeRedactedLines(child.stdout, process.stdout),
      pipeRedactedLines(child.stderr, process.stderr),
    ]);
    child.on('error', reject);
    child.on('close', (code) => piped.then(() => resolvePromise(code ?? 1)));
  });
}

async function main() {
  let run;
  try {
    run = loadArgs(process.argv.slice(2));
  } catch (error) {
    console.error(
      `${error.message}\nusage: node tools/load/runLoad.mjs --profile smoke|full [--out <folder>]`,
    );
    process.exit(2);
  }
  if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
    console.error('docker does not answer; start the Docker daemon first (docs/ops/runbook.md, load test)');
    process.exit(1);
  }
  const profile = profileOf(run.profile);
  mkdirSync(run.outDir, { recursive: true, mode: 0o700 });
  console.log(
    `load ${run.profile}: starting the bench for ${profile.learners} learners (output: ${run.outDir})`,
  );
  const bench = await startBench({
    learners: profile.learners,
    addresses: join(run.outDir, 'learners.json'),
  });
  let code;
  try {
    console.log(`load ${run.profile}: the bench is ready; running k6`);
    const uid = process.getuid?.() ?? 1000;
    const gid = process.getgid?.() ?? 1000;
    code = await runK6(k6DockerArgs({ k6Dir: K6_DIR, outDir: run.outDir, profile: run.profile, uid, gid }));
  } finally {
    // WHY: the bench holds a database and two buckets of its own; it is stopped also when k6 could not start.
    const rows = await bench.stop();
    writeFileSync(join(run.outDir, 'rows.json'), `${JSON.stringify(rows, null, 2)}\n`, { mode: 0o600 });
    console.log(`load ${run.profile}: rows the load stored ${JSON.stringify(rows)}`);
  }
  console.log(`load ${run.profile}: k6 exited with ${code}; summary in ${join(run.outDir, 'summary.txt')}`);
  process.exitCode = code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(redactTokens(error?.message ?? String(error)));
    process.exitCode = 1;
  });
}
