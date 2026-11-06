/**
 * fetchLibraries — `npm run h5p:fetch-libraries`: fetches the ten content types and their libraries from GitHub at
 * the commits pinned in `libraries.manifest.json`, builds those that need it, and packs one `.h5p` per type.
 *
 * Why: the H5P Hub is unreachable from the build environment (Q7), but public GitHub repositories are reachable
 *      through git. Real content types let S4 test the theme, feedback and accessibility on real markup and settle
 *      R-01 (D-047, D-078). `--resolve` re-pins the manifest; its diff is reviewed like any code change.
 * Spec: H5P-003, UD-011
 * Invariants:
 *   - Every checkout must be exactly its pinned commit (./gitSource.mjs); nothing unpinned is ever built.
 *   - Builds run `npm ci --ignore-scripts`, so no dependency's install script runs, then the library's `build`, each
 *     with a minimal environment (./libraryBuild.mjs): SECURITY: the build sees `PATH`, an empty `HOME` and
 *     `NODE_ENV=production` only, and no global `npmrc`, because a build can bake its environment into the JavaScript
 *     learners get (D-110's amendment of 2026-11-05).
 *   - Checkouts and builds live outside the repository (`H5P_LIBRARIES_CACHE`, default
 *     `~/.cache/hvl-interaktiv/h5p-libraries`), so a library's build never picks up this repository's TypeScript,
 *     PostCSS or browserslist configuration.
 *   - Output goes only to the destination (default `apps/server/var/h5p-real/`, gitignored): `libraries/` and
 *     `packages/` with a `SHA256SUMS` the seed command checks (`npm run seed:libraries -- <dir>`).
 *   - A finished checkout is reused only if its recorded commit and build state match the manifest, its `HEAD`
 *     is still that commit and no tracked file differs from it (`verifiedHead`); otherwise the command fails and
 *     names the folder. Its untracked files (dependencies, build output) are copied as cached, not rebuilt, unless
 *     its stamp names another build recipe (`BUILD_ENV_VERSION`): then they are removed (`git clean -ffdx`) and the
 *     library is built again from the proven commit, without a new checkout.
 *   - A build must leave the library's tracked files as committed; one that does not fails the fresh fetch.
 * Usage: fetchLibraries.mjs [--resolve] [--dest <dir>] [--only <H5P.Name>] (`--only` packs one example).
 * Collaborators: ./resolveManifest.mjs, ./gitSource.mjs, ./libraryBuild.mjs, ./libraryFiles.mjs,
 *   ./packContentTypes.mjs.
 * Tests: tools/h5p-libraries/test/manifest.test.mjs, tools/h5p-libraries/test/libraryBuild.test.mjs; CI runs the
 *   command before the browser and a11y suites.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkout, listVersionTags, verifiedHead } from './gitSource.mjs';
import { BUILD_ENV_VERSION, buildLibrary } from './libraryBuild.mjs';
import { copyLibraryFiles } from './libraryFiles.mjs';
import { packContentType } from './packContentTypes.mjs';
import { CONTENT_TYPE_ROOTS, resolveManifest } from './resolveManifest.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '../..');
/** The committed pin list. */
const MANIFEST_FILE = join(HERE, 'libraries.manifest.json');
const REGISTRY_REPOSITORY = 'https://github.com/h5p/h5p-registry';
const folderOf = (entry) => `${entry.machineName}-${entry.version.split('.').slice(0, 2).join('.')}`;
const STAMP = '.hvli-fetched.json';
const CACHE = resolve(
  process.env.H5P_LIBRARIES_CACHE ?? join(homedir(), '.cache/hvl-interaktiv/h5p-libraries'),
);

function resolveAndWrite() {
  const work = join(CACHE, 'resolve');
  const registryCommit = checkout(REGISTRY_REPOSITORY, 'HEAD', join(work, 'registry'));
  const registry = JSON.parse(readFileSync(join(work, 'registry', 'libraries.json'), 'utf8'));
  const { libraries, skipped } = resolveManifest({
    roots: CONTENT_TYPE_ROOTS,
    registry,
    source: { listVersionTags, checkout },
    workDir: join(work, 'checkouts'),
  });
  const manifest = {
    registry: { repository: REGISTRY_REPOSITORY, commit: registryCommit },
    libraries,
    skipped,
  };
  writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  rmSync(work, { recursive: true, force: true });
  console.log(
    `✓ ${libraries.length} libraries pinned (${skipped.length} offered ones skipped) in ${MANIFEST_FILE}`,
  );
}

function fetchOne(entry, dest) {
  const dir = join(CACHE, 'checkouts', folderOf(entry));
  const stampFile = join(dir, STAMP);
  const stamp = existsSync(stampFile) ? JSON.parse(readFileSync(stampFile, 'utf8')) : undefined;
  const checkedOut = stamp?.commit === entry.commit && stamp?.built === entry.build;
  // SECURITY: a build made with another recipe may hold its machine's environment (D-110, 2026-11-05).
  const builtCurrent = !entry.build || stamp?.buildEnv === BUILD_ENV_VERSION;
  if (!checkedOut) {
    checkout(entry.repository, entry.ref === 'HEAD' ? entry.commit : entry.ref, dir, entry.commit);
  } else if (!builtCurrent) {
    verifiedHead(dir, entry.commit);
    execFileSync('git', ['clean', '-ffdxq'], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] });
  }
  if (!checkedOut || !builtCurrent) {
    if (entry.build) {
      buildLibrary(dir, { home: join(CACHE, 'build-home') });
      // WHY: a reuse fails on any changed tracked file, so a build that rewrites one must fail here, by its cause.
      verifiedHead(dir, entry.commit);
    }
    const buildEnv = entry.build ? { buildEnv: BUILD_ENV_VERSION } : {};
    writeFileSync(stampFile, JSON.stringify({ commit: entry.commit, built: entry.build, ...buildEnv }));
  } else {
    verifiedHead(dir, entry.commit);
  }
  const libraryDir = join(dest, 'libraries', folderOf(entry));
  rmSync(libraryDir, { recursive: true, force: true });
  copyLibraryFiles(dir, libraryDir, { built: entry.build });
}

async function fetchAll(dest, only) {
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
  for (const entry of manifest.libraries) {
    process.stdout.write(`… ${entry.machineName} ${entry.version}${entry.build ? ' (build)' : ''}\n`);
    fetchOne(entry, dest);
  }
  const packages = join(dest, 'packages');
  rmSync(packages, { recursive: true, force: true });
  mkdirSync(packages, { recursive: true });
  const sums = [];
  const examples = join(HERE, 'examples');
  const wanted = (name) => name.endsWith('.json') && (!only || name === `${only}.json`);
  for (const name of readdirSync(examples).filter(wanted).sort()) {
    const outFile = join(packages, name.replace(/\.json$/, '.h5p'));
    await packContentType({
      librariesDir: join(dest, 'libraries'),
      exampleFile: join(examples, name),
      outFile,
    });
    sums.push(
      `${createHash('sha256').update(readFileSync(outFile)).digest('hex')}  ${name.replace(/\.json$/, '.h5p')}`,
    );
  }
  writeFileSync(join(packages, 'SHA256SUMS'), `${sums.join('\n')}\n`);
  console.log(`✓ ${manifest.libraries.length} libraries and ${sums.length} packages in ${dest}`);
}

const args = process.argv.slice(2);
const destIndex = args.indexOf('--dest');
const dest = resolve(destIndex >= 0 ? args[destIndex + 1] : join(ROOT, 'apps/server/var/h5p-real'));
const onlyIndex = args.indexOf('--only');
try {
  if (args.includes('--resolve')) resolveAndWrite();
  else await fetchAll(dest, onlyIndex >= 0 ? args[onlyIndex + 1] : undefined);
} catch (error) {
  console.error(`✗ h5p:fetch-libraries failed: ${error.message}`);
  process.exitCode = 1;
}
