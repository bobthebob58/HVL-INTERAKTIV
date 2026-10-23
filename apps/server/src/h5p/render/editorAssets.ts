/**
 * editorAssets — which of Lumi's editor assets the outer editor page loads, as opposed to the editor's iframe.
 *
 * Why: Lumi lists one set of editor scripts for both. On the outer page, H5P's `h5peditor.js` copies settings from
 *      `window.parent`, which is Canvas (another origin) when Canvas frames the page, so it throws and every widget
 *      script after it fails. H5P's own integrations load only the iframe creator and its language file outside
 *      the iframe; the rest (form, widgets, CKEditor, hub client) runs inside it from `H5PIntegration.editor.assets`.
 * Spec: H5P-002, LTI-006
 * Invariants:
 *   - Scripts outside the editor folder (H5P Core, our additions) are kept, in order.
 *   - From the editor folder only `scripts/h5peditor-editor.js` and `language/<code>.js` are kept.
 *   - Styles from the editor folder are dropped (the iframe loads its own); others are kept.
 *   - `H5PIntegration.editor.assets` is not changed: the iframe still gets the full list.
 * Collaborators: ../../http/editorView.ts, ./editorPage.ts.
 * Tests: apps/server/test/h5p/render/editorAssets.test.ts
 */

const OUTER_EDITOR_SCRIPT = /^(?:scripts\/h5peditor-editor\.js|language\/[\w-]+\.js)(?:\?|$)/;

/** The outer page's assets. */
export interface OuterPageAssets {
  readonly scripts: string[];
  readonly styles: string[];
}

/**
 * Filters Lumi's editor asset lists for the outer page.
 * @param model - Lumi's lists.
 * @param editorBase - Where the editor's own files are served, e.g. `/h5p/editor/`.
 * @returns The scripts and styles the outer page loads.
 */
export function outerPageAssets(
  model: { readonly scripts: readonly string[]; readonly styles: readonly string[] },
  editorBase: string,
): OuterPageAssets {
  const inEditor = (url: string) => url.startsWith(editorBase);
  return {
    scripts: model.scripts.filter(
      (src) => !inEditor(src) || OUTER_EDITOR_SCRIPT.test(src.slice(editorBase.length)),
    ),
    styles: model.styles.filter((href) => !inEditor(href)),
  };
}
