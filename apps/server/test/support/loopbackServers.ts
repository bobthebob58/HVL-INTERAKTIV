/**
 * loopbackServers — starts an Express app on a free port of 127.0.0.1 for a browser test to open, and stops every
 * server it started.
 *
 * Why: the browser tests reach the app under test over HTTP, and each file listened, waited for the port and built
 *      the address the same way; one helper keeps the address and the cleanup alike.
 * Spec: NFR-004
 * Invariants:
 *   - A server listens on 127.0.0.1 only, on a port the system picks, so parallel runs never collide.
 *   - `closeLoopbackServers` stops every server the test file started and resolves even if one was not running;
 *     call it in the `afterAll` of the block that started them.
 * Collaborators: Express `app.listen`; used beside `describeWithBrowser` from ./browser.ts.
 * Tests: used by the browser tests that serve an app, such as apps/server/test/http/player.browser.int.test.ts,
 *   apps/server/test/h5p/editorPage.browser.int.test.ts and apps/server/test/web/webPages.browser.int.test.ts.
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

const running: Server[] = [];

/**
 * Starts `app` on a free port of 127.0.0.1.
 * @param app - The Express app under test.
 * @returns Its base URL, `http://127.0.0.1:<port>`; stop it with `closeLoopbackServers`.
 */
export async function listenOnLoopback(app: Express): Promise<string> {
  const server = app.listen(0, '127.0.0.1');
  running.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Stops every server `listenOnLoopback` started (call in `afterAll`). */
export async function closeLoopbackServers(): Promise<void> {
  await Promise.all(running.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
}
