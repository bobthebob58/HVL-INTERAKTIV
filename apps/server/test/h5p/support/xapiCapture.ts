/**
 * xapiCapture — plays a real activity framed in a same-origin host page, as the web app frames the player, and
 * records every xAPI statement H5P dispatches, in whichever frame a listener sees it.
 *
 * Why: probe P1 (D-102) found that every statement reaches the player document's `H5P.externalDispatcher` once and
 *      the top window never; the bridge (LTI-010) relies on it. So the capture listens in every frame, not only
 *      where the bridge will, and marks an event object that reaches a second listener (H5P relays the same object
 *      from its own iframes, finding F3).
 * Spec: H5P-009
 * Invariants:
 *   - The init script runs in every frame before any page script and only listens; H5P runs unchanged.
 *   - Each statement is recorded with its view (page load), the learner step current when it arrived, and its frame.
 *   - The host page is answered by the browser itself, so the server under test is not changed.
 * Collaborators: ../../support/realTypesPlayer.ts (the server), ./xapiCapturePage.ts (what runs in the browser),
 *   ./xapiStatementShape.ts, playwright-core.
 * Tests: ../xapiQuestionTypes.browser.int.test.ts, ../xapiContainerTypes.browser.int.test.ts
 */
import { setTimeout as delay } from 'node:timers/promises';
import type { Browser, Frame, Page } from 'playwright-core';
import type { RealTypesServer } from '../../support/realTypesPlayer.js';
import {
  CAPTURE_SCRIPT,
  RECORD_BINDING,
  hostPage,
  readPlayerFacts,
  type PlayerFacts,
} from './xapiCapturePage.js';
import type { XapiStatement } from './xapiStatementShape.js';

/** Where a statement reached a listener: the player document, the top window or another frame (by path). */
export type CaptureFrame = 'player' | 'top' | `other ${string}`;

/** One statement as a listener saw it. */
export interface CapturedStatement {
  /** 1 for the first page load, 2 after the first reload. */
  readonly view: number;
  /** The learner step that was current when it arrived. */
  readonly step: string;
  readonly frame: CaptureFrame;
  /** The same event object had already reached another listener (H5P's iframe relay). */
  readonly seenBefore: boolean;
  readonly statement: XapiStatement;
}

/** A learner's session in one activity. */
export interface XapiPlay {
  readonly page: Page;
  readonly contentId: string;
  /** Everything captured so far, in arrival order. */
  readonly statements: CapturedStatement[];
  /** Uncaught errors in any frame (Playwright reports those of child frames on the page too). */
  readonly errors: string[];
  /** The facts of each view, in order. */
  readonly facts: PlayerFacts[];
  /** The player document of the current view. */
  frame(): Frame;
  /** Names the learner's next step; `until` looks only at statements from here on. */
  step(name: string): void;
  /** Waits for a statement of the current step that `match` accepts. */
  until(what: string, match: (s: CapturedStatement) => boolean): Promise<CapturedStatement>;
  /** Waits until no statement has arrived for `ms` (at most 8 s). */
  quiet(ms?: number): Promise<void>;
  /** Reloads the page around the player, which starts view n + 1. */
  reload(): Promise<void>;
  /** Closes the browser context, and with it every page of the session. */
  close(): Promise<void>;
}

// WHY: the waits poll on the test's own clock, never through the page, so a slow or stuck page still ends `until`
// at its deadline with the statements it got, instead of hanging until the test's timeout hides why.
const POLL_MS = 50;

/**
 * Opens `contentId` as `actor` in a host page and starts recording.
 * @param browser - The running full Chromium.
 * @param server - From `openRealTypesServer`.
 * @param contentId - The activity.
 * @param actor - Who plays it; the server's learner by default.
 * @returns The session at step `load` of view 1, once H5P has started the activity.
 */
export async function openXapiPlay(
  browser: Browser,
  server: RealTypesServer,
  contentId: string,
  actor = server.learner,
): Promise<XapiPlay> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.setExtraHTTPHeaders({ [actor.header[0]]: actor.header[1] });
  const playerPath = `/h5p/play/${contentId}`;
  const statements: CapturedStatement[] = [];
  const errors: string[] = [];
  const facts: PlayerFacts[] = [];
  let view = 1;
  let step = 'load';
  let mark = 0;
  await context.exposeBinding(
    RECORD_BINDING,
    ({ frame, page }, _kind: string, data: Record<string, unknown>) => {
      const path = new URL(frame.url()).pathname;
      const where: CaptureFrame =
        frame === page.mainFrame()
          ? 'top'
          : frame.parentFrame() === page.mainFrame() && path === playerPath
            ? 'player'
            : `other ${path}`;
      const statement = JSON.parse(String(data.json)) as XapiStatement;
      statements.push({ view, step, frame: where, seenBefore: data.seenBefore === true, statement });
    },
  );
  await context.addInitScript(CAPTURE_SCRIPT);
  await context.route(`${server.base}/xapi-host`, (route) =>
    route.fulfill({ contentType: 'text/html', body: hostPage(contentId) }),
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  let current: Frame | undefined;
  const started = async (): Promise<void> => {
    await page.waitForFunction((path) => document.querySelector(`iframe[src="${path}"]`), playerPath);
    current = page.frames().find((f) => new URL(f.url()).pathname === playerPath);
    if (!current) throw new Error(`no player frame for ${playerPath}`);
    await current.waitForFunction(
      () =>
        (window as { H5P?: { instances?: [] } }).H5P?.instances?.length ||
        document.querySelector('iframe.h5p-iframe'),
    );
    facts.push(await readPlayerFacts(page, current));
    // WHY: in H5P's own iframe the activity has no instance in the player document, so the learner script would
    // only time out; this names the finding instead (F1: the relay then sends each statement twice, D-115).
    if (facts.at(-1)?.h5pIframes)
      throw new Error('F1 H5P embeds the content in its own iframe, so each statement reaches two listeners');
  };
  try {
    await page.goto(`${server.base}/xapi-host`);
    await started();
  } catch (error) {
    await context.close();
    throw error;
  }
  const play: XapiPlay = {
    page,
    contentId,
    statements,
    errors,
    facts,
    frame: () => current!,
    step: (name) => {
      step = name;
      mark = statements.length;
    },
    until: async (what, match) => {
      for (const deadline = Date.now() + 20_000; Date.now() < deadline; await delay(POLL_MS)) {
        const found = statements.slice(mark).find(match);
        if (found) return found;
      }
      const seen = statements.slice(mark).map((s) => s.statement.verb.id.split('/').pop());
      throw new Error(`waited 20 s for ${what} in step "${step}"; this step got [${seen.join(', ')}]`);
    },
    quiet: async (ms = 700) => {
      let count = statements.length;
      let since = Date.now();
      for (const deadline = since + 8_000; Date.now() < deadline && Date.now() - since < ms;) {
        await delay(POLL_MS);
        if (statements.length !== count) [count, since] = [statements.length, Date.now()];
      }
    },
    reload: async () => {
      view += 1;
      play.step('reload');
      await page.reload();
      await started();
    },
    close: () => context.close(),
  };
  return play;
}
