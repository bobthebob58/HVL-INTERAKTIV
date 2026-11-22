/**
 * Tests for the memory budget: the server's heap limit and what it needs beside it are worked out against the
 * container's limit, said in one start line, and warned about when they do not fit or when production has no
 * limit at all.
 *
 * Spec: NFR-002, NFR-006, NFR-007
 */
import { describe, expect, it } from 'vitest';
import {
  logMemoryBudget,
  memoryBudgetOf,
  readMemoryFacts,
  type MemoryFacts,
} from '../../src/server/memoryBudget.js';
import { capturedLogger } from '../support/capturedLogger.js';

const MB = 1024 * 1024;
/** The example stack: a 5 GiB container, the heap limit Node chooses there, /tmp kept in memory, two exports. */
const stack = (overrides: Partial<MemoryFacts> = {}): MemoryFacts => ({
  heapLimitBytes: 2240 * MB,
  containerLimitBytes: 5120 * MB,
  temporaryFolderBytes: 512 * MB,
  pdfExportsAtOnce: 2,
  production: true,
  ...overrides,
});
const logged = (facts: MemoryFacts): Record<string, unknown>[] => {
  const log = capturedLogger();
  logMemoryBudget(log.logger, memoryBudgetOf(facts));
  return log.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
};

describe('[NFR-002] the memory budget', () => {
  it('[NFR-002] the example stack fits: heap, SVG worker, the server beside its heap, Chromium and /tmp', () => {
    // Act
    const budget = memoryBudgetOf(stack());
    // Assert: 512 (SVG worker) + 256 (beside the heap) + 256 + 128 (two exports) + 512 (/tmp) beside the heap
    expect(budget).toEqual({ containerLimitMb: 5120, heapLimitMb: 2240, besideHeapMb: 1664, neededMb: 3904 });
    expect(logged(stack())).toEqual([
      expect.objectContaining({
        level: 'info',
        msg: 'memory limits',
        containerLimitMb: 5120,
        neededMb: 3904,
      }),
    ]);
  });

  it('[NFR-002] a limit below what the server may use is warned about, in every mode', () => {
    // Arrange: a 3 GiB container, where Node chooses a heap of 1 728 MiB
    const small = { heapLimitBytes: 1728 * MB, containerLimitBytes: 3072 * MB };
    // Act
    const lines = logged(stack(small));
    // Assert
    expect(memoryBudgetOf(stack(small)).problem).toBe('limit-too-small');
    expect(memoryBudgetOf(stack({ ...small, production: false })).problem).toBe('limit-too-small');
    expect(lines.map((line) => line.level)).toEqual(['info', 'warn']);
    expect(lines[1]).toMatchObject({ containerLimitMb: 3072, neededMb: 3392 });
    expect(String(lines[1]?.msg)).toContain('the memory limit is below what the server may use');
  });

  it('[NFR-002] production without any limit is warned about; development without one is not', () => {
    // Act
    const production = logged(stack({ containerLimitBytes: undefined }));
    const development = logged(stack({ containerLimitBytes: undefined, production: false }));
    // Assert
    expect(production.map((line) => line.level)).toEqual(['info', 'warn']);
    expect(production[0]).toMatchObject({ containerLimitMb: null });
    expect(String(production[1]?.msg)).toContain('the container has no memory limit');
    expect(development.map((line) => line.level)).toEqual(['info']);
  });

  it('[NFR-007] more exports at once and a larger /tmp raise the need; a /tmp on disk counts nothing', () => {
    expect(memoryBudgetOf(stack({ pdfExportsAtOnce: 8 })).besideHeapMb).toBe(1664 + 6 * 128);
    expect(memoryBudgetOf(stack({ temporaryFolderBytes: 0 })).besideHeapMb).toBe(1664 - 512);
    expect(memoryBudgetOf(stack({ pdfExportsAtOnce: 1, temporaryFolderBytes: 0 })).besideHeapMb).toBe(1024);
  });

  it('[NFR-006] this process reads its own limits as numbers', () => {
    // Act
    const facts = readMemoryFacts({ NODE_ENV: 'test', PDF_MAX_CONCURRENCY: 2 });
    // Assert: a heap limit Node really has, and a container limit only when it is below the machine's memory
    expect(facts.heapLimitBytes).toBeGreaterThan(64 * MB);
    expect(facts.containerLimitBytes ?? 1).toBeGreaterThan(0);
    expect(facts.temporaryFolderBytes).toBeGreaterThanOrEqual(0);
    expect(facts).toMatchObject({ pdfExportsAtOnce: 2, production: false });
  });
});
