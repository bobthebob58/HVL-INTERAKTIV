/**
 * Tests for the synchronizer CSRF token: which methods and paths need it (including HEAD and GET on the H5P AJAX
 * and user-data paths), where it is read from, and refusals for a missing, wrong or odd token.
 *
 * Spec: AUTH-003, H5P-007
 */
import { Writable } from 'node:stream';
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { assertCsrfWhenRequired, csrfRequired } from '../../../src/auth/session/csrfToken.js';
import { newOpaqueId } from '../../../src/auth/session/opaqueIds.js';
import { h5pErrorHandler } from '../../../src/http/h5pErrorHandler.js';
import { createLogger } from '../../../src/logging/logger.js';

const silent = createLogger({
  level: 'silent',
  destination: new Writable({ write: (_c, _e, done) => done() }),
});
const TOKEN = newOpaqueId();

/** An app that checks the token like requestPrincipal does, then echoes the method its handler saw. */
function csrfApp(): Express {
  const app = express();
  app.use(express.urlencoded({ extended: false }), express.json());
  app.use((req, _res, next) => {
    assertCsrfWhenRequired(req, { csrfToken: TOKEN });
    next();
  });
  app.use((req, res) => {
    res.json({ handledAs: req.method });
  });
  app.use(h5pErrorHandler(silent));
  return app;
}

describe('[AUTH-003] which requests need the CSRF token', () => {
  it.each([
    ['POST', '/api/content/1/sharing'],
    ['PUT', '/h5p/content/1'],
    ['PATCH', '/api/content/1/sharing'],
    ['DELETE', '/h5p/content/1'],
    ['PROPFIND', '/'],
    ['get', '/api/me'],
    ['', '/'],
  ])('[AUTH-003] %s %s needs it (anything but exactly GET, HEAD, OPTIONS)', (method, path) => {
    expect(csrfRequired(method, path)).toBe(true);
  });

  it.each([
    ['GET', '/api/me'],
    ['HEAD', '/h5p/play/1'],
    ['OPTIONS', '/api/content'],
    ['GET', '/h5p/ajaxfoo'],
    ['GET', '/api/h5p-ajax'],
    ['GET', '/auth/feide/login?returnTo=/h5p/ajax'],
  ])('[AUTH-003] %s %s does not need it', (method, path) => {
    expect(csrfRequired(method, path)).toBe(false);
  });

  it.each([
    ['GET', '/h5p/ajax?action=content-type-cache'],
    ['HEAD', '/h5p/ajax?action=libraries'],
    ['OPTIONS', '/h5p/ajax'],
    ['GET', '/h5p/contentUserData/1/state/0'],
    ['HEAD', '/h5p/contentUserData/1/state/0'],
    ['GET', '/H5P/AJAX'],
    ['GET', '/h5p/ajax/'],
    ['GET', '//h5p//ajax'],
    ['GET', '/h5p/%61jax'],
    ['GET', '/h5p\\ajax'],
    ['GET', '/h5p/ajax#x?action=libraries'],
    ['GET', 'http://interaktiv.hvl.no/h5p/ajax?action=libraries'],
    ['GET', '/h5p/contentuserdata/1/state/0'],
    ['GET', '/h5p/%E0%A4%A'],
  ])('[H5P-007] %s %s needs it whatever the method or spelling', (method, path) => {
    expect(csrfRequired(method, path)).toBe(true);
  });
});

describe('[AUTH-003] where the token is read from', () => {
  const app = csrfApp();

  it('[AUTH-003] accepts the token from the X-CSRF-Token header', async () => {
    const res = await request(app).post('/api/x').set('X-CSRF-Token', TOKEN);
    expect(res.status).toBe(200);
  });

  it('[H5P-007] accepts the token from a csrf query value, as H5P URLs carry it', async () => {
    const res = await request(app).post(`/h5p/contentUserData/1/state/0?csrf=${TOKEN}`);
    expect(res.status).toBe(200);
  });

  it('[AUTH-003] accepts the token from a csrf field of an urlencoded form', async () => {
    const res = await request(app).post('/api/x').type('form').send({ csrf: TOKEN, title: 'a' });
    expect(res.status).toBe(200);
  });

  it('[H5P-007] lets GET and HEAD on /h5p/ajax through only with the token', async () => {
    // Act
    const withToken = await request(app).get(`/h5p/ajax?action=libraries&csrf=${TOKEN}`);
    const headWithout = await request(app).head('/h5p/ajax?action=libraries');
    const getWithout = await request(app).get('/h5p/ajax?action=libraries');
    // Assert
    expect(withToken.status).toBe(200);
    expect(headWithout.status).toBe(401);
    expect(getWithout.status).toBe(401);
    expect(getWithout.body.errorCode).toBe('hvl:csrf-invalid');
  });
});

describe('[AUTH-003] refusals', () => {
  const app = csrfApp();
  const refused = async (test: request.Test): Promise<void> => {
    const res = await test;
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, errorCode: 'hvl:csrf-invalid', httpStatusCode: 401 });
  };
  // A wrong token of the right length and alphabet: only the last character differs.
  const wrong = `${TOKEN.slice(0, -1)}${TOKEN.endsWith('A') ? 'B' : 'A'}`;

  it('[AUTH-003] refuses an unsafe request without a token', () => refused(request(app).post('/api/x')));

  it('[AUTH-003] refuses a wrong token of the same length', () =>
    refused(request(app).post('/api/x').set('X-CSRF-Token', wrong)));

  it.each([
    ['a wrong query value', () => request(app).post(`/api/x?csrf=${wrong}`)],
    ['an empty query value', () => request(app).post('/api/x?csrf=')],
    ['a wrong form field', () => request(app).post('/api/x').type('form').send({ csrf: wrong })],
    ["another session's token", () => request(app).post('/api/x').set('X-CSRF-Token', newOpaqueId())],
    ['a wrong query value on GET /h5p/ajax', () => request(app).get(`/h5p/ajax?csrf=${wrong}`)],
  ])('[AUTH-003] refuses %s', (_case, send) => refused(send()));

  it('[AUTH-003] refuses a token of a different length, a prefix and an empty header', async () => {
    await refused(request(app).post('/api/x').set('X-CSRF-Token', `${TOKEN}x`));
    await refused(request(app).post('/api/x').set('X-CSRF-Token', TOKEN.slice(0, 10)));
    await refused(request(app).post('/api/x').set('X-CSRF-Token', ''));
  });

  it('[AUTH-003] refuses a repeated query value, even when both copies are right', () =>
    refused(request(app).post(`/api/x?csrf=${TOKEN}&csrf=${TOKEN}`)));

  it('[AUTH-003] lets the first source present decide: a wrong header is not rescued by a right query', () =>
    refused(request(app).post(`/api/x?csrf=${TOKEN}`).set('X-CSRF-Token', 'wrong')));

  it('[AUTH-003] reads no csrf field from a JSON body', () =>
    refused(request(app).post('/api/x').send({ csrf: TOKEN })));
});

describe('[AUTH-003] method overrides are never honoured', () => {
  const app = csrfApp();

  it('[AUTH-003] a POST that claims to be a GET still needs the token', async () => {
    // Act
    const header = await request(app).post('/api/x').set('X-HTTP-Method-Override', 'GET');
    const query = await request(app).post('/api/x?_method=GET');
    // Assert
    expect(header.status).toBe(401);
    expect(query.status).toBe(401);
  });

  it('[AUTH-003] a GET that claims to be a POST is handled as the GET it is', async () => {
    const res = await request(app).get('/api/x').set('X-HTTP-Method-Override', 'POST');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ handledAs: 'GET' });
  });
});
