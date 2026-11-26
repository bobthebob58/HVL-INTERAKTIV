/**
 * resourceRules — static checks of the app stack's limits: the app comes back after it stops, its memory has a
 * ceiling, a server that stands still soon loses its "healthy" mark, and the one-off steps run once.
 *
 * Why: after a fault nothing handled, the server ends its process (D-133); without a restart rule it would stay
 *      down until a person starts it. Without a memory limit one runaway process can take the machine, and with
 *      one that is too small the kernel stops the server without a line in its log (D-134). A health check with a
 *      long time limit and many retries keeps a server that no longer answers "healthy" for minutes, and whatever
 *      routes requests by that mark goes on sending them (D-144). The stack file is the example a deployment
 *      copies, so its limits are checked like its hardening (NFR-007, NFR-002).
 * Spec: NFR-007, NFR-002
 * Invariants:
 *   - Pure checks of file contents: the function returns problems as text and an empty list when all is well.
 *   - The app has a restart rule, a memory limit of at least `MIN_APP_MEMORY_MB`, and no swap beyond that limit.
 *   - A step that runs once from the app's image (buckets, migration, seed) has no restart rule: restarted, it
 *     would run again and again.
 *   - The app's health check gives a try at most `MAX_HEALTH_TIMEOUT_S` seconds, comes at least every
 *     `MAX_HEALTH_INTERVAL_S` seconds, allows at most `MAX_HEALTH_RETRIES` failed tries, and has a start period, so
 *     a starting server is not counted as failing and a standing one is unhealthy within a minute.
 * Collaborators: ./checkDeployFiles.mjs, ./deployRules.mjs (the other rules), deploy/compose.app.yml,
 *   docs/ops/docker.md (the memory budget), yaml.
 * Tests: tools/deploy-check/test/resourceRules.test.mjs
 */
import { parse } from 'yaml';

/**
 * The least memory limit the app's container may have, in MiB, when Node chooses its own heap limit: at 4 GiB
 * the heap limit (2 240 MiB) and what the server needs beside it fit (docs/ops/docker.md, D-134).
 */
export const MIN_APP_MEMORY_MB = 4096;

/** The longest one try of the app's health check may take, in seconds. */
export const MAX_HEALTH_TIMEOUT_S = 5;
/** The longest pause between two tries, in seconds. */
export const MAX_HEALTH_INTERVAL_S = 10;
/** The most failed tries in a row before the app is unhealthy. */
export const MAX_HEALTH_RETRIES = 5;

/** Restart rules that bring a server back after it ended its own process. */
const RESTART_RULES = new Set(['unless-stopped', 'always', 'on-failure']);

const UNIT_MB = { b: 1 / (1024 * 1024), k: 1 / 1024, m: 1, g: 1024 };

/**
 * Reads a compose memory value as MiB.
 * @param {unknown} value - `5g`, `4096m`, `512mb`, or a number of bytes.
 * @returns {number | undefined} The size in MiB, or undefined when the value is missing or not a size.
 */
export function memoryMb(value) {
  if (typeof value === 'number') return value / (1024 * 1024);
  const match = /^(\d+(?:\.\d+)?)\s*([bkmg])?b?$/i.exec(String(value ?? '').trim());
  if (!match) return undefined;
  return Number(match[1]) * UNIT_MB[(match[2] ?? 'b').toLowerCase()];
}

/**
 * Reads a compose duration as seconds.
 * @param {unknown} value - `3s`, `1m30s`, `500ms`, or a number of seconds.
 * @returns {number | undefined} The seconds, or undefined when the value is missing or not a duration.
 */
export function durationSeconds(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim();
  if (!/^(\d+(\.\d+)?(h|ms|m|s))+$/.test(text)) return undefined;
  const unit = { h: 3600, m: 60, s: 1, ms: 0.001 };
  return [...text.matchAll(/(\d+(?:\.\d+)?)(h|ms|m|s)/g)].reduce(
    (sum, [, n, u]) => sum + Number(n) * unit[u],
    0,
  );
}

/**
 * Checks the app's health check: short tries, close together, few retries, and a start period.
 * @param {object | undefined} check - The app service's `healthcheck`.
 * @returns {string[]} Problems.
 */
export function healthCheckProblems(check) {
  if (!check || check.disable === true) return ['compose: app: needs a health check'];
  const problems = [];
  const timeout = durationSeconds(check.timeout);
  const interval = durationSeconds(check.interval);
  if (timeout === undefined || timeout > MAX_HEALTH_TIMEOUT_S)
    problems.push(`compose: app: a health check try must end within ${MAX_HEALTH_TIMEOUT_S} s (timeout)`);
  if (interval === undefined || interval > MAX_HEALTH_INTERVAL_S)
    problems.push(
      `compose: app: health checks must come at least every ${MAX_HEALTH_INTERVAL_S} s (interval)`,
    );
  if (!Number.isInteger(check.retries) || check.retries < 1 || check.retries > MAX_HEALTH_RETRIES)
    problems.push(`compose: app: at most ${MAX_HEALTH_RETRIES} failed health checks in a row (retries)`);
  if (!(durationSeconds(check.start_period) > 0))
    problems.push('compose: app: needs a start period, so a starting server is not counted as failing');
  return problems;
}

/**
 * Checks the app stack's restart rules, memory limit and health check.
 * @param {string} text - deploy/compose.app.yml.
 * @returns {string[]} Problems.
 */
export function resourceProblems(text) {
  const problems = [];
  const { services } = parse(text, { merge: true });
  for (const [name, service] of Object.entries(services)) {
    const restart = service.restart === undefined ? undefined : String(service.restart);
    if (name !== 'app') {
      // WHY: `up` waits for these steps to finish; a restart rule would run the migration or the seed again.
      if (String(service.image ?? '').startsWith('${HVLI_IMAGE') && restart !== undefined && restart !== 'no')
        problems.push(`compose: ${name}: a step that runs once must not have a restart rule`);
      continue;
    }
    if (restart === undefined || !RESTART_RULES.has(restart))
      problems.push(
        'compose: app: needs a restart rule (unless-stopped), so the server comes back after a fault',
      );
    const limit = memoryMb(service.mem_limit);
    if (limit === undefined) problems.push('compose: app: needs a memory limit (mem_limit)');
    else if (limit < MIN_APP_MEMORY_MB)
      problems.push(`compose: app: the memory limit is below ${MIN_APP_MEMORY_MB} MiB, the server's budget`);
    if (limit !== undefined && memoryMb(service.memswap_limit) !== limit)
      problems.push(
        'compose: app: memswap_limit must equal mem_limit, so the limit is not passed by swapping',
      );
    problems.push(...healthCheckProblems(service.healthcheck));
  }
  return problems;
}
