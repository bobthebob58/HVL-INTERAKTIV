/**
 * Tests for log redaction: no personal data or credentials reach the log output.
 *
 * Spec: DATA-009, NFR-006
 */
import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import { createLogger } from '../../src/logging/logger.js';
import { isSensitiveKey, redactPersonalData } from '../../src/logging/redactPersonalData.js';
import { REDACTED, redactText } from '../../src/logging/redactText.js';
import { PrismaClientValidationError } from '@prisma/client/runtime/client';

/** A fixture with every kind of sensitive field DATA-009 names, nested as libraries really log them. */
const SENSITIVE = {
  req: {
    method: 'GET',
    url: '/lti/launch?ltik=eyJhbGciOiJIUzI1NiJ9.abc.def&x=1',
    headers: { authorization: 'Bearer eyJabc', cookie: 'sid=s3cr3t' },
  },
  user: {
    name: 'Kari Nordmann',
    email: 'kari@hvl.no',
    sub: 'lti-user-123',
    feideId: 'kari@hvl.no',
    feide_affiliation: ['student'],
  },
  token: { id_token: 'eyJhbGciOi.payload.sig', 'Set-Cookie': 'sid=abc' },
  statement: { verb: 'answered', response: 'Mitt svar er Bergen', scoreRaw: 1 },
};

const capture = (): { lines: string[]; stream: Writable } => {
  const lines: string[] = [];
  const stream = new Writable({ write: (chunk, _enc, done) => (lines.push(String(chunk)), done()) });
  return { lines, stream };
};

describe('[DATA-009] log redaction', () => {
  it('[DATA-009] redacts every DATA-009 key at any depth and keeps harmless fields', () => {
    // Act
    const out = JSON.stringify(redactPersonalData(SENSITIVE));
    // Assert: no sensitive value survives, and the harmless fields do
    for (const leaked of [
      'Kari',
      'kari@hvl.no',
      'lti-user-123',
      's3cr3t',
      'eyJabc',
      'Bergen',
      'payload.sig',
      'student',
    ]) {
      expect(out, leaked).not.toContain(leaked);
    }
    expect(out).toContain('"verb":"answered"');
    expect(out).toContain('"scoreRaw":1');
    expect(out).toContain('ltik=[Redacted]&x=1');
  });

  it('[DATA-009] matches keys case-insensitively and any key that starts with feide', () => {
    // Act and assert: sensitive keys, in any case
    for (const key of [
      'Authorization',
      'ID_TOKEN',
      'idToken',
      'feideId',
      'FeideAffiliation',
      'given_name',
      'ltiSub',
    ]) {
      expect(isSensitiveKey(key), key).toBe(true);
    }
    // Act and assert: harmless keys
    for (const key of ['machineName', 'contentId', 'subContentId', 'learnerKey', 'verb']) {
      expect(isSensitiveKey(key), key).toBe(false);
    }
  });

  it('[DATA-009] does not mutate the input and survives cycles and shared objects', () => {
    const shared = { ok: 1 };
    const input: Record<string, unknown> = { email: 'a@b.no', a: shared, b: shared };
    input.self = input;
    const out = redactPersonalData(input) as Record<string, unknown>;
    expect(input.email).toBe('a@b.no');
    expect(out).toMatchObject({ email: REDACTED, a: { ok: 1 }, b: { ok: 1 }, self: '[Circular]' });
  });
});

describe('[NFR-006] structured logger output', () => {
  it('[NFR-006] writes JSON lines without personal data from records, bindings, messages and errors', () => {
    // Arrange: a child logger bound to an ltik
    const { lines, stream } = capture();
    const log = createLogger({ level: 'info', destination: stream }).child({
      ltik: 'secret-ltik',
      route: '/play',
    });
    // Act: log a sensitive record, then an error that carries personal data
    log.info(SENSITIVE, 'launch from /lti?ltik=abc.def.ghi with Bearer xyz.123');
    const error = Object.assign(new Error('token Bearer abc.def rejected'), { email: 'kari@hvl.no' });
    log.error({ err: error }, 'failed');
    // Assert
    const output = lines.join('');
    for (const leaked of ['secret-ltik', 'abc.def.ghi', 'xyz.123', 'kari@hvl.no', 'Kari', 'Bearer abc.def']) {
      expect(output, leaked).not.toContain(leaked);
    }
    const first = JSON.parse(lines[0] ?? '{}');
    expect(first).toMatchObject({ level: 'info', service: 'hvl-interaktiv-server', route: '/play' });
    expect(JSON.parse(lines[1] ?? '{}').err).toMatchObject({ type: 'Error', email: REDACTED });
  });
});

describe('[DATA-009] redaction of messages, format arguments and error text', () => {
  const run = (write: (log: ReturnType<typeof createLogger>) => void): string => {
    const { lines, stream } = capture();
    write(createLogger({ level: 'info', destination: stream }));
    return lines.join('');
  };

  it('[DATA-009] redacts msg when an Error is logged without a message', () => {
    const out = run((log) => {
      log.error(new Error('GET /lti?ltik=abc.def failed'));
      log.warn({ err: new Error('rejected Bearer xyz.123') });
      log.child({ a: 1 }).child({ b: 2 }).error(new Error('child bearer qqq.www'));
    });
    for (const leaked of ['abc.def', 'xyz.123', 'qqq.www']) expect(out, leaked).not.toContain(leaked);
    expect(JSON.parse(out.split('\n')[0] ?? '{}').msg).toBe('GET /lti?ltik=[Redacted] failed');
  });

  it('[DATA-009] redacts objects passed as printf-style format arguments', () => {
    const out = run((log) => {
      log.info('user %j', { email: 'kari@hvl.no', name: 'Kari' });
      log.info({ route: '/x' }, 'token %o', { idToken: 'tok-123' });
    });
    for (const leaked of ['kari@hvl.no', 'Kari', 'tok-123']) expect(out, leaked).not.toContain(leaked);
  });

  it('[DATA-009] masks identifiers and credentials inside free text', () => {
    const text = redactText(
      'authorization: bearer abc.def; jwt eyJhbGciOi.eyJzdWIiOi.c2ln; redis://default:hunter2@cache:6379; mail kari@hvl.no; ltik=zzz',
    );
    for (const leaked of ['abc.def', 'eyJhbGciOi', 'hunter2', 'kari@hvl.no', 'zzz'])
      expect(text, leaked).not.toContain(leaked);
    expect(text).toContain('redis://[Redacted]@cache:6379');
  });

  it('[DATA-009] redacts the raw LTI subject under the project field name', () => {
    const out = JSON.stringify(
      redactPersonalData({
        source: { kind: 'lti', issuer: 'https://canvas.example', subject: 'lti-sub-456' },
      }),
    );
    expect(out).not.toContain('lti-sub-456');
    expect(isSensitiveKey('subjectHash')).toBe(false);
    for (const key of ['subject', 'token', 'x-api-key', 'client_assertion', 'credentials'])
      expect(isSensitiveKey(key), key).toBe(true);
  });

  it('[DATA-009] logs Prisma errors by code only, without the query values they render', () => {
    // Arrange: a Prisma error whose message renders the query values
    const message =
      'Invalid `prisma.user.create()` invocation:\n  data: { email: "kari@hvl.no", displayName: "Kari Nordmann" }';
    const error = new PrismaClientValidationError(message, { clientVersion: '7.10.1' });
    // Act and assert: redaction keeps only the type, code and meta
    expect(redactPersonalData({ cause: error })).toEqual({
      cause: {
        type: 'PrismaClientValidationError',
        code: undefined,
        meta: { modelName: undefined, target: undefined },
      },
    });
    // Act and assert: the logged line holds none of the query values
    const out = run((log) => log.error({ err: error }, 'insert failed'));
    for (const leaked of ['kari@hvl.no', 'Kari Nordmann']) expect(out, leaked).not.toContain(leaked);
  });

  it('[DATA-009] never logs the raw request text a body parser attaches to its error', () => {
    const error = Object.assign(new SyntaxError('Unexpected token'), {
      status: 400,
      type: 'entity.parse.failed',
      body: 'data={"svar":"Byen er Oslo","fornavn":"Kari Nordmann"}',
    });
    const out = run((log) => log.error({ err: error }, 'request failed'));
    for (const leaked of ['Kari Nordmann', 'Byen er Oslo']) expect(out, leaked).not.toContain(leaked);
  });
});
