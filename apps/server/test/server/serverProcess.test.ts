/**
 * Tests for the server process: a configuration problem is a list of names and exit code 1, any other failed start
 * is one fatal line through the logger and exit code 1, and a signal stops the server once.
 *
 * Spec: NFR-002, NFR-006, DATA-009, DOC-008
 */
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { RunningServer } from '../../src/server/main.js';
import { runServerProcess, type HostProcess } from '../../src/server/serverProcess.js';
import { VALID_ENV } from '../support/authEnv.js';
import { capturedLogger } from '../support/capturedLogger.js';

/** A stand-in for `process` with the given environment; it records what is printed and the exit codes. */
function standIn(env: NodeJS.ProcessEnv) {
  const events = new EventEmitter();
  const printed: string[] = [];
  const exit = vi.fn<(code: number) => void>();
  const proc: HostProcess = {
    env,
    stderr: { write: (text: string) => printed.push(text) },
    exit,
    on: (event, listener) => events.on(event, listener),
    once: (event, listener) => events.once(event, listener),
  };
  return { events, printed, exit, proc };
}

/** A started server whose `stop` is the given function. */
const running = (stop: () => Promise<void>): RunningServer =>
  ({ server: { closeIdleConnections: vi.fn() }, stop }) as unknown as RunningServer;

describe('[NFR-002] the server process', () => {
  it('[DOC-008] a configuration problem is listed by name with exit code 1, and nothing is started', async () => {
    // Arrange: no mode and a secret that must not be shown
    const { printed, exit, proc } = standIn({ ...VALID_ENV, NODE_ENV: '', FEIDE_CLIENT_ID: '' });
    const log = capturedLogger();
    const start = vi.fn();
    // Act
    await runServerProcess(start, { proc, logger: log.logger });
    // Assert
    expect(start).not.toHaveBeenCalled();
    expect(proc.exitCode).toBe(1);
    expect(printed.join('')).toContain('NODE_ENV: must be development, test or production');
    expect(printed.join('')).toContain('FEIDE_CLIENT_ID');
    expect(printed.join('')).not.toContain(String(VALID_ENV.FEIDE_CLIENT_SECRET));
    expect(log.lines).toEqual([]);
    expect(exit).not.toHaveBeenCalled();
  });

  it('[NFR-006] any other failed start is one fatal line through the logger and exit code 1, with nothing printed raw', async () => {
    // Arrange: the start fails as an unreachable service does, with its address in the message
    const { printed, exit, proc } = standIn({ ...VALID_ENV });
    const log = capturedLogger();
    const start = vi
      .fn()
      .mockRejectedValue(new Error('connect ECONNREFUSED redis://:redis-password-1@redis.hvl.no:6379'));
    // Act
    await runServerProcess(start, { proc, logger: log.logger });
    // Assert
    expect(log.lines).toHaveLength(1);
    expect(JSON.parse(log.lines[0] ?? '')).toMatchObject({
      level: 'fatal',
      msg: 'the server could not start',
    });
    expect(log.lines[0]).toContain('ECONNREFUSED');
    expect(log.lines[0]).not.toContain('redis-password-1');
    expect(printed).toEqual([]);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('[NFR-002] a signal stops the server once, with exit code 0', async () => {
    // Arrange
    const { events, proc } = standIn({ ...VALID_ENV });
    const stop = vi.fn().mockResolvedValue(undefined);
    const server = running(stop);
    await runServerProcess(() => Promise.resolve(server), { proc, logger: capturedLogger().logger });
    // Act: the deployment sends SIGTERM, and an impatient operator presses Ctrl-C as well
    events.emit('SIGTERM');
    events.emit('SIGINT');
    await vi.waitFor(() => expect(proc.exitCode).toBe(0));
    // Assert
    expect(stop).toHaveBeenCalledOnce();
    expect(server.server.closeIdleConnections).toHaveBeenCalledOnce();
  });

  it('[NFR-006] a part that does not stop is an error line through the logger and exit code 1', async () => {
    // Arrange
    const { events, printed, proc } = standIn({ ...VALID_ENV });
    const log = capturedLogger();
    const stop = () => Promise.reject(new Error('the browser did not close'));
    await runServerProcess(() => Promise.resolve(running(stop)), { proc, logger: log.logger });
    // Act
    events.emit('SIGTERM');
    await vi.waitFor(() => expect(proc.exitCode).toBe(1));
    // Assert
    expect(log.lines.map((line) => (JSON.parse(line) as { msg: string }).msg)).toEqual([
      'the server did not stop cleanly',
    ]);
    expect(printed).toEqual([]);
  });

  it('[NFR-006] faults nothing handled end the process through the same logger', async () => {
    // Arrange
    const { events, exit, proc } = standIn({ ...VALID_ENV });
    const log = capturedLogger();
    await runServerProcess(() => Promise.resolve(running(() => Promise.resolve())), {
      proc,
      logger: log.logger,
    });
    // Act
    events.emit('unhandledRejection', new Error('a job failed'));
    // Assert
    expect(log.lines).toHaveLength(1);
    expect(JSON.parse(log.lines[0] ?? '')).toMatchObject({ level: 'fatal' });
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
});
