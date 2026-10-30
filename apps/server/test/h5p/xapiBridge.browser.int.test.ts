/**
 * Browser integration tests of the xAPI bridge in the real player (full Chromium, real MultiChoice and QuestionSet):
 * a learner's statements arrive at a test endpoint once each, cut down, with the CSRF token and the right attempt IDs,
 * the root result sent at «Avslutt» arrives through the `pagehide` flush, H5P's own iframe embedding still sends each
 * statement once, and an author's preview loads no bridge and sends nothing.
 *
 * Spec: LTI-010, H5P-009
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithFullChromium } from '../support/fullChromium.js';
import type { TestActor } from '../support/httpTestbed.js';
import { describeWithRealPackages } from '../support/realPackages.js';
import { openRealTypesServer, type RealTypesServer } from '../support/realTypesPlayer.js';
import { describeWithServices } from '../support/services.js';
import { openXapiPlay } from './support/xapiCapture.js';
import {
  bridgeFacts,
  describeItems,
  itemsFrom,
  recordXapiBatches,
  resentAsExactCopies,
  useH5pIframeEmbedding,
  waitForStatements,
  type ReceivedBatch,
} from './support/xapiBridgeEndpoint.js';
import { CHECK, QUESTION_SCRIPTS, rootSent } from './support/xapiLearnerQuestions.js';

const PLAY_MS = 90_000;
const CSRF = 'csrf-token-of-the-test-session';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describeWithServices('[LTI-010] the xAPI bridge in the real player', () => {
  describeWithRealPackages('[LTI-010] with the real MultiChoice and QuestionSet', () => {
    let server: RealTypesServer;
    let received: ReceivedBatch[];
    let learner: TestActor;
    beforeAll(async () => {
      server = await openRealTypesServer();
      received = recordXapiBatches(server);
      learner = await server.tb.actor('learner', { urlToken: { name: 'csrf', value: CSRF } });
    }, 180_000);
    afterAll(() => server?.close());
    const id = (type: string) => server.ids.get(type) ?? '';

    describeWithFullChromium('[LTI-010] played in full Chromium', (browser) => {
      it(
        '[LTI-010] MultiChoice: what the server stores arrives once each, cut down; a retry is a new attempt',
        async () => {
          // Arrange
          const play = await openXapiPlay(browser(), server, id('H5P.MultiChoice'), learner);
          try {
            // Act: a wrong answer and «Sjekk», then «Prøv igjen», the right answer and «Sjekk»
            for (const [round, option] of [
              ['first', 1],
              ['retry', 0],
            ] as const) {
              play.step(round);
              if (round === 'retry') await play.frame().locator('.h5p-question-try-again:visible').click();
              await play.frame().locator('.h5p-answer').nth(option).click();
              await play.frame().locator(CHECK).first().click();
              await play.until('root answered', rootSent(play, 'answered'));
            }
            await waitForStatements(received, learner, 3);
            // Assert
            const items = itemsFrom(received, learner);
            expect(describeItems(items, id('H5P.MultiChoice'))).toEqual([
              'attempted root 1',
              'answered root 1',
              'answered root 2',
            ]);
            expect(new Set(items.map((i) => i.statementId)).size).toBe(items.length);
            expect(new Set(items.map((i) => i.attemptId.split(':')[0])).size).toBe(1);
            expect(items.every((i) => UUID.test(i.statementId))).toBe(true);
            expect(JSON.stringify(items)).not.toMatch(/actor|mailto|en-US|undervegsvurdering/i);
            const batches = received.filter((b) => b.actor === learner.header[1]);
            const version = await server.tb.db.h5PContent.findUnique({
              where: { id: id('H5P.MultiChoice') },
            });
            for (const batch of batches) {
              expect(batch.headers).toEqual({
                authorization: undefined,
                csrf: CSRF,
                contentType: 'application/json',
              });
              expect(batch.body).toMatchObject({
                contentId: id('H5P.MultiChoice'),
                contentVersion: version?.version,
              });
            }
          } finally {
            await play.close();
          }
        },
        PLAY_MS,
      );

      it(
        '[LTI-010] QuestionSet: leaving the page right after «Avslutt» still delivers the root completed',
        async () => {
          // Arrange
          const before = itemsFrom(received, learner).length;
          const play = await openXapiPlay(browser(), server, id('H5P.QuestionSet'), learner);
          try {
            // Act: four answers and «Avslutt», then away before the next 2-second batch
            await QUESTION_SCRIPTS['H5P.QuestionSet']?.play(play, server);
            // WHY: Playwright's request interception (the host page's route) drops keepalive requests of an unloading
            // frame, which a real browser sends; without a route the flush reaches the server.
            await play.page.context().unrouteAll({ behavior: 'wait' });
            await play.page.goto('about:blank');
            await waitForStatements(received, learner, before + 6);
            // Assert: sub attempted, interacted and progressed are never sent (D-115)
            const items = itemsFrom(received, learner).slice(before);
            const once = [...new Map(items.map((i) => [i.statementId, i])).values()];
            expect(describeItems(once, id('H5P.QuestionSet'))).toEqual([
              'attempted root 1',
              ...Array<string>(4).fill('answered sub 1'),
              'completed root 1',
            ]);
            // WHY: a batch still in flight at pagehide goes again in the flush, as an exact copy the server skips (D-115).
            expect(resentAsExactCopies(items)).toBe(true);
          } finally {
            await play.close();
          }
        },
        PLAY_MS,
      );

      it(
        '[H5P-009] in H5P’s own iframe embedding each statement still arrives once, from the player document',
        async () => {
          // Arrange
          const other = await server.tb.actor('learner');
          const context = await browser().newContext();
          await context.setExtraHTTPHeaders({ [other.header[0]]: other.header[1] });
          await useH5pIframeEmbedding(context);
          const page = await context.newPage();
          try {
            await page.goto(`${server.base}/h5p/play/${id('H5P.MultiChoice')}`);
            const content = page.frameLocator('iframe.h5p-iframe');
            // Act
            await content.locator('.h5p-answer').nth(0).click();
            await content.locator(CHECK).first().click();
            await waitForStatements(received, other, 2);
            // Assert
            const items = itemsFrom(received, other);
            expect(describeItems(items, id('H5P.MultiChoice'))).toEqual([
              'attempted root 1',
              'answered root 1',
            ]);
            expect(page.frames().length).toBe(2);
            expect(await bridgeFacts(page.mainFrame())).toMatchObject({ started: true, config: true });
          } finally {
            await context.close();
          }
        },
        PLAY_MS,
      );

      it(
        '[H5P-009] an author’s preview loads no bridge and no reporting, and sends nothing',
        async () => {
          // Arrange
          const play = await openXapiPlay(browser(), server, id('H5P.MultiChoice'), server.author);
          try {
            // Act
            const facts = await bridgeFacts(play.frame());
            await QUESTION_SCRIPTS['H5P.MultiChoice']?.play(play, server);
            await new Promise((resolve) => setTimeout(resolve, 2_500));
            // Assert
            expect(facts).toEqual({
              started: false,
              config: false,
              scripts: 0,
              coreScripts: 0,
              reporting: undefined,
            });
            expect(itemsFrom(received, server.author)).toEqual([]);
          } finally {
            await play.close();
          }
        },
        PLAY_MS,
      );
    });
  });
});
