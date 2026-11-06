/**
 * fakeClamd — a TCP server on 127.0.0.1 that speaks clamd's `INSTREAM` protocol, for the malware-scan tests.
 *
 * Why: SEC-006's tests must show what happens when clamd finds EICAR, finds nothing, never answers, answers what no
 *      clamd would (no verdict, or a finding named like a file), reports an error, is gone, or is set up without
 *      `AlertEncrypted` and `AlertExceedsMax`, in every test run and without a real ClamAV. It reads what
 *      clamscan 2.4 sends (`zINSTREAM\0`, then chunks of a 4-byte big-endian length and the data, ended by a
 *      zero-length chunk) and answers as ClamAV 1.4.6 does (`stream: OK\0`, `stream: Eicar-Test-Signature FOUND\0`).
 * Spec: SEC-006
 * Invariants:
 *   - With `alerts` on (the default) it answers the streams a strict clamd cannot scan in full with that clamd's
 *     heuristic (./fakeClamdHeuristics.ts), as the settings probe needs; with `alerts` off it answers them "OK", as a
 *     clamd without those settings does.
 *   - Listens on 127.0.0.1 on a port the system picks. `close()` destroys every open connection and stops listening;
 *     `dropConnections()` destroys the open ones and keeps listening.
 *   - In `silent` mode it reads the whole stream and never answers or closes (a hung clamd); the server is
 *     half-open, so the client's own end does not close it either.
 *   - `streams` holds the bytes of every completed `INSTREAM`, in order; `connections` counts every connection.
 * Collaborators: node:net, ./fakeClamdHeuristics.ts; clamscan's `scanStream` (via
 *   ../../src/security/malware/clamdClient.ts).
 * Tests: used by apps/server/test/security/malware/ (the scanner, its settings probe and the check CLI) and
 *   apps/server/test/http/malwareScan.int.test.ts.
 */
import { createServer, type Server, type Socket } from 'node:net';
import { strictHeuristic } from './fakeClamdHeuristics.js';

/** The EICAR test file: harmless, and reported by every virus scanner (here as `Eicar-Test-Signature`). */
export const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/** A "signature" no clamd database holds: a person's name and a file name, as a rogue service might answer. */
export const ODD_FINDING = 'Kari Nordmann/eksamen 2026.docx';

/** How the fake answers a completed stream. */
export type FakeClamdMode = 'answer' | 'silent' | 'garbage' | 'size-limit' | 'odd-finding';

/** A running fake clamd. */
export interface FakeClamd {
  readonly port: number;
  /** How the next completed stream is answered; may be changed between tests. */
  mode: FakeClamdMode;
  /** Wait this long before answering in `answer` mode (for the parallel-scan test). */
  answerDelayMs: number;
  /** Whether it reports what it cannot scan in full (`AlertEncrypted`, `AlertExceedsMax`); true at first. */
  alerts: boolean;
  /** The bytes of every completed `INSTREAM`, in order. */
  readonly streams: Buffer[];
  /** How many connections were made in all. */
  readonly connections: number;
  /** The most connections that were open at the same time. */
  readonly peakConnections: number;
  /** Destroys the open connections and keeps listening. */
  dropConnections(): void;
  /** Destroys the open connections and stops listening. */
  close(): Promise<void>;
}

const answerFor = (data: Buffer, alerts: boolean): string => {
  if (data.includes(EICAR)) return 'stream: Eicar-Test-Signature FOUND';
  const heuristic = alerts ? strictHeuristic(data) : undefined;
  return heuristic ? `stream: ${heuristic} FOUND` : 'stream: OK';
};

/**
 * Starts a fake clamd.
 * @param mode - How it answers at first (`answer` by default).
 * @returns The running fake; `close()` it in `afterAll`.
 */
export async function startFakeClamd(mode: FakeClamdMode = 'answer'): Promise<FakeClamd> {
  const open = new Set<Socket>();
  const streams: Buffer[] = [];
  const counts = { all: 0, peak: 0 };
  // WHY: `mode`, `answerDelayMs` and `alerts` change between tests; the handlers read them when a stream completes.
  const settings = { mode, answerDelayMs: 0, alerts: true };

  const reply = (socket: Socket, data: Buffer, end: string): void => {
    const send = (text: string): void => void socket.end(`${text}${end}`);
    if (settings.mode === 'silent') return;
    if (settings.mode === 'garbage') return send('HELLO');
    if (settings.mode === 'size-limit') return send('INSTREAM size limit exceeded. ERROR');
    if (settings.mode === 'odd-finding') return send(`stream: ${ODD_FINDING} FOUND`);
    setTimeout(() => send(answerFor(data, settings.alerts)), settings.answerDelayMs);
  };

  const serve = (socket: Socket): void => {
    let pending = Buffer.alloc(0);
    let end: string | undefined;
    const chunks: Buffer[] = [];
    socket.on('data', (data: Buffer) => {
      pending = Buffer.concat([pending, data]);
      if (end === undefined) {
        const stop = pending.findIndex((byte) => byte === 0 || byte === 0x0a);
        if (stop < 0) return;
        const command = pending.subarray(0, stop).toString('latin1');
        pending = pending.subarray(stop + 1);
        if (!/^[zn]INSTREAM$/.test(command)) return void socket.end('UNKNOWN COMMAND\n');
        end = command.startsWith('z') ? '\0' : '\n';
      }
      while (pending.length >= 4) {
        const size = pending.readUInt32BE(0);
        if (size === 0) {
          const stream = Buffer.concat(chunks);
          streams.push(stream);
          return reply(socket, stream, end);
        }
        if (pending.length < 4 + size) return;
        chunks.push(pending.subarray(4, 4 + size));
        pending = pending.subarray(4 + size);
      }
    });
    socket.on('error', () => undefined);
  };

  const server: Server = createServer({ allowHalfOpen: true }, (socket) => {
    counts.all += 1;
    open.add(socket);
    counts.peak = Math.max(counts.peak, open.size);
    socket.on('close', () => open.delete(socket));
    serve(socket);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('fake clamd has no TCP port');
  const dropConnections = () => {
    for (const socket of open) socket.destroy();
  };
  return {
    port: address.port,
    get mode() {
      return settings.mode;
    },
    set mode(next: FakeClamdMode) {
      settings.mode = next;
    },
    get answerDelayMs() {
      return settings.answerDelayMs;
    },
    set answerDelayMs(next: number) {
      settings.answerDelayMs = next;
    },
    get alerts() {
      return settings.alerts;
    },
    set alerts(next: boolean) {
      settings.alerts = next;
    },
    streams,
    get connections() {
      return counts.all;
    },
    get peakConnections() {
      return counts.peak;
    },
    dropConnections,
    close: async () => {
      dropConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/**
 * A TCP port on 127.0.0.1 that nothing listens on (for "connection refused").
 * @returns The port.
 */
export async function closedPort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const address = probe.address();
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  if (address === null || typeof address === 'string') throw new Error('no TCP port');
  return address.port;
}
