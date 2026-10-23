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
 *   - Tags are read with `ls-remote --refs`, so annotated tags show their own object, never a peeled commit; the
 *     commit is always taken from the checkout itself.
 * Collaborators: ./resolveManifest.mjs, ./fetchLibraries.mjs.
 * Tests: tools/h5p-libraries/test/resolveManifest.test.mjs (with a fake source); CI runs `npm run h5p:fetch-libraries`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const run = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/**
 * Lists a repository's semantic-version tags.
 * @param {string} repository - The repository URL.
 * @returns {{ tag: string, version: number[] }[]} Tags that read `x.y.z` or `vx.y.z`.
 */
export function listVersionTags(repository) {
  const out = run(['ls-remote', '--tags', '--refs', repository]);
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
    run(['fetch', '--quiet', '--depth', '1', repository, ref], dir);
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
