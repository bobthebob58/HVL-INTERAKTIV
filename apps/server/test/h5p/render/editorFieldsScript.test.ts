/**
 * Unit tests for how "Gå til feltet" waits for H5P's editor (src/h5p/render/client/editorFields.js), run without a
 * browser with fake timers: it waits while H5P is still building the field, and gives up soon once nothing loads.
 *
 * Spec: PROD-003, UD-006
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Widget {
  field?: { readonly name: string };
  children?: Widget[];
  currentLibrary?: string;
  $input?: unknown[];
}

interface FieldsScript {
  hvliStillBuilding(form: Widget | undefined, chain: Widget[]): boolean;
  hvliGoToField(formOf: () => Widget | undefined, path: string, fallback: () => { focus(): void }): void;
}

const SOURCE = readFileSync(
  new URL('../../../src/h5p/render/client/editorFields.js', import.meta.url),
  'utf8',
);

const script = (): FieldsScript => {
  const context: Record<string, unknown> = { setTimeout };
  runInNewContext(SOURCE, context);
  return context as unknown as FieldsScript;
};

/** A focusable stand-in for an input element. */
const input = () => {
  const element = { focus: vi.fn(), matches: () => true, querySelector: () => null, closest: () => null };
  return element;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('[UD-006] "Gå til feltet" waits for the editor', () => {
  it('[UD-006] counts as still building: no form, or a sub-content widget whose library has no children yet', () => {
    const { hvliStillBuilding } = script();
    expect(hvliStillBuilding(undefined, [])).toBe(true);
    expect(hvliStillBuilding({}, [{ currentLibrary: 'H5P.MultiChoice 1.16' }])).toBe(true);
    expect(hvliStillBuilding({}, [{ currentLibrary: 'H5P.MultiChoice 1.16', children: [] }])).toBe(false);
    expect(hvliStillBuilding({}, [{ currentLibrary: '-' }])).toBe(false);
    expect(hvliStillBuilding({ children: [] }, [])).toBe(false);
    expect(hvliStillBuilding({}, [{ field: { name: 'text' } }])).toBe(false);
  });

  it('[PROD-003] keeps waiting for as long as a library loads, then focuses the field', () => {
    // Arrange: a question whose library takes 8 s to load
    const control = input();
    const question: Widget = { field: { name: 'questions' }, currentLibrary: 'H5P.MultiChoice 1.16' };
    const form: Widget = { children: [question] };
    const fallback = { focus: vi.fn() };
    const { hvliGoToField } = script();
    // Act
    hvliGoToField(
      () => form,
      'questions.params.question',
      () => fallback,
    );
    vi.advanceTimersByTime(8_000);
    question.children = [{ field: { name: 'question' }, $input: [control] }];
    vi.advanceTimersByTime(1_000);
    // Assert
    expect(control.focus).toHaveBeenCalledOnce();
    expect(fallback.focus).not.toHaveBeenCalled();
  });

  it('[PROD-003] a path that leads no further once everything is built gives up after a second', () => {
    // Arrange
    const fallback = { focus: vi.fn() };
    const { hvliGoToField } = script();
    // Act
    hvliGoToField(
      () => ({ children: [{ field: { name: 'text' } }] }),
      'metadata.defaultLanguage',
      () => fallback,
    );
    vi.advanceTimersByTime(1_500);
    // Assert
    expect(fallback.focus).toHaveBeenCalledOnce();
  });

  it('[PROD-003] never waits longer than twenty seconds, even if a library never loads', () => {
    // Arrange
    const fallback = { focus: vi.fn() };
    const stuck: Widget = { children: [{ field: { name: 'questions' }, currentLibrary: 'H5P.Blanks 1.14' }] };
    const { hvliGoToField } = script();
    // Act
    hvliGoToField(
      () => stuck,
      'questions.params.text',
      () => fallback,
    );
    vi.advanceTimersByTime(19_000);
    const early = fallback.focus.mock.calls.length;
    vi.advanceTimersByTime(2_000);
    // Assert
    expect(early).toBe(0);
    expect(fallback.focus).toHaveBeenCalledOnce();
  });
});
