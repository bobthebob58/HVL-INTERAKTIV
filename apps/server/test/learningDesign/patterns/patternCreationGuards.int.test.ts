/**
 * Integration tests for what creating from a pattern refuses and cleans up, and for the formative defaults of what it
 * creates, through the whole app on the real content types: an unknown pattern, an uninstalled library, a Canvas
 * launch and a learner are refused; a failed metadata write leaves no activity; the created skeleton keeps retry and
 * solutions on, sets no time limit and only an informative pass mark (D-085, PROD-009).
 *
 * Spec: PROD-001, PROD-009
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { CSRF_HEADER } from '../../../src/auth/session/csrfToken.js';
import type { Database } from '../../../src/infra/prismaClient.js';
import { PatternCreator } from '../../../src/learningDesign/patterns/PatternCreator.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { testActor } from '../../support/testActors.js';
import {
  openPatternCreationBench,
  storedFindings,
  UNAVAILABLE_PATTERN_ID,
  type PatternCreationBench,
} from './patternCreationBench.js';

const PATH = '/api/patterns/fixture-check/activities';
const BODY = { language: 'nn', contentType: 'H5P.QuestionSet' } as const;

/** Every value stored under one of the keys, anywhere in the parameters. */
const valuesOf = (value: unknown, keys: ReadonlySet<string>): unknown[] => {
  if (Array.isArray(value)) return value.flatMap((item) => valuesOf(item, keys));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(keys.has(key) ? [child] : []),
    ...valuesOf(child, keys),
  ]);
};

describeWithServices('what creating from a pattern refuses and creates', () => {
  describeWithRealPackages('[PROD-001] refusals, clean-up and formative defaults', () => {
    let bench: PatternCreationBench;
    const owned = () => bench.tb.db.h5PContent.count({ where: { ownerUserId: bench.authorId } });
    beforeAll(async () => {
      bench = await openPatternCreationBench();
    }, 240_000);
    afterAll(() => bench?.close(), 60_000);

    it('[PROD-001] answers 404 for an unknown pattern and 409 when a library the skeleton names is missing', async () => {
      // Arrange
      const before = await owned();
      // Act
      const unknown = await bench.create('no-such-pattern', BODY);
      const missing = await bench.create(UNAVAILABLE_PATTERN_ID, BODY);
      const otherType = await bench.create(UNAVAILABLE_PATTERN_ID, { ...BODY, contentType: 'H5P.Blanks' });
      // Assert
      expect([unknown.status, unknown.body.errorCode]).toEqual([404, 'error.notFound']);
      expect([missing.status, missing.body.errorCode]).toEqual([409, 'hvl:pattern-unavailable']);
      expect(otherType.status).toBe(201);
      expect(await owned()).toBe(before + 1);
    });

    it('[PROD-001] tells other routes which patterns, and which of their content types, can be created now', async () => {
      // Act
      const [fixture, variant, none] = await Promise.all(
        ['fixture-check', UNAVAILABLE_PATTERN_ID, 'no-such-pattern'].map((id) =>
          bench.tb.studio.patternCreator.availability(id),
        ),
      );
      // Assert
      expect(fixture?.available).toBe(true);
      expect(variant).toEqual({
        available: false,
        contentTypes: [
          { contentType: 'H5P.QuestionSet', available: false },
          { contentType: 'H5P.Blanks', available: true },
        ],
      });
      expect(none).toBeUndefined();
    });

    it('[PROD-001] refuses a signed-out request, a Canvas launch and a save without the CSRF token with 401, and a portal learner with 403', async () => {
      // Arrange
      const { ltik } = await launchFromCanvas(bench.tb.app, bench.tb.mock.canvas, {
        messageType: 'LtiDeepLinkingRequest',
        user: { sub: `teacher-${Date.now()}`, roles: CANVAS_USERS.teacher.roles },
      });
      const student =
        (await loginWithFeide({ app: bench.tb.app, feide: bench.tb.mock.feide }, 'student')).sessionCookie ??
        '';
      const csrf = (await request(bench.tb.app).get('/auth/session').set('Cookie', student)).body
        .csrfToken as string;
      // Act
      const signedOut = await request(bench.tb.app).post(PATH).send(BODY);
      const canvas = await request(bench.tb.app)
        .post(PATH)
        .set('Authorization', `Bearer ${ltik ?? ''}`)
        .send(BODY);
      const learner = await request(bench.tb.app)
        .post(PATH)
        .set('Cookie', student)
        .set(CSRF_HEADER, csrf)
        .send(BODY);
      const noCsrf = await request(bench.tb.app).post(PATH).set('Cookie', bench.cookie).send(BODY);
      // Assert
      expect([signedOut.status, signedOut.body.errorCode]).toEqual([401, 'hvl:unauthenticated']);
      expect([noCsrf.status, noCsrf.body.errorCode]).toEqual([401, 'hvl:csrf-invalid']);
      expect([canvas.status, canvas.body.errorCode]).toEqual([401, 'hvl:unauthenticated']);
      expect([learner.status, learner.body.errorCode]).toEqual([403, 'error.forbidden']);
    });

    it('[PROD-001] removes the new activity when its metadata cannot be written, and passes the failure on', async () => {
      // Arrange
      const failing = new Proxy(bench.tb.db, {
        get: (target, property) =>
          property === 'learningDesignMetadata'
            ? { create: () => Promise.reject(new Error('the metadata table is gone')) }
            : Reflect.get(target, property),
      }) as Database;
      const creator = new PatternCreator({
        db: failing,
        editor: bench.tb.runtime.editor,
        patterns: bench.tb.studio.content.patterns,
      });
      const before = await owned();
      // Act
      const creating = creator.create(
        'fixture-check',
        BODY,
        testActor('author', { accountId: bench.authorId }),
      );
      // Assert
      await expect(creating).rejects.toThrow('the metadata table is gone');
      expect(await owned()).toBe(before);
    });

    it('[PROD-009] keeps retry and solutions on, sets no time limit and only an informative pass mark; PED-H07 is silent', async () => {
      // Arrange
      const { contentId } = (await bench.create('fixture-check', BODY)).body as { contentId: string };
      // Act
      const { params } = await bench.tb.runtime.editor.getContent(contentId, bench.author);
      const settings = params.params as {
        passPercentage?: number;
        disableBackwardsNavigation?: boolean;
        endGame?: { showRetryButton?: boolean; showSolutionButton?: boolean };
      };
      // Assert
      // WHY: `showSolutionButton` also names a button's label in UI groups; only on/off values are switches.
      const switches = valuesOf(
        params.params,
        new Set([
          'enableRetry',
          'enableSolutionsButton',
          'showRetryButton',
          'showSolutionButton',
          'retryButton',
        ]),
      ).filter((value) => typeof value === 'boolean' || value === 'on' || value === 'off');
      expect(switches.length).toBeGreaterThanOrEqual(10);
      expect(switches.filter((value) => value !== true && value !== 'on')).toEqual([]);
      expect(JSON.stringify(params.params)).not.toMatch(/time ?limit|timer|countdown|requireCompletion/i);
      expect([settings.passPercentage, settings.disableBackwardsNavigation]).toEqual([80, false]);
      expect(settings.endGame).toMatchObject({ showRetryButton: true, showSolutionButton: true });
      expect((await storedFindings(bench, contentId)).filter((f) => f.ruleId === 'PED-H07')).toEqual([]);
    });
  });
});
