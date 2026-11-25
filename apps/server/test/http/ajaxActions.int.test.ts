/**
 * Integration tests of which actions the editor's AJAX endpoint takes (D-142): a request that names no action,
 * names one twice or names one Lumi does not know for its method is a 400 that logs no fault, for GET and POST
 * alike; a learner is refused before the action is read; and every action Lumi knows still reaches it.
 *
 * Spec: H5P-002, H5P-006
 */
import type { Express } from 'express';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { capturedLogger } from '../support/capturedLogger.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { requestAs } from '../support/requestAs.js';
import { describeWithServices } from '../support/services.js';

const PINO_ERROR = 50;
/** What no caller should be able to name, with the method it is sent by. */
const REFUSED: readonly (readonly ['get' | 'post', string, string])[] = [
  ['post', 'an action Lumi does not know', '?action=no-such-action'],
  ['post', 'no action', ''],
  ['post', 'an empty action', '?action='],
  ['post', 'one action given twice', '?action=libraries&action=libraries'],
  ['post', 'two actions', '?action=libraries&action=filter'],
  ['post', 'an action written as a list', '?action[]=libraries'],
  ['post', 'a GET action', '?action=content-type-cache'],
  ['post', 'a known action in other letters', '?action=Libraries'],
  ['get', 'an action Lumi does not know', '?action=no-such-action'],
  ['get', 'no action', ''],
  ['get', 'one action given twice', '?action=content-type-cache&action=content-type-cache'],
  ['get', 'a POST action', '?action=filter'],
];

describeWithServices('[H5P-002] the actions of the editor’s AJAX endpoint', () => {
  const log = capturedLogger();
  let tb: HttpTestbed;
  let app: Express;
  let author: TestActor;
  let learner: TestActor;
  const errorLines = () =>
    log.lines.filter((line) => (JSON.parse(line) as { level: number }).level >= PINO_ERROR);

  beforeAll(async () => {
    tb = await openHttpTestbed();
    app = tb.appWith({ logger: log.logger });
    author = await tb.actor('author');
    learner = await tb.actor('learner');
  }, 60_000);
  afterAll(() => tb.close());

  it.each(REFUSED)('[H5P-002] %s with %s is a 400 and logs no fault', async (method, _what, query) => {
    // Act
    const res = await requestAs(app, author, method, `/h5p/ajax${query}`);
    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, errorCode: 'error.badRequest', httpStatusCode: 400 });
    expect(errorLines()).toEqual([]);
  });

  it('[H5P-002] an unknown action is refused before its body is read', async () => {
    // Arrange: a form body the route's 20 MB parser would refuse with 413 if it read it
    const body = `x=${'a'.repeat(21 * 1024 * 1024)}`;
    // Act
    const res = await requestAs(app, author, 'post', '/h5p/ajax?action=no-such-action')
      .type('form')
      .send(body);
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([400, 'error.badRequest']);
  });

  it('[H5P-006] a learner is refused with 403 whatever the action says', async () => {
    // Act
    const unknown = await requestAs(app, learner, 'post', '/h5p/ajax?action=no-such-action');
    const known = await requestAs(app, learner, 'get', '/h5p/ajax?action=content-type-cache');
    // Assert
    expect([unknown.status, known.status]).toEqual([403, 403]);
  });

  it('[H5P-002] every action Lumi knows still reaches it', async () => {
    // Act: each is answered by Lumi (its own 200, or its own refusal of a body that lacks what the action needs)
    const answers: Record<string, number> = {};
    for (const action of ['content-type-cache', 'content-hub-metadata-cache', 'libraries']) {
      answers[`GET ${action}`] = (await requestAs(app, author, 'get', `/h5p/ajax?action=${action}`)).status;
    }
    for (const action of ['libraries', 'translations', 'filter', 'library-install', 'get-content']) {
      const res = await requestAs(app, author, 'post', `/h5p/ajax?action=${action}`).type('form').send('');
      answers[`POST ${action}`] = res.status;
      // WHY: `error.badRequest` is this route's own refusal of an unknown action; Lumi's refusals have its codes.
      expect(res.body.errorCode ?? '').not.toBe('error.badRequest');
    }
    // Assert
    expect(answers).toMatchObject({ 'GET content-type-cache': 200, 'GET content-hub-metadata-cache': 200 });
    expect(Object.values(answers).filter((status) => status >= 500)).toEqual([]);
    expect(errorLines()).toEqual([]);
  });
});
