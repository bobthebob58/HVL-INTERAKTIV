/**
 * patternCreationBench — the whole app (`openAppTestbed`) with the ten real content types (D-078), offering the
 * fixture pattern and a variant of it that names a library that is not installed, with a signed-in portal author;
 * plus the readings the creation tests make of a created activity.
 *
 * Why: PROD-001 creates an activity through the real route, the real editor save path and the real libraries, so the
 *      tests run the app as main.ts builds it; only the studio content's patterns are the fixture's (PED-011).
 * Spec: PROD-001, PED-011
 * Invariants:
 *   - The author is the mock Feide's run author (../../support/runFeideAuthor.ts), so the testbed's close removes
 *     it with every activity it created; the libraries are seeded into the testbed's own folder, removed on close,
 *     and only the seed audit rows this bench wrote are removed (by ID).
 *   - The validator is the production one with no captioned media origins, as the probe P1 reads it.
 * Collaborators: ../../support/appTestbed.ts, ../../support/fixturePattern.ts, ../../support/feideTestbed.ts,
 *   ../../support/realPackages.ts, ../../support/testLibraryAuditSink.ts.
 * Tests: apps/server/test/learningDesign/patterns/patternCreation.int.test.ts,
 *   apps/server/test/learningDesign/patterns/patternCreationGuards.int.test.ts
 */
import { rmSync } from 'node:fs';
import type { IUser } from '@lumieducation/h5p-server';
import request from 'supertest';
import { CSRF_HEADER } from '../../../src/auth/session/csrfToken.js';
import { loadValidationContext } from '../../../src/config/validationContext.js';
import { asAccountUser } from '../../../src/h5p/HvlH5pUser.js';
import { LibraryInstaller } from '../../../src/h5p/libraries/LibraryInstaller.js';
import { seedLibraries } from '../../../src/h5p/libraries/seedLibraries.js';
import type { Finding, ValidationMetadata } from '../../../src/validation/types.js';
import { createContentValidator } from '../../../src/validation/validateContent.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import {
  editedPatternFixture,
  FIXTURE_PATTERN_DIR,
  fixturePatterns,
  removePatternFixtureCopies,
  studioContentWithPatterns,
} from '../../support/fixturePattern.js';
import { REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { testActor } from '../../support/testActors.js';
import { TestLibraryAuditSink } from '../../support/testLibraryAuditSink.js';

/** The variant of the fixture whose TrueFalse question names a version that is not installed. */
export const UNAVAILABLE_PATTERN_ID = 'fixture-unavailable';

/** A running app that offers the fixture patterns, with a signed-in author. */
export interface PatternCreationBench {
  readonly tb: AppTestbed;
  /** The signed-in author's `User.id`. */
  readonly authorId: string;
  /** The author as Lumi's account view, to read stored activities. */
  readonly author: IUser;
  /** The signed-in author's session cookie, for a request without the CSRF token. */
  readonly cookie: string;
  /** POST /api/patterns/:patternId/activities as the signed-in author, with the CSRF token. */
  create(patternId: string, body: object): request.Test;
  close(): Promise<void>;
}

const unavailableVariant = () => {
  const root = editedPatternFixture(
    {
      [`${FIXTURE_PATTERN_DIR}/pattern.yaml`]: (t) =>
        t.replace('id: fixture-check', `id: ${UNAVAILABLE_PATTERN_ID}`),
      [`${FIXTURE_PATTERN_DIR}/skeleton.H5P.QuestionSet.json`]: (t) =>
        t.replace('H5P.TrueFalse 1.8', 'H5P.TrueFalse 1.99'),
    },
    { 'fixture-check': UNAVAILABLE_PATTERN_ID },
  );
  return fixturePatterns(root).patterns;
};

/**
 * Starts the app with the real libraries and the fixture patterns, and signs the author in.
 * @returns The bench; call `close` in `afterAll`.
 */
export async function openPatternCreationBench(): Promise<PatternCreationBench> {
  const patterns = {
    patterns: [...fixturePatterns().patterns, ...unavailableVariant()],
    libraryCheck: 'not-requested',
  } as const;
  const tb = await openAppTestbed([], {
    runAuthor: true,
    studioContent: studioContentWithPatterns(patterns),
  });
  const seedAudit = new TestLibraryAuditSink(tb.db);
  const { packageImporter, libraryManager } = tb.runtime.editor;
  await seedLibraries(REAL_PACKAGES_DIR, new LibraryInstaller(packageImporter, seedAudit, libraryManager));
  const cookie = (await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'author')).sessionCookie ?? '';
  const csrf = (await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken as string;
  const authorId = await tb.feideAccount('author');
  return {
    tb,
    authorId,
    cookie,
    author: asAccountUser(testActor('author', { accountId: authorId })),
    create: (patternId, body) =>
      request(tb.app)
        .post(`/api/patterns/${patternId}/activities`)
        .set('Cookie', cookie)
        .set(CSRF_HEADER, csrf)
        .send(body),
    close: async () => {
      await seedAudit.remove();
      await tb.close();
      rmSync(tb.env.H5P_LIBRARY_DIR, { recursive: true, force: true });
      removePatternFixtureCopies();
    },
  };
}

const validate = createContentValidator(loadValidationContext({ CAPTIONED_MEDIA_ORIGINS: [] }));

/**
 * The validator's findings on a stored activity, as the publish gate reads it.
 * @param bench - The bench.
 * @param contentId - The activity.
 * @returns Its findings in Nynorsk.
 */
export async function storedFindings(
  bench: PatternCreationBench,
  contentId: string,
): Promise<readonly Finding[]> {
  const { h5p, params } = await bench.tb.runtime.editor.getContent(contentId, bench.author);
  const main = h5p.preloadedDependencies.find((d) => d.machineName === h5p.mainLibrary);
  return validate({
    mainLibrary: `${h5p.mainLibrary} ${main?.majorVersion ?? 0}.${main?.minorVersion ?? 0}`,
    params: params.params,
    // WHY: h5p.json as stored is the metadata the publish gate validates; Lumi's type has no index signature.
    metadata: h5p as unknown as ValidationMetadata,
    locale: 'nn',
  });
}
