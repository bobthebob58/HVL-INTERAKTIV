/**
 * Probe P1 (S6) kept as a test, the question types: MultiChoice, Blanks,
 * DragText (also resumed after a reload), QuestionSet and a two-task Column.
 * Each is played as a learner in full Chromium, inside a same-origin host page as the web app frames the player
 * (D-102, D-065), and every xAPI statement H5P dispatches is recorded. The test pins what step 3's bridge (LTI-010),
 * ingestion route (LTI-011) and mapper (DATA-012) rely on, so an upgrade of H5P Core or a content type fails here
 * first, naming the finding it broke (F1 … F11, listed in ./support/xapiFindings.ts). It also checks, or writes with
 * `XAPI_FIXTURES_WRITE=1`, the curated fixtures in ../fixtures/xapi/ that step 3's unit tests read. The container and
 * media types are in ./xapiContainerTypes.browser.int.test.ts.
 *
 * Spec: H5P-009
 */
import { afterAll, beforeAll, it } from 'vitest';
import { describeWithFullChromium } from '../support/fullChromium.js';
import { describeWithRealPackages } from '../support/realPackages.js';
import { openRealTypesServer, type RealTypesServer } from '../support/realTypesPlayer.js';
import { describeWithServices } from '../support/services.js';
import { createTwoTaskColumn, expectP1, playRealType } from './support/xapiTypeRun.js';

const PLAY_MS = 90_000;

describeWithServices('[H5P-009] xAPI statements of the real question types (probe P1)', () => {
  describeWithRealPackages('[H5P-009] the real question types', () => {
    let server: RealTypesServer;
    let twoTaskColumn: string;
    beforeAll(async () => {
      server = await openRealTypesServer();
      twoTaskColumn = await createTwoTaskColumn(server);
    }, 180_000);
    afterAll(() => server?.close());

    describeWithFullChromium('[H5P-009] played in full Chromium', (browser) => {
      it(
        '[H5P-009] H5P.MultiChoice: a root answered with success and the option index',
        async () => {
          // Act
          const run = await playRealType(browser(), server, 'H5P.MultiChoice');
          // Assert
          expectP1(run, {
            onLoad: [['root attempted']],
            kinds: ['root answered', 'root attempted', 'root interacted'],
            rootResults: [{ view: 1, verb: 'answered', score: '1/1', success: true }],
            responses: { choice: ['0'] },
          });
        },
        PLAY_MS,
      );

      it(
        '[H5P-009] H5P.Blanks: a root answered without success; gaps joined by [,], empty kept',
        async () => {
          // Act
          const run = await playRealType(browser(), server, 'H5P.Blanks');
          // Assert
          expectP1(run, {
            onLoad: [['root attempted']],
            kinds: ['root answered', 'root attempted', 'root interacted'],
            rootResults: [{ view: 1, verb: 'answered', score: '6/7' }],
            responses: { 'fill-in': ['quiz[,]samtale[,]refleksjon[,]formativ[,]vidare[,]teksting[,]'] },
          });
        },
        PLAY_MS,
      );

      it(
        '[H5P-009] H5P.DragText: a root answered, words joined by [,]; a resume sends restore events first',
        async () => {
          // Act
          const run = await playRealType(browser(), server, 'H5P.DragText');
          // Assert: restoring each dropped word sends an `interacted` with no context, before the root attempted
          const restored = Array<string>(3).fill('no context interacted');
          expectP1(run, {
            onLoad: [['root attempted'], [...restored, 'root attempted']],
            kinds: ['no context interacted', 'root answered', 'root attempted', 'root interacted'],
            rootResults: [{ view: 1, verb: 'answered', score: '3/4' }],
            responses: { 'fill-in': ['læringsaktivitetar[,]samlinga[,]undervegsvurdering[,]'] },
          });
        },
        PLAY_MS,
      );

      it(
        '[H5P-009] H5P.QuestionSet: «Avslutt» sends a root completed with the summed score and success',
        async () => {
          // Act
          const run = await playRealType(browser(), server, 'H5P.QuestionSet');
          // Assert
          expectP1(run, {
            onLoad: [['root attempted', 'sub attempted']],
            kinds: [
              'root completed',
              'root progressed',
              'root attempted',
              'sub answered',
              'sub attempted',
              'sub interacted',
            ].sort(),
            rootResults: [{ view: 1, verb: 'completed', score: '6/9', success: true }],
            subResults: [
              'H5P.MultiChoice-1.16 answered 1/1',
              'H5P.Blanks-1.14 answered 2/3',
              'H5P.DragText-1.10 answered 1/3',
              'H5P.MultiChoice-1.16 answered 2/2',
            ],
            responses: {
              choice: ['0', '0[,]1'],
              'fill-in': ['undervegsvurdering[,]framover[,]zzz', 'teksting[,]lydspor[,]'],
            },
          });
        },
        PLAY_MS,
      );

      it(
        '[H5P-009] H5P.Column: nothing on load; a root completed only once every task is answered',
        async () => {
          // Act
          const run = await playRealType(browser(), server, 'H5P.Column', twoTaskColumn);
          // Assert
          expectP1(run, {
            onLoad: [[]],
            kinds: ['root completed', 'root progressed', 'sub answered', 'sub interacted'],
            rootResults: [{ view: 1, verb: 'completed', score: '1/2' }],
            subResults: ['H5P.MultiChoice-1.16 answered 1/1', 'H5P.MultiChoice-1.16 answered 0/1'],
            responses: { choice: ['0', '1'] },
          });
        },
        PLAY_MS,
      );
    });
  });
});
