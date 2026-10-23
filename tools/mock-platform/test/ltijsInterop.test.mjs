/**
 * Tests that ltijs 7.0.7, the tool's LTI library, and the mock Canvas understand each other: a resource-link launch
 * and a Deep Linking round trip through ltijs's own route handlers, with both JWKS fetched over HTTP.
 *
 * Spec: LTI-001, LTI-005
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { IdTokenValidationMethod, Provider } from 'ltijs';
import { CANVAS_USERS, MESSAGE_TYPE, startMockCanvas } from '../mockPlatform.mjs';

const SILENT = { debug() {}, warn() {}, error() {} };
const routes = new Map();
const handled = [];
let tool;
let canvas;

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

/** Calls one ltijs route handler directly and records what it sent. */
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

const embedded = (html, id) =>
  JSON.parse(new RegExp(`id="${id}">(.*?)</script>`, 's').exec(html ?? '')?.[1] ?? 'null');

/** A whole launch: login initiation → ltijs login → mock authorize → ltijs launch (form_post, then recovered state). */
async function launch(spec, idTokenFor) {
  const login = embedded((await call('/lti/login', canvas.loginInitiation(spec))).html, 'ltijs-login-data');
  const auth = await canvas.authorize(login.targetUrl);
  const idToken = idTokenFor
    ? await idTokenFor(new URL(login.targetUrl).searchParams.get('nonce'))
    : auth.idToken;
  const callback = { id_token: idToken, state: auth.state };
  await call('/lti/launch', callback);
  return {
    auth,
    sent: await call('/lti/launch', { ...callback, ltijs_recovered_state: login.recoveryToken }),
  };
}

beforeAll(async () => {
  tool = createServer((_req, res) =>
    call('/lti/keys', {}, 'GET').then(({ json }) => res.end(JSON.stringify(json))),
  );
  await new Promise((resolve) => tool.listen(0, '127.0.0.1', resolve));
  canvas = await startMockCanvas({ toolUrl: `http://localhost:${tool.address().port}` });
  const httpHandler = {
    registerRoute: (path, _methods, handler) => routes.set(path, handler),
    listen: async () => {},
  };
  const provider = new Provider({
    databaseManager: memoryDatabase(),
    httpHandler: { ...httpHandler, close: async () => {} },
    logger: SILENT,
  });
  provider.onResourceLink(async (context, _request, response) => {
    handled.push(context);
    context.redirect(response, '/lti/play');
  });
  provider.onDeepLinking(async (context, _request, response) => {
    handled.push(context);
    const item = {
      type: 'ltiResourceLink',
      title: 'Brettspel',
      url: `${canvas.toolUrl}/lti/launch`,
      custom: { contentId: 'c-1' },
    };
    response.html(await context.deepLinking.createDeepLinkingMessage([item, { ...item, title: 'Second' }]));
  });
  await provider.platformManager.registerPlatform({
    url: canvas.issuer,
    clientId: canvas.clientId,
    name: 'Mock Canvas',
    authenticationEndpoint: canvas.authEndpoint,
    accessTokenEndpoint: canvas.tokenEndpoint,
    idTokenValidation: { method: IdTokenValidationMethod.JwkSet, key: canvas.jwksUrl },
  });
});
afterAll(async () => {
  await canvas.close();
  tool.closeAllConnections();
  await new Promise((resolve) => tool.close(resolve));
});

describe('[LTI-001] ltijs 7.0.7 against the mock Canvas', () => {
  it("[LTI-001] completes a resource-link launch, verifying the mock's ID token against its JWKS", async () => {
    // Act
    const { auth, sent } = await launch({ user: CANVAS_USERS.student, custom: { contentId: 'c-1' } });
    // Assert
    expect(auth.action).toBe(`${canvas.toolUrl}/lti/launch`);
    expect(sent.redirect).toMatch(/^\/lti\/play\?ltik=[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(handled.at(-1).idToken).toMatchObject({
      user: { id: CANVAS_USERS.student.sub, roles: CANVAS_USERS.student.roles },
      platform: { url: canvas.issuer, clientId: canvas.clientId, deploymentId: canvas.deploymentId },
      launch: {
        type: MESSAGE_TYPE.resourceLink,
        custom: { contentId: 'c-1' },
        context: { id: 'mock-course-1' },
      },
    });
  });

  it('[LTI-001] lets ltijs refuse an ID token the mock signed with its foreign key', async () => {
    const spec = { user: CANVAS_USERS.student };
    const forged = (nonce) => canvas.signIdToken(canvas.idTokenClaims(spec, nonce), { key: 'foreign' });
    await expect(launch(spec, forged)).rejects.toMatchObject({
      name: 'JsonWebTokenError',
      message: 'invalid signature',
    });
  });
});

describe('[LTI-005] ltijs 7.0.7 Deep Linking against the mock Canvas', () => {
  it("[LTI-005] ltijs's signed response passes every check, with one item where accept_multiple is false", async () => {
    // Act
    const spec = {
      messageType: MESSAGE_TYPE.deepLinking,
      user: CANVAS_USERS.teacher,
      placement: 'assignment_selection',
    };
    const { sent } = await launch(spec);
    const record = await canvas.verifyDeepLinkResponse(sent.html);
    // Assert
    expect(handled.at(-1).idToken.services.deepLinking).toMatchObject({
      available: true,
      acceptMultiple: false,
    });
    expect(record).toMatchObject({
      ok: true,
      problems: [],
      lifetime: 60,
      request: { placement: 'assignment_selection' },
    });
    expect(record.items.map((item) => item.title)).toEqual(['Brettspel']);
  });
});
