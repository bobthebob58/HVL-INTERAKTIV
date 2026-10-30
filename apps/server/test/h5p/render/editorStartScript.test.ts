/**
 * Unit tests for the editor page's start script (src/h5p/render/client/editorStart.js), run without a browser
 * against stand-ins for H5P's editor: the page hears that H5P's editor can save only once it really can, and the
 * editor's namespace and iframe are set up as before the script was split out of editorPage.js.
 *
 * Spec: H5P-007, UD-006
 */
import { describe, expect, it } from 'vitest';
import { runClientScripts } from './clientScripts.js';

interface StartScript {
  hvliConfigureEditor(
    ns: Record<string, unknown>,
    settings: Record<string, unknown>,
    contentId: string,
  ): void;
  hvliEditorCanSave(editor: unknown): boolean;
  hvliStartEditor(ns: unknown, options: Record<string, unknown>): Record<string, unknown>;
}

/** What `getContent` reads once H5P's editor is built (h5peditor-editor.js). */
const BUILT = { iframeWindow: { H5PEditor: {} }, selector: { form: { metadataForm: {} } } };

/** A stand-in page: `H5P.externalDispatcher` that records listeners, and the editor iframe H5P inserts. */
function standInPage(frameTitle: string | null) {
  const listeners: Record<string, (() => void)[]> = {};
  const dispatcher = {
    on: (type: string, listener: () => void) =>
      void (listeners[type] = [...(listeners[type] ?? []), listener]),
    trigger: (type: string) => (listeners[type] ?? []).forEach((listener) => listener()),
  };
  const attributes: Record<string, string> = frameTitle === null ? {} : { title: frameTitle };
  const frame = {
    contentWindow: {},
    getAttribute: (name: string) => attributes[name] ?? null,
    setAttribute: (name: string, value: string) => void (attributes[name] = value),
  };
  const window = { H5P: { externalDispatcher: dispatcher } };
  const script = runClientScripts<StartScript>(['editorStart.js'], {
    window,
    document: { querySelector: () => frame },
  });
  return { script, dispatcher, listeners, attributes };
}

describe('[H5P-007] the editor page hears when H5P’s editor can save', () => {
  it('[H5P-007] is not ready on editorload, and ready on editorloaded only once the form is built', () => {
    // Arrange
    const page = standInPage('Aktivitet');
    const seen: boolean[] = [];
    let listenersAtCreation = 0;
    class Editor {
      constructor() {
        listenersAtCreation = Object.values(page.listeners).flat().length;
      }
    }
    const ns = { Editor };
    // Act
    const editor = page.script.hvliStartEditor(ns, {
      library: 'H5P.MultiChoice 1.16',
      params: '{}',
      container: {},
      frameTitle: 'H5P-redigering: ny aktivitet',
      onReadiness: (canSave: boolean) => seen.push(canSave),
    });
    page.dispatcher.trigger('editorload');
    page.dispatcher.trigger('editorloaded');
    Object.assign(editor, BUILT);
    page.dispatcher.trigger('editorload');
    page.dispatcher.trigger('editorloaded');
    // Assert
    expect(editor).toBeInstanceOf(Editor);
    expect(listenersAtCreation).toBe(2);
    expect(seen).toEqual([false, false, false, true]);
  });

  it('[H5P-007] cannot save without the iframe’s H5PEditor, a form, or the form’s metadata form', () => {
    // Arrange
    const { script } = standInPage(null);
    // Act
    const cases = [
      undefined,
      {},
      { ...BUILT, iframeWindow: {} },
      { ...BUILT, selector: {} },
      { ...BUILT, selector: { form: {} } },
      BUILT,
    ].map((editor) => script.hvliEditorCanSave(editor));
    // Assert
    expect(cases).toEqual([false, false, false, false, false, true]);
  });

  it('[UD-006] names the editor iframe until the activity has a title, and keeps a title H5P gave it', () => {
    // Arrange
    const untitled = standInPage(null);
    const titled = standInPage('Kva er fotosyntese?');
    const options = {
      container: {},
      frameTitle: 'H5P-redigering: ny aktivitet',
      onReadiness: () => undefined,
    };
    const ns = { Editor: class Editor {} };
    // Act
    untitled.script.hvliStartEditor(ns, options);
    titled.script.hvliStartEditor(ns, options);
    // Assert
    expect(untitled.attributes.title).toBe('H5P-redigering: ny aktivitet');
    expect(titled.attributes.title).toBe('Kva er fotosyntese?');
  });

  it('[H5P-007] points H5P’s namespace at the page’s settings and builds AJAX URLs as H5P’s own init does', () => {
    // Arrange
    const { script } = standInPage(null);
    const ns: Record<string, unknown> = {};
    const settings = { ajaxPath: '/h5p/ajax?action=', libraryUrl: '/h5p/editor/', language: 'nn' };
    // Act
    script.hvliConfigureEditor(ns, settings, 'c1');
    const getAjaxUrl = ns.getAjaxUrl as (action: string, parameters?: Record<string, string>) => string;
    // Assert
    expect([ns.contentId, ns.basePath, ns.contentLanguage, ns.enableContentHub]).toEqual([
      'c1',
      '/h5p/editor/',
      'nn',
      false,
    ]);
    expect(getAjaxUrl('libraries', { machineName: 'H5P.MultiChoice', majorVersion: '1' })).toBe(
      '/h5p/ajax?action=libraries&machineName=H5P.MultiChoice&majorVersion=1',
    );
    expect(getAjaxUrl('content-type-cache')).toBe('/h5p/ajax?action=content-type-cache');
  });
});
