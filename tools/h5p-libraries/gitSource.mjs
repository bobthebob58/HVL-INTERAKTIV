/**
 * gitSource — reads H5P library repositories from GitHub through `git` only: their release tags, and one checkout
 * at an exact commit.
 *
 * Why: the build environment reaches public GitHub repositories through git but not through the web or the REST
 *      API (Q7). Fetching one ref with depth 1 and proving its commit hash afterwards is the same pattern
 *      ../h5p-core/fetchCoreClients.sh uses for Core (D-022, D-078).
 * Spec: H5P-003
 * Invariants:
 *   - A checkout is accepted only if `HEAD` is exactly the pinned commit; otherwise it throws and leaves nothing.
 *     `verifiedHead` proves the same of a checkout that is reused from the cache, and that none of its tracked
 *     files differs from that commit; untracked files (dependencies, build output) are outside its proof.
 *   - Tags are read with `ls-remote --refs`, so annotated tags show their own object, never a peeled commit; the
 *     commit is always taken from the checkout itself.
 *   - Network calls are retried four times with growing pauses; an error that outlasts them is marked
 *     `transient`, so the resolver fails instead of quietly skipping a library (a manifest must not depend on a
 *     flaky connection).
 * Collaborators: ./resolveManifest.mjs, ./fetchLibraries.mjs.
 * Tests: tools/h5p-libraries/test/resolveManifest.test.mjs (with a fake source),
 *   tools/h5p-libraries/test/gitSource.test.mjs; CI runs `npm run h5p:fetch-libraries`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const run = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * Runs a git network command, retrying a failure four times (after 2, 4, 8 and 16 seconds).
 * @param {string[]} args - Git arguments.
 * @param {string} [cwd] - Working directory.
 * @returns {string} The command's output.
 * @throws {Error} With `transient: true` when every attempt failed.
 */
function runNetwork(args, cwd) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return run(args, cwd);
    } catch (error) {
      if (attempt === 4)
        throw Object.assign(new Error(`git ${args[0]} failed: ${error.message}`), { transient: true });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000 * 2 ** attempt);
    }
  }
}

/**
 * Lists a repository's semantic-version tags.
 * @param {string} repository - The repository URL.
 * @returns {{ tag: string, version: number[] }[]} Tags that read `x.y.z` or `vx.y.z`.
 */
export function listVersionTags(repository) {
  const out = runNetwork(['ls-remote', '--tags', '--refs', repository]);
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t')[1].replace('refs/tags/', ''))
    .map((tag) => ({ tag, m: /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag) }))
    .filter(({ m }) => m)
    .map(({ tag, m }) => ({ tag, version: m.slice(1).map(Number) }));
}

/**
 * Checks out one ref of a repository into an empty folder and returns its commit.
 * @param {string} repository - The repository URL.
 * @param {string} ref - A tag (`refs/tags/…`), `HEAD`, or a commit hash.
 * @param {string} dir - The folder to create.
 * @param {string} [expectedCommit] - When given, the checkout must be exactly this commit.
 * @returns {string} The commit hash of the checkout.
 * @throws {Error} When the ref cannot be fetched or resolves to another commit.
 */
export function checkout(repository, ref, dir, expectedCommit) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  try {
    run(['init', '--quiet'], dir);
    runNetwork(['fetch', '--quiet', '--depth', '1', repository, ref], dir);
    run(['-c', 'advice.detachedHead=false', 'checkout', '--quiet', 'FETCH_HEAD'], dir);
    const commit = run(['rev-parse', 'HEAD'], dir);
    // SECURITY: a moved tag or a substituted repository must never reach the build (D-078, CLAUDE.md §1).
    if (expectedCommit && commit !== expectedCommit) {
      throw new Error(`${repository} ${ref} is ${commit}, expected ${expectedCommit}`);
    }
    return commit;
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Proves that an existing checkout (one this module made) is at its pinned commit with its tracked files unedited.
 * @param {string} dir - The checkout's folder.
 * @param {string} expectedCommit - The pinned commit.
 * @returns {string} The commit hash of the checkout's `HEAD`.
 * @throws {Error} When the folder holds no checkout of its own, its `HEAD` is another commit, or a tracked file
 *   differs from that commit (the message names the files).
 */
export function verifiedHead(dir, expectedCommit) {
  // WHY: without its own .git, rev-parse would answer for whatever repository encloses the folder.
  if (!existsSync(join(dir, '.git'))) throw new Error(`${dir} holds no checkout`);
  const commit = run(['rev-parse', 'HEAD'], dir);
  // SECURITY: a cached checkout moved to another commit, or with a tracked file edited, must not reach the packed
  // libraries (D-078). Untracked files (node_modules/, a build's dist/) are not proved: in CI they rely on the
  // cache's scope (.github/workflows/ci.yml); a local cache is the developer's own.
  if (commit !== expectedCommit) throw new Error(`${dir} is at ${commit}, expected ${expectedCommit}`);
  const edited = run(['diff', '--name-only', 'HEAD', '--'], dir);
  if (edited)
    throw new Error(`${dir} has tracked files that differ from ${commit}: ${edited.split('\n').join(', ')}`);
  return commit;
}
