/**
 * Unit tests for "Gå til feltet" on a title (src/h5p/render/client/editorFields.js and editorFieldReveal.js), run
 * without a browser with fake timers: `metadata.title` focuses the activity's title field, a sub-content's
 * `metadata.title` its own, and a sub-content whose library turns metadata off says why it has no title in the
 * editor instead of falling back silently (D-086). The real editor: ../editorGoToTitle.browser.int.test.ts.
 *
 * Spec: PROD-003, UD-006
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runClientScripts } from './clientScripts.js';

interface TitleScript {
  hvliGoToField(formOf: () => unknown, path: string, page: object): void;
}

const script = () =>
  runClientScripts<TitleScript>(['editorFieldReveal.js', 'editorFields.js'], { setTimeout });

/** A stand-in for an editor control that is shown and takes focus. */
const control = () => {
  const doc = { activeElement: null as unknown, querySelector: () => null };
  const element = {
    isConnected: true,
    ownerDocument: doc,
    focus: vi.fn(() => void (doc.activeElement = element)),
    matches: () => true,
    checkVisibility: () => true,
    contains: (other: unknown) => other === element,
    classList: { contains: () => false },
    parentElement: { querySelector: (): unknown => null },
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
  };
  return element;
};

/** The page callbacks, with spies. */
const page = () => {
  const fallback = { focus: vi.fn() };
  return {
    fallback: () => fallback,
    notReached: vi.fn(),
    titleNotReached: vi.fn(),
    fallbackFocus: fallback.focus,
  };
};

/** A metadata form whose extra title field is `input` (none when undefined). */
const metadataWith = (input?: ReturnType<typeof control>) => ({
  getExtraTitleField: () => (input ? { $input: [input] } : undefined),
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('[PROD-003] "Gå til feltet" on a title', () => {
  it('[PROD-003] `metadata.title` focuses the activity’s title field, and nothing is reported', () => {
    // Arrange
    const title = control();
    const callbacks = page();
    const form = { children: [{ field: { name: 'question' } }], metadataForm: metadataWith(title) };
    // Act
    script().hvliGoToField(() => form, 'metadata.title', callbacks);
    vi.advanceTimersByTime(500);
    // Assert
    expect(title.focus).toHaveBeenCalledOnce();
    expect(callbacks.notReached).not.toHaveBeenCalled();
    expect(callbacks.titleNotReached).not.toHaveBeenCalled();
    expect(callbacks.fallbackFocus).not.toHaveBeenCalled();
  });

  it('[PROD-003] a sub-content’s `metadata.title` focuses that sub-content’s own title field', () => {
    // Arrange
    const own = control();
    const callbacks = page();
    const question = { field: { name: 'questions' }, children: [], metadataForm: metadataWith(own) };
    const form = { children: [question], metadataForm: metadataWith(control()) };
    // Act
    script().hvliGoToField(() => form, 'questions.metadata.title', callbacks);
    vi.advanceTimersByTime(500);
    // Assert
    expect(own.focus).toHaveBeenCalledOnce();
    expect(callbacks.notReached).not.toHaveBeenCalled();
  });

  it('[UD-006] a sub-content with metadata turned off: the closest part takes focus and the page says why', () => {
    // Arrange
    const part = control();
    const callbacks = page();
    const link = { field: { name: 'action' }, children: [], metadataForm: null, $item: [part] };
    // Act
    script().hvliGoToField(
      () => ({ children: [link], metadataForm: metadataWith() }),
      'action.metadata.title',
      callbacks,
    );
    vi.advanceTimersByTime(500);
    // Assert
    expect(part.focus).toHaveBeenCalledOnce();
    expect(callbacks.titleNotReached).toHaveBeenCalledOnce();
    expect(callbacks.notReached).not.toHaveBeenCalled();
  });

  it('[UD-006] a sub-content whose library is still loading is waited for, not reported as having no title', () => {
    // Arrange: H5P makes the metadata form only once the library has loaded (a slow network or machine)
    const own = control();
    const callbacks = page();
    const question: Record<string, unknown> = { field: { name: 'question' }, children: [], loadLibrary() {} };
    const form = { children: [question], metadataForm: metadataWith(control()) };
    // Act
    script().hvliGoToField(() => form, 'question.metadata.title', callbacks);
    vi.advanceTimersByTime(3000);
    question.metadataForm = metadataWith(own);
    vi.advanceTimersByTime(1000);
    // Assert
    expect(own.focus).toHaveBeenCalledOnce();
    expect(callbacks.titleNotReached).not.toHaveBeenCalled();
    expect(callbacks.notReached).not.toHaveBeenCalled();
  });

  it('[UD-006] a title H5P shows only a moment later is tried again and focused, with nothing reported', () => {
    // Arrange: the first focus finds the field still hidden (a busy machine)
    const title = control();
    title.focus.mockImplementationOnce(() => undefined);
    const callbacks = page();
    const form = { children: [{ field: { name: 'question' } }], metadataForm: metadataWith(title) };
    // Act
    script().hvliGoToField(() => form, 'metadata.title', callbacks);
    vi.advanceTimersByTime(3000);
    // Assert
    expect(title.focus).toHaveBeenCalledTimes(2);
    expect(callbacks.notReached).not.toHaveBeenCalled();
    expect(callbacks.fallbackFocus).not.toHaveBeenCalled();
  });

  it('[UD-006] a title the editor has but cannot show here falls back with the general text', () => {
    // Arrange
    const callbacks = page();
    const form = { children: [{ field: { name: 'question' } }], metadataForm: metadataWith() };
    // Act: after the tries of the grace second
    script().hvliGoToField(() => form, 'metadata.title', callbacks);
    vi.advanceTimersByTime(3000);
    // Assert
    expect(callbacks.fallbackFocus).toHaveBeenCalledOnce();
    expect(callbacks.notReached).toHaveBeenCalledOnce();
    expect(callbacks.titleNotReached).not.toHaveBeenCalled();
  });
});
