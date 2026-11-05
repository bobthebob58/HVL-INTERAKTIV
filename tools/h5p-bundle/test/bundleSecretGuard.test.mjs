/**
 * Tests for the bundle's secret guard: a package with a build machine's secrets baked into a text file is refused,
 * the problem names the file and the variables but never a value, and a file too large to scan is refused, not
 * skipped (D-110 amendment of 2026-11-05).
 *
 * Spec: NFR-007
 */
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildBundle, secretVariablesIn } from '../contentTypeBundle.mjs';
import { fetchedPackages, refusal, removeTempDirs, temp } from './bundleFixtures.mjs';

afterAll(removeTempDirs);

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
    expect(secretVariablesIn('{"API_KEY":"k",GITHUB_TOKEN:"t",DB_PASSWORD : "p",EMPTY_TOKEN:""}')).toEqual([
      'API_KEY',
      'DB_PASSWORD',
      'GITHUB_TOKEN',
    ]);
    expect(secretVariablesIn('{token:"a",password:"Passord",PATH:"/bin",npm_package_name:"x"}')).toEqual([]);
  });

  it("[NFR-007] names this server's own key lists, single-quoted values and a URL with a password", () => {
    // Arrange: what a build would bake in if it ran with the server's .env loaded.
    const text =
      "{URL_SIGNING_KEYS:'k1=c2VjcmV0',DATA_ENCRYPTION_KEYS:\"k1=x\",NPM_AUTH:'t'," +
      'DATABASE_URL:"postgresql://hvli:pw@db:5432/hvli",REDIS_URL:"redis://redis:6379",' +
      'PUBLIC_BASE_URL:"http://localhost:3000",KEY_ENTER:"Enter",ENTER_KEY:13}';
    // Act and assert: the plain URLs, a keyboard name and a number are left alone.
    expect(secretVariablesIn(text)).toEqual([
      'DATABASE_URL',
      'DATA_ENCRYPTION_KEYS',
      'NPM_AUTH',
      'URL_SIGNING_KEYS',
    ]);
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
