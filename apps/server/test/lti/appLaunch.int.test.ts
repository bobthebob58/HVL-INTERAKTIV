/**
 * Integration tests for `/app/play`'s launch check: a valid launch hands the web app its activity, title, Edit
 * decision, locale and the activity's own language when it states one; an invalid ltik and an activity the launch
 * may not view stop before the web app, and a title or language is never read for a refused activity. The ltik
 * resolver, the activity facts and the title and language lookups are stubs.
 *
 * Spec: LTI-006, LTI-003, PROD-004, H5P-006, UD-010
 */
import express, { type ErrorRequestHandler } from 'express';
import type { LaunchContext } from 'ltijs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { sealPrincipal, type Principal, type Role } from '../../src/auth/Principal.js';
import type { ContentFacts } from '../../src/h5p/permissions/ContentAccessRepository.js';
import { authError } from '../../src/http/authErrors.js';
import { HttpError } from '../../src/http/HttpError.js';
import type { ResolvedLtik } from '../../src/lti/ltikPrincipal.js';
import { appLaunchRoutes } from '../../src/lti/play/appLaunchRoutes.js';
import { appLaunchOf } from '../../src/web/appLaunch.js';

const OWNER = '0192f0c4-0000-7000-8000-000000000001';
const ACTIVITY = '0192f0c4-1111-7000-8000-000000000001';
const principal = (roles: Role[], contentId = ACTIVITY): Principal =>
  sealPrincipal({
    userId: OWNER,
    learnerKey: 'lk-1',
    roles,
    mode: 'lti',
    locale: 'nb',
    hvlMember: false,
    feideAuthenticated: false,
    studentAuthor: false,
    lti: {
      platformId: 'p',
      deploymentId: 'd',
      contextId: 'c',
      contentId,
      messageType: 'LtiResourceLinkRequest',
    },
  });

/** An app with the route, stubs, and a last handler that shows what reached the web app. */
function appWith(who: Principal, facts: Partial<ContentFacts> | undefined, language?: string) {
  const titlesRead: string[] = [];
  const app = express();
  app.use(
    appLaunchRoutes({
      resolveLtik: async (ltik) => {
        if (ltik !== 'good') throw authError('hvl:ltik-invalid');
        return { principal: who, context: {} as LaunchContext, facts: {} as ResolvedLtik['facts'] };
      },
      access: {
        factsFor: async (id) =>
          facts && id === ACTIVITY
            ? {
                contentId: ACTIVITY,
                ownerUserId: OWNER,
                coAuthorIds: [],
                status: 'published',
                visibility: 'organisation',
                bankListed: false,
                ...facts,
              }
            : undefined,
      },
      titleOf: async (id) => (titlesRead.push(id), 'Brøkar'),
      languageOf: async (id) => (titlesRead.push(`language:${id}`), language),
    }),
  );
  app.use((_req, res) => void res.json({ reachedWeb: true, launch: appLaunchOf(res) ?? null }));
  app.use(((error, _req, res, _next) => {
    const known = error instanceof HttpError;
    res.status(known ? error.status : 500).json({ refused: known ? error.errorCode : 'unknown' });
  }) satisfies ErrorRequestHandler);
  return { app, titlesRead };
}

describe('[LTI-006] the launch check of /app/play', () => {
  it('[LTI-006] the owner’s launch reaches the web app with the activity, title, Edit right and launch locale', async () => {
    const { app } = appWith(principal(['author']), {});
    const res = await request(app).get('/app/play?ltik=good');
    expect(res.body).toEqual({
      reachedWeb: true,
      launch: { contentId: ACTIVITY, title: 'Brøkar', mayEdit: true, locale: 'nb' },
    });
  });

  it('[UD-010] the activity’s own language goes with the launch, so the page can mark the title with it', async () => {
    // Arrange
    const stated = appWith(principal(['learner']), {}, 'nn');
    const unstated = appWith(principal(['learner']), {});
    // Act
    const withLanguage = await request(stated.app).get('/app/play?ltik=good');
    const without = await request(unstated.app).get('/app/play?ltik=good');
    // Assert
    expect(withLanguage.body.launch).toEqual({
      contentId: ACTIVITY,
      title: 'Brøkar',
      mayEdit: false,
      locale: 'nb',
      language: 'nn',
    });
    expect(without.body.launch).not.toHaveProperty('language');
  });

  it('[H5P-006] a student and a teacher who does not own the activity see it without the Edit right', async () => {
    for (const who of [principal(['learner']), principal(['author'])]) {
      const owner = who.roles.includes('author') ? '0192f0c4-0000-7000-8000-000000000999' : OWNER;
      const { app } = appWith(who, { ownerUserId: owner });
      expect((await request(app).get('/app/play?ltik=good')).body.launch.mayEdit).toBe(false);
    }
  });

  it('[PROD-004] a draft for a student, an unknown activity and a launch without one stop before the web app', async () => {
    // Arrange
    const cases = [
      appWith(principal(['learner']), { status: 'draft' }),
      appWith(principal(['author']), undefined),
      appWith(principal(['author'], ''), {}),
    ];
    // Act
    const answers = await Promise.all(cases.map(({ app }) => request(app).get('/app/play?ltik=good')));
    // Assert
    expect(answers.map((r) => [r.status, r.body.refused])).toEqual([
      [404, 'hvl:activity-unavailable'],
      [404, 'hvl:activity-unavailable'],
      [404, 'hvl:activity-unavailable'],
    ]);
    expect(cases.flatMap((c) => c.titlesRead)).toEqual([]);
  });

  it('[LTI-003] a missing or invalid ltik is refused before anything else', async () => {
    const { app, titlesRead } = appWith(principal(['author']), {});
    for (const path of ['/app/play', '/app/play?ltik=bad']) {
      expect((await request(app).get(path)).body).toEqual({ refused: 'hvl:ltik-invalid' });
    }
    expect(titlesRead).toEqual([]);
  });
});
