/**
 * Tests for the title of a page whose name loads in the browser: the server's title stands while it loads, the loaded
 * title replaces it, a late write of the server's title is undone, another page's title is never touched, and a
 * loaded title equal to the server's does not wake the watch without end.
 *
 * Spec: UD-013
 */
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoadedPageTitle } from '../../src/i18n/useLoadedPageTitle';

const SERVER = 'Mønster – HVL Interaktiv';
const LOADED = 'Testmønster – HVL Interaktiv';
/** Lets every queued MutationObserver callback run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('[UD-013] the title of a page that loads its name', () => {
  beforeEach(() => {
    document.title = SERVER;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('[UD-013] keeps the server’s title while loading, then names the page', () => {
    // Arrange
    const { rerender } = renderHook(({ title }) => useLoadedPageTitle(title, SERVER), {
      initialProps: { title: undefined as string | undefined },
    });
    const whileLoading = document.title;
    // Act
    rerender({ title: LOADED });
    // Assert
    expect([whileLoading, document.title]).toEqual([SERVER, LOADED]);
  });

  it('[UD-013] puts the loaded title back when the server’s title is written again after it', async () => {
    // Arrange
    renderHook(() => useLoadedPageTitle(LOADED, SERVER));
    // Act: what React does when it commits the metadata `<title>` late
    document.title = SERVER;
    // Assert
    await vi.waitFor(() => expect(document.title).toBe(LOADED));
  });

  it('[UD-013] leaves another page’s title alone, and stops watching once unmounted', async () => {
    // Arrange
    const { unmount } = renderHook(() => useLoadedPageTitle(LOADED, SERVER));
    // Act
    document.title = 'Læringsdesign – HVL Interaktiv';
    await settle();
    const afterNavigation = document.title;
    unmount();
    document.title = SERVER;
    await settle();
    // Assert
    expect([afterNavigation, document.title]).toEqual(['Læringsdesign – HVL Interaktiv', SERVER]);
  });

  it('[UD-013] does not wake itself when the loaded title is the server’s title (an activity named «Aktivitet»)', async () => {
    // Arrange: count the hook's observer callbacks; a loop is cut at 100 so it fails the test, not hangs the worker
    let callbacks = 0;
    vi.stubGlobal(
      'MutationObserver',
      class extends MutationObserver {
        constructor(callback: MutationCallback) {
          super((records, observer) => {
            callbacks += 1;
            if (callbacks > 100) observer.disconnect();
            else callback(records, observer);
          });
        }
      },
    );
    renderHook(() => useLoadedPageTitle(SERVER, SERVER));
    // Act: any later change in the head, e.g. a script or meta element Next.js inserts
    document.head.append(document.createElement('meta'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Assert
    expect(callbacks).toBeLessThanOrEqual(1);
    expect(document.title).toBe(SERVER);
  });
});
