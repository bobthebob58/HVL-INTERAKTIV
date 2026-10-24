/**
 * Unit tests for how "Gå til feltet" follows a finding's path through H5P's editor widgets
 * (src/h5p/render/client/editorFields.js), run without a browser: path tokens, lists, groups and sub-content,
 * one-field groups whose value H5P stores as the group's own, and InteractiveVideo's interactions, including
 * going from one open interaction form to another.
 *
 * Spec: PROD-003, UD-006
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

interface Widget {
  readonly field?: { readonly name: string };
  readonly children?: readonly Widget[];
  readonly currentLibrary?: string;
  readonly IV?: { readonly interactions: readonly Widget[] };
  openInteractionDialog?(): void;
  hasSingleChild?(): boolean;
  isSubContent?(): boolean;
  forEachChild?(task: (child: Widget, index: number) => unknown): void;
}

interface Chain {
  readonly widgets: Widget[];
  readonly used: number;
}

interface FieldsScript {
  hvliFieldTokens(path: string): (string | number)[];
  hvliFieldChain(form: Widget, tokens: (string | number)[]): Chain;
  hvliOpenStep(parent: object, widget: object): boolean;
}

const SOURCE = readFileSync(
  new URL('../../../src/h5p/render/client/editorFields.js', import.meta.url),
  'utf8',
);

/** Runs the script, which only defines its functions. */
const script = (): FieldsScript => {
  const context: Record<string, unknown> = { setTimeout };
  runInNewContext(SOURCE, context);
  return context as unknown as FieldsScript;
};

describe('[UD-006] "Gå til feltet" follows a finding path through the editor', () => {
  it('[UD-006] splits a path into field names and list positions, leaving out sub-content `params`', () => {
    // Arrange
    const { hvliFieldTokens } = script();
    // Act and assert
    expect(hvliFieldTokens('content[1].content.params.alt')).toEqual(['content', 1, 'content', 'alt']);
    expect(hvliFieldTokens('questions[0].params.behaviour.feedbackOnWrong')).toEqual([
      'questions',
      0,
      'behaviour',
      'feedbackOnWrong',
    ]);
    expect(hvliFieldTokens('a[2][3]')).toEqual(['a', 2, 3]);
    expect(hvliFieldTokens('paramsList[0].params')).toEqual(['paramsList', 0]);
    expect(hvliFieldTokens('')).toEqual([]);
  });

  it('[UD-006] walks lists, groups and sub-content to the field and stops where the path leaves the form', () => {
    // Arrange: a Column form whose second item holds an image sub-content with an alt field.
    const alt: Widget = { field: { name: 'alt' } };
    const image: Widget = {
      field: { name: 'content' },
      currentLibrary: 'H5P.Image 1.1',
      children: [{ field: { name: 'file' } }, alt],
    };
    const item: Widget = {
      field: { name: 'content' },
      children: [image, { field: { name: 'useSeparator' } }],
    };
    const first: Widget = { field: { name: 'content' }, children: [] };
    const list: Widget = {
      field: { name: 'content' },
      forEachChild: (task) => [first, item].forEach((child, index) => task(child, index)),
    };
    const form: Widget = { children: [list] };
    const { hvliFieldChain, hvliFieldTokens } = script();
    // Act
    const chain = hvliFieldChain(form, hvliFieldTokens('content[1].content.params.alt'));
    const partial = hvliFieldChain(form, hvliFieldTokens('content[1].missing.alt'));
    // Assert
    expect(chain).toEqual({ widgets: [list, item, image, alt], used: 4 });
    expect(partial).toEqual({ widgets: [list, item], used: 2 });
    expect(hvliFieldChain(form, hvliFieldTokens('metadata.defaultLanguage'))).toEqual({
      widgets: [],
      used: 0,
    });
  });

  it('[PROD-003] passes through a one-field group, whose value H5P stores as the group’s own (a book page)', () => {
    // Arrange: chapters[1] is a group of one library field; the path names the library's fields directly
    const text: Widget = { field: { name: 'text' } };
    const page: Widget = { field: { name: 'chapter' }, currentLibrary: 'H5P.Column 1.22', children: [text] };
    const group = (child: Widget): Widget => ({
      field: { name: 'item' },
      children: [child],
      hasSingleChild: () => true,
      isSubContent: () => false,
    });
    const chapters: Widget = { field: { name: 'chapters' }, children: [group({}), group(page)] };
    const { hvliFieldChain, hvliFieldTokens } = script();
    // Act
    const chain = hvliFieldChain({ children: [chapters] }, hvliFieldTokens('chapters[1].params.text'));
    // Assert
    expect(chain.used).toBe(3);
    expect(chain.widgets.slice(2)).toEqual([page, text]);
  });

  it('[PROD-003] finds an InteractiveVideo interaction’s widgets on the player’s interaction', () => {
    // Arrange
    const question: Widget = { field: { name: 'question' } };
    const action: Widget = {
      field: { name: 'action' },
      currentLibrary: 'H5P.MultiChoice 1.16',
      children: [question],
    };
    const interaction: Widget = { children: [{ field: { name: 'pause' } }, action] };
    const assets: Widget = {
      field: { name: 'assets' },
      IV: { interactions: [interaction] },
      openInteractionDialog() {},
    };
    const { hvliFieldChain, hvliFieldTokens } = script();
    // Act
    const path = 'assets.interactions[0].action.params.question';
    const chain = hvliFieldChain({ children: [assets] }, hvliFieldTokens(path));
    // Assert
    expect(chain.used).toBe(5);
    expect(chain.widgets.slice(2)).toEqual([interaction, action, question]);
  });

  it('[PROD-003] closes another open interaction form as its first breadcrumb does, then opens the one asked for', () => {
    // Arrange: another interaction's form is open, and once closed it still slides out for a moment
    const state = { rootForm: false, closing: true };
    const home = { click: vi.fn(() => void (state.rootForm = true)) };
    const manager = {
      classList: {
        contains: (name: string) => name === 'form-manager' || (name === 'root-form' && state.rootForm),
      },
      querySelector: (selector: string) =>
        selector.includes('.clickable') ? home : state.closing ? {} : null,
    };
    const editor = { dnb: {}, $item: [{ closest: () => manager }], openInteractionDialog: vi.fn() };
    const interaction = { $form: [{ isConnected: false }] };
    const { hvliOpenStep } = script();
    // Act
    const whileClosing = hvliOpenStep({ hvliInteractionsOf: editor }, interaction);
    state.closing = false;
    const once = hvliOpenStep({ hvliInteractionsOf: editor }, interaction);
    // Assert: the old form is closed once, and the new one opens only after it has gone
    expect(home.click).toHaveBeenCalledOnce();
    expect([whileClosing, once]).toEqual([true, false]);
    expect(editor.openInteractionDialog).toHaveBeenCalledOnce();
    expect(editor.openInteractionDialog).toHaveBeenCalledWith(interaction);
  });
});
