/**
 * bridgeDocument — opens a simulated player document (jsdom) with H5P's dispatcher, the bridge's configuration and a
 * recording stand-in for `fetch`, runs the three bridge scripts in it, and reads probe P1's recorded statements.
 *
 * Why: the bridge's tests (LTI-010) drive its 2-second timer, H5P's events and the server's answers by hand, so each
 *      test states behaviour rather than plumbing; P1's fixtures (apps/server/test/fixtures/xapi/) hold what the ten
 *      real types send in our player, which the rules must classify as D-115 says.
 * Spec: LTI-010
 * Invariants:
 *   - Scripts run only through `window.eval` of the package's own files, in the player's order.
 *   - The timer never runs by itself: `tick()` is the bridge's 2-second interval; answers come only from `answer()`.
 * Collaborators: ../../src/xapiStatements.js, ../../src/xapiBatching.js, ../../src/xapiBridge.js.
 * Tests: packages/hvl-h5p-theme/test/xapiBridge.test.ts, packages/hvl-h5p-theme/test/xapiBridgeSending.test.ts,
 *   packages/hvl-h5p-theme/test/xapiStatements.test.ts
 */
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const source = (name: string) => readFileSync(new URL(`../../src/${name}`, import.meta.url), 'utf8');
/** The bridge's scripts, in the player's order. */
export const BRIDGE_SCRIPTS = ['xapiStatements.js', 'xapiBatching.js', 'xapiBridge.js'].map(source);
/** The activity of every simulated page. */
export const CONTENT_ID = '0192f0c4-0000-7000-8000-0000000000aa';

/** An xAPI statement as H5P dispatches it (loosely typed: the tests also send malformed ones). */
export type Statement = Record<string, unknown>;

/** One request the bridge made. */
export interface SentRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly keepalive: boolean;
  readonly credentials: string;
  readonly body: { contentId: string; contentVersion: number; statements: Record<string, unknown>[] };
  readonly bytes: number;
}

/** Options of `openBridgeDocument`; every one has a learner's default. */
export interface BridgeOptions {
  /** The configuration block's JSON; null for none. */
  readonly config?: Record<string, unknown> | null;
  readonly mainLibrary?: string;
  /** `H5P.isFramed` and `H5P.externalEmbed`, which the test may change later through `h5p`. */
  readonly isFramed?: boolean;
  readonly frameClass?: string;
}

/** The learner's configuration in the portal. */
export const portalConfig = (): Record<string, unknown> => ({
  endpoint: '/api/h5p/xapi',
  contentId: CONTENT_ID,
  contentVersion: 2,
  token: { name: 'csrf', value: 'csrf-token-1' },
});

/**
 * Opens a player document and runs the bridge.
 * @param options - Configuration, main library, framing.
 * @returns Controls: `dispatch` an H5P event, `tick` the timer, `pagehide`, `answer` a request, `settle` promises.
 */
export function openBridgeDocument(options: BridgeOptions = {}) {
  const config = options.config === undefined ? portalConfig() : options.config;
  const block = config
    ? `<script type="application/json" id="hvl-xapi-bridge">${JSON.stringify(config)}</script>`
    : '';
  const dom = new JSDOM(`<!doctype html><html><head>${block}</head><body></body></html>`, {
    url: 'https://interaktiv.hvl.no/h5p/play/x',
    runScripts: 'outside-only',
    virtualConsole: new VirtualConsole(),
  });
  const window = dom.window as unknown as Record<string, unknown>;
  const listeners: ((event: unknown) => void)[] = [];
  const h5p = {
    isFramed: options.isFramed ?? true,
    externalEmbed: undefined as unknown,
    externalDispatcher: {
      on: (type: string, fn: (event: unknown) => void) => type === 'xAPI' && listeners.push(fn),
    },
  };
  window.H5P = h5p;
  window.H5PIntegration = {
    contents: { [`cid-${CONTENT_ID}`]: { library: options.mainLibrary ?? 'H5P.MultiChoice 1.16' } },
  };
  if (options.frameClass !== undefined) {
    const frame = dom.window.document.createElement('iframe');
    frame.className = options.frameClass;
    Object.defineProperty(dom.window, 'frameElement', { get: () => frame });
  }
  const ticks: (() => void)[] = [];
  window.setInterval = (fn: () => void) => ticks.push(fn);
  const requests: SentRequest[] = [];
  const answers: ((outcome: { status: number | null; retryAfter?: string }) => void)[] = [];
  window.fetch = (
    url: string,
    init: { headers: Record<string, string>; body: string; keepalive: boolean; credentials: string },
  ) => {
    requests.push({
      url,
      headers: init.headers,
      keepalive: init.keepalive,
      credentials: init.credentials,
      body: JSON.parse(init.body) as SentRequest['body'],
      bytes: Buffer.byteLength(init.body, 'utf8'),
    });
    return new Promise((resolve, reject) =>
      answers.push(({ status, retryAfter }) =>
        status === null
          ? reject(new TypeError('network'))
          : resolve({
              status,
              headers: { get: (name: string) => (name === 'Retry-After' ? (retryAfter ?? null) : null) },
            }),
      ),
    );
  };
  for (const script of BRIDGE_SCRIPTS) dom.window.eval(script);
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return {
    dom,
    h5p,
    requests,
    /** Raises H5P's `xAPI` event with this statement in the document. */
    dispatch: (statement: Statement) => listeners.forEach((fn) => fn({ data: { statement } })),
    /** Runs the bridge's 2-second interval once. */
    tick: () => ticks.forEach((fn) => fn()),
    /** Raises `pagehide`. */
    pagehide: () => dom.window.dispatchEvent(new dom.window.Event('pagehide')),
    /** Answers request `index` (null status: a network error), then lets the bridge settle it. */
    answer: async (index: number, status: number | null, retryAfter?: string) => {
      answers[index]?.({ status, ...(retryAfter === undefined ? {} : { retryAfter }) });
      await settle();
    },
    listening: () => listeners.length,
    settle,
  };
}

/**
 * P1's recorded statements of one type, with the simulated activity's ID in place of the placeholder.
 * @param type - The main library's machine name, e.g. `H5P.QuestionSet`.
 * @returns The main library (`H5P.QuestionSet 1.21`) and the statements with their view and step, in dispatch order.
 */
export function p1Fixture(type: string): {
  library: string;
  statements: { view: number; step: string; statement: Statement }[];
} {
  const url = new URL(`../../../../apps/server/test/fixtures/xapi/${type}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8').split('{{contentId}}').join(CONTENT_ID));
}

/** A minimal H5P statement: `verb` and, by default, the root activity with the main library as category. */
export function statement(verb: string, overrides: Statement = {}): Statement {
  return {
    actor: { name: '', mbox: 'mailto:' },
    verb: { id: `http://adlnet.gov/expapi/verbs/${verb}` },
    object: {
      id: CONTENT_ID,
      definition: { extensions: { 'http://h5p.org/x-api/h5p-local-content-id': CONTENT_ID } },
    },
    context: { contextActivities: { category: [{ id: 'http://h5p.org/libraries/H5P.MultiChoice-1.16' }] } },
    ...overrides,
  };
}
