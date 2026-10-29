/**
 * Integration tests for the author's course questions: the course codes they use and the Canvas labels of their own
 * placements (D-087), and the outcomes already used in one course, with who may ask.
 *
 * Spec: PED-030, AUTH-003
 */
import { courseCodeSuggestionsSchema, courseOutcomesSchema } from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LtiPlacementRecorder } from '../../../src/lti/placements/LtiPlacementRecorder.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices, uniqueName } from '../../support/services.js';
import { REFUSED_CALLERS, storeMetadata } from './metadataFixtures.js';

const ROUTES = ['/api/learning-design/course-codes', '/api/learning-design/outcomes?courseCode=SYK110'];

describeWithServices('[PED-030] the author’s course codes and outcomes', () => {
  const tb = openApiTestbed();
  let author: TestPrincipal;
  let platformId: string;

  beforeAll(async () => {
    author = await tb.principal('author');
    const colleague = await tb.principal('author');
    const stranger = await tb.principal('author');
    const own = await tb.content(author.principal.userId);
    const coAuthored = await tb.content(colleague.principal.userId, { coAuthors: [author.principal.userId] });
    const theirs = await tb.content(stranger.principal.userId, {
      status: 'published',
      visibility: 'organisation',
    });
    const ownOther = await tb.content(author.principal.userId);
    await storeMetadata(tb.db, own, {
      courseCode: 'SYK110',
      outcomes: [
        { text: 'Forklare blodtrykk', category: 'kunnskap' },
        { text: 'Måle puls', category: 'ferdigheiter' },
      ],
    });
    await storeMetadata(tb.db, coAuthored, {
      courseCode: 'SYK110',
      outcomes: [
        { text: 'Reflektere over eiga rolle', category: 'generell-kompetanse' },
        { text: '  forklare  BLODTRYKK ', category: 'kunnskap' },
      ],
    });
    await storeMetadata(tb.db, ownOther, {
      courseCode: 'PED3001',
      outcomes: [{ text: 'Annan', category: 'kunnskap' }],
    });
    await storeMetadata(tb.db, theirs, {
      courseCode: 'STR100',
      outcomes: [{ text: 'Hemmeleg', category: 'kunnskap' }],
    });
    await tb.db.learningDesignMetadata.update({
      where: { contentId: theirs },
      data: { courseCode: 'SYK110' },
    });
    platformId = (
      await tb.db.ltiPlatform.create({
        data: {
          url: `https://${uniqueName('canvas')}.example`,
          clientId: '1',
          name: 'Canvas',
          authenticationEndpoint: 'https://sso.example/auth',
          accessTokenEndpoint: 'https://sso.example/token',
          idTokenValidationMethod: 'JWK_SET',
          idTokenValidationKey: 'https://sso.example/jwks',
          publicKey: 'p',
          privateKeyEncrypted: Buffer.from([1]),
        },
      })
    ).id;
    const recorder = new LtiPlacementRecorder(tb.db);
    const place = (contentId: string, contextLabel: string) =>
      recorder.record({
        platformId,
        contextId: uniqueName('course'),
        resourceLinkId: 'l',
        contentId,
        contextLabel,
      });
    await place(own, 'syk 120');
    await place(coAuthored, 'ÅRS100');
    await place(own, 'Sandkasse Kari Nordmann');
    await place(theirs, 'STR999');
  });
  afterAll(async () => {
    // WHY: a fixture platform has no decryptable key; left behind, it would break `getPlatforms()` elsewhere.
    await tb.db.ltiPlatform.delete({ where: { id: platformId } });
    await tb.close();
  });

  describe('[AUTH-003] who may ask', () => {
    it.each(REFUSED_CALLERS)(
      '[AUTH-003] $who: $status $errorCode',
      async ({ role, overrides, status, errorCode }) => {
        // Arrange
        const caller = role ? await tb.principal(role, overrides) : undefined;
        // Act
        const answers = await Promise.all(
          ROUTES.map((path) => (caller ? requestAs(tb.app, caller, 'get', path) : request(tb.app).get(path))),
        );
        // Assert
        expect(answers.map((res) => [res.status, res.body.errorCode])).toEqual(
          ROUTES.map(() => [status, errorCode]),
        );
      },
    );
  });

  it('[PED-030] suggests the codes of own and co-authored activities and the course labels of their placements only', async () => {
    // Act
    const res = await requestAs(tb.app, author, 'get', '/api/learning-design/course-codes');
    // Assert
    expect(res.status).toBe(200);
    expect(courseCodeSuggestionsSchema.parse(res.body)).toEqual({
      inUse: ['PED3001', 'SYK110'],
      fromCanvas: ['SYK120', 'ÅRS100'],
    });
    expect(res.text).not.toMatch(/STR100|STR999|Kari/);
  });

  it('[PED-030] offers the distinct outcomes already used in the course, by category, never a stranger’s', async () => {
    // Act
    const res = await requestAs(tb.app, author, 'get', '/api/learning-design/outcomes?courseCode=syk%20110');
    // Assert
    expect(res.status).toBe(200);
    const { courseCode, outcomes } = courseOutcomesSchema.parse(res.body);
    expect(courseCode).toBe('SYK110');
    expect(
      outcomes.map(({ category, text }) => [category, text.trim().replace(/\s+/g, ' ').toLowerCase()]),
    ).toEqual([
      ['kunnskap', 'forklare blodtrykk'],
      ['ferdigheiter', 'måle puls'],
      ['generell-kompetanse', 'reflektere over eiga rolle'],
    ]);
    expect(res.text).not.toContain('Hemmeleg');
  });

  it('[PED-030] a course without the author’s activities has no outcomes; a bad course code is a 400', async () => {
    // Act
    const empty = await requestAs(tb.app, author, 'get', '/api/learning-design/outcomes?courseCode=STR100');
    const answers = await Promise.all(
      ['', '?courseCode=SYK_110', '?courseCode=SYK110&courseCode=PED3001', '?courseCode=SYK110&extra=1'].map(
        (query) => requestAs(tb.app, author, 'get', `/api/learning-design/outcomes${query}`),
      ),
    );
    // Assert
    expect(empty.body).toEqual({ courseCode: 'STR100', outcomes: [] });
    expect(answers.map((res) => [res.status, res.body.errorCode])).toEqual(
      answers.map(() => [400, 'error.badRequest']),
    );
  });
});
