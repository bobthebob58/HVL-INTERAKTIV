/**
 * checkWorkflows — holds the GitHub workflows to exact versions of what they run: actions by commit, service images
 * by digest, a token that only reads, and a checkout that leaves no token behind.
 *
 * Why: a workflow runs other people's code on the build machine. `actions/checkout@v7` names a tag, and the
 *      publisher (or whoever takes over the publisher's account) can move a tag to other code; a commit cannot be
 *      moved, and neither can an image digest. The workflows were pinned by tag, and nothing checked the next one
 *      added (SEC-007, D-145).
 * Spec: SEC-007
 * Invariants:
 *   - Every `uses:` names its action as `owner/repo[/path]@<40 hex digits>`, followed on the same line by a comment
 *     with the version the commit stands for (`# v1.2.3`), so a reader and Dependabot see which release it is. A
 *     local action (`./…`) needs neither; a `docker://` reference needs a digest.
 *   - Every service or job container image ends in `@sha256:<64 hex digits>`, and an image that the app stack
 *     (deploy/compose.app.yml) names too carries the stack's digest: CI tests against what the stack runs.
 *   - SECURITY: the workflow sets top-level `permissions`, and no permission of the workflow or of a job is
 *     `write`; every checkout step sets `persist-credentials: false`, so no later step finds the job's token on disk.
 *   - Pure checks of file contents: `workflowProblems` returns problems as text and an empty list when all is well.
 * Collaborators: .github/workflows/*.yml, deploy/compose.app.yml, .github/dependabot.yml (proposes new commits),
 *                yaml, CI (`npm run check:workflows`).
 * Tests: tools/dependency-check/test/checkWorkflows.test.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ACTION = /^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/;
const VERSION = /^v\d+\.\d+\.\d+$/;
const DIGEST = /@sha256:[0-9a-f]{64}$/;
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Reads the digest of each image a compose file names.
 * @param {string} composeText - The text of deploy/compose.app.yml.
 * @returns {Map<string, string>} Image name with tag → `sha256:…`.
 */
export function stackDigests(composeText) {
  const found = [...composeText.matchAll(/^\s*image:\s*(\S+?)@(sha256:[0-9a-f]{64})\s*$/gm)];
  return new Map(found.map((match) => [match[1], match[2]]));
}

/** Every `uses` value and every image of a parsed workflow, with the checkout steps. */
function references(doc) {
  const jobs = Object.values(doc?.jobs ?? {}).filter((job) => job && typeof job === 'object');
  const steps = jobs.flatMap((job) => (Array.isArray(job.steps) ? job.steps : []));
  const container = (job) => (typeof job.container === 'string' ? job.container : job.container?.image);
  return {
    jobs,
    steps: steps.filter((step) => step && typeof step.uses === 'string'),
    uses: [...jobs, ...steps].map((item) => item?.uses).filter((value) => typeof value === 'string'),
    images: jobs
      .flatMap((job) => [container(job), ...Object.values(job.services ?? {}).map((s) => s?.image)])
      .filter((image) => image !== undefined),
  };
}

/**
 * Checks one workflow file.
 * @param {string} file - The file's name, used in messages.
 * @param {string} text - The file's text.
 * @param {Map<string, string>} [stack] - The app stack's digests, from `stackDigests`.
 * @returns {string[]} Problems.
 */
export function workflowProblems(file, text, stack = new Map()) {
  const problems = [];
  const doc = parse(text);
  const { jobs, steps, uses, images } = references(doc);
  for (const ref of new Set(uses)) {
    if (ref.startsWith('./')) continue;
    if (ref.startsWith('docker://')) {
      if (!DIGEST.test(ref)) problems.push(`${file}: ${ref} is not pinned by digest`);
      continue;
    }
    if (!ACTION.test(ref)) {
      problems.push(`${file}: ${ref} is not pinned by commit (owner/repo@<40 hex digits>)`);
      continue;
    }
    const lines = [...text.matchAll(new RegExp(`uses:\\s*["']?${escaped(ref)}["']?[ \\t]*(.*)$`, 'gm'))];
    if (!lines.every((line) => VERSION.test(/^#\s*(\S+)\s*$/.exec(line[1])?.[1] ?? '')))
      problems.push(`${file}: ${ref.split('@')[0]}: name the version after the commit (# v1.2.3)`);
  }
  for (const image of images) {
    const [name, digest] = String(image).split('@');
    if (typeof image !== 'string' || !DIGEST.test(image))
      problems.push(`${file}: image ${image} is not pinned by digest`);
    else if (stack.has(name) && stack.get(name) !== digest)
      problems.push(`${file}: image ${name} has another digest than deploy/compose.app.yml`);
  }
  const grants = [['workflow', doc?.permissions], ...jobs.map((job) => ['job', job.permissions])];
  if (doc?.permissions === undefined) problems.push(`${file}: the workflow must set top-level permissions`);
  for (const [where, permissions] of grants.filter(([, value]) => value !== undefined)) {
    const values =
      typeof permissions === 'object' ? Object.entries(permissions ?? {}) : [['all', permissions]];
    // SECURITY: `write-all`, and `write` for any scope, lets a step change the repository or its packages.
    for (const [scope, value] of values.filter(([, v]) => v !== 'read' && v !== 'none' && v !== 'read-all'))
      problems.push(`${file}: ${where} permission ${scope}: ${value}; a workflow's token only reads`);
  }
  for (const step of steps.filter((s) => s.uses.startsWith('actions/checkout@')))
    if (step.with?.['persist-credentials'] !== false)
      problems.push(`${file}: the checkout step must set persist-credentials: false`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const folder = join(root, '.github/workflows');
  const stack = stackDigests(readFileSync(join(root, 'deploy/compose.app.yml'), 'utf8'));
  const files = readdirSync(folder).filter((name) => /\.ya?ml$/.test(name));
  const problems = files.flatMap((name) =>
    workflowProblems(`.github/workflows/${name}`, readFileSync(join(folder, name), 'utf8'), stack),
  );
  for (const p of problems) console.error(`✗ ${p}`);
  if (problems.length > 0) process.exit(1);
  console.log(
    `✓ check:workflows: ${files.length} workflows; actions by commit, service images by digest, tokens that only read.`,
  );
}
