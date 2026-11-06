/**
 * nynorskActivities — a MultiChoice and a QuestionSet made in Nynorsk the way the editor and the pattern creator make
 * them, every text at the default of the library's language file with HVL's language overlay laid over it
 * (`content/h5p-tekstar/`, D-111), published as the run author's, once per server.
 *
 * Why: the example packages the suites play were made before the overlay, so their texts for assistive technology
 *      are still English (`a11yCheck` …). UD-030 must also see what a learner meets in an activity made now: the
 *      player and the editor with the overlay's Nynorsk names, labels and results page (H5P-008). The params follow
 *      apps/server/test/h5p/languageOverlay/languageOverlay.browser.int.test.ts, which proves the overlay's texts.
 * Spec: UD-030, UD-010, H5P-008
 * Invariants:
 *   - Saved through the editor's own save (`saveOrUpdateContent`), so H5P's validator checks the params; owned by the
 *     run author, so ../../test/support/appTestbed.ts's cleanup removes them.
 *   - Made once per server and shared by its tests; no test changes them.
 * Collaborators: ../axeContentTypes.a11y.test.ts, ../axeEditor.a11y.test.ts,
 *   ../../src/learningDesign/patterns/semanticDefaults.ts, ../../test/support/realWebApp.ts.
 * Tests: apps/server/a11y/axeContentTypes.a11y.test.ts, apps/server/a11y/axeEditor.a11y.test.ts
 */
import type { IContentMetadata } from '@lumieducation/h5p-server';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { withSemanticDefaults, type Params } from '../../src/learningDesign/patterns/semanticDefaults.js';
import type { RealWebApp } from '../../test/support/realWebApp.js';
import { testActor } from '../../test/support/testActors.js';

/** The two types made in Nynorsk, by main library. */
export const NYNORSK_TYPES = ['H5P.MultiChoice', 'H5P.QuestionSet'] as const;

/** One of the two. */
export type NynorskType = (typeof NYNORSK_TYPES)[number];

/** A text the overlay gives MultiChoice's «Sjekk» button for assistive technology (nn.json leaves it English). */
export const OVERLAY_CHECK_NAME = 'Sjekk svara. Svara blir merkte som rette, feil eller utan svar.';

/** A label the overlay gives each type's editor form (its nn.json leaves it English). */
export const OVERLAY_EDITOR_LABEL: Readonly<Record<NynorskType, string>> = {
  'H5P.MultiChoice': 'Namn på «Send inn»-knappen',
  'H5P.QuestionSet': 'Namn på «Neste»-knappen',
};

const LIBRARY: Readonly<Record<NynorskType, string>> = {
  'H5P.MultiChoice': 'H5P.MultiChoice 1.16',
  'H5P.QuestionSet': 'H5P.QuestionSet 1.21',
};

const question = (id: string, text: string) => ({
  library: LIBRARY['H5P.MultiChoice'],
  subContentId: id,
  metadata: { title: text, license: 'U' },
  params: {
    question: `<p>${text}</p>`,
    answers: [
      { text: '<div>Medan læringa held på</div>', correct: true },
      { text: '<div>Etter eksamen</div>', correct: false },
    ],
  },
});

const PARAMS: Readonly<Record<NynorskType, Params>> = {
  'H5P.MultiChoice': question('mc', 'Når skjer undervegsvurdering?').params,
  'H5P.QuestionSet': {
    introPage: { showIntroPage: false },
    questions: [question('q1', 'Spørsmål 1'), question('q2', 'Spørsmål 2')],
  },
};

const made = new WeakMap<RealWebApp, Promise<Readonly<Record<NynorskType, string>>>>();

/** Saves both activities and publishes them. */
async function make(app: RealWebApp): Promise<Readonly<Record<NynorskType, string>>> {
  const { editor } = app.tb.runtime;
  const author = asAccountUser(testActor('author', { accountId: app.authorId }));
  const ids: Partial<Record<NynorskType, string>> = {};
  for (const type of NYNORSK_TYPES) {
    const library = LIBRARY[type];
    const params = await withSemanticDefaults(PARAMS[type], library, editor.libraryManager, 'nn');
    const metadata = { title: `${type} på nynorsk`, license: 'U', defaultLanguage: 'nn' };
    const id = await editor.saveOrUpdateContent(
      undefined,
      params,
      metadata as unknown as IContentMetadata,
      library,
      author,
    );
    await app.tb.db.h5PContent.update({
      where: { id },
      data: { status: 'published', visibility: 'organisation' },
    });
    ids[type] = id;
  }
  return ids as Record<NynorskType, string>;
}

/**
 * The two activities made in Nynorsk on this server, made on the first call.
 * @param app - The running server, with the real libraries and the overlay (../../src/h5p/createH5pRuntime.ts).
 * @returns Each type's activity ID.
 */
export function nynorskActivities(app: RealWebApp): Promise<Readonly<Record<NynorskType, string>>> {
  let ids = made.get(app);
  if (!ids) {
    ids = make(app);
    made.set(app, ids);
  }
  return ids;
}
