/**
 * motionAndNetwork — two recorders the suites attach to a browser context: every CSS animation and transition that
 * runs in any of its pages and frames, from the first paint on, and every network request it makes (with what the
 * policy refused).
 *
 * Why: UD-009 (2.3.3) asks that nothing moves when a person has asked for reduced motion; DATA-011 asks that
 *      student-facing pages load nothing from a third party. Both are facts of the running page that only the
 *      browser knows. Motion must be recorded while it happens: H5P's feedback moves for 100–800 ms and starts
 *      after a click or a delay, so a look at `document.getAnimations()` after loading and after answering saw
 *      nothing in 9 of the 10 types even with every reduction removed.
 * Spec: UD-009, DATA-011
 * Invariants:
 *   - The motion recorder runs in every frame before the frame's own scripts (`addInitScript`), logs each
 *     animation or transition when it starts (`transitionrun`, `animationstart`) and samples
 *     `document.getAnimations()` every 50 ms, so script (Web Animations) motion is seen too; it re-adds its
 *     listeners at each sample, because `document.open()` (H5P writes its iframes) removes them.
 *   - Motion counts when it lasts longer than 1 ms or repeats for ever; the themes shorten every duration to
 *     0.01 ms under reduced motion (UD-009), so nothing else may remain.
 *   - The request log holds every request of every page and frame of the context, also failed ones; `data:`,
 *     `blob:` and `about:` addresses are not requests to anyone.
 *   - A request the Content Security Policy refuses never reaches the network and is logged as refused.
 * Collaborators: the suites that use it (see Tests).
 * Tests: apps/server/a11y/reflowAndMotion.a11y.test.ts (with a control that must record motion),
 *   apps/server/a11y/firstParty.a11y.test.ts
 */
import type { BrowserContext, Page } from 'playwright-core';

/** Runs in every frame before its scripts: keeps one line per animation or transition that moves. */
function motionRecorder(): void {
  const log = window as unknown as { __hvlMotion?: Set<string> };
  if (log.__hvlMotion) return;
  const seen = new Set<string>();
  log.__hvlMotion = seen;
  const sample = () => {
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getComputedTiming();
      const ms = typeof timing?.duration === 'number' ? timing.duration : 0;
      if (ms <= 1 && timing?.iterations !== Infinity) continue;
      const effect = animation.effect as KeyframeEffect | null;
      const target = effect?.target;
      const what =
        animation instanceof CSSAnimation
          ? `animation ${animation.animationName}`
          : animation instanceof CSSTransition
            ? `transition ${animation.transitionProperty}`
            : 'script animation';
      const on = target
        ? `${target.tagName.toLowerCase()}${[...target.classList].map((c) => `.${c}`).join('')}${effect?.pseudoElement ?? ''}`
        : '?';
      seen.add(`${what} ${timing?.iterations === Infinity ? 'endless' : `${Math.round(ms)} ms`} on ${on}`);
    }
  };
  const listen = () => {
    for (const type of ['transitionrun', 'animationstart']) window.addEventListener(type, sample, true);
  };
  listen();
  setInterval(() => (listen(), sample()), 50);
}

/**
 * Starts recording motion in every page and frame a context opens; call it before the first page opens.
 * @param context - The browser context.
 */
export const recordMotion = (context: BrowserContext): Promise<void> => context.addInitScript(motionRecorder);

/**
 * Everything that moved in a page and its frames since they loaded (`recordMotion`).
 * @param page - A page of a recorded context.
 * @returns One line per animation or transition that moved, with its frame, its length and its element.
 */
export async function recordedMotion(page: Page): Promise<string[]> {
  const found: string[] = [];
  for (const frame of page.frames()) {
    if (frame.isDetached()) continue;
    const where =
      frame === page.mainFrame()
        ? 'page'
        : frame.url().startsWith('about:')
          ? 'H5P iframe'
          : new URL(frame.url()).pathname;
    // WHY: a frame without the recorder would pass whatever moved in it, so its absence is reported as motion.
    const lines = await frame
      .evaluate(() => {
        const log = (window as unknown as { __hvlMotion?: Set<string> }).__hvlMotion;
        return log ? [...log] : ['the motion recorder is missing'];
      })
      .catch(() => [] as string[]); // a frame that went away meanwhile shows nothing any more
    found.push(...lines.map((line) => `${where}: ${line}`));
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
