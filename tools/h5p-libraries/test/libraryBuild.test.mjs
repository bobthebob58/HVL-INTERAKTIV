/**
 * Tests that a library's build sees no variable of the build machine outside the allow-list (`PATH`, `HOME`,
 * `NODE_ENV=production` and npm's own script variables), so a build that bakes `process.env` into its JavaScript, as
 * `H5P.AudioRecorder` 1.0 does, ships no token to learners (D-110's amendment of 2026-11-05); that the install keeps
 * only the proxy, CA and npm registry variables it needs; that each build gets an empty `HOME` of its own; and that
 * a global `npmrc` of the Node install (here a planted proxy password) never reaches the build. A real `npm ci` and
 * `npm run build` run in a throwaway library whose build writes its environment to a file.
 *
 * Spec: H5P-003
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildEnvironment, buildLibrary, buildPath, installEnvironment } from '../libraryBuild.mjs';

const dirs = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tempDir = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};

/** Planted values the build must never see, by name and by value. */
const PLANTED = {
  GITHUB_TOKEN: 'ghp_plantedGithubTokenValue000000000000',
  ACTIONS_RUNTIME_TOKEN: 'planted-actions-runtime-token-value',
  CLAUDE_SESSION_INGRESS_TOKEN: 'planted-session-token-value',
  AWS_SECRET_ACCESS_KEY: 'planted-aws-secret-value',
  NODE_OPTIONS: '--max-old-space-size=99',
  HTTPS_PROXY: 'http://planted-proxy.invalid:3128',
  // WHY: a real CA file where there is one, so the install's npm loads it without a warning.
  NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS ?? '/planted/ca.pem',
  npm_config_registry: 'https://planted-registry.invalid/',
  NPM_CONFIG_CAFILE: '/planted/npm-ca.pem',
  npm_config__authToken: 'planted-npm-auth-token',
};

/** What npm and the shell add to every script's environment by themselves. */
const NPM_AND_SHELL = /^(npm_.*|INIT_CWD|NODE|COLOR|EDITOR|PWD|OLDPWD|SHLVL|_)$/;

/** A library with no dependencies whose build writes its environment and its HOME's entries to build.json. */
function throwawayLibrary() {
  const dir = tempDir('h5p-build-');
  const report =
    "const fs=require('fs');fs.writeFileSync('build.json',JSON.stringify({env:process.env," +
    'home:fs.readdirSync(process.env.HOME)}))';
  const pkg = {
    name: 'h5p-throwaway',
    version: '1.0.0',
    private: true,
    scripts: { build: `node -e "${report}"` },
  };
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  const lock = {
    name: pkg.name,
    version: pkg.version,
    lockfileVersion: 3,
    requires: true,
    packages: { '': {} },
  };
  lock.packages[''] = { name: pkg.name, version: pkg.version };
  writeFileSync(join(dir, 'package-lock.json'), JSON.stringify(lock));
  return dir;
}

/** A Node install of its own (the same binary, linked), whose global npmrc sets a proxy with a password. */
function nodeWithGlobalNpmrc(proxy) {
  const prefix = tempDir('h5p-node-prefix-');
  mkdirSync(join(prefix, 'bin'));
  mkdirSync(join(prefix, 'etc'));
  const node = join(prefix, 'bin', 'node');
  // WHY: npm finds the global npmrc at <prefix>/etc/npmrc, the prefix taken from the path Node was started by.
  try {
    linkSync(process.execPath, node);
  } catch {
    copyFileSync(process.execPath, node);
    chmodSync(node, 0o755);
  }
  const npm = join(dirname(process.execPath), 'npm');
  if (existsSync(npm)) symlinkSync(realpathSync(npm), join(prefix, 'bin', 'npm'));
  writeFileSync(join(prefix, 'etc', 'npmrc'), `https-proxy=${proxy}\n`);
  return { node, bin: join(prefix, 'bin') };
}

describe('[H5P-003] a library build’s environment', () => {
  it('[H5P-003] the build sees PATH, an empty HOME and NODE_ENV=production, and no other variable of the machine', () => {
    // Arrange: a machine environment with tokens, proxy, CA and npm settings, and a file left in the build's HOME
    const dir = throwawayLibrary();
    const home = join(tempDir('h5p-build-home-'), 'home');
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, '.npmrc'), '//registry.npmjs.org/:_authToken=planted-left-behind');
    const source = { ...process.env, ...PLANTED };
    // Act
    buildLibrary(dir, { source, home });
    // Assert
    const { env, home: homeEntries } = JSON.parse(readFileSync(join(dir, 'build.json'), 'utf8'));
    const others = Object.keys(env).filter((name) => !['PATH', 'HOME', 'NODE_ENV'].includes(name));
    expect(others.filter((name) => !NPM_AND_SHELL.test(name))).toEqual([]);
    expect(env).toMatchObject({
      HOME: home,
      NODE_ENV: 'production',
      npm_config_globalconfig: expect.any(String),
    });
    // WHY: npm puts the package's own node_modules/.bin folders (and node-gyp's) in front of the build's PATH.
    expect(env.PATH.endsWith(`:${buildPath()}`)).toBe(true);
    const seen = JSON.stringify(env);
    for (const value of Object.values(PLANTED)) expect(seen).not.toContain(value);
    for (const name of Object.keys(source).filter(
      (n) => !NPM_AND_SHELL.test(n) && !['PATH', 'HOME', 'NODE_ENV'].includes(n),
    ))
      expect(env, name).not.toHaveProperty(name);
    expect(homeEntries).not.toContain('.npmrc');
  }, 60_000);

  it('[H5P-003] a global npmrc of the Node install, a proxy password in it, never reaches the build', () => {
    // Arrange: the same Node under a prefix whose etc/npmrc sets a proxy with a password
    const password = 'planted-global-npmrc-password';
    const { node, bin } = nodeWithGlobalNpmrc(`http://builder:${password}@proxy.invalid:3128`);
    const [control, dir] = [throwawayLibrary(), throwawayLibrary()];
    const home = join(tempDir('h5p-build-home-'), 'home');
    // Control: npm run under that Node, with no setting of ours, hands the global npmrc to the build
    execFileSync('npm', ['run', 'build'], {
      cwd: control,
      env: { PATH: `${bin}:/usr/local/bin:/usr/bin:/bin`, HOME: tempDir('h5p-control-home-') },
      stdio: 'ignore',
    });
    // Act: buildLibrary under that Node
    const call = `buildLibrary(${JSON.stringify(dir)}, { source: { HOME: ${JSON.stringify(home)} }, home: ${JSON.stringify(home)} })`;
    const moduleUrl = new URL('../libraryBuild.mjs', import.meta.url).href;
    execFileSync(
      node,
      ['--input-type=module', '-e', `import { buildLibrary } from '${moduleUrl}'; ${call};`],
      {
        env: {},
        stdio: ['ignore', 'ignore', 'inherit'],
      },
    );
    // Assert
    expect(readFileSync(join(control, 'build.json'), 'utf8')).toContain(password);
    const { env } = JSON.parse(readFileSync(join(dir, 'build.json'), 'utf8'));
    expect(JSON.stringify(env)).not.toContain(password);
    expect(env).not.toHaveProperty('npm_config_https_proxy');
    expect(env.npm_config_globalconfig.startsWith(home)).toBe(true);
  }, 60_000);

  it('[H5P-003] the install keeps PATH, HOME and the set proxy, CA and npm registry variables, and nothing else', () => {
    // Act
    const env = installEnvironment({
      ...PLANTED,
      HOME: '/home/builder',
      PATH: '/anything',
      SHELL: '/bin/zsh',
    });
    // Assert
    expect(env).toEqual({
      PATH: buildPath(),
      HOME: '/home/builder',
      HTTPS_PROXY: PLANTED.HTTPS_PROXY,
      NODE_EXTRA_CA_CERTS: PLANTED.NODE_EXTRA_CA_CERTS,
      npm_config_registry: PLANTED.npm_config_registry,
      NPM_CONFIG_CAFILE: PLANTED.NPM_CONFIG_CAFILE,
    });
  });

  it('[H5P-003] the build environment is the same four variables on every machine with the same Node', () => {
    expect(buildEnvironment('/cache/build-home')).toEqual({
      PATH: buildPath(),
      HOME: '/cache/build-home',
      NODE_ENV: 'production',
      npm_config_globalconfig: '/cache/build-home/no-global-npmrc',
    });
    expect(buildPath().split(':').slice(-3)).toEqual(['/usr/local/bin', '/usr/bin', '/bin']);
  });
});
