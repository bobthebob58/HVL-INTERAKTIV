/**
 * Tests for our editor page template: no inline script, inert and escaped JSON blocks, the page language and title,
 * a save button with a polite status region, the server pages' stylesheet, and only same-origin first scripts.
 *
 * Spec: SEC-008, H5P-007, UD-010, DATA-011, PROD-003, UD-002
 */
import type { IIntegration } from '@lumieducation/h5p-server';
import { describe, expect, it } from 'vitest';
import { renderEditorPage, type EditorPageInput } from '../../../src/h5p/render/editorPage.js';
import { t } from '../../../src/i18n/translate.js';
import { inlineScriptTags, integrationFromPage } from '../../support/playerIntegration.js';

/** The messages the page hands its script. */
interface Messages {
  readonly blocked: string;
  readonly goToField: string;
  readonly errorLabel: string;
  readonly fieldNotReached: string;
}

const input = (over: Partial<EditorPageInput> = {}): EditorPageInput => ({
  integration: {
    editor: { language: 'nn' },
    l10n: { title: '</script><script>alert(1)</script>' },
  } as unknown as IIntegration,
  scripts: ['/h5p/core/js/jquery.js?version=1.28.0'],
  styles: ['/h5p/core/styles/h5p.css?version=1.28.0'],
  contentId: 'c1',
  token: { name: 'csrf', value: 'tok"en' },
  ...over,
});

describe('[SEC-008] editor page template', () => {
  it('[SEC-008] has no inline script and keeps markup in the data inert and unchanged', () => {
    // Act
    const html = renderEditorPage(input(), 'nn');
    // Assert
    expect(inlineScriptTags(html)).toEqual([]);
    expect(html.match(/<script>alert/g)).toBeNull();
    expect(integrationFromPage<{ l10n: { title: string } }>(html)?.l10n.title).toBe(
      '</script><script>alert(1)</script>',
    );
    const config = JSON.parse(/id="hvl-editor-config">(.*?)<\/script>/s.exec(html)?.[1] ?? '{}') as {
      token: { value: string };
    };
    expect(config.token.value).toBe('tok"en');
  });

  it('[UD-010] names the page language and title and offers one save button with a polite status region', () => {
    const html = renderEditorPage(input(), 'en');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Edit activity</title>');
    expect(html).toContain('<button type="button" id="hvl-editor-save" disabled>Save</button>');
    expect(html).toContain('<p id="hvl-editor-status" role="status" aria-live="polite"></p>');
    expect(html).toContain('<div class="hvl-error-summary" hidden><ul id="hvl-editor-findings"></ul></div>');
  });

  it('[UD-002] links the server pages’ stylesheet after H5P’s styles, so its own controls use the tokens', () => {
    const html = renderEditorPage(input(), 'nn');
    const own = html.indexOf('<link rel="stylesheet" href="/static/pages/serverPages.css">');
    expect(own).toBeGreaterThan(html.indexOf('href="/h5p/core/styles/h5p.css?version=1.28.0"'));
    expect(html).toContain('<main class="hvl-editor">');
  });

  it('[PROD-003] hands the script the blocked-save count message in the page language, with the count left open', () => {
    const html = renderEditorPage(input(), 'nb');
    const config = JSON.parse(/id="hvl-editor-config">(.*?)<\/script>/s.exec(html)?.[1] ?? '{}') as {
      messages: { blockedErrors: string };
    };
    expect(config.messages.blockedErrors).toBe('Feil som må rettes eller begrunnes: {{count}}.');
  });

  it('[PROD-003] tells a Canvas author to fix the errors, and only a portal author that unpublishing is possible', () => {
    // Arrange
    const messagesOf = (html: string) =>
      (
        JSON.parse(/id="hvl-editor-config">(.*?)<\/script>/s.exec(html)?.[1] ?? '{}') as {
          messages: Messages;
        }
      ).messages;
    // Act
    const portal = messagesOf(renderEditorPage(input(), 'nn'));
    const canvas = messagesOf(renderEditorPage(input({ token: { name: 'ltik', value: 'l' } }), 'nn'));
    // Assert
    expect(portal.blocked).toBe(t('page.editor.blockedSave', {}, 'nn'));
    expect(canvas.blocked).toBe(t('page.editor.blockedSaveCanvas', {}, 'nn'));
    expect(canvas.blocked).not.toMatch(/utkast/);
    expect(portal.blocked).toMatch(/utkast/);
    expect([canvas.goToField, canvas.errorLabel, canvas.fieldNotReached]).toEqual([
      'Gå til feltet',
      'Feil',
      t('page.editor.fieldNotReached', {}, 'nn'),
    ]);
  });

  it('[DATA-011] loads the data blocks, then the boot script, then H5P, and our editor boot script last', () => {
    // Act
    const html = renderEditorPage(input({ firstScripts: ['/static/lti/ltikLanding.js'] }), 'nn');
    // Assert
    const order = [
      '/static/lti/ltikLanding.js',
      'id="h5p-integration"',
      'id="hvl-editor-config"',
      '/h5p/boot/h5pIntegration.js',
      'jquery.js',
      '/h5p/boot/editorPage.js',
    ];
    const positions = order.map((needle) => html.indexOf(needle));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('[DATA-011] refuses a first script that is not one of our static files', () => {
    for (const src of ['https://evil.example/x.js', '/static/../h5p/x.js', '/h5p/ajax.js']) {
      expect(() => renderEditorPage(input({ firstScripts: [src] }), 'nn')).toThrow(/invalid script path/);
    }
  });
});
