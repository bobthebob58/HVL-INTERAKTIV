/**
 * Tests of an upload whose body ends inside a part the reader does not keep: a file under another field name, a
 * second file, a text field past the field limit, or a part past the part limit. The reader discards such a part
 * unread, so nobody waits for it; the request must still be refused with 400, leave no folder, and raise no fault
 * outside the request, because an uncaught fault stops the server (src/server/processFaults.ts).
 *
 * Spec: SEC-005
 */
import { once } from 'node:events';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { connect, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../../src/http/HttpError.js';
import { MAX_UPLOAD_FIELDS, MAX_UPLOAD_PARTS, readMultipart } from '../../src/http/multipartUpload.js';

const BOUNDARY = 'xyz';
const field = (name: string, value: string): string =>
  `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
const fileStart = (name: string, filename: string): string =>
  `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\n\r\n`;
const fields = (count: number): string =>
  Array.from({ length: count }, (_, n) => field(`f${n}`, `${n}`)).join('');

/** Bodies that stop before their last part ends; each last part is one the reader discards. */
const CUT_OFF_BODIES: readonly (readonly [string, string])[] = [
  ['a file under another field name', `${fileStart('other', 'a.png')}cut off`],
  ['a second file', `${fileStart('file', 'a.png')}abc\r\n${fileStart('file', 'b.png')}cut off`],
  [
    'a text field past the field limit',
    `${fields(MAX_UPLOAD_FIELDS)}${field('last', 'cut off').slice(0, -2)}`,
  ],
  ['a part past the part limit', `${fields(MAX_UPLOAD_PARTS)}${fileStart('file', 'a.png')}cut off`],
];

/** Bytes held back for the second piece, and the pause before it: long enough for the first to be parsed. */
const LAST_PIECE = 3;
const PAUSE_MS = 60;

interface Outcome {
  status: number;
  key?: string;
  left: string[];
  faults: unknown[];
}

/**
 * Sends one multipart body to an app that reads an upload, in two pieces with a pause between them, and collects
 * what happened in the process. WHY two pieces: a body that arrives whole is parsed and ended in one go, and the
 * parser then reports nothing for the part it was in; a real upload arrives over time.
 */
async function sent(body: string): Promise<Outcome> {
  const faults: unknown[] = [];
  const onFault = (fault: unknown): void => void faults.push(fault);
  const previous = process.env.TMPDIR;
  const dir = mkdtempSync(join(tmpdir(), 'multipart-cut-off-'));
  process.env.TMPDIR = dir;
  process.on('uncaughtException', onFault);
  let key: string | undefined;
  const app = express().post('/u', async (req, res) => {
    try {
      await (await readMultipart(req, { fileField: 'file', maxFileSize: 1024 })).cleanup();
      res.json({});
    } catch (error) {
      key = error instanceof HttpError ? error.messageKey : undefined;
      res.status(error instanceof HttpError ? error.status : 500).end();
    }
  });
  const server = app.listen(0);
  try {
    await once(server, 'listening');
    const head =
      `POST /u HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n` +
      `Content-Type: multipart/form-data; boundary=${BOUNDARY}\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
    const socket = connect((server.address() as AddressInfo).port, '127.0.0.1');
    let answer = '';
    socket.on('data', (chunk: Buffer) => void (answer += chunk.toString('latin1')));
    socket.write(head + body.slice(0, -LAST_PIECE));
    await delay(PAUSE_MS);
    // WHY: `write`, not `end`: the request is complete by its Content-Length, and the server closes after answering.
    socket.write(body.slice(-LAST_PIECE));
    await once(socket, 'close');
    const status = Number(/^HTTP\/1\.1 (\d{3})/.exec(answer)?.[1]);
    return { status, ...(key ? { key } : {}), left: readdirSync(dir), faults };
  } finally {
    server.close();
    process.off('uncaughtException', onFault);
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('[SEC-005] an upload that ends inside a part the reader does not keep', () => {
  it.each(CUT_OFF_BODIES)(
    '[SEC-005] a body that ends inside %s is refused with 400, and no fault leaves the request',
    async (_what, body) => {
      // Act
      const outcome = await sent(body);
      // Assert: refused, nothing left on disk, and nothing for the process's fault handler
      expect(outcome.faults).toEqual([]);
      expect(outcome.status).toBe(400);
      expect(outcome.key).toBe('error.badRequest');
      expect(outcome.left).toEqual([]);
    },
  );

  it('[SEC-005] the same bodies, ended properly, are answered as before: only the limits decide', async () => {
    // Arrange: each body with its last part and the request closed
    const closed = CUT_OFF_BODIES.map(([what, body]) => [what, `${body}\r\n--${BOUNDARY}--\r\n`] as const);
    // Act
    const outcomes: (readonly [string, Outcome])[] = [];
    for (const [what, body] of closed) outcomes.push([what, await sent(body)]);
    // Assert: a discarded file is no error; past the field or part limit is 400; no fault either way
    const statuses = Object.fromEntries(outcomes.map(([what, outcome]) => [what, outcome.status]));
    expect(statuses).toEqual({
      'a file under another field name': 200,
      'a second file': 200,
      'a text field past the field limit': 400,
      'a part past the part limit': 400,
    });
    expect(outcomes.flatMap(([, outcome]) => outcome.faults)).toEqual([]);
  });
});
