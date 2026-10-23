/**
 * httpRouter — a small `node:http` router with the response helpers that the mock Feide and the mock Canvas share.
 *
 * Why: the mock platform runs on Node built-ins, `jose` and `oauth2-mock-server` only (D-049). One router keeps
 *      both mocks' routing, HTML escaping, form parsing and shutdown identical and easy to read.
 * Spec: LTI-001, AUTH-001
 * Invariants:
 *   - A route matches on the method and on every path segment; `:name` segments are URL-decoded into `params`,
 *     and a segment that cannot be decoded matches nothing. A request target that is not a URL path gets a 400.
 *   - No request can throw out of the listener: a bad target must not crash the test run or the CLI.
 *   - An unmatched request goes to the fallback listener (oauth2-mock-server's handler) or gets a 404.
 *   - A failing handler answers 500 with a fixed text; request data is never echoed into an error.
 *   - Every response carries `Cache-Control: no-store`; `close()` also ends keep-alive connections, so a test
 *     or the CLI never waits for idle sockets.
 * Collaborators: ./mockFeide.mjs, ./mockCanvas.mjs, ./canvasPages.mjs, ./deepLinkReturn.mjs.
 * Tests: tools/mock-platform/test/mockPlatform.test.mjs (malformed targets); every test in tools/mock-platform/test/
 *   drives these routes over HTTP.
 */
import { createServer } from 'node:http';

const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Builds a router.
 * @param {import('node:http').RequestListener} [fallback] - Listener for requests no route matches.
 * @returns {{add: Function, listener: import('node:http').RequestListener}} `add(methods, pattern, handler)`
 *   registers `handler(req, res, {url, params, query})`; `listener` is passed to `startServer`.
 */
export function createRouter(fallback) {
  const routes = [];
  const add = (methods, pattern, handler) => {
    const segments = pattern.split('/').filter(Boolean);
    for (const method of [methods].flat()) routes.push({ method, segments, handler });
  };
  const listener = (req, res) => {
    // WHY: `new URL` throws for a target such as `//`; thrown here, it would be an uncaught exception.
    const url = URL.parse(req.url ?? '/', 'http://mock.invalid');
    if (!url) return sendText(res, 400, 'Bad request');
    const parts = url.pathname.split('/').filter(Boolean);
    for (const route of routes) {
      const params = matchRoute(route, req.method, parts);
      if (!params) continue;
      Promise.resolve()
        .then(() => route.handler(req, res, { url, params, query: url.searchParams }))
        .catch((error) => failed(res, error));
      return;
    }
    if (fallback) fallback(req, res);
    else sendText(res, 404, 'Not found');
  };
  return { add, listener };
}

function matchRoute(route, method, parts) {
  if (route.method !== method || route.segments.length !== parts.length) return undefined;
  const params = {};
  for (const [index, segment] of route.segments.entries()) {
    if (!segment.startsWith(':')) {
      if (segment !== parts[index]) return undefined;
      continue;
    }
    const value = decodeSegment(parts[index]);
    if (value === undefined) return undefined;
    params[segment.slice(1)] = value;
  }
  return params;
}

/** `decodeURIComponent`, or undefined for a malformed escape such as `%E0%A4%A` (it would throw). */
function decodeSegment(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

function failed(res, error) {
  // WHY: a mock bug must be visible in the test output, but the answer itself stays generic.
  console.error('mock-platform: handler failed:', error instanceof Error ? error.message : error);
  if (res.headersSent) res.end();
  else sendText(res, 500, 'Mock platform error');
}

/**
 * Reads an `application/x-www-form-urlencoded` body.
 * @param {import('node:http').IncomingMessage} req - The request.
 * @returns {Promise<URLSearchParams>} The fields; empty for another content type.
 * @throws {Error} When the body is larger than 1 MiB.
 */
export async function readForm(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('request body too large');
    chunks.push(chunk);
  }
  const form = String(req.headers['content-type'] ?? '').includes('application/x-www-form-urlencoded');
  return new URLSearchParams(form ? Buffer.concat(chunks).toString('utf8') : '');
}

function send(res, status, type, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

/**
 * Sends an HTML page.
 * @param {import('node:http').ServerResponse} res - The response.
 * @param {number} status - HTTP status.
 * @param {string} html - The whole document.
 */
export const sendHtml = (res, status, html) => send(res, status, 'text/html; charset=utf-8', html);

/**
 * Sends plain text.
 * @param {import('node:http').ServerResponse} res - The response.
 * @param {number} status - HTTP status.
 * @param {string} text - The body.
 */
export const sendText = (res, status, text) => send(res, status, 'text/plain; charset=utf-8', text);

/**
 * Sends JSON.
 * @param {import('node:http').ServerResponse} res - The response.
 * @param {number} status - HTTP status.
 * @param {unknown} body - Serialised with `JSON.stringify`.
 * @param {Record<string, string>} [headers] - Extra headers, e.g. `WWW-Authenticate`.
 */
export const sendJson = (res, status, body, headers) =>
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(body), headers);

/**
 * Sends a 302 redirect.
 * @param {import('node:http').ServerResponse} res - The response.
 * @param {string} location - Absolute or relative target.
 */
export const redirect = (res, location) =>
  send(res, 302, 'text/plain; charset=utf-8', '', { Location: location });

/**
 * Escapes text for HTML element content and quoted attribute values.
 * @param {unknown} value - Any value; converted with `String`.
 * @returns {string} The escaped text.
 */
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/**
 * Serialises data for a `<script type="application/json">` element.
 * @param {unknown} value - JSON-serialisable data.
 * @returns {string} JSON in which `<` cannot close the script element.
 */
export const jsonForScript = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

/**
 * Wraps a body in a complete, minimally styled HTML document.
 * @param {string} title - Text for `<title>` (escaped here).
 * @param {string} body - Trusted HTML for `<body>`.
 * @returns {string} The document.
 */
export const htmlDocument = (title, body) =>
  `<!doctype html><html lang="nn"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;color:#1b1b1b}' +
  'header{background:#394b58;color:#fff;padding:.5rem 1rem;font-weight:600}main{padding:1rem}' +
  'iframe.tool{width:100%;height:640px;border:1px solid #c7cdd1}code{word-break:break-all}</style>' +
  `</head><body>${body}</body></html>`;

/**
 * Starts an HTTP server.
 * @param {import('node:http').RequestListener} listener - From `createRouter`.
 * @param {{port?: number, host?: string}} [options] - Port 0 (default) picks a free port; host defaults to 127.0.0.1.
 * @returns {Promise<{server: import('node:http').Server, port: number, close: () => Promise<void>}>} The server.
 */
export async function startServer(listener, { port = 0, host = '127.0.0.1' } = {}) {
  const server = createServer(listener);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const close = () =>
    new Promise((resolve) => {
      if (!server.listening) return resolve();
      server.close(() => resolve());
      server.closeAllConnections();
    });
  return { server, port: server.address().port, close };
}
