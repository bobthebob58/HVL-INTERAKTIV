/**
 * Unit tests for the data-subject CLI's guards (DATA-008, D-108's amendment of 2026-11-05): `export` refuses to print
 * to a terminal before reading anything; the request runs inside the signal hold, and only after the data subject is
 * read, so Ctrl-C while pasting still stops at once.
 *
 * Spec: DATA-008, DATA-009
 */
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../../src/infra/prismaClient.js';
import { DSR_EXIT, EXPORT_TO_TERMINAL, runDsrCli } from '../../../src/privacy/dsr/dsrCli.js';
import { IdentityHasher } from '../../../src/security/keys/IdentityHasher.js';
import { parseKeyring } from '../../../src/security/keys/keyring.js';

const OPERATOR = ['--operator', 'admin@hvl.no'];
const SUBJECT = JSON.stringify({ feideId: 'kari@hvl.no' });

/** Runs the CLI with no secrets (the request then stops before the database) and records what happens, in order. */
const cli = async (argv: string[], input: string, stdoutIsTerminal: boolean) => {
  const events: string[] = [];
  const err: string[] = [];
  const untouchable = new Proxy({} as Database, {
    get: () => {
      throw new Error('the database was touched');
    },
  });
  const code = await runDsrCli(argv, {
    db: untouchable,
    secrets: new Map(),
    hasher: new IdentityHasher(parseKeyring(`a=${randomBytes(32).toString('base64')}`)),
    adminFeideIds: ['admin@hvl.no'],
    now: new Date('2026-11-05T09:00:00Z'),
    readSubject: () => {
      events.push('read');
      return Promise.resolve(input);
    },
    write: () => events.push('write'),
    warn: (line) => void err.push(line),
    stdoutIsTerminal,
    finishFirst: (work) => {
      events.push('held');
      return work();
    },
  });
  return { code, events, err };
};

describe('[DATA-008] the data-subject CLI’s guards', () => {
  it('[DATA-008] export refuses to print to a terminal, before it reads the data subject', async () => {
    // Act
    const result = await cli(['export', ...OPERATOR], SUBJECT, true);
    // Assert
    expect(result).toEqual({ code: DSR_EXIT.usage, events: [], err: [EXPORT_TO_TERMINAL] });
  });

  it('[DATA-008] an erasure may report to a terminal: it prints counts only', async () => {
    // Act
    const result = await cli(['erase', ...OPERATOR], SUBJECT, true);
    // Assert: no secret is configured, so the request is refused inside the hold.
    expect([result.code, result.events]).toEqual([DSR_EXIT.refusedOrFailed, ['read', 'held']]);
  });

  it('[DATA-008] the request runs inside the signal hold only once the data subject is read', async () => {
    // Act
    const read = await cli(['export', ...OPERATOR], SUBJECT, false);
    const unreadable = await cli(['export', ...OPERATOR], '{"feideId":', false);
    // Assert
    expect([read.code, read.events]).toEqual([DSR_EXIT.refusedOrFailed, ['read', 'held']]);
    expect([unreadable.code, unreadable.events]).toEqual([DSR_EXIT.usage, ['read']]);
  });
});
