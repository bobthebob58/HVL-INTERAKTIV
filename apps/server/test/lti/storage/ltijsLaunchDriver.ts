/**
 * ltijsLaunchDriver — runs LTI 1.3 launches through a real ltijs Provider's own login and launch routes, in
 * process: the OIDC login, the platform's form_post of a signed ID token, and ltijs's second step with the
 * recovered state. Outgoing platform calls (token endpoint, AGS) are recorded, not sent.
 *
 * Why: the storage must work for ltijs itself, not only for our contract. ltijs's real routes show which claims
 *      it hands to `saveIdToken`, what a resumed launch (`getLaunchContext`) can still read from the stored row,
 *      which access tokens it caches, and that a refused deployment or a replayed nonce never reaches a handler.
 * Spec: LTI-002, LTI-001
 * Invariants:
 *   - Uses only ltijs's public API and the routes it registers on the stub HTTP handler; never calls listen().
 *   - The platform signs its ID tokens with a fresh RS256 key; the tool keys are the ones ltijs generated.
 *   - The token endpoint answers every request with a new access token; any other call answers `{}`.
 * Collaborators: ltijs `Provider`, ../upstream/ltijsProvider.test.ts (the same steps, pinned on stubs).
 * Tests: apps/server/test/lti/storage/ltijsOnPrismaStorage.int.test.ts,
 *   apps/server/test/lti/storage/ltijsResumedLaunch.int.test.ts
 */
import { SignJWT, exportSPKI, generateKeyPair } from 'jose';
import { IdTokenValidationMethod, Provider } from 'ltijs';
import type { CacheManager, DatabaseManager, HttpHandler, HttpResponse, LaunchContext } from 'ltijs';
import type { Platform, RequestHandler, RouteHandler } from 'ltijs';

/** A call the tool made to the platform. */
export interface RecordedPlatformCall {
  /** The URL called. */
  readonly url: string;
  /** The body sent. */
  readonly body: unknown;
}

/** The result of one launch. */
export interface DrivenLaunch {
  /** Where ltijs's handler redirected the browser, e.g. `/lti/deeplink?ltik=…`. */
  readonly redirect: string | undefined;
  /** Posts the same ID token and state again, as a replaying attacker would. */
  readonly replay: () => Promise<void>;
}

/** A Provider on the given storage, with one mock platform and a way to launch from it. */
export interface LtijsLaunchDriver {
  /** The real ltijs Provider. */
  readonly provider: Provider;
  /** Every context ltijs handed to `onResourceLink` or `onDeepLinking`, in order. */
  readonly handled: LaunchContext[];
  /** Every call the tool made to a platform, in order. */
  readonly platformCalls: RecordedPlatformCall[];
  /** Registers a platform at `url` through ltijs (which generates the tool key pair). */
  registerPlatform(url: string): Promise<Platform>;
  /** Runs login and launch with these claims (iss and aud name a registered platform). */
  launch(claims: Record<string, unknown>): Promise<DrivenLaunch>;
}

const SILENT_LOGGER = { debug() {}, warn() {}, error() {} };
const post = (path: string, body: Record<string, unknown>) => ({
  method: 'POST',
  path,
  query: {},
  headers: {},
  body,
});

function recordResponse() {
  const sent: { html?: string; redirect?: string } = {};
  const response: HttpResponse = {
    status: () => response,
    redirect: (redirect) => void Object.assign(sent, { redirect }),
    html: (html) => void Object.assign(sent, { html }),
    json: () => {},
  };
  return { response, sent };
}

/** Reads the JSON that ltijs embeds in its login page. */
const embedded = (html: string | undefined, id: string): Record<string, string> =>
  JSON.parse(new RegExp(`id="${id}">(.*?)</script>`, 's').exec(html ?? '')?.[1] ?? '{}');

/**
 * Builds a Provider on the given stores, with stub HTTP and request handlers.
 * @param stores - The database manager under test and, optionally, a cache manager.
 * @returns The driver.
 */
export async function createLtijsLaunchDriver(stores: {
  databaseManager: DatabaseManager;
  cacheManager?: CacheManager;
}): Promise<LtijsLaunchDriver> {
  const routes = new Map<string, RouteHandler>();
  const httpHandler: HttpHandler = {
    registerRoute: (path, _methods, handler) => void routes.set(path, handler),
    listen: async () => {},
    close: async () => {},
  };
  const platformCalls: RecordedPlatformCall[] = [];
  const unexpected = async () => Promise.reject(new Error('the tool made an unexpected platform call'));
  const requestHandler = {
    get: unexpected,
    put: unexpected,
    delete: unexpected,
    setPermanentHeader: () => {},
    post: async (url: string, body?: unknown) => {
      platformCalls.push({ url, body });
      const isToken = url.endsWith('/token');
      const token = { access_token: `token-${platformCalls.length}`, token_type: 'bearer', expires_in: 3600 };
      return { data: isToken ? token : {}, headers: {} };
    },
  } as RequestHandler;
  const provider = new Provider({ ...stores, httpHandler, requestHandler, logger: SILENT_LOGGER });
  const handled: LaunchContext[] = [];
  provider.onResourceLink(async (context, _request, response) => {
    handled.push(context);
    context.redirect(response, '/lti/play');
  });
  provider.onDeepLinking(async (context, _request, response) => {
    handled.push(context);
    context.redirect(response, '/lti/deeplink');
  });
  const route = (path: string) => routes.get(path)!;
  const platformKeys = await generateKeyPair('RS256');
  const validationKey = await exportSPKI(platformKeys.publicKey);

  return {
    provider,
    handled,
    platformCalls,
    registerPlatform: (url) =>
      provider.platformManager.registerPlatform({
        url,
        clientId: 'client-a',
        name: 'Mock Canvas',
        authenticationEndpoint: `${url}/api/lti/authorize_redirect`,
        accessTokenEndpoint: `${url}/login/oauth2/token`,
        idTokenValidation: { method: IdTokenValidationMethod.RsaKey, key: validationKey },
      }),
    async launch(claims) {
      const target = claims['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'];
      const login = recordResponse();
      const loginBody = {
        iss: claims.iss,
        client_id: claims.aud,
        login_hint: 'hint',
        target_link_uri: target,
      };
      await route('/lti/login')(post('/lti/login', loginBody), login.response);
      const { targetUrl, state, recoveryToken } = embedded(login.sent.html, 'ltijs-login-data');
      const nonce = new URL(targetUrl!).searchParams.get('nonce');
      const now = Math.floor(Date.now() / 1000);
      const idToken = await new SignJWT({ ...claims, nonce, iat: now, exp: now + 60 })
        .setProtectedHeader({ alg: 'RS256' })
        .sign(platformKeys.privateKey);
      // WHY: step 1 is the platform's form_post; step 2 is ltijs's own page posting the recovered state back.
      await route('/lti/launch')(
        post('/lti/launch', { id_token: idToken, state }),
        recordResponse().response,
      );
      const recovered = post('/lti/launch', {
        id_token: idToken,
        state,
        ltijs_recovered_state: recoveryToken,
      });
      const done = recordResponse();
      await route('/lti/launch')(recovered, done.response);
      return {
        redirect: done.sent.redirect,
        replay: () => route('/lti/launch')(recovered, recordResponse().response),
      };
    },
  };
}
