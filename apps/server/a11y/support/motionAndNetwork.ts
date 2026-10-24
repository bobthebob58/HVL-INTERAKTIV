/**
 * motionAndNetwork — two recorders the suites attach to a page: the CSS animations and transitions still running
 * in it and its frames, and every network request a browser context makes (with what the policy refused).
 *
 * Why: UD-009 (2.3.3) asks that nothing moves when a person has asked for reduced motion; DATA-011 asks that
 *      student-facing pages load nothing from a third party. Both are facts of the running page that only the
 *      browser knows: `document.getAnimations()` for the first, the context's request events for the second.
 * Spec: UD-009, DATA-011
 * Invariants:
 *   - An animation counts as moving when it is running and lasts longer than 1 ms or repeats for ever; the themes
 *     shorten every duration to 0.01 ms under reduced motion (UD-009), so nothing else may remain.
 *   - The request log holds every request of every page and frame of the context, also failed ones; `data:`,
 *     `blob:` and `about:` addresses are not requests to anyone.
 *   - A request the Content Security Policy refuses never reaches the network and is logged as refused.
 * Collaborators: the suites that use it (see Tests).
 * Tests: apps/server/a11y/reflowAndMotion.a11y.test.ts, apps/server/a11y/firstParty.a11y.test.ts
 */
import type { BrowserContext, Page } from 'playwright-core';

/** Runs in the page: the animations and transitions that still move. */
function movingAnimations(): string[] {
  return document
    .getAnimations()
    .filter((a) => {
      const timing = a.effect?.getComputedTiming();
      const duration = typeof timing?.duration === 'number' ? timing.duration : 0;
      return a.playState === 'running' && (duration > 1 || timing?.iterations === Infinity);
    })
    .map((a) => {
      const target = (a.effect as KeyframeEffect | null)?.target;
      const what =
        a instanceof CSSAnimation
          ? `animation ${a.animationName}`
          : a instanceof CSSTransition
            ? `transition ${a.transitionProperty}`
            : 'script animation';
      return `${what} on ${target ? `${target.tagName.toLowerCase()}.${[...target.classList].join('.')}` : '?'}`;
    });
}

/**
 * The animations still moving in a page and its frames.
 * @param page - A loaded page.
 * @returns One line per moving animation, with its frame.
 */
export async function runningAnimations(page: Page): Promise<string[]> {
  const found: string[] = [];
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    const where =
      frame === page.mainFrame()
        ? 'page'
        : frame.url().startsWith('about:')
          ? 'H5P iframe'
          : new URL(frame.url()).pathname;
    found.push(...(await frame.evaluate(movingAnimations)).map((line) => `${where}: ${line}`));
  }
  return found;
}

/** What a context asked the network for. */
export interface RequestLog {
  /** Every requested URL, in order. */
  readonly urls: string[];
  /** Console messages in which the Content Security Policy refused a load. */
  readonly refused: string[];
}

/**
 * Starts recording a context's requests; attach it before the first page opens.
 * @param context - The browser context.
 * @returns The log, filled as the pages load.
 */
export function recordRequests(context: BrowserContext): RequestLog {
  const log: RequestLog = { urls: [], refused: [] };
  context.on('request', (request) => {
    if (!/^(data|blob|about):/.test(request.url())) log.urls.push(request.url());
  });
  context.on('console', (message) => {
    if (/Content Security Policy/.test(message.text())) log.refused.push(message.text().slice(0, 300));
  });
  return log;
}

/**
 * The requests that went to another origin than the tool's.
 * @param log - A context's log.
 * @param base - The tool's origin.
 * @returns The third-party URLs.
 */
export const thirdPartyRequests = (log: RequestLog, base: string): string[] =>
  log.urls.filter((url) => new URL(url).origin !== new URL(base).origin);
