/**
 * Tests for `npm run content:check`: a one-line summary and exit code 0 when the content loads; every problem and
 * exit code 1 when it does not; the command itself, run with tsx as npm runs it.
 *
 * Spec: PED-001
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from '../../../src/learningDesign/content/contentProblem.js';
import { loadStudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import { runContentCheck } from '../../../src/learningDesign/content/runContentCheck.js';

const SERVER_DIR = fileURLToPath(new URL('../../../', import.meta.url));
const CLI = 'src/learningDesign/content/contentCheckCli.ts';
const BROKEN = '--root=apps/server/test/fixtures/studio-content/repeated-key';

const recorded = () => {
  const lines: { log: string[]; error: string[] } = { log: [], error: [] };
  const output = {
    log: (line: string) => lines.log.push(line),
    error: (line: string) => lines.error.push(line),
  };
  return { lines, output, baseDirectory: REPOSITORY_ROOT };
};

describe('[PED-001] content:check', () => {
  it('[PED-001] prints a one-line summary and exits 0 when the real content loads', () => {
    // Arrange
    const { lines, ...options } = recorded();
    // Act
    const code = runContentCheck([], options);
    // Assert
    expect(code).toBe(0);
    expect(lines.error).toEqual([]);
    // WHY: a prefix without labels or counts, so ALU's edits and each section's own part leave this test as it is.
    expect(lines.log).toEqual([
      expect.stringMatching(
        /^✓ content:check: content\/ loads: 3 phases \([^;]+; status (proposed|confirmed-by-alu)\), \d+ references? \(\d+ to verify\)/,
      ),
    ]);
    expect(lines.log[0]).not.toContain('undefined');
  });

  it('[PED-001] hands the loader the resolved folder and the inputs the command was given', () => {
    // Arrange
    const { lines, ...options } = recorded();
    const calls: unknown[][] = [];
    const load = (...args: unknown[]) => {
      calls.push(args);
      return loadStudioContent();
    };
    // Act
    const code = runContentCheck(['--root=content'], { ...options, inputs: {}, load });
    // Assert
    expect(code).toBe(0);
    expect(calls).toEqual([[join(REPOSITORY_ROOT, 'content'), {}]]);
    expect(lines.log).toHaveLength(1);
  });

  it('[PED-001] prints every problem with its file, line and key, and exits 1', () => {
    // Arrange
    const { lines, ...options } = recorded();
    // Act
    const code = runContentCheck([BROKEN], options);
    // Assert
    expect(code).toBe(1);
    expect(lines.error[0]).toMatch(
      /^✗ content:check: .*repeated-key\/ has \d+ problems?; the server will not start/,
    );
    expect(lines.error).toContain(
      '  ✗ apps/server/test/fixtures/studio-content/repeated-key/laeringsdesign/phases.yaml:59: ' +
        'phases[etterarbeid].label.nn: appears more than once',
    );
    expect(lines.error.at(-1)).toBe('See content/README.md for how to edit these files.');
  });

  it.each([
    ['an unknown argument', ['--fix'], undefined, /unknown argument "--fix"\. Usage: npm run content:check/],
    [
      'an unexpected error',
      [],
      () => {
        throw new Error('disk on fire');
      },
      /could not be checked: disk on fire$/,
    ],
  ])('[PED-001] exits 1 on %s', (_, args, load, message) => {
    // Arrange
    const { lines, ...options } = recorded();
    // Act
    const code = runContentCheck(args, { ...options, ...(load ? { load } : {}) });
    // Assert
    expect(code).toBe(1);
    expect(lines.error).toEqual([expect.stringMatching(message)]);
  });

  it('[PED-001] runs as a command: exit 0 on the real content, 1 on a broken folder given from the repository root', () => {
    // Arrange
    const run = (args: string[]) =>
      spawnSync(process.execPath, ['--import', 'tsx', CLI, ...args], {
        cwd: SERVER_DIR,
        env: { ...process.env, INIT_CWD: REPOSITORY_ROOT },
        encoding: 'utf8',
      });
    // Act
    const good = run([]);
    const bad = run([BROKEN]);
    // Assert
    expect(good.status).toBe(0);
    expect(good.stdout).toMatch(/^✓ content:check: content\/ loads: 3 phases/);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('phases[etterarbeid].label.nn: appears more than once');
  });
});
