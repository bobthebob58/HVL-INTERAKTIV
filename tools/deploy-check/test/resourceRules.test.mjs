/**
 * Tests for the app stack's limits: the real stack file gives the app a restart rule, a memory limit and a short
 * health check, and a copy without one, with too little memory, with swap beyond the limit, with a health check
 * that keeps a standing server "healthy" for long, or with a one-off step that restarts is refused.
 *
 * Spec: NFR-007, NFR-002
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { durationSeconds, memoryMb, MIN_APP_MEMORY_MB, resourceProblems } from '../resourceRules.mjs';

const COMPOSE = readFileSync(
  fileURLToPath(new URL('../../../deploy/compose.app.yml', import.meta.url)),
  'utf8',
);
/** The real stack file with one text replaced; the test fails if the text is not there exactly once. */
const without = (text, replacement = '') => {
  expect(COMPOSE.split(text)).toHaveLength(2);
  return COMPOSE.replace(text, replacement);
};

describe('[NFR-007] the app stack keeps its limits', () => {
  it('[NFR-007] the real stack file passes: the app restarts, has a memory limit without extra swap and a short health check', () => {
    expect(resourceProblems(COMPOSE)).toEqual([]);
  });

  it('[NFR-002] an app without a restart rule, or with one that never restarts, is refused', () => {
    // Arrange
    const rule = '    restart: unless-stopped\n';
    // Act
    const missing = resourceProblems(without(rule));
    const never = resourceProblems(without(rule, "    restart: 'no'\n"));
    // Assert
    const problem =
      'compose: app: needs a restart rule (unless-stopped), so the server comes back after a fault';
    expect(missing).toEqual([problem]);
    expect(never).toEqual([problem]);
    expect(resourceProblems(without(rule, '    restart: on-failure\n'))).toEqual([]);
  });

  it('[NFR-007] an app without a memory limit, with too small a one, or with swap beyond it is refused', () => {
    // Act
    const missing = resourceProblems(without('    mem_limit: 5g\n'));
    const small = resourceProblems(
      without('mem_limit: 5g\n    memswap_limit: 5g', 'mem_limit: 2g\n    memswap_limit: 2g'),
    );
    const swap = resourceProblems(without('memswap_limit: 5g', 'memswap_limit: 8g'));
    const noSwapRule = resourceProblems(without('    memswap_limit: 5g\n'));
    // Assert
    expect(missing).toEqual(['compose: app: needs a memory limit (mem_limit)']);
    expect(small).toEqual([
      `compose: app: the memory limit is below ${MIN_APP_MEMORY_MB} MiB, the server's budget`,
    ]);
    const swapProblem =
      'compose: app: memswap_limit must equal mem_limit, so the limit is not passed by swapping';
    expect(swap).toEqual([swapProblem]);
    expect(noSwapRule).toEqual([swapProblem]);
  });

  it('[NFR-002] a health check that would keep a standing server healthy for long is refused', () => {
    // Arrange: the stack's values before D-144 (no time limit, forty retries), and each value alone
    const slow = without(
      '      interval: 5s\n      timeout: 3s\n      retries: 3\n',
      '      interval: 3s\n      retries: 40\n',
    );
    // Act
    const problems = {
      slow: resourceProblems(slow),
      timeout: resourceProblems(without('      timeout: 3s\n', '      timeout: 30s\n')),
      interval: resourceProblems(
        without('      interval: 5s\n      timeout', '      interval: 1m\n      timeout'),
      ),
      start: resourceProblems(without('      retries: 3\n      start_period: 120s\n', '      retries: 3\n')),
      none: resourceProblems(
        without('      test:\n        - CMD\n', '      disable: true\n      test:\n        - CMD\n'),
      ),
    };
    // Assert
    expect(problems).toEqual({
      slow: [
        'compose: app: a health check try must end within 5 s (timeout)',
        'compose: app: at most 5 failed health checks in a row (retries)',
      ],
      timeout: ['compose: app: a health check try must end within 5 s (timeout)'],
      interval: ['compose: app: health checks must come at least every 10 s (interval)'],
      start: ['compose: app: needs a start period, so a starting server is not counted as failing'],
      none: ['compose: app: needs a health check'],
    });
  });

  it('[NFR-002] durations are read as compose writes them', () => {
    expect(['3s', '1m30s', '500ms', '2h', 7].map(durationSeconds)).toEqual([3, 90, 0.5, 7200, 7]);
    expect([undefined, 'soon', '3'].map(durationSeconds)).toEqual([undefined, undefined, undefined]);
  });

  it('[NFR-007] a step that runs once must not restart', () => {
    // Arrange: the migration with the app's restart rule
    const stack = without(
      "    command: ['node', '/app/node_modules/prisma/build/index.js', 'migrate', 'deploy']\n",
      "    command: ['node', '/app/node_modules/prisma/build/index.js', 'migrate', 'deploy']\n    restart: always\n",
    );
    // Act and assert
    expect(resourceProblems(stack)).toEqual([
      'compose: migrate: a step that runs once must not have a restart rule',
    ]);
  });

  it('[NFR-007] memory values are read in every unit compose accepts', () => {
    expect(memoryMb('5g')).toBe(5120);
    expect(memoryMb('4096m')).toBe(4096);
    expect(memoryMb('512MB')).toBe(512);
    expect(memoryMb('1048576k')).toBe(1024);
    expect(memoryMb(4294967296)).toBe(4096);
    expect(memoryMb('4294967296')).toBe(4096);
    expect(memoryMb(undefined)).toBeUndefined();
    expect(memoryMb('plenty')).toBeUndefined();
  });
});
