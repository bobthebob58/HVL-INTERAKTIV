/**
 * Unit tests for how "Gå til feltet" waits for H5P's editor and where focus lands
 * (src/h5p/render/client/editorFields.js), run without a browser with fake timers: it waits while H5P is still
 * building the field, gives up soon once nothing loads, focuses only a control that is shown and takes focus
 * (CKEditor's editable where it stands in for a rich-text field), and says so whenever focus lands anywhere but
 * the field itself.
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
  $group?: unknown[];
  hvliInteractionsOf?: { dnb?: unknown };
}

interface Page {
  fallback(): { focus(): void };
  notReached(): void;
}

interface FieldsScript {
  hvliStillBuilding(form: Widget | undefined, chain: Widget[]): boolean;
  hvliGoToField(formOf: () => Widget | undefined, path: string, page: Page): void;
}

// WHY: the page loads ./editorFieldReveal.js before editorFields.js; both define page-level functions.
const SOURCE = ['editorFieldReveal.js', 'editorFields.js']
  .map((name) => readFileSync(new URL(`../../../src/h5p/render/client/${name}`, import.meta.url), 'utf8'))
  .join('\n');

const script = (): FieldsScript => {
  const context: Record<string, unknown> = { setTimeout };
  runInNewContext(SOURCE, context);
  return context as unknown as FieldsScript;
};

/** A stand-in for an editor control; `shown` and `takes` say whether it is rendered and accepts focus. */
const control = (shown = true, takes = true, inside: unknown[] = [], classes: string[] = []) => {
  const doc = { activeElement: null as unknown, querySelector: () => null };
  const element = {
    ownerDocument: doc,
    focus: vi.fn(() => void (takes && (doc.activeElement = element))),
    matches: () => true,
    checkVisibility: () => shown,
    contains: (other: unknown) => other === element,
    classList: { contains: (name: string) => classes.includes(name) },
    parentElement: { querySelector: (): unknown => null },
    querySelector: () => null,
    querySelectorAll: () => inside,
    closest: () => null,
  };
  return element;
};

/** The page callbacks, with spies. */
const page = () => {
  const fallback = { focus: vi.fn() };
  return { fallback: () => fallback, notReached: vi.fn(), fallbackFocus: fallback.focus };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('[UD-006] "Gå til feltet" waits for the editor', () => {
  it('[UD-006] counts as still building: no form, a library with no children yet, or IV with no toolbar', () => {
    const { hvliStillBuilding } = script();
    expect(hvliStillBuilding(undefined, [])).toBe(true);
    expect(hvliStillBuilding({}, [{ currentLibrary: 'H5P.MultiChoice 1.16' }])).toBe(true);
    expect(hvliStillBuilding({}, [{ currentLibrary: 'H5P.MultiChoice 1.16', children: [] }])).toBe(false);
    expect(hvliStillBuilding({}, [{ currentLibrary: '-' }])).toBe(false);
    expect(hvliStillBuilding({ children: [] }, [])).toBe(false);
    expect(hvliStillBuilding({}, [{ field: { name: 'text' } }])).toBe(false);
    expect(hvliStillBuilding({}, [{ hvliInteractionsOf: {} }, {}])).toBe(true);
    expect(hvliStillBuilding({}, [{ hvliInteractionsOf: { dnb: {} } }, {}])).toBe(false);
  });

  it('[PROD-003] keeps waiting for as long as a library loads, then focuses the field', () => {
    // Arrange: a question whose library takes 8 s to load
    const field = control();
    const question: Widget = { field: { name: 'questions' }, currentLibrary: 'H5P.MultiChoice 1.16' };
    const form: Widget = { children: [question] };
    const callbacks = page();
    const { hvliGoToField } = script();
    // Act
    hvliGoToField(() => form, 'questions.params.question', callbacks);
    vi.advanceTimersByTime(8_000);
    question.children = [{ field: { name: 'question' }, $input: [field] }];
    vi.advanceTimersByTime(1_000);
    // Assert
    expect(field.focus).toHaveBeenCalledOnce();
    expect(callbacks.fallbackFocus).not.toHaveBeenCalled();
    expect(callbacks.notReached).not.toHaveBeenCalled();
  });

  it('[PROD-003] a path that leads no further once everything is built gives up after a second', () => {
    // Arrange
    const callbacks = page();
    const { hvliGoToField } = script();
    // Act
    hvliGoToField(() => ({ children: [{ field: { name: 'text' } }] }), 'metadata.defaultLanguage', callbacks);
    vi.advanceTimersByTime(1_500);
    // Assert
    expect(callbacks.fallbackFocus).toHaveBeenCalledOnce();
    expect(callbacks.notReached).toHaveBeenCalledOnce();
  });

  it('[PROD-003] never waits longer than twenty seconds, even if a library never loads', () => {
    // Arrange
    const callbacks = page();
    const stuck: Widget = { children: [{ field: { name: 'questions' }, currentLibrary: 'H5P.Blanks 1.14' }] };
    const { hvliGoToField } = script();
    // Act
    hvliGoToField(() => stuck, 'questions.params.text', callbacks);
    vi.advanceTimersByTime(19_000);
    const early = callbacks.fallbackFocus.mock.calls.length;
    vi.advanceTimersByTime(2_000);
    // Assert
    expect(early).toBe(0);
    expect(callbacks.fallbackFocus).toHaveBeenCalledOnce();
  });
});

describe('[UD-006] "Gå til feltet" never leaves focus where it was dropped', () => {
  it('[UD-006] a field in a closed part gives focus to the closest shown part and says so', () => {
    // Arrange: the field's control is hidden (a closed tab), its group's title is shown
    const hidden = control(false);
    const title = control(true);
    const group = { ...control(true, true, [title]), matches: () => false };
    const form: Widget = { children: [{ field: { name: 'g' }, $group: [group], children: [] }] };
    form.children?.[0]?.children?.push({ field: { name: 'alt' }, $input: [hidden] });
    const callbacks = page();
    // Act
    script().hvliGoToField(() => form, 'g.alt', callbacks);
    vi.advanceTimersByTime(500);
    // Assert
    expect(hidden.focus).not.toHaveBeenCalled();
    expect(title.focus).toHaveBeenCalledOnce();
    expect(callbacks.notReached).toHaveBeenCalledOnce();
  });

  it('[UD-006] a group H5P never rendered with a title (a RangeList row) is passed without expand()', () => {
    // Arrange: Group.expand() reads its title, which such a row lacks
    const feedback = control();
    const row = {
      field: { name: 'row' },
      expand: vi.fn(),
      children: [{ field: { name: 'feedback' }, $input: [feedback] }],
    };
    const callbacks = page();
    // Act
    script().hvliGoToField(() => ({ children: [row] }), 'row.feedback', callbacks);
    vi.advanceTimersByTime(500);
    // Assert
    expect(row.expand).not.toHaveBeenCalled();
    expect(feedback.focus).toHaveBeenCalledOnce();
    expect(callbacks.notReached).not.toHaveBeenCalled();
  });

  it('[UD-006] a rich-text field CKEditor has taken over is focused in the editor’s editable, not passed over', () => {
    // Arrange: CKEditor hides the field's own `.ckeditor` element and shows its editable next to it
    const editable = control();
    const source = control(false, true, [], ['ckeditor']);
    source.parentElement.querySelector = () => editable;
    const callbacks = page();
    // Act
    script().hvliGoToField(
      () => ({ children: [{ field: { name: 'text' }, $input: [source] }] }),
      'text',
      callbacks,
    );
    vi.advanceTimersByTime(500);
    // Assert
    expect(source.focus).not.toHaveBeenCalled();
    expect(editable.focus).toHaveBeenCalledOnce();
    expect(callbacks.notReached).not.toHaveBeenCalled();
  });

  it('[UD-006] when no control takes focus, the fallback takes it and the page is told', () => {
    // Arrange: the control is shown but refuses focus (e.g. inert)
    const refusing = control(true, false);
    const form: Widget = { children: [{ field: { name: 'alt' }, $input: [refusing] }] };
    const callbacks = page();
    // Act
    script().hvliGoToField(() => form, 'alt', callbacks);
    vi.advanceTimersByTime(500);
    // Assert
    expect(refusing.focus).toHaveBeenCalledOnce();
    expect(callbacks.fallbackFocus).toHaveBeenCalledOnce();
    expect(callbacks.notReached).toHaveBeenCalledOnce();
  });
});
