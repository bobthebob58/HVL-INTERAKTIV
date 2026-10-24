/**
 * Tests for how the logger builds `msg`: object messages, message-less errors, Prisma errors and valid JSON.
 *
 * Spec: DATA-009, NFR-006
 */
import { describe, it, expect } from 'vitest';
import { PrismaClientValidationError } from '@prisma/client/runtime/client';
import { isSensitiveKey, redactPersonalData } from '../../src/logging/redactPersonalData.js';
import { capturedLogger, type CapturedLogger } from '../support/capturedLogger.js';

const run = (write: (log: CapturedLogger['logger']) => void): string[] => {
  const { logger, lines } = capturedLogger();
  write(logger);
  return lines;
};
const prismaError = () =>
  new PrismaClientValidationError('data: { displayName: "Kari Nordmann", answer: "Mitt svar er Bergen" }', {
    clientVersion: '7.10.1',
  });
/** A driver-adapter error as Prisma puts it in `meta.driverAdapterError`. */
const driverError = () =>
  Object.assign(new Error('violates check constraint'), {
    name: 'DriverAdapterError',
    cause: {
      kind: 'postgres',
      originalCode: '23514',
      detail: 'Failing row contains (learner, Kari Nordmann)',
    },
  });

describe('[DATA-009] message building', () => {
  it('[DATA-009] redacts an object passed in the message position', () => {
    const out = run((log) => {
      (log.info as (...a: unknown[]) => void)({ a: 1 }, { name: 'Kari Nordmann', sub: 'lti-sub-999' });
      (log.info as (...a: unknown[]) => void)({ a: 1 }, { name: 'Kari Nordmann' }, 'x');
    }).join('');
    for (const leaked of ['Kari', 'lti-sub-999']) expect(out, leaked).not.toContain(leaked);
  });

  it('[DATA-009] logs Prisma errors without a message by code only, in msg as well as err', () => {
    // Act: a Prisma error in every logging position, and a driver-adapter error in `meta`.
    const out = run((log) => {
      log.error(prismaError());
      log.error({ err: prismaError() });
      log.error({ err: prismaError() }, undefined);
      log.child({ c: 1 }).error(prismaError());
      log.error({ meta: { driverAdapterError: driverError() } }, 'insert failed');
    });
    // Assert
    for (const line of out) {
      for (const leaked of ['Kari', 'Bergen', 'Failing row']) expect(line, leaked).not.toContain(leaked);
    }
    expect(JSON.parse(out[0] ?? '{}').msg).toBe('PrismaClientValidationError');
    expect(JSON.parse(out[4] ?? '{}').meta.driverAdapterError).toEqual({
      type: 'DriverAdapterError',
      kind: 'postgres',
      code: '23514',
    });
  });

  it("[DATA-009] keeps a record's own msg and survives errors whose message is not a string", () => {
    const [first, second] = run((log) => {
      log.error({ err: new Error('boom'), msg: 'explicit message' });
      log.error(Object.assign(new Error('x'), { message: undefined }));
    });
    expect(first?.match(/"msg"/g)).toHaveLength(1);
    expect(JSON.parse(first ?? '{}').msg).toBe('explicit message');
    expect(second).toBeDefined();
  });

  it('[DATA-009] writes Error format arguments as redacted text', () => {
    const [line] = run((log) => log.info('failed: %s', new Error('Bearer abc.def rejected')));
    expect(JSON.parse(line ?? '{}').msg).toBe('failed: Error: Bearer [Redacted] rejected');
  });

  it('[DATA-009] redacts keys by sensitive ending and Feide attribute names', () => {
    // Act and assert: sensitive keys, harmless keys, then a secret nested in an object.
    for (const key of [
      'ltiSubject',
      'userEmail',
      'emailAddress',
      'authToken',
      'api_token',
      'x-auth-token',
      'id_token_hint',
      'S3_SECRET_ACCESS_KEY',
      'https://n.feide.no/claims/nin',
      'norEduPersonNIN',
      'eduPersonPrincipalName',
      'tokenEncrypted',
    ]) {
      expect(isSensitiveKey(key), key).toBe(true);
    }
    for (const key of ['subjectHash', 'learnerKey', 'machineName', 'admin', 'running']) {
      expect(isSensitiveKey(key), key).toBe(false);
    }
    expect(redactPersonalData({ env: { S3_SECRET_ACCESS_KEY: 'test-secret' } })).toEqual({
      env: { S3_SECRET_ACCESS_KEY: '[Redacted]' },
    });
  });
});

describe('[NFR-006] one JSON object per line', () => {
  it('[NFR-006] every line parses, whatever URLs, ltiks and @-signs it carries', () => {
    // Act
    const lines = run((log) => {
      log.warn('redirect to "/app?ltik=abc"');
      log.info({ referer: '<a href="/app/launch?ltik=abc">' });
      log.info({ hub: 'https://hub-api.h5p.org', dependency: { pkg: '@lumieducation/h5p-server' } });
      log.info({ s3: 'http://localhost:5000', owner: { team: 'ops@x' }, library: 'H5P.Blanks' });
    });
    // Assert
    for (const line of lines) expect(() => JSON.parse(line), line).not.toThrow();
    expect(JSON.parse(lines[3] ?? '{}')).toMatchObject({
      s3: 'http://localhost:5000',
      library: 'H5P.Blanks',
    });
  });
});
