/**
 * Tests for the bundle's secret guard: a package with a build machine's secrets baked into a text file is refused,
 * the problem names the file and the variables but never a value, content/ is scanned too, a file too large to scan
 * is refused, not skipped, the ten real packages pass, and the command runs under plain Node, as the image build
 * runs it (D-110 amendments of 2026-11-05 and 2026-11-06). The rules themselves are tested in
 * apps/server/test/h5p/libraries/.
 *
 * Spec: NFR-007, H5P-003
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { buildSecretsIn } from '../../../apps/server/src/h5p/libraries/libraryBuildSecrets.ts';
import { buildBundle, bundleProblems } from '../contentTypeBundle.mjs';
import { fetchedPackages, refusal, removeTempDirs, temp } from './bundleFixtures.mjs';

afterAll(removeTempDirs);

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const RULES = join(ROOT, 'apps/server/src/h5p/libraries/libraryBuildSecrets.ts');
const REAL_PACKAGES = join(ROOT, 'apps/server/var/h5p-real/packages');
const verifyWithNode = (dir) =>
  spawnSync(process.execPath, [join(ROOT, 'tools/h5p-bundle/bundleCli.mjs'), 'verify', dir], {
    encoding: 'utf8',
  });

describe('[NFR-007] the bundle refuses packages with baked-in secrets', () => {
  it('[NFR-007] refuses a package whose script holds a secret-named variable, and never prints the value', async () => {
    // Arrange: webpack's DefinePlugin of process.env, as H5P.AudioRecorder 1.0's build writes it.
    const dump = 'var e={PATH:"/usr/bin",GH_TOKEN:"ghp_doNotPrintMe",AWS_SECRET_ACCESS_KEY:"abc"};';
    const from = await fetchedPackages({
      extra: { 'H5P.CoursePresentation.h5p': { 'H5P.AudioRecorder-1.0/dist/recorder.js': dump } },
    });
    // Act
    const problems = await refusal(buildBundle({ from, out: join(temp(), 'bundle') }));
    // Assert
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(
      /^H5P\.CoursePresentation\.h5p: H5P\.AudioRecorder-1\.0\/dist\/recorder\.js holds AWS_SECRET_ACCESS_KEY, GH_TOKEN/,
    );
    expect(problems[0]).not.toContain('ghp_doNotPrintMe');
  });

  it('[NFR-007] names only upper-case secret-named variables with a value, quoted or not', () => {
    expect(buildSecretsIn('{"API_KEY":"k",GITHUB_TOKEN:"t",DB_PASSWORD : "p",EMPTY_TOKEN:""}')).toEqual([
      'API_KEY',
      'DB_PASSWORD',
      'GITHUB_TOKEN',
    ]);
    expect(buildSecretsIn('{token:"a",password:"Passord",PATH:"/bin"}')).toEqual([]);
  });

  it('[NFR-007] in an environment dump, npm_package_name is allowed and every key the build does not set is named', () => {
    // WHY: before the allowlist (D-110 amendment of 2026-11-06) this whole object passed.
    expect(buildSecretsIn('{token:"a",password:"Passord",PATH:"/bin",npm_package_name:"x"}')).toEqual([
      'password',
      'token',
    ]);
  });

  it("[NFR-007] names this server's own key lists, single-quoted values and a URL with a password", () => {
    // Arrange: what a build would bake in if it ran with the server's .env loaded.
    const text =
      "{URL_SIGNING_KEYS:'k1=c2VjcmV0',DATA_ENCRYPTION_KEYS:\"k1=x\",NPM_AUTH:'t'," +
      'DATABASE_URL:"postgresql://hvli:pw@db:5432/hvli",REDIS_URL:"redis://redis:6379",' +
      'PUBLIC_BASE_URL:"http://localhost:3000",KEY_ENTER:"Enter",ENTER_KEY:13}';
    // Act and assert: the plain URLs, a keyboard name and a number are left alone.
    expect(buildSecretsIn(text)).toEqual([
      'DATABASE_URL',
      'DATA_ENCRYPTION_KEYS',
      'NPM_AUTH',
      'URL_SIGNING_KEYS',
    ]);
  });

  it('[NFR-007] scans content/ too, unlike the server: a package whose content holds a secret is refused', async () => {
    // Arrange: a bundle's packages come from H5P Group's builds, so their example content is checked as well.
    const content = '{"code":{"GH_TOKEN":"doNotPrintMe-c1"}}';
    const from = await fetchedPackages({
      extra: { 'H5P.DragText.h5p': { 'content/content.json': content } },
    });
    // Act
    const problems = await refusal(buildBundle({ from, out: join(temp(), 'bundle') }));
    // Assert
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^H5P\.DragText\.h5p: content\/content\.json holds GH_TOKEN \(/);
    expect(problems[0]).not.toContain('doNotPrintMe');
  });

  it('[NFR-007] refuses a text file too large to scan instead of skipping it', async () => {
    // Arrange: 33 MB of spaces, which compress to almost nothing.
    const from = await fetchedPackages({
      extra: { 'H5P.Blanks.h5p': { 'H5P.Big-1.0/big.js': ' '.repeat(33 * 1024 * 1024) } },
    });
    // Act
    const problems = await refusal(buildBundle({ from, out: join(temp(), 'bundle') }));
    // Assert
    expect(problems).toEqual([
      'H5P.Blanks.h5p: H5P.Big-1.0/big.js is too large to scan (over 32 MB), so it is refused',
    ]);
  });
});

describe('[NFR-007] the shared rules run where the image build runs them', () => {
  it('[NFR-007] the rules file imports nothing, so plain Node can load it by stripping its types', () => {
    expect(readFileSync(RULES, 'utf8')).not.toMatch(/^\s*(?:import|export\s+(?:\*|\{[^}]*\})\s+from)\b/m);
  });

  it('[NFR-007] bundleCli verify runs under plain Node: a clean bundle passes and a leaky one fails by name', async () => {
    // Arrange: a clean bundle, and one with a proxy password in a lower-case variable.
    const clean = join(temp(), 'clean');
    await buildBundle({ from: await fetchedPackages(), out: clean });
    const leaky = await fetchedPackages({
      extra: {
        'H5P.Column.h5p': { 'H5P.Leak-1.0/leak.js': 'x={https_proxy:"http://u:doNotPrintMe@p:3128"}' },
      },
    });
    // Act
    const passed = verifyWithNode(clean);
    const failed = verifyWithNode(leaky);
    // Assert
    expect(passed.status, passed.stderr).toBe(0);
    expect(passed.stdout).toContain('the 10 packages match their SHA256SUMS');
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain('H5P.Column.h5p: H5P.Leak-1.0/leak.js holds https_proxy');
    expect(failed.stderr).not.toContain('doNotPrintMe');
  });

  it.skipIf(!existsSync(join(REAL_PACKAGES, 'SHA256SUMS')))(
    '[NFR-007] the ten real packages, built with the minimal build environment, pass the widened scan',
    async () => {
      expect((await bundleProblems(REAL_PACKAGES)).problems).toEqual([]);
    },
    60_000,
  );
});
