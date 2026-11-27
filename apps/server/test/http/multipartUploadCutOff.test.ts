/**
 * Tests of an upload whose body ends inside a part that nobody reads: a file under another field name, which the
 * reader itself discards, and a second file, a text field past the field limit and a part past the part limit,
 * which the parser skips before the reader sees them. The request must be refused with 400, leave no folder, and
 * raise no fault outside the request, because an uncaught fault stops the server (src/server/processFaults.ts).
 * The first case holds by the reader's own listener; the last one holds since @fastify/busboy 3.2.6 (D-148).
 *
 * Spec: SEC-005
 */
import { once } from 'node:events';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { connect, type AddressInfo, type Socket } from 'node:net';
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

/** Bodies that stop before their last part ends. The reader discards the first one's part, the parser the others'. */
const CUT_OFF_BODIES: readonly (readonly [string, string])[] = [
  ['a file under another field name', `${fileStart('other', 'a.png')}cut off`],
  ['a second file', `${fileStart('file', 'a.png')}abc\r\n${fileStart('file', 'b.png')}cut off`],
  [
    'a text field past the field limit',
    `${fields(MAX_UPLOAD_FIELDS)}${field('last', 'cut off').slice(0, -2)}`,
  ],
  ['a part past the part limit', `${fields(MAX_UPLOAD_PARTS)}${fileStart('file', 'a.png')}cut off`],
];

/** Bytes held back for the second piece, the pause before it, and how long a request may take in all. */
const LAST_PIECE = 3;
const PAUSE_MS = 60;
const ANSWER_WITHIN_MS = 5000;

interface Outcome {
  status: number;
  key?: string;
  left: string[];
  faults: unknown[];
  /** Whether the server had read the first piece, and only that, when the second was sent. */
  inTwoPieces: boolean;
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
  process.on('uncaughtException', onFault).on('unhandledRejection', onFault);
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
  let serverSide: Socket | undefined;
  server.on('connection', (socket) => void (serverSide = socket));
  let socket: Socket | undefined;
  try {
    await once(server, 'listening');
    const first =
      `POST /u HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n` +
      `Content-Type: multipart/form-data; boundary=${BOUNDARY}\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n` +
      body.slice(0, -LAST_PIECE);
    socket = connect((server.address() as AddressInfo).port, '127.0.0.1');
    socket.setTimeout(ANSWER_WITHIN_MS, () => socket?.destroy());
    let answer = '';
    socket.on('data', (chunk: Buffer) => void (answer += chunk.toString('latin1')));
    socket.write(first);
    await delay(PAUSE_MS);
    const inTwoPieces = serverSide?.bytesRead === Buffer.byteLength(first);
    // WHY: `write`, not `end`: the request is complete by its Content-Length, and the server closes after answering.
    socket.write(body.slice(-LAST_PIECE));
    await once(socket, 'close');
    const status = Number(/^HTTP\/1\.1 (\d{3})/.exec(answer)?.[1]);
    return { status, ...(key ? { key } : {}), left: readdirSync(dir), faults, inTwoPieces };
  } finally {
    socket?.destroy();
    server.closeAllConnections();
    server.close();
    process.off('uncaughtException', onFault).off('unhandledRejection', onFault);
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('[SEC-005] an upload that ends inside a part that nobody reads', () => {
  it.each(CUT_OFF_BODIES)(
    '[SEC-005] a body that ends inside %s is refused with 400, and no fault leaves the request',
    async (_what, body) => {
      // Act
      const outcome = await sent(body);
      // Assert: the body did arrive in two pieces; it is refused, nothing is left on disk, and nothing reached
      // the process's fault handlers
      expect(outcome.inTwoPieces).toBe(true);
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
