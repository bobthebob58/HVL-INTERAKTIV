/**
 * Tests for the outer editor page's assets: H5P Core and the iframe creator stay, the editor's form and widget
 * scripts and its styles stay inside the iframe.
 *
 * Spec: H5P-002, LTI-006
 */
import { describe, expect, it } from 'vitest';
import { outerPageAssets } from '../../../src/h5p/render/editorAssets.js';

const BASE = '/h5p/editor/';

describe('[LTI-006] outer editor page assets', () => {
  it('[LTI-006] keeps core files, the iframe creator, the language file and our additions, in order', () => {
    // Arrange
    const scripts = [
      '/h5p/core/js/jquery.js?version=1.28.0',
      '/h5p/core/js/h5p.js?version=1.28.0',
      `${BASE}scripts/h5peditor-editor.js?version=1.28.0`,
      `${BASE}scripts/h5peditor.js?version=1.28.0`,
      `${BASE}language/nn.js?version=1.28.0`,
      `${BASE}scripts/h5peditor-text.js?version=1.28.0`,
      `${BASE}ckeditor5/ckeditor.js?version=1.28.0`,
      '/h5p/core/js/h5p-tooltip.js?version=1.28.0',
    ];
    // Act
    const assets = outerPageAssets({ scripts, styles: [] }, BASE);
    // Assert
    expect(assets.scripts).toEqual([
      '/h5p/core/js/jquery.js?version=1.28.0',
      '/h5p/core/js/h5p.js?version=1.28.0',
      `${BASE}scripts/h5peditor-editor.js?version=1.28.0`,
      `${BASE}language/nn.js?version=1.28.0`,
      '/h5p/core/js/h5p-tooltip.js?version=1.28.0',
    ]);
  });

  it('[H5P-002] drops the editor’s styles and keeps the others', () => {
    const styles = [
      '/h5p/core/styles/h5p.css',
      `${BASE}styles/css/application.css`,
      '/h5p/core/styles/h5p-theme.css',
    ];
    expect(outerPageAssets({ scripts: [], styles }, BASE).styles).toEqual([
      '/h5p/core/styles/h5p.css',
      '/h5p/core/styles/h5p-theme.css',
    ]);
  });

  it('[LTI-006] a look-alike outside the editor folder is not mistaken for the iframe creator', () => {
    const scripts = [`${BASE}scripts/h5peditor-editor.js.map`, `${BASE}language/../scripts/x.js`];
    expect(outerPageAssets({ scripts, styles: [] }, BASE).scripts).toEqual([]);
  });
});
