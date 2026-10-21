/**
 * Tests for log redaction: no personal data or credentials reach the log output.
 *
 * Spec: DATA-009, NFR-006
 */
import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import { createLogger } from '../../src/logging/logger.js';
import { REDACTED, isSensitiveKey, redactPersonalData } from '../../src/logging/redactPersonalData.js';

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
    const out = JSON.stringify(redactPersonalData(SENSITIVE));
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
    const { lines, stream } = capture();
    const log = createLogger({ level: 'info', destination: stream }).child({
      ltik: 'secret-ltik',
      route: '/play',
    });
    log.info(SENSITIVE, 'launch from /lti?ltik=abc.def.ghi with Bearer xyz.123');
    const error = Object.assign(new Error('token Bearer abc.def rejected'), { email: 'kari@hvl.no' });
    log.error({ err: error }, 'failed');
    const output = lines.join('');
    for (const leaked of ['secret-ltik', 'abc.def.ghi', 'xyz.123', 'kari@hvl.no', 'Kari', 'Bearer abc.def']) {
      expect(output, leaked).not.toContain(leaked);
    }
    const first = JSON.parse(lines[0] ?? '{}');
    expect(first).toMatchObject({ level: 'info', service: 'hvl-interaktiv-server', route: '/play' });
    expect(JSON.parse(lines[1] ?? '{}').err).toMatchObject({ type: 'Error', email: REDACTED });
  });
});
