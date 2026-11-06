/**
 * bundleCli — `node tools/h5p-bundle/bundleCli.mjs build|verify`: builds the offline content-type bundle from a fetch's
 * packages, or checks a bundle again (in the image build).
 *
 * Why: the image build and HVL's hosts take the real content types from a bundle, never from GitHub (D-110), and each
 *      hop checks it again: `build` where the packages were fetched, `verify` in the image build's `inputs` stage.
 * Spec: NFR-007, H5P-003
 * Invariants:
 *   - Exit code 0 only when the bundle is right; 1 with one `✗` line per problem; 2 for a wrong command line.
 *   - Prints counts and problems only: never a value found in a package.
 * Usage: bundleCli.mjs build [--from <packages dir>] --out <bundle dir>
 *        bundleCli.mjs verify <bundle dir>
 *   `--from` defaults to apps/server/var/h5p-real/packages (written by `npm run h5p:fetch-libraries`).
 * Collaborators: ./contentTypeBundle.mjs, deploy/Dockerfile, deploy/smoke/dockerSmoke.sh, .github/workflows/docker.yml.
 * Tests: tools/h5p-bundle/test/contentTypeBundle.test.mjs (the functions it runs)
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUNDLE_PACKAGES, BundleError, buildBundle, bundleProblems } from './contentTypeBundle.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEFAULT_FROM = resolve(ROOT, 'apps/server/var/h5p-real/packages');

const [command, ...rest] = process.argv.slice(2);
const option = (name) => {
  const index = rest.indexOf(name);
  return index >= 0 ? rest[index + 1] : undefined;
};

try {
  if (command === 'build' && option('--out')) {
    const { packages } = await buildBundle({
      from: resolve(option('--from') ?? DEFAULT_FROM),
      out: resolve(option('--out')),
    });
    console.log(`✓ content-type bundle: ${packages} packages and their SHA256SUMS in ${option('--out')}`);
  } else if (command === 'verify' && rest[0]) {
    const { problems } = await bundleProblems(resolve(rest[0]));
    if (problems.length > 0) throw new BundleError(problems);
    console.log(`✓ content-type bundle: the ${BUNDLE_PACKAGES.length} packages match their SHA256SUMS`);
  } else {
    console.error(
      'usage: bundleCli.mjs build [--from <packages dir>] --out <bundle dir> | verify <bundle dir>',
    );
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof BundleError ? error.message : `✗ content-type bundle: ${error.message}`);
  process.exitCode = 1;
}
