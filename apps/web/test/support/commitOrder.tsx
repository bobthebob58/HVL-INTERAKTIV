/**
 * commitOrder — tools that force the order of React's commits, their passive effects and the fake API's answers, so a
 * component test can reproduce on every run an order a busy machine produces only now and then.
 *
 * Why: the S5 gate failed once under CPU load because React ran an earlier commit's passive effects (`useEffect`)
 *      after an answer had been handled. A test that waits for a busy machine proves nothing; these tools hold an
 *      answer until a chosen moment (`holdAnswer`, `gate`) and act right after a commit, before its passive effects
 *      (`watchCommits`), and they count what happened so the test can check that the order was forced.
 * Spec: NFR-004, UD-006
 * Invariants:
 *   - `next` comes before a commit's passive effects only when React defers them: a Default or Transition commit (an
 *     answer handled outside an event). A Sync commit (a discrete event, or a render that applies an update an earlier
 *     event left behind) runs them at its end, so a test checks `flushes`, never assumes the order.
 *   - The fake answers pass through promise steps only; `holdAnswer` adds none of its own timers.
 * Collaborators: ./fakeFetch.ts (`holdAnswer` wraps the `fetch` it installed), React's `Profiler` and its
 *   `onPostCommit` (development build).
 * Tests: used by apps/web/test/features/sharingFocusRace.test.tsx, apps/web/test/features/BankListingOrder.test.tsx.
 */
import { Profiler, type ComponentType, type ProfilerProps, type ReactElement } from 'react';
import { vi } from 'vitest';

// WHY: React's development build calls a Profiler's `onPostCommit` once a commit's passive effects have run, but
// @types/react does not declare the prop.
const WatchedProfiler = Profiler as unknown as ComponentType<
  ProfilerProps & { readonly onPostCommit: () => void }
>;

/** What `watchCommits` reports, and the step it runs after the next commit. */
export interface CommitWatch {
  /** Commits of the watched tree so far. */
  commits: number;
  /** Commits whose passive effects have run so far. */
  flushes: number;
  /**
   * Runs once, in a microtask right after the next commit: before that commit's passive effects when React defers
   * them (a Default or Transition commit), after them for a Sync commit; `flushes` tells which.
   */
  next: (() => void) | undefined;
  /** Puts a tree under the watch. */
  readonly wrap: (ui: ReactElement) => ReactElement;
}

/**
 * Watches the commits of the tree under test.
 * @returns The watch; render `watch.wrap(ui)`.
 */
export function watchCommits(): CommitWatch {
  const watch: CommitWatch = {
    commits: 0,
    flushes: 0,
    next: undefined,
    wrap: (ui) => (
      <WatchedProfiler id="watched" onRender={onRender} onPostCommit={() => (watch.flushes += 1)}>
        {ui}
      </WatchedProfiler>
    ),
  };
  function onRender() {
    watch.commits += 1;
    const step = watch.next;
    watch.next = undefined;
    if (step) queueMicrotask(step);
  }
  return watch;
}

/**
 * Lets the fake answers to `method` arrive only once `arrive` has resolved; through microtasks only, so an answer is
 * handled before React's next Scheduler task. Requests sent before the call are not held. It wraps the `fetch` in
 * place when called, so it is called after `fakeFetch`; a second call wraps the first.
 * @param method - The request's method.
 * @param arrive - Resolves when the answers may arrive.
 * @example
 * fakeFetch({ [`PUT ${BANK}`]: { status: 200, body: listed } });
 * const put = gate();
 * holdAnswer('PUT', put.opened);
 * // … press the button, then let the answer arrive:
 * put.open();
 */
export function holdAnswer(method: string, arrive: Promise<void>): void {
  const answer = globalThis.fetch;
  vi.stubGlobal('fetch', async (path: string, init: RequestInit = {}) => {
    if ((init.method ?? 'GET') !== method) return answer(path, init);
    await arrive;
    return answer(path, init);
  });
}

/**
 * A promise and the function that resolves it.
 * @returns `opened`, which resolves once `open` is called.
 */
export function gate(): { readonly open: () => void; readonly opened: Promise<void> } {
  let open = () => {};
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { open, opened };
}
