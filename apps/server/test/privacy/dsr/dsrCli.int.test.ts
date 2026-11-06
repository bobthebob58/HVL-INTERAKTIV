/**
 * Integration tests for the data-subject CLI on PostgreSQL (DATA-008, D-108's amendment of 2026-11-04): the usage and
 * exit codes, the data subject read from standard input and never printed back, the export on standard output with its
 * summary on standard error, the erasure's dry run by default, a refusal, and `--confirm`: rows written while the
 * erasure ran exit 3, and a second run deletes them.
 *
 * Spec: DATA-008, DATA-009
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { identitySource } from '../../../src/auth/identity/subjectSources.js';
import type { Database } from '../../../src/infra/prismaClient.js';
import { deriveLearnerKey } from '../../../src/privacy/deriveLearnerKey.js';
import { DSR_EXIT, DSR_USAGE, runDsrCli } from '../../../src/privacy/dsr/dsrCli.js';
import { SUBJECT_EXPORT_FORMAT } from '../../../src/privacy/dsr/subjectExport.js';
import { describeWithServices } from '../../support/services.js';
import { openDsrFixture, type DsrFixture } from './support/dsrFixture.js';

const NOTHING = {
  gradeSyncJobs: 0,
  xapiStatements: 0,
  h5pUserData: 0,
  learnerIdentities: 0,
  learnerUsers: 0,
};

/** The database, except that `meanwhile` runs right after the erasure deletes the accounts. */
const withWritesDuringErasure = (db: Database, meanwhile: () => Promise<void>): Database =>
  new Proxy(db, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop);
      if (prop !== 'user') {
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      }
      const deleteMany = target.user.deleteMany.bind(target.user) as (...a: unknown[]) => Promise<unknown>;
      return new Proxy(target.user, {
        get: (users, method) =>
          method === 'deleteMany'
            ? async (...args: unknown[]) => {
                const deleted = await deleteMany(...args);
                await meanwhile();
                return deleted;
              }
            : (Reflect.get(users, method) as unknown),
      });
    },
  });

describeWithServices('[DATA-008] the data-subject CLI', () => {
  let fx: DsrFixture;
  beforeAll(async () => {
    fx = await openDsrFixture();
  });
  afterAll(() => fx.close());

  /** Runs the CLI with `input` on standard input; returns the exit code and what it printed. */
  const cli = async (argv: string[], input: string, db: Database = fx.db) => {
    const out: string[] = [];
    const err: string[] = [];
    const readSubject = vi.fn(() => Promise.resolve(input));
    const code = await runDsrCli(argv, {
      ...fx.deps,
      db,
      readSubject,
      write: (text) => void out.push(text),
      warn: (line) => void err.push(line),
    });
    return { code, out: out.join(''), err: err.join('\n'), read: readSubject.mock.calls.length };
  };
  const kariInput = () =>
    JSON.stringify({
      feideId: `  ${fx.kari.feideId?.toUpperCase() ?? ''} `,
      lti: [{ issuer: fx.kari.lti[0]?.issuer, sub: fx.kari.lti[0]?.subject }],
    });
  const identifiers = () => [fx.kari.feideId ?? '', fx.kari.lti[0]?.subject ?? ''];

  it.each([
    [[]],
    [['export']],
    [['delete', '--operator', 'a@hvl.no']],
    [['export', '--operator', 'a@hvl.no', '--confirm']],
  ])(
    '[DATA-008] the CLI prints its usage and exits 2 for %j, without reading standard input',
    async (argv) => {
      // Act
      const result = await cli(argv, kariInput());
      // Assert
      expect(result).toEqual({ code: DSR_EXIT.usage, out: '', err: DSR_USAGE, read: 0 });
    },
  );

  it('[DATA-008] an unreadable data subject exits 2 and is never printed back', async () => {
    // Act
    const broken = await cli(
      ['export', '--operator', fx.operator.feideId],
      `{"feideId": "${fx.kari.feideId ?? ''}"`,
    );
    const unknown = await cli(
      ['export', '--operator', fx.operator.feideId],
      `{"${fx.kari.feideId ?? ''}": 1}`,
    );
    // Assert
    expect([broken.code, unknown.code]).toEqual([DSR_EXIT.usage, DSR_EXIT.usage]);
    expect(broken.err).toBe('the data subject is not readable: standard input is not one JSON object');
    expect(unknown.err).toBe(
      'the data subject is not readable: only the fields "feideId" and "lti" are allowed',
    );
    for (const value of identifiers()) expect(broken.err + unknown.err).not.toContain(value);
  });

  it('[DATA-008] export prints the document on standard output and a summary without identifiers on standard error', async () => {
    // Act
    const result = await cli(['export', `--operator=${fx.operator.feideId}`], kariInput());
    // Assert: the Feide ID typed in capitals with spaces finds the same rows as at login (D-054).
    expect(result.code).toBe(DSR_EXIT.done);
    const document = JSON.parse(result.out) as { format: string; xapiStatements: unknown[] };
    expect([document.format, document.xapiStatements.length]).toEqual([SUBJECT_EXPORT_FORMAT, 5]);
    expect(JSON.parse(result.err)).toMatchObject({
      action: 'export',
      counts: { xapiStatements: 5, authEvents: 1 },
    });
    for (const value of identifiers()) expect(result.out + result.err).not.toContain(value);
  });

  it('[DATA-008] erase without --confirm prints the dry run’s summary and deletes nothing', async () => {
    // Act
    const result = await cli(['erase', '--operator', fx.operator.feideId], kariInput());
    // Assert
    expect([result.code, result.err]).toEqual([DSR_EXIT.done, '']);
    expect(JSON.parse(result.out)).toMatchObject({
      action: 'erase',
      dryRun: true,
      counts: { xapiStatements: 5 },
    });
    expect(await fx.rowsOf(fx.kari)).toEqual({ xapiStatements: 5, h5pUserData: 3, gradeSyncJobs: 2 });
  });

  it('[DATA-008] a request by someone who is not an HVL admin exits 1 and names only the audited request ID', async () => {
    // Act
    const result = await cli(['erase', '--operator', 'not-listed@hvl.no', '--confirm'], kariInput());
    // Assert
    expect([result.code, result.out]).toEqual([DSR_EXIT.refusedOrFailed, '']);
    expect(result.err).toContain(`audited as request ${fx.requestIds.at(-1) ?? 'none'}`);
    expect(await fx.rowsOf(fx.kari)).toEqual({ xapiStatements: 5, h5pUserData: 3, gradeSyncJobs: 2 });
  });

  it('[DATA-008] erase --confirm deletes; rows written while it ran exit 3, and a second run deletes them', async () => {
    // Arrange: Kari logs in with Feide again and plays just as the erasure deletes her accounts.
    const feideId = fx.kari.feideId ?? '';
    const loginAndPlay = async () => {
      const { hash, keyId } = fx.deps.hasher.hash(
        'identity-subject',
        identitySource({ kind: 'feide', feideId }),
      );
      const identity = { provider: 'feide' as const, subjectHash: hash, subjectKeyId: keyId };
      await fx.db.user.create({ data: { kind: 'learner', identities: { create: identity } } });
      await fx.db.xapiStatement.create({
        data: {
          contentId: fx.contentId,
          contentVersion: 1,
          learnerKey: deriveLearnerKey({ kind: 'feide', feideId }, fx.deps.secrets, fx.deps.now),
          verb: 'attempted',
          attemptId: `${randomUUID()}:1`,
          timestamp: fx.deps.now,
          academicYear: 2041,
        },
      });
    };
    const erase = ['erase', '--operator', fx.operator.feideId, '--confirm'];
    // Act
    const first = await cli(erase, kariInput(), withWritesDuringErasure(fx.db, loginAndPlay));
    const second = await cli(erase, kariInput());
    // Assert: the first run's recount finds the new account through its identity, not only the old accounts.
    expect([first.code, second.code]).toEqual([DSR_EXIT.rowsRemain, DSR_EXIT.done]);
    expect(first.err).toBe('rows were written under the keys while the erasure ran; run the erasure again');
    const meanwhile = { ...NOTHING, xapiStatements: 1, learnerIdentities: 1, learnerUsers: 1 };
    expect(JSON.parse(first.out)).toMatchObject({
      dryRun: false,
      counts: { gradeSyncJobs: 2, xapiStatements: 5, h5pUserData: 3, learnerIdentities: 2, learnerUsers: 1 },
      remaining: meanwhile,
    });
    expect(JSON.parse(second.out)).toMatchObject({ dryRun: false, counts: meanwhile, remaining: NOTHING });
    expect(await fx.rowsOf(fx.kari)).toEqual({ xapiStatements: 0, h5pUserData: 0, gradeSyncJobs: 0 });
  });
});
