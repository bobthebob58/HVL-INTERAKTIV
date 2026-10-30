/**
 * Probe P1 (S6) kept as a test, the container and media types: CoursePresentation (also
 * resumed after a reload), InteractiveBook, ImageHotspots, BranchingScenario and InteractiveVideo.
 * Each is played as a learner in full Chromium, inside a same-origin host page as the web app frames the player
 * (D-102, D-065), and every xAPI statement H5P dispatches is recorded. The test pins what step 3's bridge (LTI-010),
 * ingestion route (LTI-011) and mapper (DATA-012) rely on, so an upgrade of H5P Core or a content type fails here
 * first, naming the finding it broke (F1 … F11, listed in ./support/xapiFindings.ts). It also checks, or writes with
 * `XAPI_FIXTURES_WRITE=1`, the curated fixtures in ../fixtures/xapi/ that step 3's unit tests read. The question types
 * are in ./xapiQuestionTypes.browser.int.test.ts.
 *
 * Spec: H5P-009
 */
import { afterAll, beforeAll, it } from 'vitest';
import { describeWithFullChromium } from '../support/fullChromium.js';
import { describeWithRealPackages } from '../support/realPackages.js';
import { openRealTypesServer, type RealTypesServer } from '../support/realTypesPlayer.js';
import { describeWithServices } from '../support/services.js';
import { expectP1, playRealType } from './support/xapiTypeRun.js';

const PLAY_MS = 90_000;

describeWithServices('[H5P-009] xAPI statements of the real container and media types (probe P1)', () => {
  describeWithRealPackages('[H5P-009] the real container and media types', () => {
    let server: RealTypesServer;
    beforeAll(async () => {
      server = await openRealTypesServer();
    }, 180_000);
    afterAll(() => server?.close());

    describeWithFullChromium('[H5P-009] played in full Chromium', (browser) => {
      it(
        '[H5P-009] H5P.CoursePresentation: the summary sends a root completed, and a resumed view sends it again',
        async () => {
          // Act
          const run = await playRealType(browser(), server, 'H5P.CoursePresentation');
          // Assert: the second root completed comes from the reload alone, with no learner action
          expectP1(run, {
            onLoad: [['root attempted'], ['root attempted', 'root progressed', 'root completed']],
            kinds: [
              'root attempted',
              'root completed',
              'root progressed',
              'sub answered',
              'sub attempted',
              'sub interacted',
            ],
            rootResults: [
              { view: 1, verb: 'completed', score: '1/1' },
              { view: 2, verb: 'completed', score: '1/1' },
            ],
            subResults: ['H5P.MultiChoice-1.16 answered 1/1'],
            responses: { choice: ['0'] },
          });
        },
        PLAY_MS,
      );

      it(
        '[H5P-009] H5P.InteractiveBook: nothing before «Les»; no root score and no «Send inn rapport»',
        async () => {
          // Act
          const run = await playRealType(browser(), server, 'H5P.InteractiveBook');
          // Assert: this holds until step 3 sets reportingIsEnabled (D-115, Q18), which adds «Send inn rapport»
          expectP1(run, {
            onLoad: [[]],
            kinds: ['root attempted', 'sub answered', 'sub completed', 'sub interacted', 'sub progressed'],
            rootResults: [],
            subResults: [
              'H5P.Column-1.22 completed 1/1',
              'H5P.MultiChoice-1.16 answered 1/1',
              'H5P.Column-1.22 completed 1/1',
            ],
            responses: { choice: ['0'] },
            observed: { submitButtons: 0 },
          });
        },
        PLAY_MS,
      );

      it(
        '[H5P-009] H5P.ImageHotspots: sends no statement at all',
        async () => {
          // Act
          const run = await playRealType(browser(), server, 'H5P.ImageHotspots');
          // Assert
          expectP1(run, {
            onLoad: [[]],
            kinds: [],
            rootResults: [],
            responses: {},
            observed: { popupsOpened: 3 },
          });
        },
        PLAY_MS,
      );

      it(
        '[H5P-009] H5P.BranchingScenario: the end screen sends a root completed; a choice carries no response',
        async () => {
          // Act
          const run = await playRealType(browser(), server, 'H5P.BranchingScenario');
          // Assert
          expectP1(run, {
            onLoad: [['root attempted', 'sub attempted']],
            kinds: ['root attempted', 'root completed', 'root progressed', 'sub attempted', 'sub interacted'],
            rootResults: [{ view: 1, verb: 'completed', score: '10/10' }],
            responses: {},
          });
        },
        PLAY_MS,
      );

      it(
        '[H5P-009] H5P.InteractiveVideo: the question sends a sub answered; no root score and no progressed',
        async () => {
          // Act
          const run = await playRealType(browser(), server, 'H5P.InteractiveVideo');
          // Assert
          expectP1(run, {
            onLoad: [['root attempted']],
            kinds: ['root attempted', 'sub answered', 'sub attempted', 'sub interacted'],
            rootResults: [],
            subResults: ['H5P.MultiChoice-1.16 answered 1/1'],
            responses: { choice: ['0'] },
          });
        },
        PLAY_MS,
      );
    });
  });
});
