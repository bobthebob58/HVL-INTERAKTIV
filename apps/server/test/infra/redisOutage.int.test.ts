/**
 * Tests of the Redis client while Redis cannot be reached (D-144): a command is refused at once, none is kept to be
 * sent later, and the client works again when Redis is back. A small relay stands in front of the real Redis so the
 * test can cut the connection and restore it.
 *
 * Spec: H5P-004, LTI-011, NFR-002
 */
import { createServer, connect, type Server, type Socket } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import { XapiRateLimit } from '../../src/xapi/XapiRateLimit.js';
import { serviceEnv } from '../support/services.js';

const KEY = `hvli:test:redis-outage:${process.pid}`;
const XAPI_KEYS = [`hvli:xapi:outage-${process.pid}:c`, `hvli:xapi-day:outage-${process.pid}:c`];

/** A TCP relay to the real Redis that can be cut and restored on the same port. */
class Relay {
  private server: Server | undefined;
  private readonly sockets = new Set<Socket>();
  port = 0;

  constructor(private readonly target: URL) {}

  async open(): Promise<void> {
    if (this.server) return;
    this.server = createServer((client) => {
      const upstream = connect(Number(this.target.port || 6379), this.target.hostname);
      for (const socket of [client, upstream]) {
        this.sockets.add(socket);
        socket.on('error', () => undefined).on('close', () => this.sockets.delete(socket));
      }
      client.pipe(upstream).pipe(client);
    });
    const server = this.server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject).listen(this.port, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (address && typeof address === 'object') this.port = address.port;
  }

  async cut(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    this.server = undefined;
  }
}

const until = async (condition: () => boolean, ms = 5000): Promise<void> => {
  for (const end = Date.now() + ms; !condition() && Date.now() < end;) await delay(20);
  if (!condition()) throw new Error('the condition did not come true in time');
};

/** How a command ended within `ms`: answered, refused, or still waiting. */
const outcomeWithin = (command: Promise<unknown>, ms: number): Promise<string> =>
  Promise.race([
    command.then(
      () => 'answered',
      () => 'refused',
    ),
    delay(ms).then(() => 'waiting'),
  ]);

describe('[H5P-004] the Redis client while Redis cannot be reached', () => {
  let relay: Relay | undefined;
  let redis: Redis | undefined;

  afterEach(async () => {
    await relay?.open().catch(() => undefined);
    if (redis) {
      await until(() => redis?.isReady === true).catch(() => undefined);
      await redis.del([KEY, ...XAPI_KEYS]).catch(() => undefined);
      await redis.disconnect().catch(() => undefined);
    }
    await relay?.cut();
  });

  it('[H5P-004][LTI-011][NFR-002] a command, a transaction, a script and a ping are refused at once', async () => {
    // Arrange
    relay = new Relay(new URL(serviceEnv().REDIS_URL));
    await relay.open();
    const client = (redis = await connectRedis(`redis://127.0.0.1:${relay.port}`));
    const limit = new XapiRateLimit(client);
    await client.set(KEY, '1');
    // Act: cut the connection, then send one command of each kind
    await relay.cut();
    await until(() => !client.isReady);
    const started = performance.now();
    const outcomes = await Promise.all(
      [
        client.incr(KEY),
        limit.take(`outage-${process.pid}`, 'c', 1),
        client.multi().incr(KEY).exec(),
        client.eval('return 1', { keys: [KEY], arguments: [] }),
        client.ping(),
      ].map((command) => outcomeWithin(command, 2000)),
    );
    const waitedMs = performance.now() - started;
    // Assert
    expect(outcomes).toEqual(['refused', 'refused', 'refused', 'refused', 'refused']);
    expect(waitedMs).toBeLessThan(1000);
  });

  it('[H5P-004][LTI-011] no refused command is sent later, and the client works again when Redis is back', async () => {
    // Arrange
    relay = new Relay(new URL(serviceEnv().REDIS_URL));
    await relay.open();
    const client = (redis = await connectRedis(`redis://127.0.0.1:${relay.port}`));
    const limit = new XapiRateLimit(client);
    await client.set(KEY, '1');
    await relay.cut();
    await until(() => !client.isReady);
    const during = [
      client.incr(KEY),
      client.multi().incr(KEY).exec(),
      limit.take(`outage-${process.pid}`, 'c', 5),
    ];
    for (const command of during) command.catch(() => undefined);
    // Act
    await relay.open();
    await until(() => client.isReady);
    await delay(200);
    const after = await limit.take(`outage-${process.pid}`, 'c', 1);
    // Assert: the counter and the window hold only what was sent after Redis came back
    expect(await client.get(KEY)).toBe('1');
    expect(await client.get(XAPI_KEYS[0] ?? '')).toBe('1');
    expect(after).toEqual({ allowed: true });
    expect(await Promise.all(during.map((command) => outcomeWithin(command, 500)))).toEqual([
      'refused',
      'refused',
      'refused',
    ]);
  });
});
