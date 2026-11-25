/**
 * Unit tests of the one way ltijs asks a platform for anything (D-141), against small local servers: only the
 * platforms' own origins are asked, a redirect is never followed, a slow or over-large answer is given up, a
 * roster's «next page» link that names another host is not followed, and the requests and answers are those of
 * ltijs's own handler.
 *
 * Spec: LTI-001, LTI-008, NFR-006
 */
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpError } from 'ltijs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LTI_REQUEST_TIMEOUT_MS,
  LTI_RESPONSE_MAX_BYTES,
  LtiOutboundRequests,
  allowedLtiOrigins,
} from '../../../src/lti/http/LtiOutboundRequests.js';
import { httpStatusOf } from '../../../src/lti/nrps/nrpsRosterRead.js';

/** One request a local server received. */
type Seen = { method: string; url: string; headers: IncomingMessage['headers']; body: string };

describe('[LTI-001] what ltijs may ask a platform, and how', () => {
  const seen: { platform: Seen[]; elsewhere: Seen[] } = { platform: [], elsewhere: [] };
  let platform: Server;
  let elsewhere: Server;
  let origin = '';
  let other = '';
  const urlOf = (server: Server) => `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  const listen = (server: Server) =>
    new Promise<string>((resolve) => server.listen(0, '127.0.0.1', () => resolve(urlOf(server))));
  const record = async (req: IncomingMessage, into: Seen[]) => {
    let body = '';
    for await (const chunk of req) body += String(chunk);
    into.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
  };

  beforeAll(async () => {
    elsewhere = createServer((req, res) => void record(req, seen.elsewhere).then(() => res.end('{}')));
    other = await listen(elsewhere);
    platform = createServer((req, res) => {
      void record(req, seen.platform).then(() => {
        const path = (req.url ?? '').split('?')[0];
        if (path === '/redirect') return res.writeHead(302, { location: `${other}/taken` }).end();
        if (path === '/slow') return undefined;
        if (path === '/large') return res.end('x'.repeat(5000));
        if (path === '/text') return res.end('plain text');
        if (path === '/empty') return res.writeHead(204).end();
        if (path === '/denied') return res.writeHead(401).end(JSON.stringify({ errors: ['secret detail'] }));
        if (path === '/members') {
          res.setHeader('link', `<${other}/members?page=2>; rel="next"`);
          return res.end(JSON.stringify({ members: [{ user_id: 'u1' }] }));
        }
        return res.end(JSON.stringify({ keys: [{ kid: 'k1' }] }));
      });
    });
    origin = await listen(platform);
  });
  afterAll(() => {
    platform.closeAllConnections();
    platform.close();
    elsewhere.close();
  });

  const handler = (rules: Partial<ConstructorParameters<typeof LtiOutboundRequests>[0]> = {}) =>
    new LtiOutboundRequests({ origins: [origin], ...rules });
  const refusal = async (attempt: Promise<unknown>) => {
    const error = await attempt.then(
      () => undefined,
      (caught: unknown) => caught,
    );
    return error instanceof HttpError
      ? { message: error.message, status: error.status, url: error.url }
      : error;
  };

  it('[LTI-001] the limits are 10 seconds and 4 MB, and the origins are the platforms’ own and Canvas’s', () => {
    // Arrange: Canvas as HVL registers it
    const sso = 'https://sso.canvaslms.com';
    const canvas = {
      issuer: 'https://canvas.instructure.com',
      authEndpoint: `${sso}/api/lti/authorize_redirect`,
      tokenEndpoint: `${sso}/login/oauth2/token`,
      jwksUrl: `${sso}/api/lti/security/jwks`,
    };
    // Act + Assert
    expect([LTI_REQUEST_TIMEOUT_MS, LTI_RESPONSE_MAX_BYTES]).toEqual([10_000, 4 * 1024 * 1024]);
    expect(allowedLtiOrigins([canvas], ['https://hvl.instructure.com', 'not a url'])).toEqual([
      'https://canvas.instructure.com',
      'https://sso.canvaslms.com',
      'https://hvl.instructure.com',
    ]);
  });

  it('[LTI-001] a URL on another origin, with credentials, or not https where required is refused unasked', async () => {
    // Arrange
    const before = seen.elsewhere.length + seen.platform.length;
    // Act
    const refusals = [
      await refusal(handler().get(`${other}/api/lti/security/jwks`)),
      await refusal(handler().get(origin.replace('http://', 'http://user:secret@'))),
      await refusal(handler({ requireHttps: true }).get(`${origin}/jwks`)),
      await refusal(handler().get('file:///etc/hostname')),
      await refusal(handler().get('not a url')),
    ];
    // Assert: no request was made, and an error names an origin at most, never a path or a password
    expect(refusals.map((r) => (r as { message: string }).message)).toEqual([
      'LTI request refused: origin not allowed',
      'LTI request refused: credentials in the URL',
      'LTI request refused: scheme',
      'LTI request refused: scheme',
      'LTI request refused: not a URL',
    ]);
    expect(JSON.stringify(refusals)).not.toMatch(/secret|security\/jwks/);
    expect(seen.elsewhere.length + seen.platform.length).toBe(before);
  });

  it('[LTI-001] a redirect is a failed request with its status, and where it points is never asked', async () => {
    // Arrange
    const before = seen.elsewhere.length;
    // Act
    const refused = await refusal(
      handler().get(`${origin}/redirect`, { headers: { authorization: 'Bearer token-1' } }),
    );
    // Assert
    expect(refused).toMatchObject({ status: 302, url: origin });
    expect(seen.elsewhere.length).toBe(before);
  });

  it('[LTI-008] a roster’s «next page» link that names another host is not followed', async () => {
    // Arrange: the first page, as ltijs reads it
    const before = seen.elsewhere.length;
    const page = await handler().get<{ members: unknown[] }>(`${origin}/members`, {
      query: new URLSearchParams({ role: 'Learner', limit: '50' }),
      headers: { authorization: 'Bearer token-1' },
    });
    const next = /<([^>]+)>; rel="next"/.exec(page.headers.link ?? '')?.[1] ?? '';
    // Act: ltijs asks for the URL the link names, with the same bearer token
    const refused = await refusal(handler().get(next, { headers: { authorization: 'Bearer token-1' } }));
    // Assert
    expect(page.data.members).toHaveLength(1);
    expect(next.startsWith(other)).toBe(true);
    expect(refused).toMatchObject({ message: 'LTI request refused: origin not allowed' });
    expect(seen.elsewhere.length).toBe(before);
  });

  it('[NFR-006] a slow answer is given up after the time limit, and an over-large one unread', async () => {
    // Act
    const started = Date.now();
    const slow = await refusal(handler({ timeoutMs: 150 }).get(`${origin}/slow`));
    const waited = Date.now() - started;
    const large = await refusal(handler({ maxBytes: 1000 }).get(`${origin}/large`));
    const fits = await handler({ maxBytes: 5000 }).get<string>(`${origin}/large`);
    // Assert
    expect((slow as Error).name).toBe('TimeoutError');
    expect(waited).toBeLessThan(2000);
    expect(large).toMatchObject({ message: 'LTI request refused: answer too large' });
    expect(fits.data).toHaveLength(5000);
  });

  it('[LTI-001] an answer that is not 2xx is ltijs’s HttpError with the status and without the body', async () => {
    // Act
    const denied = await handler()
      .get(`${origin}/denied`)
      .catch((error: unknown) => error);
    // Assert: the status is what the roster read decides its one retry on
    expect(denied).toBeInstanceOf(HttpError);
    expect(httpStatusOf(denied)).toBe(401);
    expect(JSON.stringify(denied)).not.toContain('secret detail');
    expect(String((denied as Error).message)).not.toContain('secret detail');
  });

  it('[LTI-001] requests and answers are ltijs’s own: headers, a form or a JSON body, the query, the parsing', async () => {
    // Arrange
    const requests = handler();
    requests.setPermanentHeader('X-Tool', 'hvl');
    const from = seen.platform.length;
    // Act
    const keys = await requests.get<{ keys: unknown[] }>(`${origin}/jwks`, {
      headers: { accept: 'application/json' },
    });
    await requests.post(`${origin}/token`, new URLSearchParams({ grant_type: 'client_credentials' }));
    await requests.put(`${origin}/item?x=1`, { score: 1 }, { query: new URLSearchParams({ y: '2' }) });
    const text = await requests.get(`${origin}/text`);
    const empty = await requests.delete(`${origin}/empty`);
    // Assert
    const [jwks, token, put] = seen.platform.slice(from);
    expect(keys.data.keys).toHaveLength(1);
    expect(keys.headers['content-length']).toBeDefined();
    expect(jwks).toMatchObject({ method: 'GET', headers: { accept: 'application/json', 'x-tool': 'hvl' } });
    expect(token).toMatchObject({ method: 'POST', body: 'grant_type=client_credentials' });
    expect(token?.headers['content-type']).toContain('application/x-www-form-urlencoded');
    expect(put).toMatchObject({ method: 'PUT', url: '/item?x=1&y=2', body: '{"score":1}' });
    expect(put?.headers['content-type']).toBe('application/json');
    expect([text.data, empty.data]).toEqual(['plain text', undefined]);
  });
});
