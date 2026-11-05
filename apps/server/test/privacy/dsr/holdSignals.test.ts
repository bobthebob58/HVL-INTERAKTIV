/**
 * Tests for holding signals while a data-subject request runs (DATA-008, D-108's amendment of 2026-11-05): Ctrl-C,
 * SIGTERM and SIGHUP do not end a run before it is audited, the note is printed once, the listeners go when the run
 * settles, and in a real process a held SIGINT lets the run finish where the default action would have ended it.
 *
 * Spec: DATA-008, DATA-007
 */
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HELD_SIGNALS, HOLD_NOTE, holdSignals } from '../../../src/privacy/dsr/holdSignals.js';

const SERVER_DIR = fileURLToPath(new URL('../../../', import.meta.url));
const MODULE = pathToFileURL(
  fileURLToPath(new URL('../../../src/privacy/dsr/holdSignals.ts', import.meta.url)),
);

/** Runs `body` as an ES module in a fresh Node process with tsx, as the CLI runs. */
const inChild = (body: string) =>
  spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', body], {
    cwd: SERVER_DIR,
    encoding: 'utf8',
    timeout: 30_000,
  });

/** A run that signals itself twice, then takes a moment, as an erasure does. */
const SIGNALLED_RUN = `async () => {
  process.kill(process.pid, 'SIGINT');
  process.kill(process.pid, 'SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 150));
  return 'audited';
}`;

describe('[DATA-008] holdSignals', () => {
  it('[DATA-008] holds every signal while the run lasts, prints the note once and passes the result through', async () => {
    // Arrange
    const source = new EventEmitter();
    const notes: string[] = [];
    let finish: (value: string) => void = () => undefined;
    // Act
    const run = holdSignals(
      () => new Promise<string>((resolve) => (finish = resolve)),
      source,
      (line) => {
        notes.push(line);
      },
    );
    for (const signal of HELD_SIGNALS) source.emit(signal);
    const heldWhileRunning = HELD_SIGNALS.map((signal) => source.listenerCount(signal));
    finish('audited');
    // Assert
    await expect(run).resolves.toBe('audited');
    expect(heldWhileRunning).toEqual([1, 1, 1]);
    expect(notes).toEqual([HOLD_NOTE]);
    expect(HELD_SIGNALS.map((signal) => source.listenerCount(signal))).toEqual([0, 0, 0]);
  });

  it('[DATA-008] lets go of the signals when the run fails, and passes its error through', async () => {
    // Arrange
    const source = new EventEmitter();
    // Act
    const run = holdSignals(
      () => Promise.reject(new Error('connection lost')),
      source,
      () => undefined,
    );
    // Assert
    await expect(run).rejects.toThrow('connection lost');
    expect(HELD_SIGNALS.map((signal) => source.listenerCount(signal))).toEqual([0, 0, 0]);
  });

  it('[DATA-008] in a real process, a run signalled with SIGINT and SIGTERM finishes; without the hold it is ended', () => {
    // Act
    const held = inChild(`
      const { holdSignals } = await import(${JSON.stringify(MODULE.href)});
      const out = await holdSignals(${SIGNALLED_RUN}, process, (line) => process.stderr.write(line + '\\n'));
      process.stdout.write(out);
    `);
    const unheld = inChild(`process.stdout.write(await (${SIGNALLED_RUN})());`);
    // Assert
    expect([held.status, held.stdout, held.stderr]).toEqual([0, 'audited', `${HOLD_NOTE}\n`]);
    expect([unheld.status, unheld.signal, unheld.stdout]).toEqual([null, 'SIGINT', '']);
  });
});
