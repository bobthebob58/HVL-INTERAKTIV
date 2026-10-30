/**
 * fakeAgsFetch — a scripted `fetch` and platform directory for unit tests of the AGS token source and score client,
 * so each answer (a 401, a 404, a redirect, no answer at all) can be given exactly, without a mock server.
 *
 * Why: the integration tests prove the client against the mock Canvas; these unit tests pin the edges that the mock
 *      cannot easily produce (a redirect, an answer that is not a token, the token's expiry on a given clock).
 * Spec: LTI-012
 * Collaborators: ../../../src/grades/AgsAccessTokens.ts, ../../../src/grades/AgsScoreClient.ts.
 * Tests: apps/server/test/grades/AgsAccessTokens.test.ts, apps/server/test/grades/AgsScoreClient.test.ts
 */
import { generateKeyPairSync } from 'node:crypto';
import type { AgsPlatformDirectory, AgsPlatformRecord } from '../../../src/grades/AgsAccessTokens.js';

/** One request the fake saw. */
export interface FakeRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly redirect: RequestRedirect | undefined;
}

/** A scripted answer: a status with optional JSON body and headers, or `'network'` for no answer. */
export type FakeAnswer = { status: number; json?: unknown; headers?: Record<string, string> } | 'network';

/** The fake platform's token endpoint. */
export const FAKE_TOKEN_URL = 'https://canvas.example/login/oauth2/token';

/** A platform as ltijs returns it, with the fields the client reads. */
export const fakePlatform = (active = true): AgsPlatformRecord => ({
  id: '0195f0a0-0000-7000-8000-000000000001',
  clientId: '10000000000001',
  accessTokenEndpoint: FAKE_TOKEN_URL,
  authorizationServer: FAKE_TOKEN_URL,
  active,
});

const pem = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs1', format: 'pem' })
  .toString();

/**
 * A platform directory holding one platform.
 * @param platform - The platform, or null for none.
 * @returns The directory.
 */
export const fakeDirectory = (platform: AgsPlatformRecord | null = fakePlatform()): AgsPlatformDirectory => ({
  getPlatformById: async (id) => (platform?.id === id ? platform : undefined),
  getPrivateKey: async () => pem,
});

/** A token answer as Canvas gives it. */
export const tokenAnswer = (token: string, expiresIn = 3600): FakeAnswer => ({
  status: 200,
  json: { access_token: token, token_type: 'Bearer', expires_in: expiresIn, scope: 'x' },
});

/**
 * A `fetch` that answers from a script, in order, and records every request.
 * @param answers - The answers, used one per request.
 * @returns The fake and its record.
 */
export function scriptedFetch(answers: FakeAnswer[]): { fetch: typeof fetch; requests: FakeRequest[] } {
  const requests: FakeRequest[] = [];
  const fake = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const body = init.body instanceof URLSearchParams ? init.body.toString() : String(init.body ?? '');
    requests.push({
      url: String(input),
      method: init.method ?? 'GET',
      headers,
      body,
      redirect: init.redirect,
    });
    const answer = answers.shift();
    if (answer === undefined) throw new Error('the fake fetch has no answer left');
    if (answer === 'network') throw new TypeError('fetch failed');
    const text = answer.json === undefined ? null : JSON.stringify(answer.json);
    return new Response(text, { status: answer.status, headers: answer.headers ?? {} });
  };
  return { fetch: fake as typeof fetch, requests };
}
