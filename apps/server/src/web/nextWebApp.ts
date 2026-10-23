/**
 * nextWebApp — loads the Next.js app (apps/web) into the server process.
 *
 * Why: Express stays the single front door (D-068), so the web pages share its origin, cookies stay `__Host-` and
 *      ltijs's same-origin checks hold. Next.js is imported only when `WEB_APP` is `dev` or `prod`, so integration
 *      tests and tools that run with `off` never load it.
 * Spec: UD-030, DATA-011
 * Invariants:
 *   - Telemetry is off before Next.js loads (`NEXT_TELEMETRY_DISABLED`): no request leaves for nextjs.org.
 *   - `prod` serves the build in apps/web/.next (`npm run build`); it fails at start-up when there is none.
 *   - `close()` releases the dev server's watchers; production has none.
 * Collaborators: ./webRoutes.ts, ../server/main.ts, apps/web/next.config.mjs.
 * Tests: apps/server/test/web/webApp.browser.int.test.ts
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { fileURLToPath } from 'node:url';

/** The web app's folder (apps/web). */
export const WEB_APP_DIR = fileURLToPath(new URL('../../../web', import.meta.url));

/** The part of Next.js's custom-server API we use (`next({ dev, dir })`). */
interface NextServerFactory {
  (options: { dev: boolean; dir: string; quiet: boolean }): {
    prepare(): Promise<void>;
    getRequestHandler(): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
    getUpgradeHandler(): (req: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void>;
    close(): Promise<void>;
  };
}

// WHY: a computed specifier keeps Next.js's global type augmentations (e.g. a read-only `process.env.NODE_ENV`) out
// of the server's compilation; the factory's shape is declared above.
const NEXT_MODULE: string = 'next';

/** A loaded web app. */
export interface WebApp {
  /** Whether it runs Next.js's development server. */
  readonly dev: boolean;
  /** Answers one request. */
  handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
  /** Answers a WebSocket upgrade (the development server's hot reload). */
  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void>;
  /** Stops watchers. */
  close(): Promise<void>;
}

/**
 * Loads and prepares the web app.
 * @param mode - `dev` for Next.js's development server, `prod` for the built app.
 * @param dir - The app's folder; apps/web by default.
 * @returns The prepared app.
 */
export async function loadWebApp(mode: 'dev' | 'prod', dir: string = WEB_APP_DIR): Promise<WebApp> {
  // PRIVACY: Next.js reports anonymous usage to its vendor unless this is set before it loads.
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  const { default: next } = (await import(NEXT_MODULE)) as { default: NextServerFactory };
  const dev = mode === 'dev';
  const app = next({ dev, dir, quiet: !dev });
  await app.prepare();
  const handle = app.getRequestHandler();
  const upgrade = app.getUpgradeHandler();
  return {
    dev,
    handle: (req, res) => handle(req, res),
    upgrade: (req, socket, head) => upgrade(req, socket, head),
    close: () => app.close(),
  };
}
