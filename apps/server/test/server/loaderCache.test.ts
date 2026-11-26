/**
 * Tests of the TypeScript loader's cache switch (D-144), for the pinned tsx: with `TSX_DISABLE_CACHE=1`, as the
 * image sets it, a program and its worker thread run from TypeScript sources and nothing is written to the
 * temporary area; without the setting the loader makes its folder of translated code there.
 *
 * Spec: NFR-007
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), '../..');
const work = mkdtempSync(join(tmpdir(), 'loader-cache-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

/** A program in TypeScript that also starts itself as a worker thread, as the SVG cleaning does. */
const PROGRAM = `
  import { isMainThread, parentPort, Worker } from 'node:worker_threads';
  const answer: number = 42;
  if (isMainThread) {
    const worker = new Worker(new URL(import.meta.url), { execArgv: process.execArgv });
    worker.once('message', (value: number) => console.log('main ' + answer + ', worker ' + value));
  } else parentPort?.postMessage(answer);
`;

/** Runs the program with an empty temporary area; answers its output and what the area holds afterwards. */
function run(name: string, setting: Record<string, string>): { output: string; written: string[] } {
  const temporary = mkdtempSync(join(work, `${name}-tmp-`));
  const program = join(work, `${name}.ts`);
  writeFileSync(program, PROGRAM);
  const child = spawnSync(process.execPath, ['--import', 'tsx', program], {
    cwd: SERVER_DIR,
    env: { PATH: process.env.PATH ?? '', TMPDIR: temporary, ...setting },
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { output: `${child.stdout}${child.stderr}`.trim(), written: readdirSync(temporary) };
}

describe('[NFR-007] the TypeScript loader keeps no code in a writable folder', () => {
  it('[NFR-007] with the image’s setting a program and its worker run and the temporary area stays empty', () => {
    // Act
    const off = run('off', { TSX_DISABLE_CACHE: '1' });
    // Assert
    expect(off).toEqual({ output: 'main 42, worker 42', written: [] });
  }, 90_000);

  it('[NFR-007] without the setting the loader writes its folder of translated code there', () => {
    // Act
    const on = run('on', {});
    // Assert: this is what the setting prevents, so the first test proves something
    expect(on.output).toBe('main 42, worker 42');
    expect(on.written).toEqual([expect.stringMatching(/^tsx-/)]);
  }, 90_000);
});
