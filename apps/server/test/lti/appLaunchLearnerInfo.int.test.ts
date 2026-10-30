/**
 * Integration tests for the learner info in `/app/play`'s launch (D-087): the estimated minutes and the purpose go
 * to the web app with the launch, and are read only after the View check; a language tag longer than the web app's
 * strict parser accepts is left out rather than breaking the launch. The ltik resolver, the activity facts and the
 * lookups are stubs.
 *
 * Spec: PED-032, PROD-004, UD-010
 */
import express, { type ErrorRequestHandler } from 'express';
import type { LaunchContext } from 'ltijs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { sealPrincipal, type Role } from '../../src/auth/Principal.js';
import type { ContentFacts } from '../../src/h5p/permissions/ContentAccessRepository.js';
import { HttpError } from '../../src/http/HttpError.js';
import type { LearnerInfoFields } from '../../src/learningDesign/metadata/learnerInfoFields.js';
import type { ResolvedLtik } from '../../src/lti/ltikPrincipal.js';
import { appLaunchRoutes } from '../../src/lti/play/appLaunchRoutes.js';
import { appLaunchOf, LAUNCH_LANGUAGE_MAX_LENGTH, launchHeaderValue } from '../../src/web/appLaunch.js';

const OWNER = '0192f0c4-0000-7000-8000-000000000001';
const ACTIVITY = '0192f0c4-1111-7000-8000-000000000001';

/** An app with the route and stubs; `reads` lists every lookup made, in order. */
function appWith(roles: Role[], status: ContentFacts['status'], info: LearnerInfoFields, language?: string) {
  const reads: string[] = [];
  const principal = sealPrincipal({
    userId: OWNER,
    learnerKey: 'lk-1',
    roles,
    mode: 'lti',
    locale: 'nn',
    hvlMember: false,
    feideAuthenticated: false,
    studentAuthor: false,
    lti: {
      platformId: 'p',
      deploymentId: 'd',
      contextId: 'c',
      contentId: ACTIVITY,
      messageType: 'LtiResourceLinkRequest',
    },
  });
  const facts: ContentFacts = {
    contentId: ACTIVITY,
    ownerUserId: '0192f0c4-0000-7000-8000-000000000999',
    coAuthorIds: [],
    status,
    visibility: 'organisation',
    bankListed: false,
  };
  const app = express();
  app.use(
    appLaunchRoutes({
      resolveLtik: async () => ({
        principal,
        context: {} as LaunchContext,
        facts: {} as ResolvedLtik['facts'],
      }),
      access: { factsFor: async (id) => (id === ACTIVITY ? facts : undefined) },
      titleOf: async () => (reads.push('title'), 'Brøkar'),
      languageOf: async () => (reads.push('language'), language),
      learnerInfoOf: async (id) => (reads.push(`learnerInfo:${id}`), info),
    }),
  );
  app.use((_req, res) => void res.json({ launch: appLaunchOf(res) ?? null }));
  app.use(((error, _req, res, _next) => {
    res.status(error instanceof HttpError ? error.status : 500).json({ refused: true });
  }) satisfies ErrorRequestHandler);
  return { app, reads };
}

describe('[PED-032] the learner info in the Canvas launch', () => {
  it('[PED-032] a learner’s launch carries the estimated minutes and the purpose to the web app', async () => {
    // Arrange
    const { app, reads } = appWith(['learner'], 'published', {
      estimatedStudentMinutes: 15,
      learnerPurpose: 'Du øver før samlinga.',
    });
    // Act
    const res = await request(app).get('/app/play?ltik=good');
    // Assert
    expect(res.body.launch).toEqual({
      contentId: ACTIVITY,
      title: 'Brøkar',
      mayEdit: false,
      locale: 'nn',
      estimatedStudentMinutes: 15,
      learnerPurpose: 'Du øver før samlinga.',
    });
    expect(reads).toContain(`learnerInfo:${ACTIVITY}`);
  });

  it('[PED-032] nothing is added when the activity has neither, and the header stays Latin-1', async () => {
    // Arrange
    const { app } = appWith(['learner'], 'published', {});
    // Act
    const { launch } = (await request(app).get('/app/play?ltik=good')).body;
    // Assert
    expect(Object.keys(launch).sort()).toEqual(['contentId', 'locale', 'mayEdit', 'title']);
    const value = launchHeaderValue({ ...launch, learnerPurpose: 'Kvifor? Fordi æ, ø og å' });
    expect(/^[\x20-\x7e]*$/.test(value)).toBe(true);
  });

  it('[UD-010] a language tag longer than the web app accepts is left out, so the launch still works', async () => {
    // Arrange
    const longest = `en-${'abcdefgh-'.repeat(3)}abcde`;
    const tooLong = `${longest}x`;
    // Act
    const kept = (
      await request(appWith(['learner'], 'published', {}, longest).app).get('/app/play?ltik=good')
    ).body.launch;
    const dropped = (
      await request(appWith(['learner'], 'published', {}, tooLong).app).get('/app/play?ltik=good')
    ).body.launch;
    // Assert
    expect([longest.length, LAUNCH_LANGUAGE_MAX_LENGTH]).toEqual([35, 35]);
    expect(kept.language).toBe(longest);
    expect(dropped).toMatchObject({ contentId: ACTIVITY, title: 'Brøkar' });
    expect(dropped).not.toHaveProperty('language');
  });

  it('[PROD-004] a draft launched by a learner is refused before the minutes or the purpose are read', async () => {
    // Arrange
    const { app, reads } = appWith(['learner'], 'draft', { estimatedStudentMinutes: 15 });
    // Act
    const res = await request(app).get('/app/play?ltik=good');
    // Assert
    expect(res.status).toBe(404);
    expect(reads).toEqual([]);
  });
});
