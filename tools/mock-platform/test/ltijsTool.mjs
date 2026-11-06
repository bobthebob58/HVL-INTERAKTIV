/**
 * ltijsTool — ltijs 7.0.7, the tool's LTI library, as a minimal tool against a mock Canvas, for the interop tests:
 * an in-memory DatabaseManager, its route handlers called directly, its key set served over HTTP, and whole launches.
 *
 * Why: the mock Canvas is only useful if ltijs accepts it and it accepts ltijs (LTI-001, LTI-005), including the
 *      tokens and service calls ltijs makes for NRPS (LTI-008) and AGS (LTI-012). Both interop test files drive the
 *      same tool.
 * Spec: LTI-001, LTI-005, LTI-008, LTI-012
 * Invariants:
 *   - The platform is registered as the server registers it: token endpoint = the mock's, `authorizationServer`
 *     unset, ID tokens checked against the mock's JWKS.
 *   - The DatabaseManager stores copies, as a database would; it caches no access token, so every service call
 *     asks the mock's token endpoint for one.
 * Collaborators: ./ltijsInterop.test.mjs, ./ltijsServicesInterop.test.mjs, ltijs.
 * Tests: tools/mock-platform/test/ltijsInterop.test.mjs
 */
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { IdTokenValidationMethod, Provider } from 'ltijs';
import { startMockCanvas } from '../mockPlatform.mjs';

const SILENT = { debug() {}, warn() {}, error() {} };

/** An in-memory ltijs DatabaseManager (all 14 methods) that stores copies, as a database would. */
function memoryDatabase() {
  const [platforms, idTokens, nonces] = [new Map(), new Map(), new Set()];
  const put = (map, value) => {
    const id = randomUUID();
    map.set(id, { ...structuredClone(value), id });
    return id;
  };
  const matches = (p, { url = p.url, clientId = p.clientId } = {}) =>
    url === p.url && [clientId].flat().includes(p.clientId);
  const database = {
    listen: async () => {},
    close: async () => {},
    getPlatforms: async (filter) =>
      structuredClone([...platforms.values()].filter((p) => matches(p, filter))),
    getPlatformById: async (id) => structuredClone(platforms.get(id)),
    getPlatformByUrlAndClientId: async (url, clientId) => (await database.getPlatforms({ url, clientId }))[0],
    savePlatform: async (attributes) => put(platforms, attributes),
    updatePlatformById: async (id, fields) => void platforms.set(id, { ...platforms.get(id), ...fields }),
    deletePlatformById: async (id) => void platforms.delete(id),
    getAccessToken: async () => undefined,
    saveAccessToken: async () => randomUUID(),
    getIdToken: async (id) => structuredClone(idTokens.get(id)),
    saveIdToken: async (token) => put(idTokens, token),
    saveNonce: async (nonce) => nonces.add(nonce) && nonce,
    consumeNonce: async (nonce) => nonces.delete(nonce),
  };
  return database;
}

const embedded = (html, id) =>
  JSON.parse(new RegExp(`id="${id}">(.*?)</script>`, 's').exec(html ?? '')?.[1] ?? 'null');

/**
 * Starts ltijs as a tool and a mock Canvas for it.
 * @param {(provider: Provider, canvas: object, handled: object[]) => void} configure - Registers
 *   `onResourceLink`/`onDeepLinking`; `handled` collects launch contexts.
 * @param {object} [canvasOptions] - Extra `startMockCanvas` options.
 * @returns {Promise<{canvas: object, provider: Provider, handled: object[], call: Function, launch: Function,
 *   close: Function}>} `call(path, body?, method?)` runs one ltijs route; `launch(spec, idTokenFor?)` runs a whole
 *   launch (login → mock authorize → launch POST → the recovered-state POST) and returns `{auth, sent}`.
 */
export async function startLtijsTool(configure, canvasOptions = {}) {
  const routes = new Map();
  const handled = [];
  async function call(path, body = {}, method = 'POST') {
    const sent = {};
    const response = {
      status: () => response,
      redirect: (redirect) => Object.assign(sent, { redirect }),
      html: (html) => Object.assign(sent, { html }),
      json: (json) => Object.assign(sent, { json }),
    };
    await routes.get(path)({ method, path, query: {}, headers: {}, body }, response);
    return sent;
  }
  const tool = createServer((_req, res) =>
    call('/lti/keys', {}, 'GET').then(({ json }) => res.end(JSON.stringify(json))),
  );
  await new Promise((resolve) => tool.listen(0, '127.0.0.1', resolve));
  const canvas = await startMockCanvas({
    toolUrl: `http://localhost:${tool.address().port}`,
    ...canvasOptions,
  });
  const httpHandler = {
    registerRoute: (path, _methods, handler) => routes.set(path, handler),
    listen: async () => {},
  };
  const provider = new Provider({
    databaseManager: memoryDatabase(),
    httpHandler: { ...httpHandler, close: async () => {} },
    logger: SILENT,
  });
  configure(provider, canvas, handled);
  await provider.platformManager.registerPlatform({
    url: canvas.issuer,
    clientId: canvas.clientId,
    name: 'Mock Canvas',
    authenticationEndpoint: canvas.authEndpoint,
    accessTokenEndpoint: canvas.tokenEndpoint,
    idTokenValidation: { method: IdTokenValidationMethod.JwkSet, key: canvas.jwksUrl },
  });
  async function launch(spec, idTokenFor) {
    const login = embedded((await call('/lti/login', canvas.loginInitiation(spec))).html, 'ltijs-login-data');
    const auth = await canvas.authorize(login.targetUrl);
    const nonce = new URL(login.targetUrl).searchParams.get('nonce');
    const callback = { id_token: idTokenFor ? await idTokenFor(nonce) : auth.idToken, state: auth.state };
    await call('/lti/launch', callback);
    return {
      auth,
      sent: await call('/lti/launch', { ...callback, ltijs_recovered_state: login.recoveryToken }),
    };
  }
  const close = async () => {
    await canvas.close();
    tool.closeAllConnections();
    await new Promise((resolve) => tool.close(resolve));
  };
  return { canvas, provider, handled, call, launch, close };
}
