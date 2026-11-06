/**
 * k6Container — how the load runner starts k6: the pinned image by digest, its `docker run` arguments, and the
 * redaction of anything token-like in k6's own output before it is shown.
 *
 * Why: D-110's and D-114's probe-P3 amendments run k6 2.3.0 as a container image pinned by digest (AGPL-3.0, a
 *      separate program outside the npm tree), on the host network so it reaches the bench on `localhost`. k6 prints
 *      a request's URL when a request fails at the network level, and some URLs carry an ltik (H5P's state URL).
 * Spec: NFR-001, LTI-003
 * Invariants:
 *   - The image is named by digest only through the daemon (`docker run`), so a registry mirror serves it (D-110).
 *   - The scripts are mounted read-only and the container's own file system is read-only (`--read-only`), so the
 *     output folder is the only place k6 can write; the container gets exactly the three `HVLI_LOAD_*` variables,
 *     the caller's uid and gid, no capabilities and no new privileges.
 *   - k6's usage report is off (`--no-usage-report`): a run sends nothing to Grafana.
 *   - SECURITY: `redactTokens` replaces every `ltik=…`, `Bearer …` and JWT-shaped value in a line, and
 *     `pipeRedactedLines` hands it whole lines only, so no token is split across two pieces of output (LTI-003).
 * Collaborators: ./runLoad.mjs, ./k6/visit.js.
 * Tests: tools/load/test/k6Container.test.mjs
 */
import { createInterface } from 'node:readline';

/** k6 2.3.0 by digest (D-114's P3 amendment). */
export const K6_IMAGE =
  'grafana/k6:2.3.0@sha256:2dd4756ec6e14e62778916e1eb850108e4b499304c02df56760fa0bdb0fba0b8';

/** Where the scripts and the output folder appear inside the container. */
export const MOUNTS = Object.freeze({ scripts: '/scripts', out: '/out' });

/**
 * The `docker run` arguments of one load run.
 * @param {{k6Dir: string, outDir: string, profile: 'smoke' | 'full', uid: number, gid: number}} run - The scripts'
 *   folder, the output folder (holding `learners.json`), the profile and the caller's ids.
 * @returns {string[]} Arguments after `docker`.
 */
export function k6DockerArgs({ k6Dir, outDir, profile, uid, gid }) {
  return [
    'run',
    '--rm',
    '--network',
    'host',
    '--user',
    `${uid}:${gid}`,
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--read-only',
    '--volume',
    `${k6Dir}:${MOUNTS.scripts}:ro`,
    '--volume',
    `${outDir}:${MOUNTS.out}`,
    '--env',
    `HVLI_LOAD_PROFILE=${profile}`,
    '--env',
    `HVLI_LOAD_ADDRESSES=${MOUNTS.out}/learners.json`,
    '--env',
    `HVLI_LOAD_OUT=${MOUNTS.out}`,
    K6_IMAGE,
    'run',
    // WHY: no progress line per second; the summary (./k6/loadSummary.js) holds what the run measured.
    '--quiet',
    '--no-usage-report',
    `${MOUNTS.scripts}/visit.js`,
  ];
}

const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;

/**
 * Replaces token-like values in a text before it is printed.
 * @param {string} text - A whole line of k6's output (a chunk could split a token, so callers pass lines).
 * @returns {string} The text with `ltik=…`, `Bearer …` and JWT-shaped values replaced by `…`.
 */
export const redactTokens = (text) =>
  String(text)
    .replace(/(ltik=)[^&\s"'\\]+/g, '$1…')
    .replace(/(Bearer\s+)[^\s"'\\]+/gi, '$1…')
    .replace(JWT, '…');

/**
 * Copies k6's output to the runner's own, one whole line at a time through `redactTokens`.
 * @param {import('node:stream').Readable} from - k6's standard output or error.
 * @param {import('node:stream').Writable} to - Where the redacted lines go.
 * @returns {Promise<void>} Settles when `from` has ended and every line is written.
 */
export function pipeRedactedLines(from, to) {
  // SECURITY: a pipe delivers chunks of any size, and a chunk boundary inside `ltik=…` would let the rest of the
  // token through a per-chunk redaction; whole lines cannot split one (LTI-003).
  const lines = createInterface({ input: from, crlfDelay: Infinity });
  lines.on('line', (line) => to.write(`${redactTokens(line)}\n`));
  return new Promise((resolve) => lines.on('close', resolve));
}
