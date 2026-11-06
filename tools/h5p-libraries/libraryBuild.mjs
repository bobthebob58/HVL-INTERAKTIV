/**
 * libraryBuild — installs and builds one H5P library checkout with a minimal, explicit environment: the install sees
 * only what it needs to reach the registry, and the build sees `PATH`, `HOME` and `NODE_ENV=production` only, with
 * npm's global configuration turned off.
 *
 * Why: `H5P.AudioRecorder` 1.0 and `H5PEditor.AudioRecorder` 1.0 build with webpack's
 *      `DefinePlugin({ 'process.env': JSON.stringify(process.env) })`, so a build that inherits the build machine's
 *      environment writes it, tokens included (a session token, a codespace's `GITHUB_TOKEN`, CI's `ACTIONS_*`), into
 *      JavaScript the player sends to every learner (D-110's amendment of 2026-11-05). No library may see more of the
 *      machine than it needs (D-078).
 * Spec: H5P-003
 * Invariants:
 *   - SECURITY: the build step (`npm run build`) gets exactly `PATH` (Node's own folder and the system folders),
 *     `HOME` (an empty folder made anew for each build, so no `.npmrc`, `.gitconfig` or token file is found),
 *     `NODE_ENV=production` and `npm_config_globalconfig` (a file in that `HOME` that never exists, because npm
 *     exports every setting of the Node install's global `npmrc`, a proxy password too, as `npm_config_*`); npm then
 *     adds only its own script variables (`npm_*`, `INIT_CWD`, `NODE`, `COLOR`, `EDITOR`) and the shell its `PWD`.
 *   - The install (`npm ci --ignore-scripts`, so no dependency's script runs) gets `PATH`, the caller's `HOME` (npm's
 *     cache and configuration) and, where set, the proxy and CA variables in `INSTALL_PASSTHROUGH`; nothing else.
 *   - `BUILD_ENV_VERSION` names this recipe; a cached build stamped with another (or none) is built again.
 * Collaborators: ./fetchLibraries.mjs (the caller and the cache stamp).
 * Tests: tools/h5p-libraries/test/libraryBuild.test.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** The build recipe's version, kept in each checkout's stamp; change it whenever what a build sees changes. */
export const BUILD_ENV_VERSION = 3;

/** Variables the install keeps when they are set: the proxy, the CA and npm's own registry and TLS settings. */
export const INSTALL_PASSTHROUGH = [
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
  'NO_PROXY',
  'no_proxy',
  'NODE_USE_ENV_PROXY',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
];

/** npm's own settings for the registry, proxy and CA, under either spelling (`npm_config_*`, `NPM_CONFIG_*`). */
const NPM_INSTALL_SETTINGS =
  /^npm_config_(registry|cafile|ca|https_proxy|proxy|noproxy|strict_ssl|userconfig)$/i;

/** A fixed search path: Node's own folder first, then the system folders, so no user folder is baked in. */
export const buildPath = () =>
  [...new Set([dirname(process.execPath), '/usr/local/bin', '/usr/bin', '/bin'])].join(':');

/**
 * The environment of a library's build step.
 * @param {string} home - The empty folder that is the build's `HOME`.
 * @returns {Record<string, string>} `PATH`, `HOME`, `NODE_ENV` and `npm_config_globalconfig` only.
 */
export function buildEnvironment(home) {
  // SECURITY: npm would export the global npmrc's settings (a proxy password too) into the build (D-110).
  const globalconfig = join(home, 'no-global-npmrc');
  return { PATH: buildPath(), HOME: home, NODE_ENV: 'production', npm_config_globalconfig: globalconfig };
}

/**
 * The environment of a library's dependency install.
 * @param {NodeJS.ProcessEnv} source - The caller's environment.
 * @returns {Record<string, string>} `PATH`, `HOME` and the set proxy, CA and npm registry variables.
 */
export function installEnvironment(source) {
  const kept = Object.entries(source).filter(
    ([name, value]) =>
      value !== undefined && (INSTALL_PASSTHROUGH.includes(name) || NPM_INSTALL_SETTINGS.test(name)),
  );
  return { ...Object.fromEntries(kept), PATH: buildPath(), HOME: source.HOME ?? '' };
}

/**
 * Installs a checkout's locked dependencies without their scripts, then runs its `build` script.
 * @param {string} dir - The checkout.
 * @param {{ source?: NodeJS.ProcessEnv, home: string }} options - The caller's environment (default
 *   `process.env`) and the folder the build gets as `HOME` (emptied first).
 * @throws {Error} When the install or the build fails.
 */
export function buildLibrary(dir, { source = process.env, home }) {
  const npm = (args, env) =>
    execFileSync('npm', args, { cwd: dir, env, stdio: ['ignore', 'ignore', 'inherit'] });
  // SECURITY: `--ignore-scripts` keeps third-party install scripts from running on the build machine.
  npm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], installEnvironment(source));
  // SECURITY: a fresh, empty HOME per build, so one library's build cannot leave a file for the next one.
  rmSync(home, { recursive: true, force: true });
  mkdirSync(home, { recursive: true });
  npm(['run', 'build'], buildEnvironment(home));
}
