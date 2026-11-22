/**
 * resourceRules — static checks of the app stack's limits: the app comes back after it stops, its memory has a
 * ceiling, and the one-off steps run once.
 *
 * Why: after a fault nothing handled, the server ends its process (D-133); without a restart rule it would stay
 *      down until a person starts it. Without a memory limit one runaway process can take the machine, and with
 *      one that is too small the kernel stops the server without a line in its log (D-134). The stack file is the
 *      example a deployment copies, so its limits are checked like its hardening (NFR-007, NFR-002).
 * Spec: NFR-007, NFR-002
 * Invariants:
 *   - Pure checks of file contents: the function returns problems as text and an empty list when all is well.
 *   - The app has a restart rule, a memory limit of at least `MIN_APP_MEMORY_MB`, and no swap beyond that limit.
 *   - A step that runs once from the app's image (buckets, migration, seed) has no restart rule: restarted, it
 *     would run again and again.
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
 * Checks the app stack's restart rules and memory limit.
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
  }
  return problems;
}
