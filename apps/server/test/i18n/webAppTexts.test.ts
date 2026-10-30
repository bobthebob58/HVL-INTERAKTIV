/**
 * Tests for the one reader of the web app's Nynorsk texts that the e2e flows and the accessibility suites share
 * (../support/webAppTexts.ts): placeholders filled as the web app's `t()` fills them, an unknown key refused by name,
 * and a pattern that matches the filled text whatever the placeholders hold, without capture groups. The tests name
 * keys of the app's own locale file, never a wording, so rewording a text breaks none of them.
 *
 * Spec: PROD-012, NFR-004
 */
import { describe, expect, it } from 'vitest';
import { webText, webTextPattern } from '../support/webAppTexts.js';

describe('[PROD-012] the web app’s Nynorsk texts as the browser suites read them', () => {
  it('[PROD-012] fills each placeholder by name and leaves one without a value as written, as the web app does', () => {
    // Act
    const filled = webText('studio.catalogueCount', { shown: 3, total: 9 });
    const partly = webText('studio.catalogueCount', { shown: 3 });
    // Assert
    expect(filled).toMatch(/3.*9/);
    expect(filled).not.toContain('{{');
    expect(partly).toContain('{{total}}');
    expect(partly).not.toContain('{{shown}}');
  });

  it('[PROD-012] refuses a key that is not a text, naming it', () => {
    // Act and assert
    expect(() => webText('no.such')).toThrow("the web app's nn.json has no text no.such");
    expect(() => webTextPattern('studio')).toThrow("the web app's nn.json has no text studio");
  });

  it('[PROD-012] matches the filled text whatever its placeholders hold, escapes the rest, and captures nothing', () => {
    // Arrange
    const values = { words: 812, wordLimit: 1500, attachments: 4, attachmentLimit: 10 };
    const pattern = webTextPattern('mappe.wordCountWithin');
    const text = webText('mappe.wordCountWithin', values);
    // Act
    const match = pattern.exec(`✓ ${text}`);
    const other = pattern.test(webText('mappe.wordCountWithin', { ...values, words: 'tusen' }));
    // Assert: one whole match and no group; a `.` in the text is a full stop, not any character
    expect(match?.length).toBe(1);
    expect(other).toBe(true);
    expect(pattern.test(text.replaceAll('.', 'X'))).toBe(!text.includes('.'));
  });
});
