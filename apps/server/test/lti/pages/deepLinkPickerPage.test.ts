/**
 * Unit tests for the Deep Linking picker's HTML: radio buttons or checkboxes, disabled drafts with their reason in
 * text, the formative note for graded placements, escaping, the locale, the error summary at the top and the Hjelp
 * header.
 *
 * Spec: LTI-005, PROD-005, PROD-011, UD-013
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/i18n/translate.js';
import { deepLinkPickerPage } from '../../../src/lti/pages/deepLinkPickerPage.js';

const published = { id: 'a1', title: 'Brøkar', mainLibrary: 'H5P.MultiChoice', selectable: true };
const draft = { id: 'd1', title: 'Utkast', mainLibrary: 'H5P.Blanks', selectable: false };
const page = (overrides: Partial<Parameters<typeof deepLinkPickerPage>[0]> = {}) =>
  deepLinkPickerPage({
    locale: 'nn',
    activities: [published, draft],
    multiple: false,
    graded: false,
    ...overrides,
  });

describe('deepLinkPickerPage', () => {
  it('[LTI-005] offers radio buttons when the platform takes one item, checkboxes when it takes several', () => {
    expect(page()).toContain('type="radio"');
    expect(page()).not.toContain('type="checkbox"');
    expect(page({ multiple: true })).toContain('type="checkbox"');
  });

  it('[PROD-005] a draft is disabled and its reason is tied to the input in text', () => {
    const html = page();
    expect(html).toContain('value="d1" disabled aria-describedby="activity-1-draft"');
    expect(html).toContain(`<span id="activity-1-draft">(${t('deepLink.draft', {}, 'nn')})</span>`);
    expect(html).not.toMatch(/value="a1"[^>]*disabled/);
  });

  it('[LTI-005] a graded placement says the points are formative', () => {
    expect(page({ graded: true })).toContain(t('deepLink.graded', {}, 'nn'));
    expect(page()).not.toContain(t('deepLink.graded', {}, 'nn'));
  });

  it('[LTI-005] titles are escaped', () => {
    const html = page({ activities: [{ ...published, title: '<img src=x onerror=alert(1)>' }] });
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img');
  });

  it('[PROD-005] with no activities the page says so and has no form', () => {
    const html = page({ activities: [] });
    expect(html).toContain(t('deepLink.empty', {}, 'nn'));
    expect(html).not.toContain('<form');
  });

  it('[LTI-005] the page is in the launch’s language and hands its script the texts it shows', () => {
    const html = page({ locale: 'en' });
    expect(html).toContain('<html lang="en">');
    expect(html).toContain(`data-msg-failed="${t('deepLink.failed', {}, 'en')}"`);
    expect(html).toContain('<script src="/static/lti/deepLinkPicker.js" defer></script>');
  });

  it('[PROD-011] shows the formative-use notice with its version, and none once it is dismissed', () => {
    const shown = page({ noticeVersion: 1 });
    expect(shown).toContain(t('notice.formativeUse.body', {}, 'nn'));
    expect(shown).toContain('<button type="button" data-notice-version="1">');
    expect(shown).toContain('aria-labelledby="formative-notice-title"');
    expect(page()).not.toContain('formative-notice');
  });
});

describe('[UD-013] picker errors and help', () => {
  it('[UD-013] has an empty, hidden error summary right below the heading, before the form', () => {
    // Act
    const html = page();
    // Assert
    const summary = html.indexOf(
      '<div id="deep-link-errors" class="hvl-error-summary" role="alert" tabindex="-1"',
    );
    expect(summary).toBeGreaterThan(html.indexOf('</h1>'));
    expect(summary).toBeLessThan(html.indexOf('<form'));
    expect(html).toContain('aria-labelledby="deep-link-errors-title" hidden>');
    expect(html).toContain(
      `<h2 id="deep-link-errors-title">${t('deepLink.errorSummaryTitle', {}, 'nn')}</h2>`,
    );
    expect(html).toContain('<span aria-hidden="true">✗ </span><span id="deep-link-error"></span>');
    expect(html.indexOf('id="deep-link-error"')).toBeLessThan(html.indexOf('<form'));
    expect(html).toContain('<p id="deep-link-status" role="status"></p>');
  });

  it('[UD-013] has no error summary when there is no form', () => {
    expect(page({ activities: [] })).not.toContain('deep-link-errors');
  });

  it('[UD-013] shows the Hjelp header, opening a new tab, only when the route passes it', () => {
    expect(page({ help: { newTab: true } })).toContain(
      '<a href="/hjelp" target="_blank" rel="noopener noreferrer">',
    );
    expect(page()).not.toContain('/hjelp');
  });
});
