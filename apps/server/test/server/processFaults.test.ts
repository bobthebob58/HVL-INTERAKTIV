/**
 * Tests for the process's fault handlers: an uncaught exception or an unhandled promise rejection is written once
 * through the logger and ends the process with exit code 1, in a stand-in process and in a real one.
 *
 * Spec: NFR-006, DATA-009, NFR-002
 */
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { installProcessFaultHandlers, type FaultingProcess } from '../../src/server/processFaults.js';
import { capturedLogger } from '../support/capturedLogger.js';

const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));

/** A stand-in for `process`: it takes listeners and records the exit code. */
function standIn() {
  const events = new EventEmitter();
  const exit = vi.fn<(code: number) => void>();
  const proc: FaultingProcess = { on: (event, listener) => events.on(event, listener), exit };
  return { events, exit, proc };
}

describe('[NFR-006] faults nothing handled', () => {
  it('[NFR-006] an uncaught exception is one fatal line through the logger, then exit code 1', () => {
    // Arrange
    const log = capturedLogger();
    const { events, exit, proc } = standIn();
    installProcessFaultHandlers(log.logger, proc);
    // Act
    events.emit(
      'uncaughtException',
      new Error('connect failed: redis://:redis-password-1@redis.hvl.no:6379'),
    );
    // Assert
    expect(log.lines).toHaveLength(1);
    expect(JSON.parse(log.lines[0] ?? '')).toMatchObject({
      level: 'fatal',
      msg: 'an uncaught fault stopped the server',
    });
    expect(log.lines[0]).not.toContain('redis-password-1');
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('[NFR-006] an unhandled promise rejection is one fatal line, also when its reason is not an Error', () => {
    // Arrange
    const log = capturedLogger();
    const { events, exit, proc } = standIn();
    installProcessFaultHandlers(log.logger, proc);
    // Act
    events.emit('unhandledRejection', 'failed for /lti/play?ltik=eyJhbGciOiJIUzI1NiJ9.e30.c2lnbmF0dXJl');
    // Assert
    expect(log.lines).toHaveLength(1);
    expect(JSON.parse(log.lines[0] ?? '')).toMatchObject({
      level: 'fatal',
      msg: 'an unhandled promise rejection stopped the server',
    });
    expect(log.lines[0]).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('[NFR-002] the process still ends with exit code 1 when the logging itself fails', () => {
    // Arrange
    const { events, exit, proc } = standIn();
    const broken = {
      fatal: () => {
        throw new Error('the log destination is gone');
      },
    };
    installProcessFaultHandlers(broken, proc);
    // Act and assert
    expect(() => events.emit('uncaughtException', new Error('boom'))).toThrow('the log destination is gone');
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('[DATA-009] in a real process the fault is written as one cleaned line before the process ends', async () => {
    // Arrange: a process that installs the handlers with the real logger and then fails outside any handler
    const script = `
      import { createLogger } from './src/logging/logger.ts';
      import { installProcessFaultHandlers } from './src/server/processFaults.ts';
      installProcessFaultHandlers(createLogger({ level: 'info' }));
      setTimeout(() => {
        throw new Error('query failed on postgresql://hvli_app:db-password-1@db.hvl.no:5432/hvli');
      }, 10);
    `;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
      cwd: SERVER_DIR,
      env: { PATH: process.env.PATH ?? '' },
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => (out += String(chunk)));
    child.stderr.on('data', (chunk: Buffer) => (err += String(chunk)));
    // Act
    const code = await new Promise<number | null>((resolve) => child.on('exit', resolve));
    // Assert: one JSON line on standard output, nothing on standard error, and no password anywhere
    expect(code).toBe(1);
    const lines = out.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      level: 'fatal',
      msg: 'an uncaught fault stopped the server',
    });
    expect(err).toBe('');
    expect(out).not.toContain('db-password-1');
  }, 30_000);
});
